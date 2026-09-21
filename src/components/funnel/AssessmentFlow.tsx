"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  bottleneckChoices,
  businessTypeChoices,
  channelChoices,
  contentNeedChoices,
  followUpChoices,
  goalChoicesFor,
  goalQuestionFor,
  labelFor,
  stepCopy,
  timingChoices,
  type StepId,
} from "@/content/assessment";
import { audienceById, isAudienceId } from "@/content/audiences";
import { MARKETING_CONSENT_VERSION } from "@/content/consent";
import type { Choice } from "@/content/types";
import { track } from "@/lib/analytics";
import {
  branchFor,
  isStepAnswered,
  nextStep,
  previousStep,
  progressFor,
  reconcileAnswers,
  stepAnswerKey,
  type AssessmentAnswers,
} from "@/lib/assessment";
import { recommend } from "@/lib/recommendation";
import { clearAnswers, mergeAnswers, readAnswers } from "@/lib/session-answers";
import { captureAttribution, readAttribution } from "@/lib/utm";
import { AnswerSummary, FunnelShell } from "./FunnelShell";
import { ConfirmationStep, type SubmissionSuccess } from "./ConfirmationStep";
import {
  ContactStep,
  emptyContactForm,
  type ContactFormValues,
  type SubmissionFailure,
} from "./ContactStep";
import { QuestionStep } from "./QuestionStep";
import { ResultStep } from "./ResultStep";

type Screen = StepId | "result" | "contact" | "confirmation";

function choicesFor(step: StepId, answers: AssessmentAnswers): Choice<string>[] {
  switch (step) {
    case "business-type":
      return businessTypeChoices;
    case "bottleneck":
      return bottleneckChoices;
    case "channels":
      return channelChoices;
    case "follow-up":
      return followUpChoices;
    case "goal":
      return goalChoicesFor(answers.audience);
    case "content-needs":
      return contentNeedChoices;
    case "timing":
      return timingChoices;
  }
}

