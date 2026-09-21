import { describe, expect, it, vi } from "vitest";
import {
  registerAnalyticsSink,
  sanitiseProps,
  track,
  type AnalyticsEventName,
} from "@/lib/analytics";

/**
 * Analytics must never carry personal data. These tests pin that as a
 * property of the adapter rather than a rule call sites have to remember.
 */

describe("property sanitisation", () => {
  it("drops keys that are not on the allow list", () => {
    expect(
      sanitiseProps({
        step_id: "bottleneck",
        email: "dana@example.test",
        full_name: "Dana Reyes",
        phone: "+15555550123",
      }),
    ).toEqual({ step_id: "bottleneck" });
  });

  it("drops an allow-listed key whose value looks like free text", () => {
    // Even under an allowed key, anything with whitespace or an @ is dropped.
    expect(sanitiseProps({ cta_id: "Find My Growth Plan" })).toEqual({});
    expect(sanitiseProps({ cta_id: "dana@example.test" })).toEqual({});
    expect(sanitiseProps({ cta_id: "primary" })).toEqual({ cta_id: "primary" });
  });

  it("drops an over-long value", () => {
    expect(sanitiseProps({ cta_id: "x".repeat(100) })).toEqual({});
  });

  it("keeps numbers and booleans", () => {
    expect(
      sanitiseProps({ step_index: 3, step_total: 7, includes_production: true }),
    ).toEqual({ step_index: 3, step_total: 7, includes_production: true });
  });

  it("drops undefined values rather than sending nulls", () => {
    expect(sanitiseProps({ step_id: undefined, audience: "real-estate" })).toEqual({
      audience: "real-estate",
    });
  });

  it("handles no properties at all", () => {
    expect(sanitiseProps(undefined)).toEqual({});
  });
});

describe("sink", () => {
  it("forwards only sanitised properties", () => {
    const received: { event: string; props: Record<string, unknown> }[] = [];
    registerAnalyticsSink({ track: (event, props) => received.push({ event, props }) });

    track("assessment_step_completed", {
      step_id: "goal",
      step_index: 5,
      audience: "real-estate",
      email: "dana@example.test",
    });

    expect(received).toHaveLength(1);
    expect(received[0]?.props).toEqual({
      step_id: "goal",
      step_index: 5,
      audience: "real-estate",
    });
    registerAnalyticsSink(null);
  });

  it("never lets a failing sink break the funnel", () => {
    registerAnalyticsSink({
      track: () => {
        throw new Error("analytics vendor is down");
      },
    });
    expect(() => track("assessment_started")).not.toThrow();
    registerAnalyticsSink(null);
  });

  it("supports every documented event name", () => {
    const events: AnalyticsEventName[] = [
      "landing_cta_clicked",
      "assessment_started",
      "assessment_step_completed",
      "assessment_completed",
      "recommendation_viewed",
      "lead_submission_succeeded",
      "lead_submission_failed",
      "booking_link_clicked",
    ];
    const seen: string[] = [];
    registerAnalyticsSink({ track: (event) => seen.push(event) });
    for (const event of events) track(event);
    expect(seen).toEqual(events);
    registerAnalyticsSink(null);
  });

  it("treats a booking-link click as a click, not a booking", async () => {
    const seen: string[] = [];
    registerAnalyticsSink({ track: (event) => seen.push(event) });
    const { trackBookingLinkClicked } = await import("@/lib/analytics");
    trackBookingLinkClicked();
    expect(seen).toEqual(["booking_link_clicked"]);
    // There is no event that asserts a confirmed appointment.
    expect(seen).not.toContain("appointment_booked");
    registerAnalyticsSink(null);
  });
});

describe("logger redaction", () => {
  it("masks emails, tokens and known-sensitive keys", async () => {
    const { redactValue } = await import("@/lib/logger");
    const redacted = redactValue({
      email: "dana@example.test",
      note: "reply to dana@example.test please",
      headers: { authorization: "Bearer secret-token-value" },
      count: 3,
    }) as Record<string, unknown>;

    expect(redacted.email).toBe("[redacted]");
    expect(redacted.note).toBe("reply to [email] please");
    expect((redacted.headers as Record<string, unknown>).authorization).toBe("[redacted]");
    expect(redacted.count).toBe(3);
  });

  it("masks a bearer token appearing inside a message", async () => {
    const { redactValue } = await import("@/lib/logger");
    expect(redactValue("failed with Bearer abc123.def-456")).toBe(
      "failed with Bearer [redacted]",
    );
  });
});

describe("no accidental console noise", () => {
  it("does nothing without a sink outside development", () => {
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
    registerAnalyticsSink(null);
    track("assessment_started");
    // NODE_ENV is "test" under vitest, so nothing is printed.
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
