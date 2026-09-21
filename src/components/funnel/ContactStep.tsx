"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Send } from "lucide-react";
import { consentCopy } from "@/content/consent";
import {
  contactFormSchema,
  emptyContactForm,
  type ContactFormValues,
} from "@/lib/contact-form-schema";
import type { Recommendation } from "@/lib/recommendation";
import { useKeyboardOpen } from "@/hooks/use-keyboard-open";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConsentField, HoneypotField, TextField } from "@/components/ui/form-field";
import { BackButton, StepHeading, StepShell } from "@/components/ui/step-shell";

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
 * React Hook Form keeps the entered values in an uncontrolled form, so a
 * recoverable error (a 503, a dropped connection) never clears what was typed
 * — the visitor just presses the button again.
 *
 * Input types, `inputMode` and `autoComplete` are set per field so a phone
 * shows the right keyboard and the browser can autofill. When that keyboard is
 * open the action area detaches and scrolls with the content, so the visitor
 * is never pinned between the keyboard and a fixed footer.
 */
export function ContactStep({
  recommendation,
  defaultValues,
  onSubmit,
  onValuesChange,
  onBack,
  submitting,
  failure,
  scrollRef,
}: {
  recommendation: Recommendation;
  defaultValues?: ContactFormValues;
  onSubmit: (values: ContactFormValues) => void;
  onValuesChange?: (values: ContactFormValues) => void;
  onBack: () => void;
  submitting: boolean;
  failure: SubmissionFailure | null;
  scrollRef?: React.Ref<HTMLDivElement>;
}) {
  const keyboardOpen = useKeyboardOpen();
  const formId = React.useId();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitted },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: defaultValues ?? emptyContactForm,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const marketingEmail = watch("marketingEmail");
  const values = watch();

  // Keep the parent in sync so answers survive navigating back to the result.
  React.useEffect(() => {
    onValuesChange?.(values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(values)]);

  // Server-side field errors are merged into the same display path as local ones.
  React.useEffect(() => {
    if (!failure?.fieldErrors) return;
    for (const [key, message] of Object.entries(failure.fieldErrors)) {
      const field = key.replace(/^contact\./, "") as keyof ContactFormValues;
      if (field in emptyContactForm) setError(field, { type: "server", message });
    }
  }, [failure, setError]);

  const hasErrors = Object.keys(errors).length > 0;

  const actions = (
    <div className="flex flex-col gap-2">
      <Button
        type="submit"
        form={formId}
        size="action"
        full
        loading={submitting}
        loadingLabel="Sending…"
      >
        Send my request
        <Send aria-hidden="true" />
      </Button>
      <div className="flex justify-center">
        <BackButton onClick={onBack} label="Back to my plan" />
      </div>
    </div>
  );

  return (
    <form
      id={formId}
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex min-h-0 flex-1 flex-col"
    >
      <StepShell scrollRef={scrollRef} actions={actions} detachActions={keyboardOpen}>
        <StepHeading
          title="Where should we send it?"
          supporting={`We'll put together a starting point around ${recommendation.service.name} and reply personally.`}
        />

        <div className="mt-7 space-y-4">
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
                    className="font-semibold text-primary underline underline-offset-4"
                  >
                    {failure.contactEmail}
                  </a>
                  .
                </p>
              ) : null}
            </Alert>
          ) : null}

          {isSubmitted && hasErrors && !failure ? (
            <Alert tone="error" title="Please check the highlighted fields." />
          ) : null}

          <TextField
            label="Full name"
            required
            autoComplete="name"
            autoCapitalize="words"
            enterKeyHint="next"
            error={errors.fullName?.message}
            {...register("fullName")}
          />

          <TextField
            label="Email"
            type="email"
            inputMode="email"
            required
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            error={errors.email?.message}
            {...register("email")}
          />

          <TextField
            label="Business name"
            required
            autoComplete="organization"
            enterKeyHint="next"
            error={errors.businessName?.message}
            {...register("businessName")}
          />

          <TextField
            label="Phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            enterKeyHint="next"
            hint="Only used to reach you about this request."
            error={errors.phone?.message}
            {...register("phone")}
          />

          <TextField
            label="Website or social profile"
            type="url"
            inputMode="url"
            autoComplete="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            placeholder="yourbusiness.com"
            error={errors.website?.message}
            {...register("website")}
          />

          <ConsentField
            label={consentCopy.marketingLabel}
            checked={marketingEmail}
            onCheckedChange={(checked) =>
              setValue("marketingEmail", checked, { shouldDirty: true })
            }
          />

          <p className="text-small text-muted-foreground">
            {consentCopy.purpose} {consentCopy.phoneNote}
          </p>

          <HoneypotField {...register("companyWebsiteConfirm")} />
        </div>
      </StepShell>
    </form>
  );
}
