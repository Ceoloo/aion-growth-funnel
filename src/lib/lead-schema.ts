import { z } from "zod";
import { audienceIds } from "@/content/audiences";

/**
 * Validation for the public lead endpoint.
 *
 * Every string has an explicit maximum length so a malicious client cannot
 * push an unbounded body into durable storage or a downstream CRM.
 */

const LIMITS = {
  name: 120,
  email: 254,
  business: 160,
  phone: 32,
  url: 512,
  submissionId: 64,
  utm: 200,
  referrer: 1024,
  landingPage: 1024,
} as const;

export const FIELD_LIMITS = LIMITS;

const trimmed = (max: number) => z.string().trim().max(max);
const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    // Transform before `.optional()` so the KEY stays optional: an absent
    // field and an empty string both come through as `undefined`.
    .transform((v) => (v === "" ? undefined : v))
    .optional();

export const assessmentAnswersSchema = z.object({
  audience: z.enum(audienceIds),
  bottleneck: z.enum([
    "not-enough-inquiries",
    "inconsistent-follow-up",
    "content-credibility",
    "closing-conversations",
    "no-clear-process",
  ]),
  channels: z
    .array(
      z.enum([
        "referrals",
        "instagram-facebook",
        "google-website",
        "paid-ads",
        "phone-text",
        "other",
      ]),
    )
    .min(1, "Select at least one channel")
    .max(6),
  followUp: z.enum(["crm-consistent", "tools-inconsistent", "manual", "figuring-it-out"]),
  goal: z.enum([
    "seller-consultations",
    "buyer-consultations",
    "listing-promotion",
    "agent-brand",
    "nurture-contacts",
    "estimate-requests",
    "booked-appointments",
    "qualified-inquiries",
    "repeat-customers",
    "visibility-trust",
  ]),
  contentNeed: z.enum(["need-production", "have-content", "help-me-decide"]),
  timing: z.enum(["asap", "within-30-days", "one-to-three-months", "exploring"]),
});

export const contactSchema = z.object({
  fullName: trimmed(LIMITS.name).min(2, "Please enter your full name"),
  email: trimmed(LIMITS.email).email("Enter a valid email address"),
  businessName: trimmed(LIMITS.business).min(2, "Please enter your business name"),
  phone: optionalTrimmed(LIMITS.phone),
  website: optionalTrimmed(LIMITS.url),
});

export const attributionSchema = z
  .object({
    utmSource: optionalTrimmed(LIMITS.utm),
    utmMedium: optionalTrimmed(LIMITS.utm),
    utmCampaign: optionalTrimmed(LIMITS.utm),
    utmContent: optionalTrimmed(LIMITS.utm),
    utmTerm: optionalTrimmed(LIMITS.utm),
    landingPage: optionalTrimmed(LIMITS.landingPage),
    referrer: optionalTrimmed(LIMITS.referrer),
  })
  .default({});

export const leadRequestSchema = z.object({
  /** Client-generated, stable for the life of one completed assessment. */
  submissionId: z.uuid().max(LIMITS.submissionId),
  contact: contactSchema,
  answers: assessmentAnswersSchema,
  consent: z.object({
    /** Optional, unchecked by default. Email marketing only — never SMS. */
    marketingEmail: z.boolean(),
    /** Version of the consent copy the person actually saw. */
    copyVersion: trimmed(64),
  }),
  attribution: attributionSchema,
  /** Honeypot. Must be empty; bots fill it in. */
  companyWebsiteConfirm: z.string().max(200).optional(),
  /** Epoch ms when the contact form was rendered, used to reject instant posts. */
  formRenderedAt: z.number().int().nonnegative().optional(),
});

export type LeadRequest = z.infer<typeof leadRequestSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type ValidatedAnswers = z.infer<typeof assessmentAnswersSchema>;
export type Attribution = z.infer<typeof attributionSchema>;

/** Flattens Zod issues into a field -> message map the form can render. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !(key in out)) out[key] = issue.message;
  }
  return out;
}
