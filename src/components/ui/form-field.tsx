"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/**
 * Labelled text field.
 *
 * The error is wired to the input through `aria-describedby` and
 * `aria-invalid`, so it is announced with the field rather than floating
 * nearby, and the visual and accessible states cannot diverge.
 */
export const TextField = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input"> & {
    label: string;
    hint?: string;
    error?: string;
    optionalLabel?: string;
  }
>(function TextField(
  { label, hint, error, required, optionalLabel = "Optional", className, id, ...props },
  ref,
) {
  const generatedId = React.useId();
  const fieldId = id ?? generatedId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <Label htmlFor={fieldId} className="text-[0.95rem] font-semibold text-foreground">
          {label}
        </Label>
        {!required ? (
          <span className="text-small text-muted-foreground">{optionalLabel}</span>
        ) : null}
      </div>
      <Input
        id={fieldId}
        ref={ref}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={[errorId, hintId].filter(Boolean).join(" ") || undefined}
        {...props}
      />
      {hint && !error ? (
        <p id={hintId} className="mt-1.5 text-small text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="mt-1.5 text-small font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
});

/** Standalone consent checkbox. Separate, optional, and unchecked by default. */
export function ConsentField({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id?: string;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const generatedId = React.useId();
  const fieldId = id ?? generatedId;
  const descriptionId = description ? `${fieldId}-description` : undefined;

  return (
    <div className="rounded-xl border border-border bg-muted/50 p-4">
      <div className="flex min-h-[var(--tap-min)] items-start gap-3">
        <Checkbox
          id={fieldId}
          checked={checked}
          onCheckedChange={(next) => onCheckedChange(next === true)}
          aria-describedby={descriptionId}
          className="mt-0.5 size-6 shrink-0 rounded-sm border-2 data-[state=checked]:border-primary data-[state=checked]:bg-primary [&_svg]:size-4"
        />
        <Label
          htmlFor={fieldId}
          className="cursor-pointer text-small leading-snug font-normal text-foreground"
        >
          {label}
        </Label>
      </div>
      {description ? (
        <p id={descriptionId} className="mt-2 pl-9 text-small text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}

/** Off-screen honeypot. Hidden from people and from assistive technology. */
export const HoneypotField = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(function HoneypotField(props, ref) {
  return (
    <div aria-hidden="true" className="absolute top-0 left-[-9999px] size-0 overflow-hidden">
      <label htmlFor="company_website_confirm">Do not fill this in</label>
      <input
        id="company_website_confirm"
        ref={ref}
        type="text"
        tabIndex={-1}
        autoComplete="off"
        {...props}
      />
    </div>
  );
});
