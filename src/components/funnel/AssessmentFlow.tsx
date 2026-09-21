"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, m } from "@/components/ui/m";
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
  previousStep,
  progressFor,
  reconcileAnswers,
  stepAnswerKey,
  type AssessmentAnswers,
} from "@/lib/assessment";
import {
  canContinue as canContinueFor,
  funnelReducer,
  isQuestionScreen,
  resumeScreen,
  type FunnelState,
} from "@/lib/funnel-machine";
import { recommend } from "@/lib/recommendation";
import { clearAnswers, mergeAnswers, readAnswers } from "@/lib/session-answers";
import {
  emptyContactForm,
  toLeadContact,
  type ContactFormValues,
} from "@/lib/contact-form-schema";
import { captureAttribution, readAttribution } from "@/lib/utm";
import { stepVariants, usePrefersReducedMotion } from "@/components/ui/motion";
import { AnswerSummary, FunnelShell, ServiceContext } from "./FunnelShell";
import { ConfirmationStep, type SubmissionSuccess } from "./ConfirmationStep";
import { ContactStep, type SubmissionFailure } from "./ContactStep";
import { QuestionStep } from "./QuestionStep";
import { ResultStep } from "./ResultStep";

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
  if (webCrypto && typeof webCrypto.randomUUID === "function") return webCrypto.randomUUID();
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
  const reducedMotion = usePrefersReducedMotion();

  const [answers, setAnswers] = React.useState<AssessmentAnswers>({});
  const [state, dispatch] = React.useReducer(funnelReducer, {
    screen: "business-type",
    direction: "forward",
  } satisfies FunnelState);
  const [hydrated, setHydrated] = React.useState(false);
  const [contactValues, setContactValues] = React.useState<ContactFormValues>(emptyContactForm);
  const [submitting, setSubmitting] = React.useState(false);
  const [failure, setFailure] = React.useState<SubmissionFailure | null>(null);
  const [success, setSuccess] = React.useState<SubmissionSuccess | null>(null);

  const startedRef = React.useRef(false);
  const stepEnteredAt = React.useRef(Date.now());
  const formRenderedAt = React.useRef<number | null>(null);
  // Stable for the life of one completed assessment, so retrying after a
  // network error can never create a second lead.
  const submissionIdRef = React.useRef<string | null>(null);
  const inFlightRef = React.useRef(false);
  const headingRef = React.useRef<HTMLDivElement | null>(null);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  const { screen, direction } = state;

  // --- Hydration -------------------------------------------------------
  React.useEffect(() => {
    captureAttribution();

    const stored = readAnswers();
    const preselected = searchParams.get("audience");
    const merged: AssessmentAnswers =
      preselected && isAudienceId(preselected) ? { ...stored, audience: preselected } : stored;

    const reconciled = reconcileAnswers(merged);
    setAnswers(reconciled);
    dispatch({ type: "GOTO", screen: resumeScreen(reconciled), direction: "forward" });
    setHydrated(true);
  }, [searchParams]);

  React.useEffect(() => {
    if (!hydrated || startedRef.current) return;
    startedRef.current = true;
    track("assessment_started", {
      audience: answers.audience,
      entry_point: searchParams.get("audience") ? "audience_card" : "direct",
    });
  }, [hydrated, answers.audience, searchParams]);

  // Move focus to the new screen's heading and reset the scroll position, so
  // keyboard and screen-reader users land on the new question rather than
  // wherever the previous one left them.
  React.useEffect(() => {
    if (!hydrated) return;
    stepEnteredAt.current = Date.now();
    headingRef.current?.focus();
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
    if (isQuestionScreen(screen)) {
      const progress = progressFor(screen, answers);
      track("assessment_step_viewed", {
        step_id: screen,
        step_index: progress.current,
        step_total: progress.total,
      });
    }
    // `answers` deliberately omitted: this fires on screen changes only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, hydrated]);

  const recommendation = React.useMemo(() => recommend(answers), [answers]);

  // --- Answer handling -------------------------------------------------
  const setSingle = React.useCallback((step: StepId, value: string) => {
    setAnswers((current) => {
      const next = reconcileAnswers({
        ...current,
        [stepAnswerKey[step]]: value,
      } as AssessmentAnswers);
      mergeAnswers(next);
      return next;
    });
  }, []);

  const toggleMulti = React.useCallback((step: StepId, value: string, checked: boolean) => {
    setAnswers((current) => {
      const key = stepAnswerKey[step];
      if (key !== "channels") return current;
      const existing = current.channels ?? [];
      const updated = checked
        ? [...new Set([...existing, value])]
        : existing.filter((c) => c !== value);
      const next = reconcileAnswers({
        ...current,
        channels: updated as AssessmentAnswers["channels"],
      });
      mergeAnswers(next);
      return next;
    });
  }, []);

  // --- Navigation ------------------------------------------------------
  const dwellSeconds = () => Math.round((Date.now() - stepEnteredAt.current) / 1000);

  const handleContinue = React.useCallback(() => {
    if (isQuestionScreen(screen)) {
      const progress = progressFor(screen, answers);
      const key = stepAnswerKey[screen];
      const value = answers[key];
      track("assessment_step_completed", {
        step_id: screen,
        step_index: progress.current,
        step_total: progress.total,
        dwell_seconds: dwellSeconds(),
        // Answer ids only — `sanitiseProps` drops anything else.
        audience: answers.audience,
        bottleneck: screen === "bottleneck" ? answers.bottleneck : undefined,
        follow_up: screen === "follow-up" ? answers.followUp : undefined,
        goal: screen === "goal" ? answers.goal : undefined,
        content_need: screen === "content-needs" ? answers.contentNeed : undefined,
        timing: screen === "timing" ? answers.timing : undefined,
        channel_count: Array.isArray(value) ? value.length : undefined,
      });

      const branch = branchFor(answers);
      if (screen === branch[branch.length - 1]) {
        track("assessment_completed", {
          audience: answers.audience,
          answer_count: branch.length,
        });
      }
    }
    if (screen === "result") {
      formRenderedAt.current = Date.now();
      track("contact_step_viewed", { recommended_service: recommendation.service.id });
    }
    setFailure(null);
    dispatch({ type: "CONTINUE", answers });
  }, [screen, answers, recommendation.service.id]);

  const handleBack = React.useCallback(() => {
    if (isQuestionScreen(screen)) {
      const progress = progressFor(screen, answers);
      track("assessment_step_exited", {
        step_id: screen,
        step_index: progress.current,
        step_total: progress.total,
        exit_reason: "back",
        dwell_seconds: dwellSeconds(),
      });
    }
    setFailure(null);
    dispatch({ type: "BACK", answers });
  }, [screen, answers]);

  // --- Submission ------------------------------------------------------
  const handleSubmit = React.useCallback(
    async (values: ContactFormValues) => {
      // Guard against a double submit from a fast second tap or an Enter key
      // landing while the first request is still open.
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setSubmitting(true);
      setFailure(null);

      if (!submissionIdRef.current) submissionIdRef.current = newSubmissionId();
      if (formRenderedAt.current === null) formRenderedAt.current = Date.now() - 2_000;

      const payload = {
        submissionId: submissionIdRef.current,
        contact: toLeadContact(values),
        answers,
        consent: {
          marketingEmail: values.marketingEmail,
          copyVersion: MARKETING_CONSENT_VERSION,
        },
        attribution: readAttribution(),
        companyWebsiteConfirm: values.companyWebsiteConfirm,
        formRenderedAt: formRenderedAt.current,
      };

      try {
        const response = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

        // A success screen appears only when the server says it stored the
        // submission. Anything else — including an unknown outcome — is an error.
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

        // The assessment is finished, so a fresh visit starts clean. Contact
        // details were never written to browser storage in the first place.
        clearAnswers();
        dispatch({ type: "SUBMITTED" });
      } catch {
        track("lead_submission_failed", { error_code: "network_error" });
        setFailure({
          code: "network_error",
          message:
            "We couldn't reach our server. Check your connection and try again — nothing you typed has been lost.",
          retryable: true,
        });
      } finally {
        inFlightRef.current = false;
        setSubmitting(false);
      }
    },
    [answers, recommendation],
  );

  // --- Desktop context column -----------------------------------------
  const summaryItems = React.useMemo(() => {
    const items: { label: string; value: string }[] = [];
    for (const step of branchFor(answers)) {
      if (!isStepAnswered(step, answers)) continue;
      const value = answers[stepAnswerKey[step]];
      items.push({
        label: stepCopy[step].shortLabel,
        value: Array.isArray(value)
          ? value.map((v) => labelFor(v)).join(", ")
          : labelFor(value as string | undefined),
      });
    }
    return items;
  }, [answers]);

  const aside = React.useMemo(() => {
    if (screen === "confirmation") {
      return (
        <ServiceContext
          eyebrow="Received"
          title="Thanks — that's everything we need."
          body="We'll review your answers before the call so we can spend the time on your situation, not on the basics."
        />
      );
    }
    if (screen === "result" || screen === "contact") {
      return (
        <ServiceContext
          eyebrow="Your suggested starting point"
          title={recommendation.service.name}
          body={recommendation.service.summary}
          footnote={
            answers.audience
              ? `Built for ${audienceById[answers.audience].descriptor}.`
              : undefined
          }
        />
      );
    }
    return <AnswerSummary items={summaryItems} />;
  }, [screen, recommendation, summaryItems, answers.audience]);

  if (!hydrated) {
    return (
      <FunnelShell aside={<AnswerSummary items={[]} />}>
        <div className="flex flex-1 items-center justify-center py-20">
          <p className="text-small text-muted-foreground">Loading your assessment…</p>
        </div>
      </FunnelShell>
    );
  }

  const announcement = isQuestionScreen(screen)
    ? screen === "goal"
      ? goalQuestionFor(answers.audience)
      : stepCopy[screen].question
    : screen === "result"
      ? "Your suggested starting point"
      : screen === "contact"
        ? "Contact details"
        : "Request received";

  function renderScreen() {
    if (screen === "confirmation") {
      return success ? (
        <ConfirmationStep
          result={success}
          recommendation={recommendation}
          scrollRef={scrollRef}
        />
      ) : null;
    }

    if (screen === "contact") {
      return (
        <ContactStep
          recommendation={recommendation}
          defaultValues={contactValues}
          onValuesChange={setContactValues}
          onSubmit={handleSubmit}
          onBack={handleBack}
          submitting={submitting}
          failure={failure}
          scrollRef={scrollRef}
        />
      );
    }

    if (screen === "result") {
      return (
        <ResultStep
          recommendation={recommendation}
          answers={answers}
          onContinue={handleContinue}
          onBack={handleBack}
          scrollRef={scrollRef}
        />
      );
    }

    const step: StepId = screen;
    return (
      <QuestionStep
        stepKey={step}
        question={step === "goal" ? goalQuestionFor(answers.audience) : stepCopy[step].question}
        help={step === "content-needs" ? contentHelpFor(answers) : stepCopy[step].help}
        choices={choicesFor(step, answers)}
        kind={stepCopy[step].kind}
        value={answers[stepAnswerKey[step]] as string | string[] | undefined}
        onSelect={(value) => setSingle(step, value)}
        onToggle={(value, checked) => toggleMulti(step, value, checked)}
        onContinue={handleContinue}
        onBack={previousStep(step, answers) ? handleBack : null}
        progress={progressFor(step, answers)}
        canContinue={canContinueFor(step, answers)}
        scrollRef={scrollRef}
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
      {/* Announces each screen change without visually duplicating the heading.
          It is also the focus target, so keyboard users land here on arrival. */}
      <div ref={headingRef} tabIndex={-1} aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {/* `mode="wait"` lets the outgoing screen finish before the incoming one
          mounts, so two steps can never be in the DOM at once and a fast
          double-tap cannot produce a duplicate transition. */}
      <AnimatePresence mode="wait" custom={direction} initial={false}>
        <m.div
          key={screen}
          data-step-panel={screen}
          custom={direction}
          variants={reducedMotion ? undefined : stepVariants}
          initial="enter"
          animate="center"
          exit="exit"
          className="flex min-h-0 flex-1 flex-col"
        >
          {renderScreen()}
        </m.div>
      </AnimatePresence>
    </FunnelShell>
  );
}

function contentHelpFor(answers: AssessmentAnswers): string {
  const base = stepCopy["content-needs"].help ?? "";
  if (!answers.audience) return base;
  return `${base} For ${audienceById[answers.audience].descriptor}, that usually looks like:`;
}
