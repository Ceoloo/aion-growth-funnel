import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemorySubmissionStore } from "@/lib/store/memory";
import type { SubmissionRecord } from "@/lib/store/types";
import { makeLead } from "./helpers/lead";

/**
 * Delivery behaviour against a mocked GoHighLevel.
 *
 * Nothing here talks to a real GHL location. Every request is intercepted, so
 * these tests verify our sequencing, resumption and failure handling — not
 * GoHighLevel's behaviour, which still needs verification against an
 * authorised test location.
 */

interface RecordedCall {
  url: string;
  method: string;
  body: unknown;
  headers: Record<string, string>;
}

let calls: RecordedCall[] = [];
let store: MemorySubmissionStore;

type Responder = (call: RecordedCall) => {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
  throw?: Error;
};

function installFetch(responder: Responder) {
  vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const call: RecordedCall = {
      url,
      method: (init?.method ?? "GET").toUpperCase(),
      body: init?.body ? JSON.parse(init.body as string) : undefined,
      headers: (init?.headers ?? {}) as Record<string, string>,
    };
    calls.push(call);
    const result = responder(call);
    if (result.throw) throw result.throw;
    const status = result.status ?? 200;
    return new Response(JSON.stringify(result.body ?? {}), {
      status,
      headers: { "Content-Type": "application/json", ...(result.headers ?? {}) },
    });
  });
}

/** Default happy-path GoHighLevel. */
const happyPath: Responder = (call) => {
  if (call.url.includes("/contacts/upsert")) {
    return { body: { new: true, contact: { id: "contact_1" } } };
  }
  if (call.url.includes("/tags")) return { body: { tags: ["source:aion-growth-funnel"] } };
  if (call.url.includes("/opportunities/search")) return { body: { opportunities: [] } };
  if (call.url.includes("/opportunities")) return { status: 201, body: { opportunity: { id: "opp_1" } } };
  if (call.url.includes("/notes") && call.method === "GET") return { body: { notes: [] } };
  if (call.url.includes("/notes")) return { status: 201, body: { note: { id: "note_1" } } };
  return { body: {} };
};

function seed(overrides: Partial<SubmissionRecord> = {}): SubmissionRecord {
  const lead = makeLead({ submissionId: overrides.submissionId });
  return {
    submissionId: lead.submissionId,
    receivedAt: "2026-09-21T10:00:00.000Z",
    updatedAt: "2026-09-21T10:00:00.000Z",
    status: "received",
    lead,
    attempts: 0,
    nextAttemptAt: null,
    lockedUntil: null,
    lastError: null,
    steps: {},
    mode: "api",
    ...overrides,
  };
}

/**
 * Imports the runner from a fresh module graph.
 *
 * `vi.resetModules()` gives each test its own copy of the modules, so the
 * in-memory store has to be injected into that same copy — injecting into the
 * statically imported one would have no effect on the runner under test.
 */
async function importRunner() {
  const storeModule = await import("@/lib/store");
  storeModule.__setStoreForTests(store);
  return import("@/lib/delivery/runner");
}

