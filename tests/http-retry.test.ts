import { afterEach, describe, expect, it, vi } from "vitest";
import {
  backoffDelayMs,
  classifyStatus,
  fetchJson,
  IntegrationError,
  parseRetryAfter,
} from "@/lib/http";

describe("status classification", () => {
  it("separates configuration failures from transient ones", () => {
    expect(classifyStatus(401)).toBe("configuration");
    expect(classifyStatus(403)).toBe("configuration");
    expect(classifyStatus(429)).toBe("rate_limited");
    expect(classifyStatus(500)).toBe("transient");
    expect(classifyStatus(503)).toBe("transient");
    expect(classifyStatus(422)).toBe("permanent");
    expect(classifyStatus(404)).toBe("permanent");
  });

  it("marks rate limits and transient failures as retryable", () => {
    expect(new IntegrationError("x", { kind: "transient" }).isRetryable).toBe(true);
    expect(new IntegrationError("x", { kind: "rate_limited" }).isRetryable).toBe(true);
    expect(new IntegrationError("x", { kind: "ambiguous" }).isRetryable).toBe(true);
    expect(new IntegrationError("x", { kind: "configuration" }).isRetryable).toBe(false);
    expect(new IntegrationError("x", { kind: "permanent" }).isRetryable).toBe(false);
  });
});

describe("Retry-After parsing", () => {
  it("reads a delay in seconds", () => {
    expect(parseRetryAfter("120")).toBe(120_000);
  });

  it("reads an HTTP date", () => {
    const future = new Date(Date.now() + 30_000).toUTCString();
    const parsed = parseRetryAfter(future) ?? 0;
    expect(parsed).toBeGreaterThan(20_000);
    expect(parsed).toBeLessThanOrEqual(30_000);
  });

  it("caps an absurd value and ignores nonsense", () => {
    expect(parseRetryAfter("999999")).toBe(300_000);
    expect(parseRetryAfter("soon")).toBeUndefined();
    expect(parseRetryAfter(null)).toBeUndefined();
  });
});

describe("backoff", () => {
  it("grows exponentially across attempts", () => {
    const max = (attempt: number) => backoffDelayMs(attempt, { random: () => 1 });
    expect(max(1)).toBe(2_000);
    expect(max(2)).toBe(4_000);
    expect(max(3)).toBe(8_000);
    expect(max(6)).toBe(64_000);
  });

  it("applies jitter so retries do not land in lockstep", () => {
    // Full jitter: the delay varies between attempts with the same input.
    const low = backoffDelayMs(5, { random: () => 0 });
    const high = backoffDelayMs(5, { random: () => 1 });
    expect(high).toBeGreaterThan(low);
  });

  it("never returns less than the base delay", () => {
    expect(backoffDelayMs(4, { random: () => 0 })).toBeGreaterThanOrEqual(2_000);
  });

  it("treats Retry-After as a floor, not a ceiling", () => {
    expect(backoffDelayMs(1, { retryAfterMs: 90_000, random: () => 1 })).toBe(90_000);
    // A longer computed backoff wins over a shorter Retry-After.
    expect(backoffDelayMs(10, { retryAfterMs: 1_000, random: () => 1 })).toBeGreaterThan(
      1_000,
    );
  });

  it("is capped so a stuck submission does not retry a year from now", () => {
    expect(backoffDelayMs(40, { random: () => 1 })).toBe(6 * 60 * 60 * 1000);
  });
});

describe("fetchJson", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("times out and reports a write as ambiguous", async () => {
    vi.stubGlobal("fetch", (_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    });

    await expect(
      fetchJson("https://api.test/x", {
        method: "POST",
        body: {},
        timeoutMs: 20,
        label: "test write",
      }),
    ).rejects.toMatchObject({ kind: "ambiguous" });
  });

  it("treats a timed-out read as transient, since nothing was written", async () => {
    vi.stubGlobal("fetch", (_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    });

    await expect(
      fetchJson("https://api.test/x", { timeoutMs: 20, label: "test read" }),
    ).rejects.toMatchObject({ kind: "transient" });
  });

  it("surfaces the status and Retry-After from a rate-limited response", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(JSON.stringify({ message: "slow down" }), {
          status: 429,
          headers: { "Retry-After": "45" },
        }),
    );

    await expect(
      fetchJson("https://api.test/x", { timeoutMs: 1_000, label: "test" }),
    ).rejects.toMatchObject({ kind: "rate_limited", status: 429, retryAfterMs: 45_000 });
  });

  it("returns parsed JSON on success", async () => {
    vi.stubGlobal(
      "fetch",
      async () => new Response(JSON.stringify({ contact: { id: "c1" } }), { status: 201 }),
    );
    const result = await fetchJson<{ contact: { id: string } }>("https://api.test/x", {
      timeoutMs: 1_000,
      label: "test",
    });
    expect(result.status).toBe(201);
    expect(result.data.contact.id).toBe("c1");
  });

  it("does not choke on a non-JSON error body", async () => {
    vi.stubGlobal("fetch", async () => new Response("<html>gateway</html>", { status: 502 }));
    await expect(
      fetchJson("https://api.test/x", { timeoutMs: 1_000, label: "test" }),
    ).rejects.toMatchObject({ kind: "transient", status: 502 });
  });
});
