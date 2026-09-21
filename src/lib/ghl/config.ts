import "server-only";
import { serverEnv, type IntegrationMode } from "../env";

/**
 * Resolves and validates the GoHighLevel configuration.
 *
 * The mode is always explicit. There is no automatic fallback from one mode to
 * another: if API delivery fails in hybrid mode we retry API delivery, we do
 * not quietly switch to the webhook and produce a differently-shaped record.
 */

export interface GhlConfig {
  mode: IntegrationMode;
  baseUrl: string;
  apiVersion: string;
  accessToken?: string;
  locationId?: string;
  pipelineId?: string;
  newAssessmentStageId?: string;
  assignedUserId?: string;
  inboundWebhookUrl?: string;
  customFieldMap: Record<string, string>;
  timeoutMs: number;
}

export interface ConfigProblem {
  variable: string;
  message: string;
}

export type GhlConfigResult =
  | { configured: true; config: GhlConfig; warnings: ConfigProblem[] }
  | { configured: false; problems: ConfigProblem[]; warnings: ConfigProblem[] };

/**
 * Internal field names used by the mapping layer. The values in
 * GHL_CUSTOM_FIELD_MAP_JSON are the operator's real GoHighLevel custom-field
 * ids. We never invent an id: an unmapped field is simply not sent.
 */
export const CUSTOM_FIELD_KEYS = [
  "business_category",
  "primary_bottleneck",
  "inquiry_channels",
  "current_follow_up",
  "desired_outcome",
  "content_production_interest",
  "start_timeframe",
  "recommended_service",
  "submission_id",
  "submitted_at",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "landing_page",
  "referrer",
  "marketing_consent",
  "marketing_consent_at",
  "consent_copy_version",
] as const;

export type CustomFieldKey = (typeof CUSTOM_FIELD_KEYS)[number];

export function parseCustomFieldMap(raw: string | undefined): {
  map: Record<string, string>;
  warnings: ConfigProblem[];
} {
  const warnings: ConfigProblem[] = [];
  if (!raw) return { map: {}, warnings };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      map: {},
      warnings: [
        {
          variable: "GHL_CUSTOM_FIELD_MAP_JSON",
          message: "Value is not valid JSON. No custom fields will be sent.",
        },
      ],
    };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      map: {},
      warnings: [
        {
          variable: "GHL_CUSTOM_FIELD_MAP_JSON",
          message: "Value must be a JSON object of { internal_key: ghl_custom_field_id }.",
        },
      ],
    };
  }

  const map: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value !== "string" || value.trim() === "") {
      warnings.push({
        variable: "GHL_CUSTOM_FIELD_MAP_JSON",
        message: `Key "${key}" has a non-string or empty id and was ignored.`,
      });
      continue;
    }
    if (!(CUSTOM_FIELD_KEYS as readonly string[]).includes(key)) {
      warnings.push({
        variable: "GHL_CUSTOM_FIELD_MAP_JSON",
        message: `Key "${key}" is not a known AION field name and was ignored.`,
      });
      continue;
    }
    map[key] = value.trim();
  }
  return { map, warnings };
}

export function resolveGhlConfig(): GhlConfigResult {
  const mode = serverEnv.ghlMode;
  const problems: ConfigProblem[] = [];
  const { map, warnings } = parseCustomFieldMap(serverEnv.ghlCustomFieldMapJson);

  if (!mode) {
    problems.push({
      variable: "GHL_INTEGRATION_MODE",
      message: 'Not set. Use "api", "webhook" or "hybrid".',
    });
    return { configured: false, problems, warnings };
  }

  const needsApi = mode === "api" || mode === "hybrid";
  const needsWebhook = mode === "webhook" || mode === "hybrid";

  if (needsApi) {
    if (!serverEnv.ghlAccessToken) {
      problems.push({
        variable: "GHL_ACCESS_TOKEN",
        message: `Required in "${mode}" mode.`,
      });
    }
    if (!serverEnv.ghlLocationId) {
      problems.push({
        variable: "GHL_LOCATION_ID",
        message: `Required in "${mode}" mode.`,
      });
    }
    if (!serverEnv.ghlPipelineId) {
      warnings.push({
        variable: "GHL_PIPELINE_ID",
        message: "Not set — no opportunity will be created.",
      });
    } else if (!serverEnv.ghlNewAssessmentStageId) {
      warnings.push({
        variable: "GHL_NEW_ASSESSMENT_STAGE_ID",
        message:
          "Not set — opportunities will be created without an explicit stage, landing in the pipeline default.",
      });
    }
    if (Object.keys(map).length === 0) {
      warnings.push({
        variable: "GHL_CUSTOM_FIELD_MAP_JSON",
        message:
          "No custom fields mapped. Assessment answers will only reach the CRM via the contact note.",
      });
    }
  }

  if (needsWebhook && !serverEnv.ghlInboundWebhookUrl) {
    problems.push({
      variable: "GHL_INBOUND_WEBHOOK_URL",
      message: `Required in "${mode}" mode.`,
    });
  }

  if (problems.length > 0) return { configured: false, problems, warnings };

  return {
    configured: true,
    warnings,
    config: {
      mode,
      baseUrl: serverEnv.ghlApiBaseUrl.replace(/\/+$/, ""),
      apiVersion: serverEnv.ghlApiVersion,
      accessToken: serverEnv.ghlAccessToken,
      locationId: serverEnv.ghlLocationId,
      pipelineId: serverEnv.ghlPipelineId,
      newAssessmentStageId: serverEnv.ghlNewAssessmentStageId,
      assignedUserId: serverEnv.ghlAssignedUserId,
      inboundWebhookUrl: serverEnv.ghlInboundWebhookUrl,
      customFieldMap: map,
      timeoutMs: serverEnv.httpTimeoutMs,
    },
  };
}

/** Human-readable list of what is still missing, for the health endpoint. */
export function describeConfiguration(): {
  mode: IntegrationMode | null;
  ready: boolean;
  missing: ConfigProblem[];
  warnings: ConfigProblem[];
} {
  const result = resolveGhlConfig();
  if (result.configured) {
    return { mode: result.config.mode, ready: true, missing: [], warnings: result.warnings };
  }
  return {
    mode: serverEnv.ghlMode ?? null,
    ready: false,
    missing: result.problems,
    warnings: result.warnings,
  };
}
