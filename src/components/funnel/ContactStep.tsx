"use client";

import { useRef, useState } from "react";
import { consentCopy, MARKETING_CONSENT_VERSION } from "@/content/consent";
import type { Recommendation } from "@/lib/recommendation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { CheckboxField, HoneypotField, TextField } from "@/components/ui/Field";
import { BackButton, StepContainer } from "@/components/ui/StepContainer";

export interface ContactFormValues {
  fullName: string;
  email: string;
  businessName: string;
  phone: string;
  website: string;
  marketingEmail: boolean;
  honeypot: string;
}

export const emptyContactForm: ContactFormValues = {
  fullName: "",
  email: "",
  businessName: "",
  phone: "",
  website: "",
  marketingEmail: false,
  honeypot: "",
};

export interface SubmissionFailure {
  code: string;
  message: string;
  retryable: boolean;
  contactEmail?: string | null;
  fieldErrors?: Record<string, string>;
}

/**
 * Contact capture.
 *
 * Input types and `inputMode` are set per field so a phone shows the right
 * keyboard: an email keyboard for email, a telephone keypad for phone, a URL
 * keyboard for the website. `autoComplete` tokens let the browser fill the
 * form rather than making someone retype it.
 */
export function ContactStep({
  recommendation,
  values,
  onChange,
  onSubmit,
  onBack,
  submitting,
  failure,
}: {
  recommendation: Recommendation;
  values: ContactFormValues;
  onChange: (patch: Partial<ContactFormValues>) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitting: boolean;
  failure: SubmissionFailure | null;
}) {
  const [touched, setTouched] = useState(false);
  const renderedAt = useRef(Date.now());

  const localErrors: Record<string, string> = {};
  if (touched) {
    if (values.fullName.trim().length < 2) localErrors.fullName = "Please enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))
      localErrors.email = "Enter a valid email address.";
    if (values.businessName.trim().length < 2)
      localErrors.businessName = "Please enter your business name.";
  }

  const errors = { ...localErrors, ...(failure?.fieldErrors ?? {}) };
  const hasErrors = Object.keys(errors).length > 0;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    const invalid =
      values.fullName.trim().length < 2 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()) ||
      values.businessName.trim().length < 2;
    if (invalid) return;
    onSubmit();
  }

  return (
    // The form must carry the flex sizing itself: as a plain block it would
    // break the height chain between the shell and StepContainer's internal
    // scroll area, and the sticky action bar would then sit over the fields
    // instead of below them.
    <form
      onSubmit={handleSubmit}
      noValidate
      data-rendered-at={renderedAt.current}
      className="flex min-h-0 flex-1 flex-col"
    >
      <StepContainer
        stepKey="contact"
        question="Where should we send it?"
        help={`We'll put together a starting point around ${recommendation.service.name} and reply personally.`}
        actions={
          <div className="flex flex-col gap-3">
            <Button type="submit" size="lg" fullWidth disabled={submitting}>
              {submitting ? "Sending…" : "Send my request"}
            </Button>
            <div className="flex justify-center">
              <BackButton onClick={onBack} label="Back to my plan" />
            </div>
          </div>
        }
        footnote={
          <p>
            {consentCopy.purpose} {consentCopy.phoneNote}
          </p>
        }
      >
        <div className="space-y-4">
          {failure ? (
            <Alert
              tone={failure.retryable ? "warning" : "error"}
              title={
                failure.retryable
                  ? "We couldn't send that just now"
                  : "We couldn't accept that request"
              }
            >
              <p>{failure.message}</p>
              {failure.contactEmail ? (
                <p>
                  You can reach us directly at{" "}
                  <a
                    href={`mailto:${failure.contactEmail}`}
                    className="font-semibold text-electric-600 underline underline-offset-4"
                  >
                    {failure.contactEmail}
                  </a>
                  .
                </p>
              ) : null}
            </Alert>
          ) : null}

          {touched && hasErrors && !failure ? (
            <Alert tone="error" title="Please check the highlighted fields." />
          ) : null}

          <TextField
            label="Full name"
            name="fullName"
            required
            autoComplete="name"
            enterKeyHint="next"
            autoCapitalize="words"
            value={values.fullName}
            error={errors.fullName ?? errors["contact.fullName"]}
            onChange={(e) => onChange({ fullName: e.currentTarget.value })}
          />

          <TextField
            label="Email"
            name="email"
            type="email"
            inputMode="email"
            required
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            value={values.email}
            error={errors.email ?? errors["contact.email"]}
            onChange={(e) => onChange({ email: e.currentTarget.value })}
          />

          <TextField
            label="Business name"
            name="businessName"
            required
            autoComplete="organization"
            enterKeyHint="next"
            value={values.businessName}
            error={errors.businessName ?? errors["contact.businessName"]}
            onChange={(e) => onChange({ businessName: e.currentTarget.value })}
          />

          <TextField
            label="Phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            enterKeyHint="next"
            hint="Only used to reach you about this request."
            value={values.phone}
            error={errors["contact.phone"]}
            onChange={(e) => onChange({ phone: e.currentTarget.value })}
          />

          <TextField
            label="Website or social profile"
            name="website"
            type="url"
            inputMode="url"
            autoComplete="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            placeholder="yourbusiness.com"
            value={values.website}
            error={errors["contact.website"]}
            onChange={(e) => onChange({ website: e.currentTarget.value })}
          />

          <CheckboxField
            label={consentCopy.marketingLabel}
            checked={values.marketingEmail}
            onChange={(e) => onChange({ marketingEmail: e.currentTarget.checked })}
            data-consent-version={MARKETING_CONSENT_VERSION}
          />

          <HoneypotField
            name="company_website_confirm"
            value={values.honeypot}
            onChange={(honeypot) => onChange({ honeypot })}
          />
        </div>
      </StepContainer>
    </form>
  );
}
