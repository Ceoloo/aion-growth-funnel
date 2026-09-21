import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SqliteSubmissionStore } from "@/lib/store/sqlite";
import { MemorySubmissionStore } from "@/lib/store/memory";
import type { SubmissionRecord, SubmissionStore } from "@/lib/store/types";
import { makeLead } from "./helpers/lead";

/**
 * Store contract, run against both drivers.
 *
 * The SQLite pass also verifies the property the whole outbox rests on:
 * a pending submission is still pending after the process that accepted it
 * has gone away.
 */

let dir: string;

function record(id: string, overrides: Partial<SubmissionRecord> = {}): SubmissionRecord {
  return {
    submissionId: id,
    receivedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "received",
    lead: makeLead({ submissionId: id }),
    attempts: 0,
    nextAttemptAt: null,
    lockedUntil: null,
    lastError: null,
    steps: {},
    mode: "api",
    ...overrides,
  };
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "aion-store-"));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

function contractTests(name: string, create: () => Promise<SubmissionStore>) {
  describe(`${name} driver`, () => {
    it("enforces uniqueness on the submission id", async () => {
      const store = await create();
      const first = await store.insert(record("a1111111-1111-4111-8111-111111111111"));
      const second = await store.insert(record("a1111111-1111-4111-8111-111111111111"));

      expect(first.created).toBe(true);
      expect(second.created).toBe(false);
      expect(second.record.submissionId).toBe("a1111111-1111-4111-8111-111111111111");
      await store.close();
    });

    it("round-trips the canonical lead and step state", async () => {
      const store = await create();
      const id = "a2222222-2222-4222-8222-222222222222";
      await store.insert(record(id));
      await store.update(id, {
        status: "delivering",
        attempts: 1,
        steps: { contact: { status: "done", externalId: "contact_9", attempts: 1 } },
      });

      const loaded = await store.get(id);
      expect(loaded?.status).toBe("delivering");
      expect(loaded?.steps.contact?.externalId).toBe("contact_9");
      expect(loaded?.lead.contact.businessName).toBe("Example Builders");
      await store.close();
    });

    it("merges step patches rather than replacing the whole map", async () => {
      const store = await create();
      const id = "a3333333-3333-4333-8333-333333333333";
      await store.insert(record(id));
      await store.update(id, { steps: { contact: { status: "done", attempts: 1 } } });
      await store.update(id, { steps: { tags: { status: "done", attempts: 1 } } });

      const loaded = await store.get(id);
      expect(loaded?.steps.contact?.status).toBe("done");
      expect(loaded?.steps.tags?.status).toBe("done");
      await store.close();
    });

    it("claims only submissions that are due", async () => {
      const store = await create();
      await store.insert(record("a4444444-4444-4444-8444-444444444444"));
      await store.insert(
        record("a5555555-5555-4555-8555-555555555555", {
          nextAttemptAt: new Date(Date.now() + 600_000).toISOString(),
        }),
      );
      await store.insert(
        record("a6666666-6666-4666-8666-666666666666", { status: "delivered" }),
      );

      const claimed = await store.claimDue(new Date(), 10, new Date(Date.now() + 60_000));
      expect(claimed.map((r) => r.submissionId)).toEqual([
        "a4444444-4444-4444-8444-444444444444",
      ]);
      await store.close();
    });

    it("does not hand the same record to a second worker while it is locked", async () => {
      const store = await create();
      await store.insert(record("a7777777-7777-4777-8777-777777777777"));

      const first = await store.claimDue(new Date(), 10, new Date(Date.now() + 60_000));
      const second = await store.claimDue(new Date(), 10, new Date(Date.now() + 60_000));

      expect(first).toHaveLength(1);
      expect(second).toHaveLength(0);
      await store.close();
    });

    it("counts submissions per hashed address for rate limiting", async () => {
      const store = await create();
      await store.insert(record("a8888888-8888-4888-8888-888888888888"));
      await store.recordIpHash("a8888888-8888-4888-8888-888888888888", "hash_a");

      const since = new Date(Date.now() - 60_000);
      expect(await store.countByIpHashSince("hash_a", since)).toBe(1);
      expect(await store.countByIpHashSince("hash_b", since)).toBe(0);
      await store.close();
    });

    it("reports a callback event as fresh exactly once", async () => {
      const store = await create();
      expect(await store.markCallbackSeen("evt_x", new Date())).toBe(true);
      expect(await store.markCallbackSeen("evt_x", new Date())).toBe(false);
      await store.close();
    });

    it("returns null for an unknown submission", async () => {
      const store = await create();
      expect(await store.get("missing")).toBeNull();
      expect(await store.update("missing", { attempts: 2 })).toBeNull();
      await store.close();
    });
  });
}

contractTests("memory", async () => {
  const store = new MemorySubmissionStore();
  await store.init();
  return store;
});

contractTests("sqlite", async () => {
  const store = new SqliteSubmissionStore(join(dir, `${crypto.randomUUID()}.sqlite`));
  await store.init();
  return store;
});

describe("durability across a restart", () => {
  it("keeps a pending submission after the store is closed and reopened", async () => {
    const path = join(dir, "restart.sqlite");
    const id = "b1111111-1111-4111-8111-111111111111";

    const first = new SqliteSubmissionStore(path);
    await first.init();
    await first.insert(
      record(id, {
        attempts: 2,
        lastError: "upstream timeout",
        steps: { contact: { status: "done", externalId: "contact_r", attempts: 1 } },
      }),
    );
    await first.close();

    // A completely new store object, as a restarted process would create.
    const second = new SqliteSubmissionStore(path);
    await second.init();
    const loaded = await second.get(id);

    expect(loaded).not.toBeNull();
    expect(loaded?.attempts).toBe(2);
    expect(loaded?.steps.contact?.externalId).toBe("contact_r");
    expect(loaded?.lead.contact.email).toBe("dana@examplebuilders.test");

    // And it is still claimable for delivery.
    const due = await second.claimDue(new Date(), 5, new Date(Date.now() + 60_000));
    expect(due.map((r) => r.submissionId)).toContain(id);
    await second.close();
  });
});
