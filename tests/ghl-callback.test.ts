import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemorySubmissionStore } from "@/lib/store/memory";
import {
  callbackEventSchema,
  isForwardTransition,
  verifyMarketplaceSignature,
} from "@/lib/ghl/callback";

/**
 * Inbound callbacks. An unauthenticated or malformed event must be rejected,
 * and a redelivered event must not be applied twice.
 */

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();

function signBody(body: string): string {
  return cryptoSign(null, Buffer.from(body, "utf8"), privateKey).toString("base64");
}

let store: MemorySubmissionStore;

function validEvent(overrides: Record<string, unknown> = {}) {
  return {
    eventId: "evt_1",
    eventType: "AppointmentCreate",
    locationId: "loc_123",
    occurredAt: "2026-09-21T10:00:00.000Z",
    appointment: { id: "appt_1", status: "booked" },
    ...overrides,
  };
}

async function loadRoute() {
  const storeModule = await import("@/lib/store");
  storeModule.__setStoreForTests(store);
  return import("@/app/api/integrations/ghl/callback/route");
}

type RouteRequest = Parameters<Awaited<ReturnType<typeof loadRoute>>["POST"]>[0];

function post(payload: unknown, headers: Record<string, string> = {}) {
  return new Request("https://aion.test/api/integrations/ghl/callback", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(payload),
  }) as RouteRequest;
}

beforeEach(() => {
  store = new MemorySubmissionStore();
  vi.resetModules();
  vi.stubEnv("GHL_CALLBACK_SECRET", "shared-secret-value");
  vi.stubEnv("GHL_MARKETPLACE_PUBLIC_KEY", publicKeyPem);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("signature verification", () => {
  it("accepts a correctly signed body", () => {
    const body = JSON.stringify(validEvent());
    expect(verifyMarketplaceSignature(body, signBody(body), publicKeyPem)).toBe(true);
  });

  it("rejects a body that was altered after signing", () => {
    const body = JSON.stringify(validEvent());
    const signature = signBody(body);
    const tampered = JSON.stringify(validEvent({ locationId: "loc_attacker" }));
    expect(verifyMarketplaceSignature(tampered, signature, publicKeyPem)).toBe(false);
  });

  it("rejects a signature produced by a different key", () => {
    const other = generateKeyPairSync("ed25519");
    const body = JSON.stringify(validEvent());
    const signature = cryptoSign(null, Buffer.from(body), other.privateKey).toString("base64");
    expect(verifyMarketplaceSignature(body, signature, publicKeyPem)).toBe(false);
  });

  it("rejects an empty or malformed signature", () => {
    const body = JSON.stringify(validEvent());
    expect(verifyMarketplaceSignature(body, "", publicKeyPem)).toBe(false);
    expect(verifyMarketplaceSignature(body, "!!!not base64!!!", publicKeyPem)).toBe(false);
  });
});

describe("route authentication", () => {
  it("rejects an unauthenticated request", async () => {
    const { POST } = await loadRoute();
    const response = await POST(post(validEvent()));
    expect(response.status).toBe(401);
  });

  it("rejects an incorrect shared secret", async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      post(validEvent(), { "x-aion-callback-secret": "wrong-secret-val" }),
    );
    expect(response.status).toBe(401);
  });

  it("accepts a correct shared secret and reports the mechanism used", async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      post(validEvent(), { "x-aion-callback-secret": "shared-secret-value" }),
    );
    const data = await response.json();
    expect(response.status).toBe(202);
    expect(data.mechanism).toBe("shared-secret");
  });

  it("does not accept a shared secret in place of a platform signature", async () => {
    // A request carrying a signature header is verified as a signature; the
    // shared secret cannot be used to satisfy it.
    const { POST } = await loadRoute();
    const response = await POST(
      post(validEvent(), {
        "x-ghl-signature": "bogus",
        "x-aion-callback-secret": "shared-secret-value",
      }),
    );
    expect(response.status).toBe(401);
  });

  it("accepts a platform-signed request", async () => {
    const event = validEvent();
    const body = JSON.stringify(event);
    const { POST } = await loadRoute();
    const response = await POST(
      new Request("https://aion.test/api/integrations/ghl/callback", {
        method: "POST",
        headers: { "x-ghl-signature": signBody(body), "Content-Type": "application/json" },
        body,
      }) as RouteRequest,
    );
    const data = await response.json();
    expect(response.status).toBe(202);
    expect(data.mechanism).toBe("marketplace-signature");
  });

  it("refuses everything when no authentication is configured at all", async () => {
    vi.stubEnv("GHL_CALLBACK_SECRET", "");
    const { POST } = await loadRoute();
    const response = await POST(post(validEvent()));
    expect(response.status).toBe(401);
  });
});

describe("schema and deduplication", () => {
  it("rejects an event missing required identity fields", async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      post({ eventType: "AppointmentCreate" }, { "x-aion-callback-secret": "shared-secret-value" }),
    );
    expect(response.status).toBe(400);
  });

  it("acknowledges a redelivered event without applying it twice", async () => {
    const { POST } = await loadRoute();
    const headers = { "x-aion-callback-secret": "shared-secret-value" };

    const first = await POST(post(validEvent(), headers));
    const second = await POST(post(validEvent(), headers));

    expect(first.status).toBe(202);
    expect(second.status).toBe(200);
    expect((await second.json()).deduplicated).toBe(true);
  });

  it("validates the event schema", () => {
    expect(callbackEventSchema.safeParse(validEvent()).success).toBe(true);
    expect(callbackEventSchema.safeParse({ eventId: "", eventType: "x" }).success).toBe(false);
  });
});

describe("booking confirmation", () => {
  it("records a stage transition only for a confirmed appointment", async () => {
    const { POST } = await loadRoute();
    const headers = { "x-aion-callback-secret": "shared-secret-value" };

    const confirmed = await POST(post(validEvent(), headers));
    expect((await confirmed.json()).stageTransition).toMatchObject({
      to: "strategy-call-booked",
    });

    const cancelled = await POST(
      post(
        validEvent({ eventId: "evt_2", appointment: { id: "appt_2", status: "cancelled" } }),
        headers,
      ),
    );
    expect((await cancelled.json()).stageTransition).toBeNull();
  });

  it("records no transition for an unrelated event type", async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      post(validEvent({ eventId: "evt_3", eventType: "ContactUpdate" }), {
        "x-aion-callback-secret": "shared-secret-value",
      }),
    );
    expect((await response.json()).stageTransition).toBeNull();
  });
});

describe("stage ordering", () => {
  it("never allows an opportunity to move backwards", () => {
    expect(isForwardTransition("new-assessment", "strategy-call-booked")).toBe(true);
    expect(isForwardTransition("qualified", "new-assessment")).toBe(false);
    expect(isForwardTransition("proposal-sent", "strategy-call-booked")).toBe(false);
    expect(isForwardTransition("contacted", "contacted")).toBe(false);
    expect(isForwardTransition(null, "new-assessment")).toBe(true);
  });
});
