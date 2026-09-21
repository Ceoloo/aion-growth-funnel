import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { assessmentSummaryText } from "../canonical";
import { serverEnv } from "../env";
import { GhlClient, StaticLocationTokenProvider, postInboundWorkflowEvent } from "../ghl/client";
import { resolveGhlConfig, type GhlConfig } from "../ghl/config";
import { buildAssessmentEvent } from "../ghl/event";
import {
  contactUpsertPayload,
  noteMarker,
  opportunityName,
  tagsFor,
} from "../ghl/mapping";
import { backoffDelayMs, IntegrationError } from "../http";
import { logger } from "../logger";
import { getStore } from "../store";
import {
  newStepState,
  type DeliveryStepName,
  type DeliveryStepState,
  type SubmissionRecord,
  type SubmissionStatus,
} from "../store/types";

/**
 * Delivery runner.
 *
 * Every submission is already durably stored before this runs. The runner
 * walks a fixed list of steps, persisting the outcome of each one, so a retry
 * resumes from the first step that is not yet `done` instead of replaying work
 * that already succeeded.
 *
 * Nothing here claims exactly-once delivery. GoHighLevel cannot guarantee it,
 * and neither can we: what we do guarantee is that an ambiguous failure is
 * reconciled (by searching for the record we may already have created) before
 * a second write is attempted.
 */

export interface DeliveryOutcome {
  submissionId: string;
  status: SubmissionStatus;
  steps: Partial<Record<DeliveryStepName, DeliveryStepState>>;
  /** Set when delivery could not finish and will be retried. */
  retryAt?: string;
  error?: string;
}

interface StepContext {
  record: SubmissionRecord;
  config: GhlConfig;
  client: GhlClient | null;
  steps: Partial<Record<DeliveryStepName, DeliveryStepState>>;
  deadline: number;
}

class BudgetExhausted extends Error {
  constructor() {
    super("Delivery budget exhausted for this invocation");
    this.name = "BudgetExhausted";
  }
}

function stepState(
  steps: Partial<Record<DeliveryStepName, DeliveryStepState>>,
  name: DeliveryStepName,
): DeliveryStepState {
  return steps[name] ?? newStepState();
}

function isDone(state: DeliveryStepState): boolean {
  return state.status === "done" || state.status === "skipped";
}

function checkBudget(ctx: StepContext): void {
  if (Date.now() >= ctx.deadline) throw new BudgetExhausted();
}

// --- Individual steps --------------------------------------------------

/**
 * Upsert the contact and apply mapped custom fields in the same call.
 *
 * Safe to replay: the upsert is keyed on email within the location, so an
 * ambiguous timeout followed by a retry updates the same contact.
 */
async function stepContact(ctx: StepContext): Promise<DeliveryStepState> {
  const current = stepState(ctx.steps, "contact");
  if (isDone(current)) return current;
  if (!ctx.client) return { ...current, status: "skipped" };

  checkBudget(ctx);
  const payload = contactUpsertPayload(ctx.record.lead, ctx.config);
  const { contact } = await ctx.client.upsertContact(payload);

  // Custom fields travel with the upsert, so they complete together.
  ctx.steps.custom_fields = {
    status: Object.keys(ctx.config.customFieldMap).length > 0 ? "done" : "skipped",
    attempts: stepState(ctx.steps, "custom_fields").attempts + 1,
    completedAt: new Date().toISOString(),
  };

  return {
    status: "done",
    externalId: contact.id,
    attempts: current.attempts + 1,
    completedAt: new Date().toISOString(),
  };
}

/** Add AION's tags without disturbing tags applied by anything else. */
async function stepTags(ctx: StepContext): Promise<DeliveryStepState> {
  const current = stepState(ctx.steps, "tags");
  if (isDone(current)) return current;
  const contactId = ctx.steps.contact?.externalId;
  if (!ctx.client || !contactId) return { ...current, status: "skipped" };

  checkBudget(ctx);
  await ctx.client.addTags(contactId, tagsFor(ctx.record.lead));
  return {
    status: "done",
    attempts: current.attempts + 1,
    completedAt: new Date().toISOString(),
  };
}

/**
 * Create the growth-services opportunity, or reuse one that already exists.
 *
 * An existing opportunity that has moved past the initial stage is never
 * dragged back: if the contact already has an opportunity in the configured
 * pipeline, we adopt its id and leave its stage and status alone.
 */
