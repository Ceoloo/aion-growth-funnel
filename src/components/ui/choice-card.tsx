"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

/**
 * A single answer option.
 *
 * The control itself is stretched over the entire card and made transparent,
 * so the real hit area is the card rather than a 24px dot — that is what makes
 * the whole card tappable in fact and not just in appearance. The visible
 * indicator is a sibling that reacts to the control's state through `peer-*`,
 * which keeps the two in sync without duplicating state.
 *
 * Keyboard behaviour stays native: arrow keys move within a radio group, space
 * toggles a checkbox, and focus lands on a control that fills the card.
 *
 * Selection is signalled three ways, never colour alone — a heavier accent
 * border, a tinted background, and a filled indicator with a check.
 */
export interface ChoiceCardProps {
  id: string;
  value: string;
  label: string;
  hint?: string;
  type: "radio" | "checkbox";
  selected: boolean;
  onToggle?: (checked: boolean) => void;
  className?: string;
}

/** Stretches the underlying control across the whole card. */
const stretchedControl =
  "peer absolute inset-0 z-10 size-full rounded-xl border-0 bg-transparent opacity-0 shadow-none";

export function ChoiceCard({
  id,
  value,
  label,
  hint,
  type,
  selected,
  onToggle,
  className,
}: ChoiceCardProps) {
  const control =
    type === "radio" ? (
      <RadioGroupItem id={id} value={value} className={stretchedControl} />
    ) : (
      <Checkbox
        id={id}
        checked={selected}
        onCheckedChange={(next) => onToggle?.(next === true)}
        className={stretchedControl}
      />
    );

  return (
    <label
      htmlFor={id}
      data-selected={selected || undefined}
      className={cn(
        "press relative flex w-full cursor-pointer items-start gap-3.5",
        "min-h-[var(--tap-min)] rounded-xl border-2 bg-card px-4 py-4 text-left sm:px-5",
        // The focus ring belongs to the card, because the card is the control.
        "peer-focus-visible:outline peer-focus-visible:outline-3",
        "peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
        "active:scale-[0.995]",
        selected
          ? "border-primary bg-accent/50 shadow-subtle"
          : "border-border hover:border-charcoal-400",
        className,
      )}
    >
      {control}

      {/* Visual indicator. Decorative — the control above carries the state. */}
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center border-2",
          "transition-[background-color,border-color] duration-[var(--duration-feedback)]",
          type === "radio" ? "rounded-full" : "rounded-sm",
          selected ? "border-primary bg-primary" : "border-input bg-card",
        )}
      >
        {selected ? (
          type === "radio" ? (
            <span className="size-2 rounded-full bg-primary-foreground" />
          ) : (
            <Check className="size-4 text-primary-foreground" strokeWidth={3} />
          )
        ) : null}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          {/* Long labels wrap rather than truncating — nothing is hidden. */}
          <span className="block text-[1.0625rem] leading-snug font-semibold text-card-foreground">
            {label}
          </span>
          <Check
            aria-hidden="true"
            className={cn(
              "mt-0.5 size-5 shrink-0 text-primary transition-opacity duration-[var(--duration-feedback)]",
              selected ? "opacity-100" : "opacity-0",
            )}
          />
        </span>
        {hint ? (
          <span className="mt-1 block text-small leading-snug text-muted-foreground">{hint}</span>
        ) : null}
      </span>
    </label>
  );
}
