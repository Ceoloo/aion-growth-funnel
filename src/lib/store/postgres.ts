import "server-only";
import type {
  InsertResult,
  SubmissionRecord,
  SubmissionStore,
} from "./types";
import { StoreUnavailableError } from "./types";

/**
 * Postgres-backed store.
 *
 * This is the driver to use on serverless platforms: state lives in the
 * database, not in the function instance, so a submission accepted by one
 * invocation is still pending delivery for the next one — and survives an
 * application restart.
 *
 * `claimDue` uses `FOR UPDATE SKIP LOCKED`, so several worker invocations can
 * run concurrently without processing the same submission twice.
 */

interface PgClientLike {
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[]; rowCount: number | null }>;
  release?(): void;
}

interface PgPoolLike {
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[]; rowCount: number | null }>;
  connect(): Promise<PgClientLike>;
  end(): Promise<void>;
}

interface Row {
  submission_id: string;
  received_at: Date | string;
  updated_at: Date | string;
  status: string;
  mode: string | null;
  lead_json: unknown;
  attempts: number;
  next_attempt_at: Date | string | null;
  locked_until: Date | string | null;
  last_error: string | null;
  steps_json: unknown;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS lead_submissions (
  submission_id   TEXT PRIMARY KEY,
  received_at     TIMESTAMPTZ NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL,
  mode            TEXT,
  lead_json       JSONB NOT NULL,
  attempts        INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ,
  locked_until    TIMESTAMPTZ,
  last_error      TEXT,
  steps_json      JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_lead_submissions_due
  ON lead_submissions (status, next_attempt_at);

CREATE TABLE IF NOT EXISTS lead_submission_sources (
  submission_id TEXT PRIMARY KEY,
  ip_hash       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lead_sources_ip
  ON lead_submission_sources (ip_hash, created_at);

CREATE TABLE IF NOT EXISTS integration_callback_events (
  event_id    TEXT PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL
);
`;

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toRecord(row: Row): SubmissionRecord {
  return {
    submissionId: row.submission_id,
    receivedAt: iso(row.received_at) ?? new Date(0).toISOString(),
    updatedAt: iso(row.updated_at) ?? new Date(0).toISOString(),
    status: row.status as SubmissionRecord["status"],
    mode: row.mode,
    lead: (typeof row.lead_json === "string"
      ? JSON.parse(row.lead_json)
      : row.lead_json) as SubmissionRecord["lead"],
    attempts: row.attempts,
    nextAttemptAt: iso(row.next_attempt_at),
    lockedUntil: iso(row.locked_until),
    lastError: row.last_error,
    steps: (typeof row.steps_json === "string"
      ? JSON.parse(row.steps_json)
      : row.steps_json) as SubmissionRecord["steps"],
  };
}

export class PostgresSubmissionStore implements SubmissionStore {
  readonly driver = "postgres";
  private pool: PgPoolLike | null = null;

  constructor(private readonly connectionString: string) {}

  async init(): Promise<void> {
    if (this.pool) return;
    let Pool: new (config: Record<string, unknown>) => PgPoolLike;
    try {
      const mod = (await import("pg")) as unknown as {
        default?: { Pool: new (config: Record<string, unknown>) => PgPoolLike };
        Pool?: new (config: Record<string, unknown>) => PgPoolLike;
      };
      const resolved = mod.Pool ?? mod.default?.Pool;
      if (!resolved) throw new Error("pg did not export Pool");
      Pool = resolved;
    } catch (error) {
      throw new StoreUnavailableError(
        `LEAD_STORE_DRIVER=postgres but the pg driver could not be loaded: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    const needsSsl = !/localhost|127\.0\.0\.1/.test(this.connectionString);
    this.pool = new Pool({
      connectionString: this.connectionString,
      max: 4,
      connectionTimeoutMillis: 8_000,
      idleTimeoutMillis: 10_000,
      ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    });
    await this.pool.query(SCHEMA);
  }

  private require(): PgPoolLike {
    if (!this.pool) throw new StoreUnavailableError("Postgres store used before init()");
    return this.pool;
  }

  async insert(record: SubmissionRecord): Promise<InsertResult> {
    const result = await this.require().query(
      `INSERT INTO lead_submissions
         (submission_id, received_at, updated_at, status, mode, lead_json,
          attempts, next_attempt_at, locked_until, last_error, steps_json)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11::jsonb)
       ON CONFLICT (submission_id) DO NOTHING
       RETURNING *`,
      [
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
      ],
    );

    if ((result.rowCount ?? 0) > 0) {
      return { record: toRecord(result.rows[0] as Row), created: true };
    }
    const existing = await this.get(record.submissionId);
    if (!existing) throw new StoreUnavailableError("Insert conflicted but row is missing");
    return { record: existing, created: false };
  }

  async get(submissionId: string): Promise<SubmissionRecord | null> {
    const result = await this.require().query(
      "SELECT * FROM lead_submissions WHERE submission_id = $1",
      [submissionId],
    );
    const row = result.rows[0] as Row | undefined;
    return row ? toRecord(row) : null;
  }

  async update(
    submissionId: string,
    patch: Partial<Omit<SubmissionRecord, "submissionId" | "lead">>,
  ): Promise<SubmissionRecord | null> {
    const current = await this.get(submissionId);
    if (!current) return null;
    const next: SubmissionRecord = {
      ...current,
      ...patch,
      steps: patch.steps ? { ...current.steps, ...patch.steps } : current.steps,
      updatedAt: new Date().toISOString(),
    };
    const result = await this.require().query(
      `UPDATE lead_submissions
          SET updated_at = $2, status = $3, mode = $4, attempts = $5,
              next_attempt_at = $6, locked_until = $7, last_error = $8,
              steps_json = $9::jsonb
        WHERE submission_id = $1
        RETURNING *`,
      [
        submissionId,
        next.updatedAt,
        next.status,
        next.mode,
        next.attempts,
        next.nextAttemptAt,
        next.lockedUntil,
        next.lastError,
        JSON.stringify(next.steps),
      ],
    );
    const row = result.rows[0] as Row | undefined;
    return row ? toRecord(row) : null;
  }

  async claimDue(now: Date, limit: number, lockUntil: Date): Promise<SubmissionRecord[]> {
    const client = await this.require().connect();
    try {
      await client.query("BEGIN");
      const selected = await client.query(
        `SELECT submission_id FROM lead_submissions
          WHERE status IN ('received','delivering')
            AND (next_attempt_at IS NULL OR next_attempt_at <= $1)
            AND (locked_until IS NULL OR locked_until <= $1)
          ORDER BY received_at ASC
          LIMIT $2
          FOR UPDATE SKIP LOCKED`,
        [now.toISOString(), limit],
      );
      const ids = (selected.rows as { submission_id: string }[]).map((r) => r.submission_id);
      if (ids.length === 0) {
        await client.query("COMMIT");
        return [];
      }
      const updated = await client.query(
        `UPDATE lead_submissions
            SET status = 'delivering', locked_until = $2, updated_at = $3
          WHERE submission_id = ANY($1::text[])
          RETURNING *`,
        [ids, lockUntil.toISOString(), now.toISOString()],
      );
      await client.query("COMMIT");
      return (updated.rows as Row[]).map(toRecord);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release?.();
    }
  }

  async countByIpHashSince(ipHash: string, since: Date): Promise<number> {
    const result = await this.require().query(
      "SELECT COUNT(*)::int AS n FROM lead_submission_sources WHERE ip_hash = $1 AND created_at >= $2",
      [ipHash, since.toISOString()],
    );
    return (result.rows[0] as { n: number } | undefined)?.n ?? 0;
  }

  async recordIpHash(submissionId: string, ipHash: string): Promise<void> {
    await this.require().query(
      `INSERT INTO lead_submission_sources (submission_id, ip_hash, created_at)
       VALUES ($1,$2,$3) ON CONFLICT (submission_id) DO NOTHING`,
      [submissionId, ipHash, new Date().toISOString()],
    );
  }

  async markCallbackSeen(eventId: string, receivedAt: Date): Promise<boolean> {
    const result = await this.require().query(
      `INSERT INTO integration_callback_events (event_id, received_at)
       VALUES ($1,$2) ON CONFLICT (event_id) DO NOTHING`,
      [eventId, receivedAt.toISOString()],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async close(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }
}
