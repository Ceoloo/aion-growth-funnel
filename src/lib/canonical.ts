import { labelFor } from "@/content/assessment";
import { audienceById } from "@/content/audiences";
import type { AudienceId, ServiceId } from "@/content/types";
import type { Attribution, ContactInput, ValidatedAnswers } from "./lead-schema";
import { recommend, type RecommendationRuleId } from "./recommendation";

/**
 * The canonical lead payload.
 *
 * This shape is AION's, not GoHighLevel's. Nothing in it is named after a CRM
 * field, and no part of the funnel depends on a CRM being configured. The GHL
 * adapter maps from this type; a future adapter for a different CRM would map
 * from the same type without the funnel changing.
 */
export const CANONICAL_PAYLOAD_VERSION = "1.0";

export interface CanonicalLead {
  version: typeof CANONICAL_PAYLOAD_VERSION;
  submissionId: string;
  submittedAt: string;

  contact: {
    fullName: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    businessName: string;
    website?: string;
  };

  assessment: {
    audience: AudienceId;
    audienceLabel: string;
    bottleneck: string;
    bottleneckLabel: string;
    channels: string[];
    channelLabels: string[];
    followUp: string;
    followUpLabel: string;
    goal: string;
    goalLabel: string;
    contentNeed: string;
    contentNeedLabel: string;
    timing: string;
    timingLabel: string;
  };

  recommendation: {
    coreServiceId: ServiceId;
    coreServiceName: string;
    serviceIds: ServiceId[];
    ruleId: RecommendationRuleId;
    includesProduction: boolean;
    productionIsAddOn: boolean;
    priorities: string[];
    reasons: string[];
  };

  consent: {
    marketingEmail: boolean;
    /** ISO timestamp, present only when consent was actually given. */
    marketingEmailAt?: string;
    copyVersion: string;
  };

  attribution: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    utmTerm?: string;
    landingPage?: string;
    referrer?: string;
  };
}

/** Splits a full name into first/last without being clever about it. */
export function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0] ?? "", lastName: "" };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1] ?? "",
  };
}

export function buildCanonicalLead(input: {
  submissionId: string;
  submittedAt: string;
  contact: ContactInput;
  answers: ValidatedAnswers;
  consent: { marketingEmail: boolean; copyVersion: string };
  attribution: Attribution;
}): CanonicalLead {
  const { firstName, lastName } = splitName(input.contact.fullName);
  const rec = recommend(input.answers);

  return {
    version: CANONICAL_PAYLOAD_VERSION,
    submissionId: input.submissionId,
    submittedAt: input.submittedAt,
    contact: {
      fullName: input.contact.fullName,
      firstName,
      lastName,
      email: input.contact.email.toLowerCase(),
      phone: input.contact.phone,
      businessName: input.contact.businessName,
      website: input.contact.website,
    },
    assessment: {
      audience: input.answers.audience,
      audienceLabel: audienceById[input.answers.audience].label,
      bottleneck: input.answers.bottleneck,
      bottleneckLabel: labelFor(input.answers.bottleneck),
      channels: input.answers.channels,
      channelLabels: input.answers.channels.map((c) => labelFor(c)),
      followUp: input.answers.followUp,
      followUpLabel: labelFor(input.answers.followUp),
      goal: input.answers.goal,
      goalLabel: labelFor(input.answers.goal),
      contentNeed: input.answers.contentNeed,
      contentNeedLabel: labelFor(input.answers.contentNeed),
      timing: input.answers.timing,
      timingLabel: labelFor(input.answers.timing),
    },
    recommendation: {
      coreServiceId: rec.service.id,
      coreServiceName: rec.service.name,
      serviceIds: rec.serviceIds,
      ruleId: rec.ruleId,
      includesProduction: rec.includesProduction,
      productionIsAddOn: rec.productionIsAddOn,
      priorities: rec.priorities,
      reasons: rec.reasons,
    },
    consent: {
      marketingEmail: input.consent.marketingEmail,
      marketingEmailAt: input.consent.marketingEmail ? input.submittedAt : undefined,
      copyVersion: input.consent.copyVersion,
    },
    attribution: {
      utmSource: input.attribution.utmSource,
      utmMedium: input.attribution.utmMedium,
      utmCampaign: input.attribution.utmCampaign,
      utmContent: input.attribution.utmContent,
      utmTerm: input.attribution.utmTerm,
      landingPage: input.attribution.landingPage,
      referrer: input.attribution.referrer,
    },
  };
}

/** Readable assessment summary used as the CRM note body. */
export function assessmentSummaryText(lead: CanonicalLead): string {
  const a = lead.assessment;
  const r = lead.recommendation;
  const lines = [
    "AION Growth Assessment",
    `Submitted: ${lead.submittedAt}`,
    `Submission ID: ${lead.submissionId}`,
    "",
    `Business: ${lead.contact.businessName}`,
    `Business type: ${a.audienceLabel}`,
    lead.contact.website ? `Website / social: ${lead.contact.website}` : null,
    "",
    `Main bottleneck: ${a.bottleneckLabel}`,
    `Inquiry channels: ${a.channelLabels.join(", ")}`,
    `Current follow-up: ${a.followUpLabel}`,
    `Wants more of: ${a.goalLabel}`,
    `Content production: ${a.contentNeedLabel}`,
    `Timeframe: ${a.timingLabel}`,
    "",
    `Suggested starting point: ${r.coreServiceName}${
      r.productionIsAddOn ? " + Premium Content Production (optional add-on)" : ""
    }`,
    `Rule applied: ${r.ruleId}`,
    "",
    "First priorities:",
    ...r.priorities.map((p, i) => `  ${i + 1}. ${p}`),
    "",
    `Marketing email consent: ${
      lead.consent.marketingEmail
        ? `yes (${lead.consent.marketingEmailAt}, copy ${lead.consent.copyVersion})`
        : "no"
    }`,
    "Phone submission is not SMS consent.",
  ];

  const attribution = Object.entries(lead.attribution).filter(([, v]) => Boolean(v));
  if (attribution.length > 0) {
    lines.push("", "Attribution:");
    for (const [key, value] of attribution) lines.push(`  ${key}: ${value}`);
  }

  return lines.filter((l) => l !== null).join("\n");
}
