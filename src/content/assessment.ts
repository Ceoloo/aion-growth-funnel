import { audiences } from "./audiences";
import type {
  AudienceId,
  BottleneckId,
  ChannelId,
  Choice,
  ContentNeedId,
  FollowUpId,
  GoalId,
  TimingId,
} from "./types";

/** Step ids, in the order they are presented. */
export const stepIds = [
  "business-type",
  "bottleneck",
  "channels",
  "follow-up",
  "goal",
  "content-needs",
  "timing",
] as const;

export type StepId = (typeof stepIds)[number];

/** Screens after the questions. Not counted in question progress. */
export const outcomeStepIds = ["result", "contact", "confirmation"] as const;
export type OutcomeStepId = (typeof outcomeStepIds)[number];

export const businessTypeChoices: Choice<AudienceId>[] = audiences.map((a) => ({
  id: a.id,
  label: a.label,
  hint: a.blurb,
}));

export const bottleneckChoices: Choice<BottleneckId>[] = [
  {
    id: "not-enough-inquiries",
    label: "Not enough qualified inquiries",
    hint: "The pipeline starts too thin.",
  },
  {
    id: "inconsistent-follow-up",
    label: "People inquire, but follow-up is inconsistent",
    hint: "Interest arrives and then goes quiet.",
  },
  {
    id: "content-credibility",
    label: "We need better content and credibility",
    hint: "The work is strong; the proof is not.",
  },
  {
    id: "closing-conversations",
    label: "We struggle to turn conversations into customers",
    hint: "Good conversations stall before a decision.",
  },
  {
    id: "no-clear-process",
    label: "We don't have a clear process yet",
    hint: "It works, but nobody could write it down.",
  },
];

export const channelChoices: Choice<ChannelId>[] = [
  { id: "referrals", label: "Referrals" },
  { id: "instagram-facebook", label: "Instagram / Facebook" },
  { id: "google-website", label: "Google / Website" },
  { id: "paid-ads", label: "Paid ads" },
  { id: "phone-text", label: "Phone / Text" },
  { id: "other", label: "Other" },
];

export const followUpChoices: Choice<FollowUpId>[] = [
  {
    id: "crm-consistent",
    label: "We have a CRM and a consistent process",
    hint: "Everyone follows the same steps.",
  },
  {
    id: "tools-inconsistent",
    label: "We have tools, but the process is inconsistent",
    hint: "The software exists; the habit does not.",
  },
  {
    id: "manual",
    label: "We handle it manually through calls, texts, or DMs",
    hint: "It lives in personal devices and inboxes.",
  },
  {
    id: "figuring-it-out",
    label: "We're still figuring it out",
    hint: "No agreed process yet.",
  },
];

export const realEstateGoalChoices: Choice<GoalId>[] = [
  { id: "seller-consultations", label: "Seller consultations" },
  { id: "buyer-consultations", label: "Buyer consultations" },
  { id: "listing-promotion", label: "Listing promotion" },
  { id: "agent-brand", label: "My agent brand" },
  { id: "nurture-contacts", label: "Nurturing existing contacts" },
];

export const generalGoalChoices: Choice<GoalId>[] = [
  { id: "estimate-requests", label: "Estimate requests" },
  { id: "booked-appointments", label: "Booked appointments" },
  { id: "qualified-inquiries", label: "Qualified inquiries" },
  { id: "repeat-customers", label: "Repeat customers" },
  { id: "visibility-trust", label: "Visibility and trust" },
];

export function goalChoicesFor(audience: AudienceId | undefined): Choice<GoalId>[] {
  return audience === "real-estate" ? realEstateGoalChoices : generalGoalChoices;
}

export function goalQuestionFor(audience: AudienceId | undefined): string {
  return audience === "real-estate"
    ? "What do you want to improve first?"
    : "What do you want more of?";
}

export const contentNeedChoices: Choice<ContentNeedId>[] = [
  {
    id: "need-production",
    label: "Yes, we need production support",
    hint: "The current photos and video don't represent the work.",
  },
  {
    id: "have-content",
    label: "We already have usable content",
    hint: "There is enough to work with for now.",
  },
  {
    id: "help-me-decide",
    label: "Maybe — help us decide",
    hint: "We'd like an honest opinion on what's needed.",
  },
];

export const timingChoices: Choice<TimingId>[] = [
  { id: "asap", label: "As soon as practical" },
  { id: "within-30-days", label: "Within 30 days" },
  { id: "one-to-three-months", label: "Within 1–3 months" },
  { id: "exploring", label: "Just exploring" },
];

export interface StepCopy {
  id: StepId;
  /** Short label for the progress indicator and the desktop answer summary. */
  shortLabel: string;
  question: string;
  /** Optional clarifying line under the question. */
  help?: string;
  kind: "single" | "multi";
}

export const stepCopy: Record<StepId, StepCopy> = {
  "business-type": {
    id: "business-type",
    shortLabel: "Business",
    question: "What kind of business are you growing?",
    kind: "single",
  },
  bottleneck: {
    id: "bottleneck",
    shortLabel: "Bottleneck",
    question: "Where are opportunities getting stuck?",
    help: "Pick the one that costs you the most right now.",
    kind: "single",
  },
  channels: {
    id: "channels",
    shortLabel: "Channels",
    question: "How do customers find or contact you?",
    help: "Select all that apply.",
    kind: "multi",
  },
  "follow-up": {
    id: "follow-up",
    shortLabel: "Follow-up",
    question: "What happens when someone reaches out?",
    kind: "single",
  },
  goal: {
    id: "goal",
    shortLabel: "Goal",
    // Replaced at render time by goalQuestionFor(audience).
    question: "What do you want more of?",
    kind: "single",
  },
  "content-needs": {
    id: "content-needs",
    shortLabel: "Content",
    question: "Would better photos or video help?",
    help: "Production is optional. This only tells us whether to look at it.",
    kind: "single",
  },
  timing: {
    id: "timing",
    shortLabel: "Timing",
    question: "When would you like to get started?",
    kind: "single",
  },
};

/** Human-readable label for any answer id, used in summaries and CRM notes. */
const allChoices: Choice<string>[] = [
  ...businessTypeChoices,
  ...bottleneckChoices,
  ...channelChoices,
  ...followUpChoices,
  ...realEstateGoalChoices,
  ...generalGoalChoices,
  ...contentNeedChoices,
  ...timingChoices,
];

const labelLookup = new Map(allChoices.map((c) => [c.id, c.label]));

export function labelFor(id: string | undefined): string {
  if (!id) return "Not answered";
  return labelLookup.get(id) ?? id;
}
