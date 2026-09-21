"use client";

import { useId, type ComponentPropsWithoutRef } from "react";

/**
 * Labelled text input with inline validation messaging.
 *
 * `inputMode`, `type` and `autoComplete` are surfaced deliberately: they are
 * what decides whether a phone keypad or an email keyboard appears on a
 * phone, and whether the browser can autofill.
 */
export function TextField({
  label,
  hint,
  error,
  required,
  optionalLabel = "Optional",
  className = "",
  ...rest
}: {
  label: string;
  hint?: string;
  error?: string;
  optionalLabel?: string;
} & ComponentPropsWithoutRef<"input">) {
  const generatedId = useId();
  const id = rest.id ?? generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={`w-full ${className}`}>
      <label
        htmlFor={id}
        className="mb-1.5 flex items-baseline justify-between gap-3 text-[0.92rem] font-semibold text-navy-900"
      >
        <span>{label}</span>
        {!required ? (
          <span className="text-[0.78rem] font-medium text-charcoal-400">{optionalLabel}</span>
        ) : null}
      </label>
      <input
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={[errorId, hintId].filter(Boolean).join(" ") || undefined}
        className={[
          "w-full rounded-xl border bg-white px-4 py-3 text-[1rem] text-navy-900",
          // 16px minimum font size stops iOS Safari zooming on focus.
          "placeholder:text-charcoal-400",
          "transition-[border-color,box-shadow] duration-200",
          error
            ? "border-red-500 focus:border-red-500"
            : "border-line-strong focus:border-electric-500",
        ].join(" ")}
        {...rest}
      />
      {hint && !error ? (
        <p id={hintId} className="mt-1.5 text-[0.84rem] leading-snug text-charcoal-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="mt-1.5 text-[0.86rem] font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Standalone checkbox with its own label — used for optional consent. */
export function CheckboxField({
  label,
  description,
  ...rest
}: { label: string; description?: string } & ComponentPropsWithoutRef<"input">) {
  const generatedId = useId();
  const id = rest.id ?? generatedId;
  const descriptionId = description ? `${id}-description` : undefined;

  return (
    <div className="rounded-xl border border-line bg-paper-50 p-4">
      <label htmlFor={id} className="flex min-h-[44px] cursor-pointer items-start gap-3">
        <input
          id={id}
          type="checkbox"
          aria-describedby={descriptionId}
          className="mt-0.5 h-5 w-5 min-h-0 shrink-0 accent-[var(--color-electric-500)]"
          {...rest}
        />
        <span className="text-[0.92rem] leading-snug text-charcoal-700">{label}</span>
      </label>
      {description ? (
        <p id={descriptionId} className="mt-2 pl-8 text-[0.84rem] leading-snug text-charcoal-500">
          {description}
        </p>
      ) : null}
    </div>
  );
}

/** Off-screen honeypot. Real people never see or focus it. */
export function HoneypotField({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div aria-hidden="true" className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden">
      <label htmlFor={name}>Do not fill this in</label>
      <input
        id={name}
        name={name}
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </div>
  );
}
