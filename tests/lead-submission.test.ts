import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemorySubmissionStore } from "@/lib/store/memory";
import { MARKETING_CONSENT_VERSION } from "@/content/consent";
import { makeAnswers } from "./helpers/lead";

/**
 * The public lead endpoint, exercised through its real route handler.
 *
 * The rule under test throughout: a success response is returned only when the
 * submission was durably stored.
 */

let store: MemorySubmissionStore;

function body(overrides: Record<string, unknown> = {}) {
  return {
    submissionId: "11111111-1111-4111-8111-111111111111",
    contact: {
      fullName: "Dana Reyes",
      email: "dana@examplebuilders.test",
      businessName: "Example Builders",
      phone: "+15555550123",
      website: "examplebuilders.test",
    },
    answers: makeAnswers(),
    consent: { marketingEmail: false, copyVersion: MARKETING_CONSENT_VERSION },
    attribution: { utmSource: "google", utmMedium: "cpc" },
    formRenderedAt: Date.now() - 10_000,
    ...overrides,
  };
}

function request(payload: unknown, headers: Record<string, string> = {}) {
  return new Request("https://aion.test/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(payload),
  });
}

async function loadRoute(options: { withStore?: boolean } = {}) {
  const storeModule = await import("@/lib/store");
  storeModule.__setStoreForTests(options.withStore === false ? null : store);
  return import("@/app/api/leads/route");
}

/** Route handlers take a NextRequest; a Request satisfies everything used here. */
type RouteRequest = Parameters<
  Awaited<ReturnType<typeof loadRoute>>["POST"]
>[0];

beforeEach(() => {
  store = new MemorySubmissionStore();
  vi.resetModules();
  vi.stubGlobal("fetch", async () => new Response("{}", { status: 200 }));
  vi.stubEnv("DELIVERY_INLINE", "false");
  vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", "hello@aion.test");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("validation", () => {
  it("rejects a missing required field with per-field errors", async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      request(body({ contact: { fullName: "", email: "nope", businessName: "" } })) as RouteRequest,
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("validation_failed");
    expect(data.errors["contact.email"]).toBeTruthy();
    expect(data.errors["contact.fullName"]).toBeTruthy();
    expect(store.all()).toHaveLength(0);
  });

  it("accepts a submission without the optional fields", async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      request(
        body({
          contact: {
            fullName: "Sam Ortiz",
            email: "sam@example.test",
            businessName: "Ortiz Plumbing",
          },
        }),
      ) as RouteRequest,
    );

    expect(response.status).toBe(201);
    expect(store.all()).toHaveLength(1);
  });

  it("rejects an answer id outside the known vocabulary", async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      request(body({ answers: { ...makeAnswers(), bottleneck: "made-up" } })) as RouteRequest,
    );
    expect(response.status).toBe(400);
  });

  it("rejects an over-long field instead of storing it", async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      request(
        body({
          contact: {
            fullName: "x".repeat(500),
            email: "sam@example.test",
            businessName: "Ortiz Plumbing",
          },
        }),
      ) as RouteRequest,
    );
    expect(response.status).toBe(400);
    expect(store.all()).toHaveLength(0);
  });

  it("rejects a malformed body", async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new Request("https://aion.test/api/leads", {
        method: "POST",
        body: "not json",
      }) as RouteRequest,
    );
    expect(response.status).toBe(400);
  });
});

describe("storage is the source of truth", () => {
  it("stores the canonical lead with its recommendation", async () => {
    const { POST } = await loadRoute();
    const response = await POST(request(body()) as RouteRequest);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.ok).toBe(true);

    const [stored] = store.all();
    expect(stored?.lead.contact.email).toBe("dana@examplebuilders.test");
    expect(stored?.lead.recommendation.coreServiceId).toBe("sales-follow-up");
    expect(stored?.status).toBe("received");
  });

  it("returns an honest unavailable state when no store is configured", async () => {
    const { POST } = await loadRoute({ withStore: false });
    const response = await POST(request(body()) as RouteRequest);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.ok).toBe(false);
    expect(data.code).toBe("not_configured");
    // The visitor is given a real alternative rather than a false success.
    expect(data.contactEmail).toBe("hello@aion.test");
  });

  it("returns a retryable error when the store write fails", async () => {
    vi.spyOn(store, "insert").mockRejectedValue(new Error("connection reset"));
    const { POST } = await loadRoute();
    const response = await POST(request(body()) as RouteRequest);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.retryable).toBe(true);
    expect(data.ok).toBe(false);
  });

  it("reports delivery as pending, never as synced, when it has not run", async () => {
    const { POST } = await loadRoute();
    const response = await POST(request(body()) as RouteRequest);
    const data = await response.json();
    expect(data.delivery).toBe("pending");
  });
});

