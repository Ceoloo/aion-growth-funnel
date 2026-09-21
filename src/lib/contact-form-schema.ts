import { z } from "zod";
import { FIELD_LIMITS } from "./lead-schema";

/**
 * Client-side contact schema.
 *
 * Deliberately shaped for the form rather than the wire: every field is a
 * string (an empty input is `""`, not `undefined`), which is what React Hook
 * Form actually holds. `toLeadContact` converts it to the payload shape.
 *
 * The server re-validates with `leadRequestSchema` regardless — this exists to
 * give immediate, per-field feedback, not to be trusted.
 */
export const contactFormSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Please enter your full name.")
    .max(FIELD_LIMITS.name, "That name is too long."),
  email: z
    .string()
    .trim()
    .min(1, "Please enter your email address.")
    .email("Enter a valid email address.")
    .max(FIELD_LIMITS.email, "That email address is too long."),
  businessName: z
    .string()
    .trim()
    .min(2, "Please enter your business name.")
    .max(FIELD_LIMITS.business, "That business name is too long."),
  phone: z
    .string()
    .trim()
    .max(FIELD_LIMITS.phone, "That phone number is too long.")
    .optional()
    .or(z.literal("")),
  website: z
    .string()
    .trim()
    .max(FIELD_LIMITS.url, "That address is too long.")
    .optional()
    .or(z.literal("")),
  marketingEmail: z.boolean(),
  /** Honeypot. A real person never sees this, so any value marks a bot. */
  companyWebsiteConfirm: z.string().max(200),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;

export const emptyContactForm: ContactFormValues = {
  fullName: "",
  email: "",
  businessName: "",
  phone: "",
  website: "",
  marketingEmail: false,
  companyWebsiteConfirm: "",
};

/** Converts form values into the contact shape the lead endpoint expects. */
export function toLeadContact(values: ContactFormValues) {
  return {
    fullName: values.fullName.trim(),
    email: values.email.trim(),
    businessName: values.businessName.trim(),
    phone: values.phone?.trim() || undefined,
    website: values.website?.trim() || undefined,
  };
}
