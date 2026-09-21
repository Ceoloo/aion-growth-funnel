import type {
  InsertResult,
  SubmissionRecord,
  SubmissionStore,
} from "./types";

/**
 * In-memory store.
 *
 * For tests and local experiments only. It is never selected automatically:
 * an unconfigured deployment returns an honest "unavailable" response rather
 * than silently accepting leads it cannot keep.
 */
export class MemorySubmissionStore implements SubmissionStore {
  readonly driver = "memory";
  private records = new Map<string, SubmissionRecord>();
  private ipHashes: { submissionId: string; ipHash: string; at: Date }[] = [];
  private callbackEvents = new Set<string>();

  async init(): Promise<void> {}

  async insert(record: SubmissionRecord): Promise<InsertResult> {
    const existing = this.records.get(record.submissionId);
    if (existing) return { record: structuredClone(existing), created: false };
    this.records.set(record.submissionId, structuredClone(record));
    return { record: structuredClone(record), created: true };
  }

  async get(submissionId: string): Promise<SubmissionRecord | null> {
    const found = this.records.get(submissionId);
    return found ? structuredClone(found) : null;
  }

  async update(
    submissionId: string,
    patch: Partial<Omit<SubmissionRecord, "submissionId" | "lead">>,
  ): Promise<SubmissionRecord | null> {
    const existing = this.records.get(submissionId);
    if (!existing) return null;
    const next: SubmissionRecord = {
      ...existing,
      ...patch,
      steps: patch.steps ? { ...existing.steps, ...patch.steps } : existing.steps,
      updatedAt: new Date().toISOString(),
    };
    this.records.set(submissionId, next);
    return structuredClone(next);
  }

  async claimDue(now: Date, limit: number, lockUntil: Date): Promise<SubmissionRecord[]> {
    const due = [...this.records.values()]
      .filter(
        (r) =>
          (r.status === "received" || r.status === "delivering") &&
          (r.nextAttemptAt === null || new Date(r.nextAttemptAt) <= now) &&
          (r.lockedUntil === null || new Date(r.lockedUntil) <= now),
      )
      .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
      .slice(0, limit);

    return due.map((record) => {
      const locked: SubmissionRecord = {
        ...record,
        status: "delivering",
        lockedUntil: lockUntil.toISOString(),
      };
      this.records.set(record.submissionId, locked);
      return structuredClone(locked);
    });
  }

  async countByIpHashSince(ipHash: string, since: Date): Promise<number> {
    return this.ipHashes.filter((e) => e.ipHash === ipHash && e.at >= since).length;
  }

  async recordIpHash(submissionId: string, ipHash: string): Promise<void> {
    this.ipHashes.push({ submissionId, ipHash, at: new Date() });
  }

  async markCallbackSeen(eventId: string): Promise<boolean> {
    if (this.callbackEvents.has(eventId)) return false;
    this.callbackEvents.add(eventId);
    return true;
  }

  async close(): Promise<void> {}

  /** Test helper. */
  all(): SubmissionRecord[] {
    return [...this.records.values()].map((r) => structuredClone(r));
  }
}
