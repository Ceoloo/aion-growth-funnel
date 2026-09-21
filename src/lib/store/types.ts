import type { CanonicalLead } from "../canonical";

/** Delivery steps tracked independently so a retry can resume mid-way. */
export const DELIVERY_STEPS = [
  "contact",
  "custom_fields",
  "tags",
  "opportunity",
  "note",
  "workflow_event",
  "generic_webhook",
] as const;

export type DeliveryStepName = (typeof DELIVERY_STEPS)[number];

export type StepStatus = "pending" | "done" | "skipped" | "failed";

export interface DeliveryStepState {
  status: StepStatus;
  /** Provider id produced by this step (contact id, opportunity id, note id). */
  externalId?: string;
  attempts: number;
  lastError?: string;
  completedAt?: string;
  /**
   * Set when a request failed in a way that leaves the outcome unknown
   * (timeout, aborted connection). The next attempt must reconcile before it
   * writes anything, so the same record is not created twice.
   */
  ambiguous?: boolean;
}

export type SubmissionStatus =
  | "received"
  | "delivering"
  | "delivered"
  | "needs_operator"
  | "failed_permanent";

export interface SubmissionRecord {
  submissionId: string;
  receivedAt: string;
  updatedAt: string;
  status: SubmissionStatus;
  lead: CanonicalLead;
  attempts: number;
  nextAttemptAt: string | null;
  lockedUntil: string | null;
  lastError: string | null;
  steps: Partial<Record<DeliveryStepName, DeliveryStepState>>;
  /** Integration mode in force when the submission was accepted. */
  mode: string | null;
}

export interface InsertResult {
  record: SubmissionRecord;
  /** False when a record with this submission id already existed. */
  created: boolean;
}

/**
 * Durable submission store.
 *
 * Implementations must be safe across process restarts and must enforce
 * uniqueness on `submissionId`. In-memory storage is acceptable only in tests.
 */
export interface SubmissionStore {
  readonly driver: string;
  init(): Promise<void>;
  /** Insert if absent. Returns the existing record (created=false) otherwise. */
  insert(record: SubmissionRecord): Promise<InsertResult>;
  get(submissionId: string): Promise<SubmissionRecord | null>;
  update(
    submissionId: string,
    patch: Partial<Omit<SubmissionRecord, "submissionId" | "lead">>,
  ): Promise<SubmissionRecord | null>;
  /**
   * Atomically claim up to `limit` records that are due for a delivery
   * attempt, marking them locked until `lockUntil` so two workers running at
   * once cannot process the same record.
   */
  claimDue(now: Date, limit: number, lockUntil: Date): Promise<SubmissionRecord[]>;
  /** Submissions from one hashed IP since `since`, for rate limiting. */
  countByIpHashSince(ipHash: string, since: Date): Promise<number>;
  recordIpHash(submissionId: string, ipHash: string): Promise<void>;
  /** Idempotency guard for inbound provider callbacks. */
  markCallbackSeen(eventId: string, receivedAt: Date): Promise<boolean>;
  close(): Promise<void>;
}

export class StoreUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreUnavailableError";
  }
}

export class StoreNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreNotConfiguredError";
  }
}

export function newStepState(): DeliveryStepState {
  return { status: "pending", attempts: 0 };
}
