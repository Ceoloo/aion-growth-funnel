"use client";

import type { ReactNode } from "react";

/**
 * A single answer option.
 *
 * Rendered as a real radio or checkbox with a visually hidden input, so the
 * whole card is one large tap target while keyboard and screen-reader
 * behaviour stays native: arrow keys move within a radio group, space toggles
 * a checkbox, and the checked state is announced without any ARIA patching.
 *
 * Nothing here depends on hover — selection state is carried by colour, border
 * weight and an explicit indicator that is visible on touch devices.
 */
export function ChoiceCard({
  name,
  value,
  label,
  hint,
  type,
  checked,
  onSelect,
  icon,
}: {
  name: string;
  value: string;
  label: string;
  hint?: string;
  type: "radio" | "checkbox";
  checked: boolean;
  onSelect: (value: string, checked: boolean) => void;
  icon?: ReactNode;
}) {
  return (
    <label
      className={[
        "group relative flex min-h-[64px] w-full cursor-pointer items-start gap-3.5",
        "rounded-2xl border bg-white px-4 py-4 text-left sm:px-5",
        "transition-[border-color,box-shadow,background-color] duration-200",
        "has-[:focus-visible]:outline has-[:focus-visible]:outline-3",
        "has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-electric-500",
        checked
          ? "border-electric-500 bg-electric-100/45 shadow-[0_0_0_1px_var(--color-electric-500)]"
          : "border-line hover:border-line-strong",
      ].join(" ")}
    >
      <input
        type={type}
        name={name}
        value={value}
        checked={checked}
        onChange={(event) => onSelect(value, event.currentTarget.checked)}
        onClick={() => {
          // Re-selecting the option that is already chosen fires no `change`
          // event, so without this a visitor who navigates back and taps their
          // existing answer would be stuck on the screen. The guard reads the
          // React state, which has not yet updated for a genuinely new
          // selection, so this never double-fires.
          if (type === "radio" && checked) onSelect(value, true);
        }}
        className="sr-only"
      />

      <span
        aria-hidden="true"
        className={[
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border-2",
          type === "radio" ? "rounded-full" : "rounded-md",
          checked ? "border-electric-500 bg-electric-500" : "border-line-strong bg-white",
        ].join(" ")}
      >
        {checked ? (
          type === "radio" ? (
            <span className="h-2 w-2 rounded-full bg-white" />
          ) : (
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-white" fill="none">
              <path
                d="M3.5 8.5l3 3 6-7"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )
        ) : null}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          {icon}
          <span className="block text-[1.02rem] font-semibold text-navy-900">{label}</span>
        </span>
        {hint ? (
          <span className="mt-1 block text-[0.9rem] leading-snug text-charcoal-500">{hint}</span>
        ) : null}
      </span>
    </label>
  );
}
