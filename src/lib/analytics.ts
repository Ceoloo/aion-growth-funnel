"use client";

/**
 * Vendor-neutral analytics adapter.
 *
 * Nothing here is tied to a specific analytics product. A sink is registered
 * at runtime (see `registerAnalyticsSink`); with no sink registered, events go
 * nowhere in production and to the console in development.
 *
 * Privacy rule enforced in code, not by convention: event properties are
 * restricted to a fixed vocabulary of non-identifying values. Names, email
 * addresses, phone numbers, business names, website URLs and any free text are
 * never accepted — `sanitiseProps` drops anything that is not an allow-listed
 * key with a primitive, bounded value.
 */

export type AnalyticsEventName =
  | "landing_cta_clicked"
  | "assessment_started"
  | "assessment_step_completed"
  | "assessment_completed"
  | "recommendation_viewed"
  | "lead_submission_succeeded"
  | "lead_submission_failed"
  | "booking_link_clicked";

/**
 * Keys allowed on an analytics event. All of these hold ids from a closed
 * vocabulary (step ids, answer ids, service ids) or small integers.
 */
const ALLOWED_PROP_KEYS = new Set([
  "step_id",
  "step_index",
  "step_total",
  "audience",
  "bottleneck",
  "follow_up",
  "goal",
  "content_need",
  "timing",
  "channel_count",
  "recommended_service",
  "recommendation_rule",
  "includes_production",
  "cta_id",
  "cta_location",
  "error_code",
  "answer_count",
  "has_booking_link",
]);

const MAX_STRING_LENGTH = 64;

export type AnalyticsProps = Record<string, string | number | boolean | undefined>;

export function sanitiseProps(props: AnalyticsProps | undefined): Record<
  string,
  string | number | boolean
> {
  if (!props) return {};
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!ALLOWED_PROP_KEYS.has(key)) continue;
    if (value === undefined) continue;
    if (typeof value === "string") {
      // Ids only. Anything with whitespace or an @ is free text and is dropped.
      if (value.length > MAX_STRING_LENGTH) continue;
      if (/\s|@/.test(value)) continue;
      out[key] = value;
    } else if (typeof value === "number") {
      if (Number.isFinite(value)) out[key] = value;
    } else if (typeof value === "boolean") {
      out[key] = value;
    }
  }
  return out;
}

export interface AnalyticsSink {
  track(event: AnalyticsEventName, props: Record<string, string | number | boolean>): void;
}

let sink: AnalyticsSink | null = null;

/**
 * Point the adapter at a real analytics product.
 *
 * Example (GA4):
 *   registerAnalyticsSink({ track: (e, p) => window.gtag?.("event", e, p) });
 */
export function registerAnalyticsSink(next: AnalyticsSink | null): void {
  sink = next;
}

export function track(event: AnalyticsEventName, props?: AnalyticsProps): void {
  const safe = sanitiseProps(props);
  if (sink) {
    try {
      sink.track(event, safe);
    } catch {
      // Analytics must never break the funnel.
    }
    return;
  }
  if (process.env.NODE_ENV === "development") {
    console.debug("[analytics]", event, safe);
  }
}

/**
 * A click on the booking link is exactly that — a click. It is never recorded
 * as a confirmed appointment; only a verified booking event from the calendar
 * provider can establish that.
 */
export function trackBookingLinkClicked(): void {
  track("booking_link_clicked");
}
