/**
 * Consent copy is versioned so that a stored consent record can be traced back
 * to the exact wording the person agreed to. Bump the version whenever the
 * copy below changes, and never re-use an old version string for new wording.
 */
export const MARKETING_CONSENT_VERSION = "2026-09-21.v1";

export const consentCopy = {
  /** Always shown. Explains the lawful basis for using the submitted details. */
  purpose:
    "We'll use these details to respond to your request.",
  /** Separate, optional, unchecked. Marketing email only — never SMS. */
  marketingLabel:
    "Send me occasional emails about marketing and sales systems. Optional — unchecking this does not affect your request.",
  /**
   * Submitting the form is a request for a reply; it is not SMS consent and we
   * never enrol a submitted phone number in text campaigns.
   */
  phoneNote:
    "A phone number is optional and is only used to reach you about this request. We don't add it to text campaigns.",
} as const;
