import "server-only";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type {
  InsertResult,
  SubmissionRecord,
  SubmissionStore,
} from "./types";
import { StoreUnavailableError } from "./types";

/**
 * SQLite-backed store.
 *
 * Durable across restarts and a good fit for a single long-running Node
 * process (a VPS, a container, local development). It is NOT appropriate for
 * a serverless deployment with an ephemeral filesystem — use the Postgres
 * driver there.
 */

type SqliteDb = {
  pragma(source: string): unknown;
  exec(source: string): unknown;
  prepare(source: string): {
    run(...params: unknown[]): { changes: number };
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  };
  transaction<T extends (...args: never[]) => unknown>(fn: T): T;
  close(): void;
};

interface Row {
  submission_id: string;
  received_at: string;
  updated_at: string;
  status: string;
  mode: string | null;
  lead_json: string;
  attempts: number;
  next_attempt_at: string | null;
  locked_until: string | null;
  last_error: string | null;
  steps_json: string;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS lead_submissions (
  submission_id   TEXT PRIMARY KEY,
  received_at     TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  status          TEXT NOT NULL,
  mode            TEXT,
  lead_json       TEXT NOT NULL,
  attempts        INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  locked_until    TEXT,
  last_error      TEXT,
  steps_json      TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_lead_submissions_due
  ON lead_submissions (status, next_attempt_at);

CREATE TABLE IF NOT EXISTS lead_submission_sources (
  submission_id TEXT PRIMARY KEY,
  ip_hash       TEXT NOT NULL,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lead_sources_ip
  ON lead_submission_sources (ip_hash, created_at);

CREATE TABLE IF NOT EXISTS integration_callback_events (
  event_id    TEXT PRIMARY KEY,
  received_at TEXT NOT NULL
);
`;

function toRecord(row: Row): SubmissionRecord {
  return {
    submissionId: row.submission_id,
    receivedAt: row.received_at,
    updatedAt: row.updated_at,
    status: row.status as SubmissionRecord["status"],
    mode: row.mode,
    lead: JSON.parse(row.lead_json) as SubmissionRecord["lead"],
    attempts: row.attempts,
    nextAttemptAt: row.next_attempt_at,
    lockedUntil: row.locked_until,
    lastError: row.last_error,
    steps: JSON.parse(row.steps_json) as SubmissionRecord["steps"],
  };
}

export class SqliteSubmissionStore implements SubmissionStore {
  readonly driver = "sqlite";
  private db: SqliteDb | null = null;

  constructor(private readonly path: string) {}

  async init(): Promise<void> {
    if (this.db) return;
    let Database: new (path: string) => SqliteDb;
    try {
      const mod = (await import("better-sqlite3")) as unknown as {
        default: new (path: string) => SqliteDb;
      };
      Database = mod.default;
    } catch (error) {
      throw new StoreUnavailableError(
        `LEAD_STORE_DRIVER=sqlite but better-sqlite3 could not be loaded: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    try {
      mkdirSync(dirname(this.path), { recursive: true });
    } catch {
      // Directory may already exist, or the path may be ':memory:'.
    }
    const db = new Database(this.path);
    db.pragma("journal_mode = WAL");
    db.pragma("busy_timeout = 5000");
    db.exec(SCHEMA);
    this.db = db;
  }

  private require(): SqliteDb {
    if (!this.db) throw new StoreUnavailableError("SQLite store used before init()");
    return this.db;
  }

  async insert(record: SubmissionRecord): Promise<InsertResult> {
    const db = this.require();
    const result = db
      .prepare(
        `INSERT INTO lead_submissions
           (submission_id, received_at, updated_at, status, mode, lead_json,
            attempts, next_attempt_at, locked_until, last_error, steps_json)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT (submission_id) DO NOTHING`,
      )
      .run(
        record.submissionId,
        record.receivedAt,
        record.updatedAt,
        record.status,
        record.mode,
        JSON.stringify(record.lead),
        record.attempts,
        record.nextAttemptAt,
        record.lockedUntil,
        record.lastError,
        JSON.stringify(record.steps),
      );

    if (result.changes === 1) return { record, created: true };
    const existing = await this.get(record.submissionId);
    if (!existing) throw new StoreUnavailableError("Insert conflicted but row is missing");
    return { record: existing, created: false };
  }

  async get(submissionId: string): Promise<SubmissionRecord | null> {
    const row = this.require()
      .prepare("SELECT * FROM lead_submissions WHERE submission_id = ?")
      .get(submissionId) as Row | undefined;
    return row ? toRecord(row) : null;
  }

  async update(
    submissionId: string,
    patch: Partial<Omit<SubmissionRecord, "submissionId" | "lead">>,
  ): Promise<SubmissionRecord | null> {
    const db = this.require();
    const current = await this.get(submissionId);
    if (!current) return null;
    const next: SubmissionRecord = {
      ...current,
      ...patch,
      steps: patch.steps ? { ...current.steps, ...patch.steps } : current.steps,
      updatedAt: new Date().toISOString(),
    };
    db.prepare(
      `UPDATE lead_submissions
          SET updated_at = ?, status = ?, mode = ?, attempts = ?,
              next_attempt_at = ?, locked_until = ?, last_error = ?, steps_json = ?
        WHERE submission_id = ?`,
    ).run(
      next.updatedAt,
      next.status,
      next.mode,
      next.attempts,
      next.nextAttemptAt,
      next.lockedUntil,
      next.lastError,
      JSON.stringify(next.steps),
      submissionId,
    );
    return next;
  }

  async claimDue(now: Date, limit: number, lockUntil: Date): Promise<SubmissionRecord[]> {
    const db = this.require();
    const nowIso = now.toISOString();
    const claim = db.transaction(((): SubmissionRecord[] => {
      const rows = db
        .prepare(
          `SELECT * FROM lead_submissions
            WHERE status IN ('received','delivering')
              AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
              AND (locked_until IS NULL OR locked_until <= ?)
            ORDER BY received_at ASC
            LIMIT ?`,
        )
        .all(nowIso, nowIso, limit) as Row[];

      const update = db.prepare(
        `UPDATE lead_submissions
            SET status = 'delivering', locked_until = ?, updated_at = ?
          WHERE submission_id = ?`,
      );
      const claimed: SubmissionRecord[] = [];
      for (const row of rows) {
        update.run(lockUntil.toISOString(), nowIso, row.submission_id);
        claimed.push({
          ...toRecord(row),
          status: "delivering",
          lockedUntil: lockUntil.toISOString(),
        });
      }
      return claimed;
    }) as unknown as (...args: never[]) => SubmissionRecord[]);

    return claim();
  }

  async countByIpHashSince(ipHash: string, since: Date): Promise<number> {
    const row = this.require()
      .prepare(
        "SELECT COUNT(*) AS n FROM lead_submission_sources WHERE ip_hash = ? AND created_at >= ?",
      )
      .get(ipHash, since.toISOString()) as { n: number } | undefined;
    return row?.n ?? 0;
  }

  async recordIpHash(submissionId: string, ipHash: string): Promise<void> {
    this.require()
      .prepare(
        `INSERT INTO lead_submission_sources (submission_id, ip_hash, created_at)
         VALUES (?,?,?) ON CONFLICT (submission_id) DO NOTHING`,
      )
      .run(submissionId, ipHash, new Date().toISOString());
  }

  async markCallbackSeen(eventId: string, receivedAt: Date): Promise<boolean> {
    const result = this.require()
      .prepare(
        `INSERT INTO integration_callback_events (event_id, received_at)
         VALUES (?,?) ON CONFLICT (event_id) DO NOTHING`,
      )
      .run(eventId, receivedAt.toISOString());
    return result.changes === 1;
  }

  async close(): Promise<void> {
    this.db?.close();
    this.db = null;
  }
}
