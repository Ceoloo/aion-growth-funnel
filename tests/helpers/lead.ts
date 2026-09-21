import { buildCanonicalLead, type CanonicalLead } from "@/lib/canonical";
import type { ValidatedAnswers } from "@/lib/lead-schema";
import type { AudienceId } from "@/content/types";

export function makeAnswers(overrides: Partial<ValidatedAnswers> = {}): ValidatedAnswers {
  return {
    audience: "contractor-builder",
    bottleneck: "inconsistent-follow-up",
    channels: ["referrals", "google-website"],
    followUp: "manual",
    goal: "estimate-requests",
    contentNeed: "have-content",
    timing: "asap",
    ...overrides,
  };
}

export function makeLead(
  overrides: {
    submissionId?: string;
    answers?: Partial<ValidatedAnswers>;
    marketingEmail?: boolean;
    audience?: AudienceId;
  } = {},
): CanonicalLead {
  return buildCanonicalLead({
    submissionId: overrides.submissionId ?? "11111111-1111-4111-8111-111111111111",
    submittedAt: "2026-09-21T10:00:00.000Z",
    contact: {
      fullName: "Dana Reyes",
      email: "Dana@ExampleBuilders.test",
      businessName: "Example Builders",
      phone: "+15555550123",
      website: "examplebuilders.test",
    },
    answers: makeAnswers({
      ...(overrides.audience ? { audience: overrides.audience } : {}),
      ...overrides.answers,
    }),
    consent: {
      marketingEmail: overrides.marketingEmail ?? false,
      copyVersion: "2026-09-21.v1",
    },
    attribution: {
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "fall-remodel",
      landingPage: "https://aion.test/",
      referrer: "https://google.test/",
    },
  });
}
