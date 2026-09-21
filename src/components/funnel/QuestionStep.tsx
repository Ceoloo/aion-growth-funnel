"use client";

import type { Choice } from "@/content/types";
import { Button } from "@/components/ui/Button";
import { ChoiceCard } from "@/components/ui/ChoiceCard";
import { ProgressIndicator } from "@/components/ui/ProgressIndicator";
import { BackButton, StepContainer } from "@/components/ui/StepContainer";

/**
 * A single question screen.
 *
 * Single-select advances as soon as an option is chosen — one tap, one
 * question, no redundant Continue. Multi-select keeps an explicit Continue
 * because the visitor has to be able to pick more than one thing first.
 */
export function QuestionStep({
  stepKey,
  question,
  help,
  choices,
  kind,
  value,
  onChange,
  onContinue,
  onBack,
  progress,
  footnote,
  canContinue,
}: {
  stepKey: string;
  question: string;
  help?: string;
  choices: Choice<string>[];
  kind: "single" | "multi";
  value: string | string[] | undefined;
  onChange: (value: string, checked: boolean) => void;
  onContinue: () => void;
  onBack: (() => void) | null;
  progress: { current: number; total: number; percent: number };
  footnote?: React.ReactNode;
  canContinue: boolean;
}) {
  const selected = Array.isArray(value) ? value : value ? [value] : [];

  return (
    <StepContainer
      stepKey={stepKey}
      header={
        <ProgressIndicator
          current={progress.current}
          total={progress.total}
          percent={progress.percent}
          label="Growth assessment"
        />
      }
      question={question}
      help={help}
      footnote={footnote}
      actions={
        <div className="flex items-center justify-between gap-3">
          {onBack ? <BackButton onClick={onBack} /> : <span />}
          {/*
            Multi-select always needs a Continue. Single-select advances on
            tap, but once an answer exists — which is what a visitor sees after
            navigating back — an explicit Continue is shown so moving forward
            never depends on re-tapping the option already selected.
          */}
          {kind === "multi" || canContinue ? (
            <Button
              type="button"
              size="lg"
              onClick={onContinue}
              disabled={!canContinue}
              className="min-w-[9rem] flex-1 sm:flex-none"
            >
              Continue
            </Button>
          ) : (
            <span className="text-[0.84rem] text-charcoal-400">Select one to continue</span>
          )}
        </div>
      }
    >
      <fieldset className="border-0 p-0">
        <legend className="sr-only">{question}</legend>
        <div className="flex flex-col gap-2.5">
          {choices.map((choice) => (
            <ChoiceCard
              key={choice.id}
              name={stepKey}
              value={choice.id}
              label={choice.label}
              hint={choice.hint}
              type={kind === "multi" ? "checkbox" : "radio"}
              checked={selected.includes(choice.id)}
              onSelect={onChange}
            />
          ))}
        </div>
      </fieldset>
    </StepContainer>
  );
}