async function stepOpportunity(ctx: StepContext): Promise<DeliveryStepState> {
  const current = stepState(ctx.steps, "opportunity");
  if (isDone(current)) return current;
  const contactId = ctx.steps.contact?.externalId;
  if (!ctx.client || !contactId) return { ...current, status: "skipped" };
  if (!ctx.config.pipelineId) {
    return {
      ...current,
      status: "skipped",
      lastError: "GHL_PIPELINE_ID is not configured",
    };
  }

  checkBudget(ctx);
  const existing = await ctx.client.searchOpportunities({
    contactId,
    pipelineId: ctx.config.pipelineId,
  });

  const reusable = existing.find((o) => o.pipelineId === ctx.config.pipelineId) ?? existing[0];
  if (reusable) {
    // Reuse only. We do not reset the stage or the status of an opportunity
    // that a salesperson may already have advanced.
    return {
      status: "done",
      externalId: reusable.id,
      attempts: current.attempts + 1,
      completedAt: new Date().toISOString(),
      lastError: undefined,
    };
  }

  checkBudget(ctx);
  const created = await ctx.client.createOpportunity({
    name: opportunityName(ctx.record.lead),
    contactId,
    pipelineId: ctx.config.pipelineId,
    pipelineStageId: ctx.config.newAssessmentStageId,
    assignedTo: ctx.config.assignedUserId,
  });
  return {
    status: "done",
    externalId: created.id,
    attempts: current.attempts + 1,
    completedAt: new Date().toISOString(),
  };
}

/**
 * Add the assessment summary as a contact note.
 *
 * The note body carries a submission marker. If a previous attempt timed out
 * with an unknown outcome, we list the contact's notes and look for that
 * marker before writing, so a repeated submission never produces a duplicate
 * note.
 */
async function stepNote(ctx: StepContext): Promise<DeliveryStepState> {
  const current = stepState(ctx.steps, "note");
  if (isDone(current)) return current;
  const contactId = ctx.steps.contact?.externalId;
  if (!ctx.client || !contactId) return { ...current, status: "skipped" };

  const marker = noteMarker(ctx.record.lead.submissionId);

  // Reconcile before writing when the outcome of an earlier write is unknown,
  // or when this submission has been attempted before.
  if (current.ambiguous || current.attempts > 0) {
    checkBudget(ctx);
    const notes = await ctx.client.listNotes(contactId);
    const existing = notes.find((n) => n.body?.includes(marker));
    if (existing) {
      return {
        status: "done",
        externalId: existing.id,
        attempts: current.attempts + 1,
        completedAt: new Date().toISOString(),
        ambiguous: false,
      };
    }
  }

  checkBudget(ctx);
  const body = `${assessmentSummaryText(ctx.record.lead)}\n\n${marker}`;
  const note = await ctx.client.createNote(contactId, body, ctx.config.assignedUserId);
  return {
    status: "done",
    externalId: note.id,
    attempts: current.attempts + 1,
    completedAt: new Date().toISOString(),
    ambiguous: false,
  };
}

/**
 * Post the versioned assessment event to the inbound workflow webhook.
 *
 * In hybrid mode this runs only after the API steps have succeeded, and the
 * event carries the resulting GHL ids with `recordOwner: "api"` so the
 * workflow resolves the existing contact instead of creating a duplicate.
 */
async function stepWorkflowEvent(ctx: StepContext): Promise<DeliveryStepState> {
  const current = stepState(ctx.steps, "workflow_event");
  if (isDone(current)) return current;

  const { mode, inboundWebhookUrl } = ctx.config;
  if (mode === "api" || !inboundWebhookUrl) {
    return { ...current, status: "skipped" };
  }

  checkBudget(ctx);
  const event = buildAssessmentEvent({
    lead: ctx.record.lead,
    eventId: `${ctx.record.lead.submissionId}:assessment`,
    recordOwner: mode === "hybrid" ? "api" : "workflow",
    locationId: ctx.config.locationId,
    contactId: ctx.steps.contact?.externalId,
    opportunityId: ctx.steps.opportunity?.externalId,
    noteId: ctx.steps.note?.externalId,
  });

  await postInboundWorkflowEvent(inboundWebhookUrl, event, {
    timeoutMs: ctx.config.timeoutMs,
    secret: serverEnv.ghlCallbackSecret,
  });

  // A 2xx means the event was accepted, not that every workflow action ran.
  return {
    status: "done",
    attempts: current.attempts + 1,
    completedAt: new Date().toISOString(),
  };
}

