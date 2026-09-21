import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { MARKETING_CONSENT_VERSION } from "@/content/consent";
import { buildCanonicalLead } from "@/lib/canonical";
import { deliverSubmission } from "@/lib/delivery/runner";
import { serverEnv } from "@/lib/env";
import { resolveGhlConfig } from "@/lib/ghl/config";
import { fieldErrors, leadRequestSchema } from "@/lib/lead-schema";
import { logger } from "@/lib/logger";
import { getStore } from "@/lib/store";
import {
  StoreNotConfiguredError,
  StoreUnavailableError,
  type SubmissionStatus,
} from "@/lib/store/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public lead endpoint.
 *
 * Order of operations matters and is deliberate:
 *   1. validate           — nothing unvalidated reaches storage
 *   2. durably store      — this is what lets us say "received"
 *   3. attempt delivery   — bounded, inline, and optional
 *
 * If step 2 fails the caller gets a retryable error and the UI does not show a
 * success screen. If step 3 fails the submission stays in the outbox for the
 * worker, and the response says delivery is pending rather than complete.
 */

const MIN_FORM_DWELL_MS = 1_500;

function clientIpHash(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
  if (!ip) return null;
  const salt = serverEnv.ipHashSalt ?? "aion-default-salt";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

/**
 * Maps a stored submission status to what the client is told about delivery.
 * "complete" is reserved for a finished CRM write; anything still in flight is
 * reported as pending, never as synced.
 */
function deliveryStateFor(
  status: SubmissionStatus,
): "complete" | "pending" | "needs_operator" {
  if (status === "delivered") return "complete";
  if (status === "needs_operator" || status === "failed_permanent") return "needs_operator";
  return "pending";
}

function bookingPayload() {
  const url = serverEnv.bookingUrl;
  return {
    bookingUrl: url ?? null,
    contactEmail: serverEnv.contactEmail ?? null,
  };
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 32_000) {
      return NextResponse.json(
        { ok: false, code: "payload_too_large", message: "Submission is too large." },
        { status: 413 },
      );
    }
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { ok: false, code: "invalid_json", message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  const parsed = leadRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "validation_failed",
        message: "Please check the highlighted fields.",
        errors: fieldErrors(parsed.error),
      },
      { status: 400 },
    );
  }

  const input = parsed.data;

  // Honeypot: a real person never sees this field, so any value is a bot.
  // Respond as though it succeeded, without storing or delivering anything.
  if (input.companyWebsiteConfirm && input.companyWebsiteConfirm.trim() !== "") {
    logger.warn("lead.honeypot_triggered", { submissionId: input.submissionId });
    return NextResponse.json(
      { ok: true, submissionId: input.submissionId, delivery: "pending", ...bookingPayload() },
      { status: 202 },
    );
  }

  if (
    input.formRenderedAt !== undefined &&
    Date.now() - input.formRenderedAt < MIN_FORM_DWELL_MS
  ) {
    return NextResponse.json(
      {
        ok: false,
        code: "too_fast",
        message: "That was submitted unusually quickly. Please try again.",
      },
      { status: 429 },
    );
  }

  if (input.consent.copyVersion !== MARKETING_CONSENT_VERSION) {
    logger.warn("lead.stale_consent_version", {
      submissionId: input.submissionId,
      received: input.consent.copyVersion,
    });
  }

  // --- Durable storage --------------------------------------------------
  let store;
  try {
    store = await getStore();
  } catch (error) {
    if (error instanceof StoreNotConfiguredError) {
      logger.error("lead.store_not_configured", { message: error.message });
      return NextResponse.json(
        {
          ok: false,
          code: "not_configured",
          message:
            "We can't accept requests through this form right now. Please email us instead and we'll respond personally.",
          contactEmail: serverEnv.contactEmail ?? null,
        },
        { status: 503 },
      );
    }
    logger.error("lead.store_unavailable", { message: (error as Error).message });
    return NextResponse.json(
      {
        ok: false,
        code: "storage_unavailable",
        message: "We couldn't save your request just now. Please try again in a moment.",
        retryable: true,
        contactEmail: serverEnv.contactEmail ?? null,
      },
      { status: 503 },
    );
  }

  const ipHash = clientIpHash(request);
  if (ipHash) {
    try {
      const since = new Date(Date.now() - 60 * 60 * 1000);
      const recent = await store.countByIpHashSince(ipHash, since);
      if (recent >= serverEnv.maxSubmissionsPerIpPerHour) {
        return NextResponse.json(
          {
            ok: false,
            code: "rate_limited",
            message: "You've sent several requests recently. Please email us instead.",
            contactEmail: serverEnv.contactEmail ?? null,
          },
          { status: 429 },
        );
      }
    } catch (error) {
      // Rate limiting is best-effort; never block a genuine lead over it.
      logger.warn("lead.rate_limit_check_failed", { message: (error as Error).message });
    }
  }

  const submittedAt = new Date().toISOString();
  const lead = buildCanonicalLead({
    submissionId: input.submissionId,
    submittedAt,
    contact: input.contact,
    answers: input.answers,
    consent: input.consent,
    attribution: input.attribution,
  });

  const configResult = resolveGhlConfig();
  let insert;
  try {
    insert = await store.insert({
      submissionId: lead.submissionId,
      receivedAt: submittedAt,
      updatedAt: submittedAt,
      status: "received",
      lead,
      attempts: 0,
      nextAttemptAt: null,
      lockedUntil: null,
      lastError: null,
      steps: {},
      mode: configResult.configured ? configResult.config.mode : null,
    });
    if (ipHash) await store.recordIpHash(lead.submissionId, ipHash);
  } catch (error) {
    logger.error("lead.persist_failed", {
      submissionId: lead.submissionId,
      message: (error as Error).message,
      storeUnavailable: error instanceof StoreUnavailableError,
    });
    return NextResponse.json(
      {
        ok: false,
        code: "storage_unavailable",
        message: "We couldn't save your request just now. Please try again in a moment.",
        retryable: true,
        contactEmail: serverEnv.contactEmail ?? null,
      },
      { status: 503 },
    );
  }

  // Duplicate submit: the record already exists. Report the stored outcome
  // rather than delivering a second time.
  if (!insert.created) {
    logger.info("lead.duplicate_submission", { submissionId: lead.submissionId });
    return NextResponse.json(
      {
        ok: true,
        submissionId: lead.submissionId,
        duplicate: true,
        delivery: deliveryStateFor(insert.record.status),
        recommendedService: lead.recommendation.coreServiceName,
        ...bookingPayload(),
      },
      { status: 200 },
    );
  }

  logger.info("lead.received", {
    submissionId: lead.submissionId,
    audience: lead.assessment.audience,
    recommendation: lead.recommendation.coreServiceId,
    mode: configResult.configured ? configResult.config.mode : "unconfigured",
  });

  // --- Delivery ---------------------------------------------------------
  // The submission is safely stored at this point, so the visitor gets a
  // truthful "received" either way. Inline delivery is a bounded, awaited
  // attempt — not a promise left dangling after the response.
  let delivery: "complete" | "pending" | "needs_operator" = "pending";
  if (serverEnv.inlineDelivery) {
    try {
      const outcome = await deliverSubmission(insert.record, {
        budgetMs: serverEnv.inlineDeliveryBudgetMs,
      });
      delivery = deliveryStateFor(outcome.status);
    } catch (error) {
      logger.error("lead.inline_delivery_threw", {
        submissionId: lead.submissionId,
        message: (error as Error).message,
      });
    }
  }

  return NextResponse.json(
    {
      ok: true,
      submissionId: lead.submissionId,
      // "complete" means the CRM writes finished. "pending" means the request
      // is stored and queued — never presented to the visitor as synced.
      delivery,
      recommendedService: lead.recommendation.coreServiceName,
      ...bookingPayload(),
    },
    { status: 201 },
  );
}

export async function GET() {
  return NextResponse.json(
    { ok: false, code: "method_not_allowed", message: "Use POST." },
    { status: 405, headers: { Allow: "POST" } },
  );
}