/** Generates a submission id, preferring the platform UUID where available. */
function newSubmissionId(): string {
  const webCrypto: Crypto | undefined =
    typeof globalThis.crypto !== "undefined" ? globalThis.crypto : undefined;
  if (webCrypto && typeof webCrypto.randomUUID === "function") {
    return webCrypto.randomUUID();
  }
  // Fallback for older browsers: an RFC-4122 v4 shape from getRandomValues.
  const bytes = new Uint8Array(16);
  webCrypto?.getRandomValues(bytes);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20,
  )}-${hex.slice(20)}`;
}

export function AssessmentFlow() {
  const searchParams = useSearchParams();
  const [answers, setAnswers] = useState<AssessmentAnswers>({});
  const [screen, setScreen] = useState<Screen>("business-type");
  const [hydrated, setHydrated] = useState(false);
  const [contact, setContact] = useState<ContactFormValues>(emptyContactForm);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<SubmissionFailure | null>(null);
  const [success, setSuccess] = useState<SubmissionSuccess | null>(null);

  const startedRef = useRef(false);
  const formRenderedAt = useRef<number | null>(null);
  // Stable for the life of this completed assessment, so a retry after a
  // network error cannot create a second lead.
  const submissionIdRef = useRef<string | null>(null);
  const liveRegionRef = useRef<HTMLDivElement | null>(null);

  // --- Hydration -------------------------------------------------------
  useEffect(() => {
    captureAttribution();

    const stored = readAnswers();
    const preselected = searchParams.get("audience");
    const merged: AssessmentAnswers =
      preselected && isAudienceId(preselected)
        ? { ...stored, audience: preselected }
        : stored;

    const reconciled = reconcileAnswers(merged);
    setAnswers(reconciled);

    // Open on the first unanswered question so a preselected audience (or a
    // refresh partway through) does not make anyone repeat themselves.
    const branch = branchFor(reconciled);
    const firstUnanswered = branch.find((step) => !isStepAnswered(step, reconciled));
    setScreen(firstUnanswered ?? "result");
    setHydrated(true);
  }, [searchParams]);

  useEffect(() => {
    if (!hydrated || startedRef.current) return;
    startedRef.current = true;
    track("assessment_started", { audience: answers.audience });
  }, [hydrated, answers.audience]);

  // Move focus to the top of each new screen so keyboard and screen-reader
  // users land on the new question rather than staying where the old one was.
  useEffect(() => {
    if (!hydrated) return;
    liveRegionRef.current?.focus();
  }, [screen, hydrated]);

  const recommendation = useMemo(() => recommend(answers), [answers]);

  // --- Answer handling -------------------------------------------------
  const applyAnswer = useCallback(
    (step: StepId, value: string, checked: boolean) => {
      setAnswers((current) => {
        const key = stepAnswerKey[step];
        let next: AssessmentAnswers;

        if (key === "channels") {
          const existing = current.channels ?? [];
          const updated = checked
            ? [...new Set([...existing, value])]
            : existing.filter((c) => c !== value);
          next = { ...current, channels: updated as AssessmentAnswers["channels"] };
        } else {
          next = { ...current, [key]: value } as AssessmentAnswers;
        }

        next = reconcileAnswers(next);
        mergeAnswers(next);
        return next;
      });
    },
    [],
  );

  const advance = useCallback(
    (step: StepId, updated: AssessmentAnswers) => {
      const progress = progressFor(step, updated);
      track("assessment_step_completed", {
        step_id: step,
        step_index: progress.current,
        step_total: progress.total,
        // Answer ids only. `sanitiseProps` drops anything outside the
        // allow-list, so no free text can leak through here.
        audience: updated.audience,
        bottleneck: step === "bottleneck" ? updated.bottleneck : undefined,
        follow_up: step === "follow-up" ? updated.followUp : undefined,
        goal: step === "goal" ? updated.goal : undefined,
        content_need: step === "content-needs" ? updated.contentNeed : undefined,
        timing: step === "timing" ? updated.timing : undefined,
        channel_count: step === "channels" ? (updated.channels?.length ?? 0) : undefined,
      });

      const following = nextStep(step, updated);
      if (following) {
        setScreen(following);
        return;
      }
      track("assessment_completed", {
        audience: updated.audience,
        answer_count: branchFor(updated).length,
      });
      setScreen("result");
    },
    [],
  );

  const handleSelect = useCallback(
    (step: StepId, value: string, checked: boolean) => {
      applyAnswer(step, value, checked);
      if (stepCopy[step].kind === "single") {
        // Read the updated answers from the functional update by recomputing
        // them here — the state setter above is the source of truth.
        setAnswers((current) => {
          const updated = reconcileAnswers({
            ...current,
            [stepAnswerKey[step]]: value,
          } as AssessmentAnswers);
          mergeAnswers(updated);
          // Defer navigation so the selected state paints before the change.
          queueMicrotask(() => advance(step, updated));
          return updated;
        });
      }
    },
    [applyAnswer, advance],
  );

  const handleBack = useCallback(() => {
    setFailure(null);
    setScreen((current) => {
      if (current === "confirmation") return current;
      if (current === "contact") return "result";
      if (current === "result") {
        const branch = branchFor(answers);
        return branch[branch.length - 1] ?? "business-type";
      }
      return previousStep(current, answers) ?? current;
    });
  }, [answers]);

  // --- Submission ------------------------------------------------------
  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    setFailure(null);

    if (!submissionIdRef.current) submissionIdRef.current = newSubmissionId();
    if (formRenderedAt.current === null) formRenderedAt.current = Date.now() - 2_000;

    const payload = {
      submissionId: submissionIdRef.current,
      contact: {
        fullName: contact.fullName.trim(),
        email: contact.email.trim(),
        businessName: contact.businessName.trim(),
        phone: contact.phone.trim() || undefined,
        website: contact.website.trim() || undefined,
      },
      answers,
      consent: {
        marketingEmail: contact.marketingEmail,
        copyVersion: MARKETING_CONSENT_VERSION,
      },
      attribution: readAttribution(),
      companyWebsiteConfirm: contact.honeypot,
      formRenderedAt: formRenderedAt.current,
    };

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

      // A success screen is shown only when the server says it accepted and
      // stored the submission. Anything else is an error, including a network
      // failure that leaves the outcome unknown.
      if (!response.ok || data.ok !== true) {
        const code = typeof data.code === "string" ? data.code : "submission_failed";
        track("lead_submission_failed", { error_code: code });
        setFailure({
          code,
          message:
            typeof data.message === "string"
              ? data.message
              : "Something went wrong on our side. Please try again.",
          retryable: code !== "validation_failed",
          contactEmail: typeof data.contactEmail === "string" ? data.contactEmail : null,
          fieldErrors:
            typeof data.errors === "object" && data.errors !== null
              ? (data.errors as Record<string, string>)
              : undefined,
        });
        return;
      }

      track("lead_submission_succeeded", {
        recommended_service: recommendation.service.id,
        recommendation_rule: recommendation.ruleId,
        audience: answers.audience,
        has_booking_link: typeof data.bookingUrl === "string",
      });

      setSuccess({
        submissionId: String(data.submissionId ?? submissionIdRef.current),
        recommendedService:
          typeof data.recommendedService === "string"
            ? data.recommendedService
            : recommendation.service.name,
        bookingUrl: typeof data.bookingUrl === "string" ? data.bookingUrl : null,
        contactEmail: typeof data.contactEmail === "string" ? data.contactEmail : null,
        delivery:
          data.delivery === "complete" || data.delivery === "needs_operator"
            ? data.delivery
            : "pending",
      });

      // The assessment is finished; clear the stored answers so a fresh visit
      // starts clean. Contact details were never stored in the browser.
      clearAnswers();
      setScreen("confirmation");
    } catch {
      track("lead_submission_failed", { error_code: "network_error" });
      setFailure({
        code: "network_error",
        message:
          "We couldn't reach our server. Check your connection and try again — your answers are safe.",
        retryable: true,
      });
    } finally {
      setSubmitting(false);
    }
  }, [answers, contact, recommendation, submitting]);

  // --- Rendering -------------------------------------------------------
  const summaryItems = useMemo(() => {
    const branch = branchFor(answers);
    const items: { label: string; value: string }[] = [];
    for (const step of branch) {
      if (!isStepAnswered(step, answers)) continue;
      const key = stepAnswerKey[step];
      const value = answers[key];
      items.push({
        label: stepCopy[step].shortLabel,
        value: Array.isArray(value)
          ? value.map((v) => labelFor(v)).join(", ")
          : labelFor(value as string | undefined),
      });
    }
    return items;
  }, [answers]);

  const aside = useMemo(() => {
    if (screen === "confirmation") {
      return (
        <div>
          <p className="text-[0.72rem] font-semibold tracking-[0.2em] text-cyan-500 uppercase">
            Received
          </p>
          <p className="mt-4 text-[1.05rem] leading-relaxed text-paper-300">
            Thanks — we have everything we need to prepare for the call.
          </p>
        </div>
      );
    }
    if (screen === "result" || screen === "contact") {
      return (
        <div>
          <p className="text-[0.72rem] font-semibold tracking-[0.2em] text-cyan-500 uppercase">
            Your suggested starting point
          </p>
          <p className="mt-4 text-[1.35rem] leading-snug font-semibold text-paper-50">
            {recommendation.service.name}
          </p>
          <p className="mt-3 text-[0.95rem] leading-relaxed text-paper-300">
            {recommendation.service.summary}
          </p>
          {answers.audience ? (
            <p className="mt-6 border-t border-white/12 pt-5 text-[0.9rem] text-charcoal-400">
              Built for {audienceById[answers.audience].descriptor}.
            </p>
          ) : null}
        </div>
      );
    }
    return <AnswerSummary items={summaryItems} />;
  }, [screen, recommendation, summaryItems, answers.audience]);

  if (!hydrated) {
    return (
      <FunnelShell aside={<AnswerSummary items={[]} />}>
        <div className="flex flex-1 items-center justify-center py-20">
          <p className="text-[0.95rem] text-charcoal-400">Loading your assessment…</p>
        </div>
      </FunnelShell>
    );
  }

  /**
   * Announcement for the live region. Kept as a separate value so the render
   * below can narrow `screen` to a question step without re-checking it.
   */
  const announcement =
    screen === "result"
      ? "Your suggested starting point"
      : screen === "contact"
        ? "Contact details"
        : screen === "confirmation"
          ? "Request received"
          : stepCopy[screen].question;

  function renderScreen() {
    if (screen === "confirmation") {
      // The confirmation screen is only reachable after the server accepted
      // and stored the submission, so `success` is always present here. The
      // guard keeps that invariant explicit rather than assumed.
      return success ? (
        <ConfirmationStep result={success} recommendation={recommendation} />
      ) : null;
    }

    if (screen === "contact") {
      return (
        <ContactStep
          recommendation={recommendation}
          values={contact}
          onChange={(patch) => {
            if (formRenderedAt.current === null) formRenderedAt.current = Date.now();
            setContact((current) => ({ ...current, ...patch }));
          }}
          onSubmit={handleSubmit}
          onBack={handleBack}
          submitting={submitting}
          failure={failure}
        />
      );
    }

    if (screen === "result") {
      return (
        <ResultStep
          recommendation={recommendation}
          answers={answers}
          onContinue={() => {
            formRenderedAt.current = Date.now();
            setScreen("contact");
          }}
          onBack={handleBack}
        />
      );
    }

    // `screen` is now narrowed to a question step.
    const step: StepId = screen;
    return (
      <QuestionStep
        stepKey={step}
        question={step === "goal" ? goalQuestionFor(answers.audience) : stepCopy[step].question}
        help={step === "content-needs" ? contentHelpFor(answers) : stepCopy[step].help}
        choices={choicesFor(step, answers)}
        kind={stepCopy[step].kind}
        value={answers[stepAnswerKey[step]] as string | string[] | undefined}
        onChange={(value, checked) => handleSelect(step, value, checked)}
        onContinue={() => advance(step, answers)}
        onBack={previousStep(step, answers) ? handleBack : null}
        progress={progressFor(step, answers)}
        canContinue={isStepAnswered(step, answers)}
        footnote={
          step === "content-needs" && answers.audience ? (
            <ul className="space-y-1.5">
              {audienceById[answers.audience].contentExamples.map((example) => (
                <li key={example}>— {example}</li>
              ))}
            </ul>
          ) : undefined
        }
      />
    );
  }

  return (
    <FunnelShell aside={aside}>
      {/* Announces each screen change without visually duplicating the heading. */}
      <div ref={liveRegionRef} tabIndex={-1} aria-live="polite" className="sr-only">
        {announcement}
      </div>
      {renderScreen()}
    </FunnelShell>
  );
}

function contentHelpFor(answers: AssessmentAnswers): string {
  const base = stepCopy["content-needs"].help ?? "";
  if (!answers.audience) return base;
  return `${base} For ${audienceById[answers.audience].descriptor}, that usually looks like:`;
}