/** Optional generic webhook, independent of GoHighLevel. */
async function stepGenericWebhook(ctx: StepContext): Promise<DeliveryStepState> {
  const current = stepState(ctx.steps, "generic_webhook");
  if (isDone(current)) return current;
  const url = serverEnv.leadWebhookUrl;
  if (!url) return { ...current, status: "skipped" };

  checkBudget(ctx);
  const event = buildAssessmentEvent({
    lead: ctx.record.lead,
    eventId: `${ctx.record.lead.submissionId}:assessment`,
    recordOwner: ctx.config.mode === "webhook" ? "workflow" : "api",
    locationId: ctx.config.locationId,
    contactId: ctx.steps.contact?.externalId,
    opportunityId: ctx.steps.opportunity?.externalId,
    noteId: ctx.steps.note?.externalId,
  });
  const body = JSON.stringify(event);
  const secret = serverEnv.leadWebhookSecret;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) {
    headers["X-AION-Signature"] = `sha256=${createHmac("sha256", secret)
      .update(body)
      .digest("hex")}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ctx.config.timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      throw new IntegrationError(`Lead webhook returned HTTP ${response.status}`, {
        kind: response.status >= 500 || response.status === 429 ? "transient" : "permanent",
        status: response.status,
      });
    }
  } catch (error) {
    if (error instanceof IntegrationError) throw error;
    throw new IntegrationError("Lead webhook request failed", {
      kind: controller.signal.aborted ? "ambiguous" : "transient",
      cause: error,
    });
  } finally {
    clearTimeout(timer);
  }

  return {
    status: "done",
    attempts: current.attempts + 1,
    completedAt: new Date().toISOString(),
  };
}

const STEP_ORDER: {
  name: DeliveryStepName;
  run: (ctx: StepContext) => Promise<DeliveryStepState>;
}[] = [
  { name: "contact", run: stepContact },
  { name: "tags", run: stepTags },
  { name: "opportunity", run: stepOpportunity },
  { name: "note", run: stepNote },
  { name: "workflow_event", run: stepWorkflowEvent },
  { name: "generic_webhook", run: stepGenericWebhook },
];

export interface DeliverOptions {
  /** Wall-clock budget for this invocation. */
  budgetMs?: number;
  /** Test seam. */
  clientFactory?: (config: GhlConfig) => GhlClient;
  random?: () => number;
}

/**
 * Runs delivery for one already-stored submission and persists the outcome.
 */
export async function deliverSubmission(
  record: SubmissionRecord,
  options: DeliverOptions = {},
): Promise<DeliveryOutcome> {
  const store = await getStore();
  const configResult = resolveGhlConfig();
  const attempt = record.attempts + 1;

  if (!configResult.configured) {
    const message = `GoHighLevel integration is not configured: ${configResult.problems
      .map((p) => `${p.variable} — ${p.message}`)
      .join("; ")}`;
    logger.warn("delivery.not_configured", {
      submissionId: record.submissionId,
      missing: configResult.problems.map((p) => p.variable),
    });
    await store.update(record.submissionId, {
      status: "needs_operator",
      attempts: attempt,
      lastError: message,
      lockedUntil: null,
      nextAttemptAt: null,
    });
    return {
      submissionId: record.submissionId,
      status: "needs_operator",
      steps: record.steps,
      error: message,
    };
  }

  const config = configResult.config;
  const needsApi = config.mode === "api" || config.mode === "hybrid";
  const client = needsApi
    ? (options.clientFactory?.(config) ??
      new GhlClient(config, new StaticLocationTokenProvider(config.accessToken ?? "")))
    : null;

  const steps: Partial<Record<DeliveryStepName, DeliveryStepState>> = { ...record.steps };
  const ctx: StepContext = {
    record,
    config,
    client,
    steps,
    deadline: Date.now() + (options.budgetMs ?? serverEnv.httpTimeoutMs * 6),
  };

  let failure: { error: unknown; step: DeliveryStepName } | null = null;

  for (const step of STEP_ORDER) {
    try {
      steps[step.name] = await step.run(ctx);
    } catch (error) {
      if (error instanceof BudgetExhausted) {
        failure = { error, step: step.name };
        break;
      }
      const previous = stepState(steps, step.name);
      const integrationError =
        error instanceof IntegrationError
          ? error
          : new IntegrationError(
              error instanceof Error ? error.message : String(error),
              { kind: "transient", cause: error },
            );
      steps[step.name] = {
        ...previous,
        status: "failed",
        attempts: previous.attempts + 1,
        lastError: integrationError.message,
        ambiguous: integrationError.isAmbiguous,
      };
      failure = { error: integrationError, step: step.name };
      break;
    }
  }

  if (!failure) {
    await store.update(record.submissionId, {
      status: "delivered",
      attempts: attempt,
      steps,
      lastError: null,
      nextAttemptAt: null,
      lockedUntil: null,
      mode: config.mode,
    });
    logger.info("delivery.completed", {
      submissionId: record.submissionId,
      mode: config.mode,
      attempt,
    });
    return { submissionId: record.submissionId, status: "delivered", steps };
  }

  const error = failure.error;
  const isBudget = error instanceof BudgetExhausted;
  const integrationError = error instanceof IntegrationError ? error : null;
  const message = isBudget
    ? `Paused at step "${failure.step}": invocation budget reached; will resume.`
    : `Step "${failure.step}" failed: ${
        error instanceof Error ? error.message : String(error)
      }`;

  // Configuration and authentication problems are an operator's job. Retrying
  // a bad token on a schedule just burns attempts and hides the problem.
  if (integrationError?.kind === "configuration") {
    await store.update(record.submissionId, {
      status: "needs_operator",
      attempts: attempt,
      steps,
      lastError: message,
      nextAttemptAt: null,
      lockedUntil: null,
      mode: config.mode,
    });
    logger.error("delivery.needs_operator", {
      submissionId: record.submissionId,
      step: failure.step,
      status: integrationError.status,
    });
    return {
      submissionId: record.submissionId,
      status: "needs_operator",
      steps,
      error: message,
    };
  }

  const retryable = isBudget || integrationError === null || integrationError.isRetryable;
  const exhausted = attempt >= serverEnv.maxDeliveryAttempts;

  if (!retryable || exhausted) {
    const status: SubmissionStatus = retryable ? "needs_operator" : "failed_permanent";
    await store.update(record.submissionId, {
      status,
      attempts: attempt,
      steps,
      lastError: message,
      nextAttemptAt: null,
      lockedUntil: null,
      mode: config.mode,
    });
    logger.error("delivery.stopped", {
      submissionId: record.submissionId,
      step: failure.step,
      status,
      attempt,
    });
    return { submissionId: record.submissionId, status, steps, error: message };
  }

  const delay = isBudget
    ? 1_000
    : backoffDelayMs(attempt, {
        retryAfterMs: integrationError?.retryAfterMs,
        random: options.random,
      });
  const retryAt = new Date(Date.now() + delay).toISOString();

  await store.update(record.submissionId, {
    status: "received",
    attempts: attempt,
    steps,
    lastError: message,
    nextAttemptAt: retryAt,
    lockedUntil: null,
    mode: config.mode,
  });
  logger.warn("delivery.retry_scheduled", {
    submissionId: record.submissionId,
    step: failure.step,
    attempt,
    retryAt,
    rateLimited: integrationError?.kind === "rate_limited",
  });

  return {
    submissionId: record.submissionId,
    status: "received",
    steps,
    retryAt,
    error: message,
  };
}

/**
 * Processes a batch of due submissions. Intended for a scheduled invocation
 * (cron job, platform scheduler or a long-running worker loop) — never a
 * promise left running after an HTTP response has been sent.
 */
export async function processDueSubmissions(
  options: { limit?: number; budgetMs?: number } & DeliverOptions = {},
): Promise<{ claimed: number; outcomes: DeliveryOutcome[] }> {
  const store = await getStore();
  const limit = options.limit ?? serverEnv.workerBatchSize;
  const now = new Date();
  const lockUntil = new Date(now.getTime() + 2 * 60_000);
  const due = await store.claimDue(now, limit, lockUntil);

  const outcomes: DeliveryOutcome[] = [];
  for (const record of due) {
    outcomes.push(await deliverSubmission(record, options));
  }
  return { claimed: due.length, outcomes };
}

export function newEventId(): string {
  return randomUUID();
}
