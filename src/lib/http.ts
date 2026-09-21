/**
 * HTTP helpers shared by every outbound integration.
 *
 * Three behaviours matter here and are relied on by the delivery runner:
 *  - every request is bounded by a timeout;
 *  - failures are classified so the caller knows whether to retry, whether an
 *    operator must intervene, or whether the outcome is simply unknown;
 *  - backoff is exponential with full jitter, and honours `Retry-After`.
 */

export type FailureKind =
  | "transient"
  | "rate_limited"
  | "configuration"
  | "permanent"
  | "ambiguous";

export class IntegrationError extends Error {
  readonly kind: FailureKind;
  readonly status?: number;
  readonly retryAfterMs?: number;

  constructor(
    message: string,
    options: { kind: FailureKind; status?: number; retryAfterMs?: number; cause?: unknown },
  ) {
    super(message, { cause: options.cause });
    this.name = "IntegrationError";
    this.kind = options.kind;
    this.status = options.status;
    this.retryAfterMs = options.retryAfterMs;
  }

  /** True when the request may have been applied even though it failed. */
  get isAmbiguous(): boolean {
    return this.kind === "ambiguous";
  }

  get isRetryable(): boolean {
    return this.kind === "transient" || this.kind === "rate_limited" || this.kind === "ambiguous";
  }
}

export function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 300_000);
  const date = Date.parse(header);
  if (Number.isFinite(date)) {
    const delta = date - Date.now();
    if (delta > 0) return Math.min(delta, 300_000);
  }
  return undefined;
}

/** Classifies an HTTP status into a failure kind. */
export function classifyStatus(status: number): FailureKind {
  if (status === 401 || status === 403) return "configuration";
  if (status === 404) return "permanent";
  if (status === 408) return "transient";
  if (status === 409) return "permanent";
  if (status === 422) return "permanent";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "transient";
  if (status >= 400) return "permanent";
  return "permanent";
}

export interface FetchJsonOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs: number;
  /** Used only to make error messages readable; never logged with the body. */
  label: string;
  signal?: AbortSignal;
}

export interface FetchJsonResult<T> {
  status: number;
  data: T;
}

/**
 * Performs one HTTP request. Retrying is the caller's job — the delivery runner
 * owns the retry schedule so that attempts are persisted between tries rather
 * than looping inside a single serverless invocation.
 */
export async function fetchJson<T = unknown>(
  url: string,
  options: FetchJsonOptions,
): Promise<FetchJsonResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  const onExternalAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onExternalAbort);

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error) {
    const aborted = controller.signal.aborted;
    const isWrite = (options.method ?? "GET").toUpperCase() !== "GET";
    throw new IntegrationError(
      aborted
        ? `${options.label}: request timed out after ${options.timeoutMs}ms`
        : `${options.label}: network error`,
      {
        // A write that timed out may still have been applied upstream.
        kind: isWrite ? "ambiguous" : "transient",
        cause: error,
      },
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onExternalAbort);
  }

  const text = await response.text().catch(() => "");
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 500) };
    }
  }

  if (!response.ok) {
    throw new IntegrationError(
      `${options.label}: HTTP ${response.status}${
        text ? ` — ${text.slice(0, 200)}` : ""
      }`,
      {
        kind: classifyStatus(response.status),
        status: response.status,
        retryAfterMs: parseRetryAfter(response.headers.get("retry-after")),
      },
    );
  }

  return { status: response.status, data: data as T };
}

const BASE_DELAY_MS = 2_000;
const MAX_DELAY_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Exponential backoff with full jitter.
 *
 * Full jitter (a uniform random value in `[0, capped]`) is used rather than a
 * fixed delay so that a batch of submissions failing at the same moment does
 * not retry in lockstep and re-create the same spike.
 */
export function backoffDelayMs(
  attempt: number,
  options: { retryAfterMs?: number; random?: () => number } = {},
): number {
  const random = options.random ?? Math.random;
  const capped = Math.min(BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1), MAX_DELAY_MS);
  const jittered = Math.round(random() * capped);
  const floor = Math.min(BASE_DELAY_MS, capped);
  const base = Math.max(floor, jittered);
  // A server-supplied Retry-After is a lower bound we must respect.
  if (options.retryAfterMs !== undefined) return Math.max(base, options.retryAfterMs);
  return base;
}
