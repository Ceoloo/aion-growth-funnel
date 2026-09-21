/**
 * Shared content types.
 *
 * Everything a non-developer is likely to want to change (copy, questions,
 * options, service definitions, recommendation rules) lives under `src/content`.
 * Nothing in this folder may import from `src/lib/ghl` or any server module.
 */

export type AudienceId =
  | "contractor-builder"
  | "home-services"
  | "local-business"
  | "real-estate";

export type ServiceId =
  | "sales-follow-up"
  | "marketing-growth"
  | "content-production"
  | "foundation-review";

export type BottleneckId =
  | "not-enough-inquiries"
  | "inconsistent-follow-up"
  | "content-credibility"
  | "closing-conversations"
  | "no-clear-process";

export type ChannelId =
  | "referrals"
  | "instagram-facebook"
  | "google-website"
  | "paid-ads"
  | "phone-text"
  | "other";

export type FollowUpId =
  | "crm-consistent"
  | "tools-inconsistent"
  | "manual"
  | "figuring-it-out";

export type ContentNeedId = "need-production" | "have-content" | "help-me-decide";

export type TimingId = "asap" | "within-30-days" | "one-to-three-months" | "exploring";

/** Goal ids are audience-dependent; see `goalsByAudience` in `assessment.ts`. */
export type GoalId =
  | "seller-consultations"
  | "buyer-consultations"
  | "listing-promotion"
  | "agent-brand"
  | "nurture-contacts"
  | "estimate-requests"
  | "booked-appointments"
  | "qualified-inquiries"
  | "repeat-customers"
  | "visibility-trust";

export interface Choice<T extends string> {
  id: T;
  label: string;
  /** Short supporting line shown under the label. Keep it to one clause. */
  hint?: string;
}

export interface Audience {
  id: AudienceId;
  label: string;
  /** Used in the landing-page card. */
  blurb: string;
  /** Used to personalise funnel copy, e.g. "for a contracting business". */
  descriptor: string;
  /** Content examples surfaced on the content-needs step. */
  contentExamples: string[];
}