beforeEach(() => {
  calls = [];
  store = new MemorySubmissionStore();
  vi.stubEnv("GHL_INTEGRATION_MODE", "api");
  vi.stubEnv("GHL_ACCESS_TOKEN", "test-token");
  vi.stubEnv("GHL_LOCATION_ID", "loc_123");
  vi.stubEnv("GHL_PIPELINE_ID", "pipe_123");
  vi.stubEnv("GHL_NEW_ASSESSMENT_STAGE_ID", "stage_new");
  vi.stubEnv("DELIVERY_MAX_ATTEMPTS", "8");
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("happy path", () => {
  it("writes contact, tags, opportunity and note, in that order", async () => {
    installFetch(happyPath);
    const { deliverSubmission } = await importRunner();
    const record = seed();
    await store.insert(record);

    const outcome = await deliverSubmission(record);

    expect(outcome.status).toBe("delivered");
    expect(outcome.steps.contact?.externalId).toBe("contact_1");
    expect(outcome.steps.opportunity?.externalId).toBe("opp_1");
    expect(outcome.steps.note?.externalId).toBe("note_1");

    const writes = calls.filter((c) => c.method === "POST").map((c) => c.url);
    expect(writes[0]).toContain("/contacts/upsert");
    expect(writes[1]).toContain("/tags");
  });

  it("sends the configured API version on every call", async () => {
    installFetch(happyPath);
    vi.stubEnv("GHL_API_VERSION", "2021-07-28");
    const { deliverSubmission } = await importRunner();
    const record = seed();
    await store.insert(record);
    await deliverSubmission(record);

    for (const call of calls) {
      expect(call.headers.Version).toBe("2021-07-28");
      expect(call.headers.Authorization).toBe("Bearer test-token");
    }
  });

  it("adds tags through the additive endpoint, never through the upsert", async () => {
    installFetch(happyPath);
    const { deliverSubmission } = await importRunner();
    const record = seed();
    await store.insert(record);
    await deliverSubmission(record);

    const upsert = calls.find((c) => c.url.includes("/contacts/upsert"));
    expect(upsert?.body).not.toHaveProperty("tags");

    const tagCall = calls.find((c) => c.url.includes("/tags"));
    expect((tagCall?.body as { tags: string[] }).tags).toContain("audience:contractor-builder");
  });
});

describe("resuming after a partial failure", () => {
  it("does not replay completed steps", async () => {
    // The contact and tags already succeeded; the note failed last time.
    const record = seed({
      attempts: 1,
      steps: {
        contact: { status: "done", externalId: "contact_1", attempts: 1 },
        tags: { status: "done", attempts: 1 },
        opportunity: { status: "done", externalId: "opp_1", attempts: 1 },
        note: { status: "failed", attempts: 1, lastError: "boom" },
      },
    });
    await store.insert(record);

    installFetch((call) => {
      if (call.url.includes("/notes") && call.method === "GET") return { body: { notes: [] } };
      if (call.url.includes("/notes")) return { status: 201, body: { note: { id: "note_2" } } };
      return { body: {} };
    });

    const { deliverSubmission } = await importRunner();
    const outcome = await deliverSubmission(record);

    expect(outcome.status).toBe("delivered");
    expect(calls.some((c) => c.url.includes("/contacts/upsert"))).toBe(false);
    expect(calls.some((c) => c.url.includes("/opportunities"))).toBe(false);
    expect(outcome.steps.note?.externalId).toBe("note_2");
  });

  it("reconciles an ambiguous note write instead of creating a duplicate", async () => {
    const lead = makeLead();
    const marker = `[aion-submission:${lead.submissionId}]`;
    const record = seed({
      attempts: 1,
      steps: {
        contact: { status: "done", externalId: "contact_1", attempts: 1 },
        tags: { status: "done", attempts: 1 },
        opportunity: { status: "done", externalId: "opp_1", attempts: 1 },
        // Previous attempt timed out: the note may or may not exist.
        note: { status: "failed", attempts: 1, ambiguous: true },
      },
    });
    await store.insert(record);

    installFetch((call) => {
      if (call.url.includes("/notes") && call.method === "GET") {
        return { body: { notes: [{ id: "note_existing", body: `summary\n\n${marker}` }] } };
      }
      if (call.url.includes("/notes")) return { status: 201, body: { note: { id: "note_new" } } };
      return { body: {} };
    });

    const { deliverSubmission } = await importRunner();
    const outcome = await deliverSubmission(record);

    expect(outcome.steps.note?.externalId).toBe("note_existing");
    // No second note was written.
    expect(calls.filter((c) => c.url.includes("/notes") && c.method === "POST")).toHaveLength(0);
  });

  it("reuses an existing opportunity rather than creating a second one", async () => {
    installFetch((call) => {
      if (call.url.includes("/contacts/upsert")) {
        return { body: { new: false, contact: { id: "contact_1" } } };
      }
      if (call.url.includes("/tags")) return { body: { tags: [] } };
      if (call.url.includes("/opportunities/search")) {
        return {
          body: {
            opportunities: [
              { id: "opp_existing", pipelineId: "pipe_123", pipelineStageId: "stage_qualified" },
            ],
          },
        };
      }
      if (call.url.includes("/notes") && call.method === "GET") return { body: { notes: [] } };
      if (call.url.includes("/notes")) return { status: 201, body: { note: { id: "note_1" } } };
      return { body: {} };
    });

    const { deliverSubmission } = await importRunner();
    const record = seed();
    await store.insert(record);
    const outcome = await deliverSubmission(record);

    expect(outcome.steps.opportunity?.externalId).toBe("opp_existing");
    // The advanced opportunity is never reset to the New Assessment stage.
    const created = calls.filter(
      (c) => c.method === "POST" && c.url.includes("/opportunities") && !c.url.includes("search"),
    );
    expect(created).toHaveLength(0);
    const updates = calls.filter((c) => c.method === "PUT");
    expect(updates).toHaveLength(0);
  });
});

describe("failure handling", () => {
  it("schedules a bounded retry for a transient error", async () => {
    installFetch((call) =>
      call.url.includes("/contacts/upsert") ? { status: 502, body: { error: "bad gateway" } } : { body: {} },
    );
    const { deliverSubmission } = await importRunner();
    const record = seed();
    await store.insert(record);

    const outcome = await deliverSubmission(record, { random: () => 0.5 });

    expect(outcome.status).toBe("received");
    expect(outcome.retryAt).toBeTruthy();
    const stored = await store.get(record.submissionId);
    expect(stored?.attempts).toBe(1);
    expect(stored?.nextAttemptAt).toBeTruthy();
  });

  it("honours Retry-After on a rate-limited response", async () => {
    installFetch((call) =>
      call.url.includes("/contacts/upsert")
        ? { status: 429, body: { message: "slow down" }, headers: { "Retry-After": "120" } }
        : { body: {} },
    );
    const { deliverSubmission } = await importRunner();
    const record = seed();
    await store.insert(record);

    const before = Date.now();
    const outcome = await deliverSubmission(record, { random: () => 0 });
    const retryAt = new Date(outcome.retryAt ?? "").getTime();

    expect(outcome.status).toBe("received");
    // Retry-After is a floor, so the wait is at least the requested 120s.
    expect(retryAt - before).toBeGreaterThanOrEqual(119_000);
  });

  it("flags an authentication failure for an operator instead of retrying", async () => {
    installFetch(() => ({ status: 401, body: { message: "unauthorized" } }));
    const { deliverSubmission } = await importRunner();
    const record = seed();
    await store.insert(record);

    const outcome = await deliverSubmission(record);

    expect(outcome.status).toBe("needs_operator");
    const stored = await store.get(record.submissionId);
    expect(stored?.nextAttemptAt).toBeNull();
  });

  it("treats a timed-out write as ambiguous, not as a clean failure", async () => {
    installFetch((call) => {
      if (call.url.includes("/contacts/upsert")) {
        const error = new Error("The operation was aborted");
        error.name = "AbortError";
        return { throw: error };
      }
      return { body: {} };
    });
    const { deliverSubmission } = await importRunner();
    const record = seed();
    await store.insert(record);

    const outcome = await deliverSubmission(record);
    expect(outcome.status).toBe("received");
    expect(outcome.steps.contact?.ambiguous).toBe(true);
  });

  it("stops retrying once the attempt limit is reached", async () => {
    vi.stubEnv("DELIVERY_MAX_ATTEMPTS", "2");
    installFetch(() => ({ status: 503, body: {} }));
    const { deliverSubmission } = await importRunner();

    const record = seed({ attempts: 1 });
    await store.insert(record);
    const outcome = await deliverSubmission(record);

    expect(outcome.status).toBe("needs_operator");
  });
});

describe("configuration", () => {
  it("marks a submission for an operator when the integration is unconfigured", async () => {
    vi.stubEnv("GHL_INTEGRATION_MODE", "");
    vi.stubEnv("GHL_ACCESS_TOKEN", "");
    vi.stubEnv("GHL_LOCATION_ID", "");
    installFetch(happyPath);

    const { deliverSubmission } = await importRunner();
    const record = seed();
    await store.insert(record);
    const outcome = await deliverSubmission(record);

    expect(outcome.status).toBe("needs_operator");
    expect(outcome.error).toContain("GHL_INTEGRATION_MODE");
    // Nothing was sent anywhere.
    expect(calls).toHaveLength(0);
    // And the submission is still on record, not discarded.
    expect(await store.get(record.submissionId)).not.toBeNull();
  });

  it("does not fall back to another mode after a failure", async () => {
    vi.stubEnv("GHL_INTEGRATION_MODE", "api");
    vi.stubEnv("GHL_INBOUND_WEBHOOK_URL", "https://hooks.test/inbound");
    installFetch((call) =>
      call.url.includes("/contacts/upsert") ? { status: 500, body: {} } : { body: {} },
    );

    const { deliverSubmission } = await importRunner();
    const record = seed();
    await store.insert(record);
    await deliverSubmission(record);

    // In api mode the workflow webhook is never used, failure or not.
    expect(calls.some((c) => c.url.includes("hooks.test"))).toBe(false);
  });

  it("skips the opportunity step when no pipeline is configured", async () => {
    vi.stubEnv("GHL_PIPELINE_ID", "");
    installFetch(happyPath);
    const { deliverSubmission } = await importRunner();
    const record = seed();
    await store.insert(record);
    const outcome = await deliverSubmission(record);

    expect(outcome.status).toBe("delivered");
    expect(outcome.steps.opportunity?.status).toBe("skipped");
    expect(calls.some((c) => c.url.includes("/opportunities"))).toBe(false);
  });
});

describe("hybrid mode", () => {
  it("posts the workflow event with the resulting GHL ids and api ownership", async () => {
    vi.stubEnv("GHL_INTEGRATION_MODE", "hybrid");
    vi.stubEnv("GHL_INBOUND_WEBHOOK_URL", "https://hooks.test/inbound");
    installFetch((call) =>
      call.url.includes("hooks.test") ? { status: 200, body: { ok: true } } : happyPath(call),
    );

    const { deliverSubmission } = await importRunner();
    const record = seed();
    await store.insert(record);
    const outcome = await deliverSubmission(record);

    expect(outcome.status).toBe("delivered");
    const event = calls.find((c) => c.url.includes("hooks.test"))?.body as Record<string, unknown>;
    expect(event.eventType).toBe("aion.assessment.submitted");
    expect(event.eventVersion).toBe("1.0");
    expect(event.ghl).toMatchObject({
      recordOwner: "api",
      contactId: "contact_1",
      opportunityId: "opp_1",
      noteId: "note_1",
    });
  });

  it("sends the event only after the API steps succeeded", async () => {
    vi.stubEnv("GHL_INTEGRATION_MODE", "hybrid");
    vi.stubEnv("GHL_INBOUND_WEBHOOK_URL", "https://hooks.test/inbound");
    installFetch((call) =>
      call.url.includes("/contacts/upsert") ? { status: 500, body: {} } : { body: {} },
    );

    const { deliverSubmission } = await importRunner();
    const record = seed();
    await store.insert(record);
    await deliverSubmission(record);

    expect(calls.some((c) => c.url.includes("hooks.test"))).toBe(false);
  });
});

describe("webhook mode", () => {
  it("makes no authenticated API calls and hands ownership to the workflow", async () => {
    vi.stubEnv("GHL_INTEGRATION_MODE", "webhook");
    vi.stubEnv("GHL_INBOUND_WEBHOOK_URL", "https://hooks.test/inbound");
    installFetch(() => ({ status: 200, body: { ok: true } }));

    const { deliverSubmission } = await importRunner();
    const record = seed();
    await store.insert(record);
    const outcome = await deliverSubmission(record);

    expect(outcome.status).toBe("delivered");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://hooks.test/inbound");
    const event = calls[0]?.body as Record<string, unknown>;
    expect(event.ghl).toMatchObject({ recordOwner: "workflow", contactId: null });
  });
});

describe("worker", () => {
  it("claims due submissions and survives a restart of the process", async () => {
    installFetch(happyPath);
    const { processDueSubmissions } = await importRunner();

    // Two submissions stored but not yet delivered — as they would be after a
    // crash between storing and delivering.
    await store.insert(seed({ submissionId: "22222222-2222-4222-8222-222222222222" }));
    await store.insert(seed({ submissionId: "33333333-3333-4333-8333-333333333333" }));

    const result = await processDueSubmissions({ limit: 10 });

    expect(result.claimed).toBe(2);
    expect(result.outcomes.every((o) => o.status === "delivered")).toBe(true);
  });

  it("does not claim a submission whose retry time is in the future", async () => {
    installFetch(happyPath);
    const { processDueSubmissions } = await importRunner();
    await store.insert(
      seed({
        submissionId: "44444444-4444-4444-8444-444444444444",
        nextAttemptAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    );

    const result = await processDueSubmissions({ limit: 10 });
    expect(result.claimed).toBe(0);
  });
});
