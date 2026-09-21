"use client";

import * as React from "react";
import { ArrowRight } from "lucide-react";
import { RadioGroup } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { ChoiceCard } from "@/components/ui/choice-card";
import { BackButton, StepHeading, StepShell } from "@/components/ui/step-shell";
import { ProgressHeader } from "./ProgressHeader";
import type { Choice } from "@/content/types";

/**
 * One question screen.
 *
 * Selection never auto-advances. A visitor always gets a chance to read their
 * choice back and change it before committing, and the Continue button is the
 * single predictable primary action on every screen — including single-select,
 * where an auto-advance would otherwise make the back button feel like a trap.
 */
export function QuestionStep({
  stepKey,
  question,
  help,
  choices,
  kind,
  value,
  onSelect,
  onToggle,
  onContinue,
  onBack,
  progress,
  footnote,
  canContinue,
  scrollRef,
}: {
  stepKey: string;
  question: string;
  help?: string;
  choices: Choice<string>[];
  kind: "single" | "multi";
  value: string | string[] | undefined;
  onSelect: (value: string) => void;
  onToggle: (value: string, checked: boolean) => void;
  onContinue: () => void;
  onBack: (() => void) | null;
  progress: { current: number; total: number; percent: number };
  footnote?: React.ReactNode;
  canContinue: boolean;
  scrollRef?: React.Ref<HTMLDivElement>;
}) {
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const headingId = `${stepKey}-question`;
  const helpText =
    kind === "multi" ? [help, "Select all that apply."].filter(Boolean).join(" ") : help;

  const options = choices.map((choice) => (
    <ChoiceCard
      key={choice.id}
      id={`${stepKey}-${choice.id}`}
      value={choice.id}
      label={choice.label}
      hint={choice.hint}
      type={kind === "multi" ? "checkbox" : "radio"}
      selected={selected.includes(choice.id)}
      onToggle={(checked) => onToggle(choice.id, checked)}
    />
  ));

  return (
    <StepShell
      scrollRef={scrollRef}
      header={
        <ProgressHeader
          current={progress.current}
          total={progress.total}
          percent={progress.percent}
          label="Growth assessment"
        />
      }
      actions={
        <div className="flex items-center gap-3">
          {onBack ? <BackButton onClick={onBack} /> : <span className="min-w-[1px]" />}
          <Button
            type="button"
            size="action"
            onClick={onContinue}
            disabled={!canContinue}
            className="ml-auto flex-1 sm:flex-none sm:min-w-[11rem]"
          >
            Continue
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      }
    >
      <StepHeading id={headingId} title={question} supporting={helpText} />

      <div className="mt-7">
        {kind === "multi" ? (
          // Checkboxes are independent controls, so a group label carries the
          // question rather than a radio group's roving focus.
          <div role="group" aria-labelledby={headingId} className="flex flex-col gap-3">
            {options}
          </div>
        ) : (
          <RadioGroup
            value={typeof value === "string" ? value : ""}
            onValueChange={onSelect}
            aria-labelledby={headingId}
            className="flex flex-col gap-3"
          >
            {options}
          </RadioGroup>
        )}
      </div>

      {footnote ? (
        <div className="mt-6 text-small text-muted-foreground">{footnote}</div>
      ) : null}
    </StepShell>
  );
}
