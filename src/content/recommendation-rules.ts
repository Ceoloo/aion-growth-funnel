import type { AudienceId, BottleneckId, FollowUpId, ServiceId } from "./types";

/**
 * Deterministic recommendation rules.
 *
 * These rules are transparent on purpose: the result screen tells the visitor
 * exactly which of their answers produced the recommendation. There is no
 * score, no forecast and no model inference involved.
 *
 * Evaluation order (first match wins for the CORE service):
 *   1. Follow-up / sales-process weakness  -> Sales & Follow-Up System
 *   2. Inquiry volume / visibility gap     -> Marketing & Growth System
 *   3. Content & credibility with an
 *      established process                 -> Premium Content Production
 *   4. Anything unclear                    -> Discovery-Led Foundation Review
 *
 * Production is then ADDED to the core recommendation whenever the visitor
 * asked for production support.
 */

/** Bottlenecks that indicate the sales / follow-up side is the constraint. */
export const salesProcessBottlenecks: BottleneckId[] = [
  "inconsistent-follow-up",
  "closing-conversations",
];

/** Follow-up answers that indicate no dependable process exists. */
export const weakFollowUpAnswers: FollowUpId[] = ["manual", "figuring-it-out"];

/** Follow-up answers that indicate a process is already established. */
export const establishedFollowUpAnswers: FollowUpId[] = ["crm-consistent"];

/** Bottlenecks that indicate a demand / visibility constraint. */
export const demandBottlenecks: BottleneckId[] = ["not-enough-inquiries"];

/** Bottlenecks that indicate a content / credibility constraint. */
export const contentBottlenecks: BottleneckId[] = ["content-credibility"];

/** Bottlenecks that are too broad to map to a single build. */
export const unclearBottlenecks: BottleneckId[] = ["no-clear-process"];

/**
 * Priorities are the three things we would look at first. They are written as
 * work we would do, never as an outcome we promise.
 */
export const priorityLibrary: Record<ServiceId, string[]> = {
  "sales-follow-up": [
    "Route every inquiry into one place with an owner and a due time",
    "Set a first-response step that runs whether or not someone remembers",
    "Make the pipeline visible so stalled conversations surface early",
    "Connect booking so an interested inquiry can pick a time",
    "Agree what a qualified inquiry means before it reaches the pipeline",
  ],
  "marketing-growth": [
    "Sharpen positioning so the offer is obvious in the first ten seconds",
    "Give each channel one job and one measurable next step",
    "Build a conversion-focused page for the highest-intent traffic",
    "Connect campaign activity to the inquiries it actually produces",
    "Plan a campaign calendar you can sustain with your current capacity",
  ],
  "content-production": [
    "Audit existing assets to see what is already usable",
    "Plan a shot list around the work you most want more of",
    "Capture proof: finished work, real people and customer stories",
    "Package the content for the channels where inquiries start",
    "Set a light refresh cadence so the library does not go stale",
  ],
  "foundation-review": [
    "Map how an inquiry travels today, from first contact to decision",
    "Inventory the tools already in place and what can be reused",
    "Identify the one constraint worth fixing first",
    "Agree a scope that matches your capacity and timing",
    "Write it down so the next build has a clear starting point",
  ],
};

/**
 * Audience-specific framing for the "why this matches" explanation. Kept short
 * and factual — it restates their answers rather than adding claims.
 */
export const audienceFraming: Record<AudienceId, string> = {
  "contractor-builder":
    "Estimate requests are high-intent and time-sensitive, so the path from inquiry to site visit is where most of the value sits.",
  "home-services":
    "Service demand is immediate, so the speed and consistency of the first response usually matters more than the volume of leads.",
  "local-business":
    "Most local decisions happen quickly and close to home, so visibility and an easy next step carry a lot of the weight.",
  "real-estate":
    "Buyer and seller inquiries arrive on different timelines, so the process has to hold a contact for weeks or months without dropping it.",
};

/** Copy shown with every recommendation. */
export const scopeNote =
  "This is a starting point based on your answers, not a quote. Final scope and pricing follow a conversation about your current setup.";