describe("duplicate protection", () => {
  it("does not create a second record for a repeated submission id", async () => {
    const { POST } = await loadRoute();
    const payload = body();

    const first = await POST(request(payload) as RouteRequest);
    const second = await POST(request(payload) as RouteRequest);
    const secondData = await second.json();

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(secondData.duplicate).toBe(true);
    expect(store.all()).toHaveLength(1);
  });
});

describe("abuse controls", () => {
  it("silently discards a honeypot submission without storing it", async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      request(body({ companyWebsiteConfirm: "http://spam.test" })) as RouteRequest,
    );

    expect(response.status).toBe(202);
    expect(store.all()).toHaveLength(0);
  });

  it("rejects a submission posted faster than a person could type", async () => {
    const { POST } = await loadRoute();
    const response = await POST(request(body({ formRenderedAt: Date.now() })) as RouteRequest);
    expect(response.status).toBe(429);
    expect(store.all()).toHaveLength(0);
  });

  it("rate limits repeated submissions from one address", async () => {
    vi.stubEnv("LEAD_MAX_PER_IP_PER_HOUR", "2");
    const { POST } = await loadRoute();

    const headers = { "x-forwarded-for": "203.0.113.9" };
    for (let i = 0; i < 2; i += 1) {
      const response = await POST(
        request(
          body({ submissionId: `1111111${i}-1111-4111-8111-111111111111` }),
          headers,
        ) as RouteRequest,
      );
      expect(response.status).toBe(201);
    }

    const blocked = await POST(
      request(
        body({ submissionId: "99999999-9999-4999-8999-999999999999" }),
        headers,
      ) as RouteRequest,
    );
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).code).toBe("rate_limited");
  });
});

describe("privacy", () => {
  it("records consent with a timestamp only when it was given", async () => {
    const { POST } = await loadRoute();
    await POST(
      request(
        body({ consent: { marketingEmail: true, copyVersion: MARKETING_CONSENT_VERSION } }),
      ) as RouteRequest,
    );
    const [stored] = store.all();
    expect(stored?.lead.consent.marketingEmail).toBe(true);
    expect(stored?.lead.consent.marketingEmailAt).toBeTruthy();
    expect(stored?.lead.consent.copyVersion).toBe(MARKETING_CONSENT_VERSION);
  });

  it("stores no consent timestamp when consent was withheld", async () => {
    const { POST } = await loadRoute();
    await POST(request(body()) as RouteRequest);
    const [stored] = store.all();
    expect(stored?.lead.consent.marketingEmail).toBe(false);
    expect(stored?.lead.consent.marketingEmailAt).toBeUndefined();
  });

  it("hashes the source address rather than storing it", async () => {
    const { POST } = await loadRoute();
    await POST(request(body(), { "x-forwarded-for": "203.0.113.4" }) as RouteRequest);
    const serialised = JSON.stringify(store.all());
    expect(serialised).not.toContain("203.0.113.4");
  });

  it("captures attribution alongside the answers", async () => {
    const { POST } = await loadRoute();
    await POST(request(body()) as RouteRequest);
    const [stored] = store.all();
    expect(stored?.lead.attribution.utmSource).toBe("google");
    expect(stored?.lead.attribution.utmMedium).toBe("cpc");
  });
});

describe("method handling", () => {
  it("refuses GET", async () => {
    const { GET } = await loadRoute();
    const response = await GET();
    expect(response.status).toBe(405);
  });
});
