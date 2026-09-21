/**
 * Minimal structured logger with redaction.
 *
 * Contact details and credentials must never reach the logs. Rather than
 * relying on call sites to remember, every value passed through here is run
 * past a redactor that drops known-sensitive keys and masks anything that
 * looks like an email address or a bearer token.
 */

const SENSITIVE_KEYS = new Set([
  "email",
  "phone",
  "fullname",
  "firstname",
  "lastname",
  "name",
  "contact",
  "authorization",
  "token",
  "accesstoken",
  "secret",
  "password",
  "apikey",
  "webhookurl",
  "url",
]);

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const BEARER_RE = /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi;

export function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[deep]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value.replace(EMAIL_RE, "[email]").replace(BEARER_RE, "Bearer [redacted]");
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redactValue(v, depth + 1));
  if (value instanceof Error) return { name: value.name, message: redactValue(value.message) };
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEYS.has(key.toLowerCase())
        ? "[redacted]"
        : redactValue(val, depth + 1);
    }
    return out;
  }
  return "[unserialisable]";
}

type Level = "debug" | "info" | "warn" | "error";

/** Tests set AION_LOG_SILENT=1 so expected failure paths do not spam output. */
function silenced(): boolean {
  return process.env.AION_LOG_SILENT === "1";
}

function emit(level: Level, message: string, context?: Record<string, unknown>) {
  if (silenced()) return;
  const line = {
    level,
    msg: message,
    at: new Date().toISOString(),
    ...(context ? (redactValue(context) as Record<string, unknown>) : {}),
  };
  const serialised = JSON.stringify(line);
  if (level === "error") console.error(serialised);
  else if (level === "warn") console.warn(serialised);
  else console.log(serialised);
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== "production") emit("debug", message, context);
  },
  info: (message: string, context?: Record<string, unknown>) => emit("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => emit("error", message, context),
};
