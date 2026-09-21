import "server-only";

/**
 * Server-only environment access.
 *
 * Importing this module from a client component is a build error, which is the
 * mechanism that keeps tokens, webhook URLs and secrets out of the browser
 * bundle. Anything the browser legitimately needs goes through
 * `src/lib/public-config.ts` instead.
 */

function str(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function int(name: string, fallback: number): number {
  const raw = str(name);
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = str(name)?.toLowerCase();
  if (raw === undefined) return fallback;
  return raw === "1" || raw === "true" || raw === "yes";
}

export type IntegrationMode = "api" | "webhook" | "hybrid";

function integrationMode(): IntegrationMode | undefined {
  const raw = str("GHL_INTEGRATION_MODE")?.toLowerCase();
  if (raw === "api" || raw === "webhook" || raw === "hybrid") return raw;
  return undefined;
}

export const serverEnv = {
  get nodeEnv(): string {
    return process.env.NODE_ENV ?? "development";
  },

  // ---- Durable storage -------------------------------------------------
  /** `postgres` | `sqlite` | undefined (unconfigured). */
  get storeDriver(): string | undefined {
    return str("LEAD_STORE_DRIVER")?.toLowerCase();
  },
  get databaseUrl(): string | undefined {
    return str("DATABASE_URL");
  },
  get sqlitePath(): string | undefined {
    return str("LEAD_STORE_SQLITE_PATH");
  },

  // ---- Generic outbound webhook (pre-CRM / non-GHL destinations) --------
  get leadWebhookUrl(): string | undefined {
    return str("LEAD_WEBHOOK_URL");
  },
  get leadWebhookSecret(): string | undefined {
    return str("LEAD_WEBHOOK_SECRET");
  },

  // ---- GoHighLevel -----------------------------------------------------
  get ghlMode(): IntegrationMode | undefined {
    return integrationMode();
  },
  get ghlAccessToken(): string | undefined {
    return str("GHL_ACCESS_TOKEN");
  },
  get ghlLocationId(): string | undefined {
    return str("GHL_LOCATION_ID");
  },
  get ghlPipelineId(): string | undefined {
    return str("GHL_PIPELINE_ID");
  },
  get ghlNewAssessmentStageId(): string | undefined {
    return str("GHL_NEW_ASSESSMENT_STAGE_ID");
  },
  get ghlAssignedUserId(): string | undefined {
    return str("GHL_ASSIGNED_USER_ID");
  },
  get ghlInboundWebhookUrl(): string | undefined {
    return str("GHL_INBOUND_WEBHOOK_URL");
  },
  get ghlCallbackSecret(): string | undefined {
    return str("GHL_CALLBACK_SECRET");
  },
  get ghlCustomFieldMapJson(): string | undefined {
    return str("GHL_CUSTOM_FIELD_MAP_JSON");
  },
  get ghlApiBaseUrl(): string {
    return str("GHL_API_BASE_URL") ?? "https://services.leadconnectorhq.com";
  },
  /**
   * `Version` header sent on every GHL API call. One value is used for all
   * calls so versions are never mixed. See docs/ghl-integration.md before
   * changing it.
   */
  get ghlApiVersion(): string {
    return str("GHL_API_VERSION") ?? "v3";
  },
  /** Ed25519 public key used to verify marketplace webhook signatures. */
  get ghlMarketplacePublicKey(): string | undefined {
    return str("GHL_MARKETPLACE_PUBLIC_KEY");
  },

  // ---- Delivery behaviour ---------------------------------------------
  get httpTimeoutMs(): number {
    return int("INTEGRATION_HTTP_TIMEOUT_MS", 10_000);
  },
  get maxDeliveryAttempts(): number {
    return int("DELIVERY_MAX_ATTEMPTS", 8);
  },
  /**
   * Attempt delivery inline, inside the request that stored the submission.
   * This is a bounded synchronous attempt, not a background promise: if it
   * fails or runs out of budget the record stays in the outbox for the worker.
   */
  get inlineDelivery(): boolean {
    return bool("DELIVERY_INLINE", true);
  },
  get inlineDeliveryBudgetMs(): number {
    return int("DELIVERY_INLINE_BUDGET_MS", 6_000);
  },
  get workerBatchSize(): number {
    return int("DELIVERY_WORKER_BATCH", 10);
  },
  /** Shared secret required by the worker endpoint. */
  get workerSecret(): string | undefined {
    return str("DELIVERY_WORKER_SECRET");
  },

  // ---- Abuse controls --------------------------------------------------
  get ipHashSalt(): string | undefined {
    return str("LEAD_IP_HASH_SALT");
  },
  get maxSubmissionsPerIpPerHour(): number {
    return int("LEAD_MAX_PER_IP_PER_HOUR", 8);
  },

  // ---- Public values resolved server-side ------------------------------
  /**
   * Booking URL. Resolved server-side first so it can be changed without a
   * rebuild; falls back to the build-time public variable.
   */
  get bookingUrl(): string | undefined {
    return str("BOOKING_URL") ?? str("NEXT_PUBLIC_BOOKING_URL");
  },
  get contactEmail(): string | undefined {
    return str("CONTACT_EMAIL") ?? str("NEXT_PUBLIC_CONTACT_EMAIL");
  },
  get siteUrl(): string | undefined {
    return str("NEXT_PUBLIC_SITE_URL");
  },
} as const;

/** Names of variables that must never appear in a client bundle. */
export const SERVER_ONLY_ENV_NAMES = [
  "GHL_ACCESS_TOKEN",
  "GHL_LOCATION_ID",
  "GHL_PIPELINE_ID",
  "GHL_NEW_ASSESSMENT_STAGE_ID",
  "GHL_ASSIGNED_USER_ID",
  "GHL_INBOUND_WEBHOOK_URL",
  "GHL_CALLBACK_SECRET",
  "GHL_CUSTOM_FIELD_MAP_JSON",
  "LEAD_WEBHOOK_URL",
  "LEAD_WEBHOOK_SECRET",
  "DELIVERY_WORKER_SECRET",
  "DATABASE_URL",
  "LEAD_IP_HASH_SALT",
] as const;
