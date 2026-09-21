"use client";

import type { ReactNode } from "react";

/**
 * One full-screen funnel step.
 *
 * Layout rules this encodes:
 *  - the question is the dominant element on the screen;
 *  - the content area scrolls independently, so a short viewport (a phone in
 *    landscape, or a phone with the keyboard open) can always reach the last
 *    option;
 *  - the action bar is sticky but sits in normal flow at the end of the
 *    scroll area, so it can never cover the final option or a focused input;
 *  - bottom padding accounts for the home indicator via the safe-area inset.
 */
export function StepContainer({
  stepKey,
  header,
  question,
  help,
  children,
  actions,
  footnote,
}: {
  /** Changing this key re-runs the entrance transition. */
  stepKey: string;
  header?: ReactNode;
  question: string;
  help?: string;
  children: ReactNode;
  actions: ReactNode;
  footnote?: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {header ? <div className="shrink-0 pb-5">{header}</div> : null}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div key={stepKey} className="aion-step-enter pb-2">
          <h1 className="text-[1.5rem] leading-[1.2] font-semibold tracking-[-0.02em] text-navy-900 sm:text-[1.9rem] lg:text-[2.15rem]">
            {question}
          </h1>
          {help ? (
            <p className="mt-2.5 text-[0.96rem] leading-relaxed text-charcoal-500 sm:text-[1.02rem]">
              {help}
            </p>
          ) : null}

          <div className="mt-6 sm:mt-8">{children}</div>

          {footnote ? (
            <div className="mt-6 text-[0.86rem] leading-relaxed text-charcoal-400">{footnote}</div>
          ) : null}
        </div>

        {/* Reserves room so the sticky bar never overlaps the last element. */}
        <div className="h-4" aria-hidden="true" />
      </div>

      <div className="aion-sticky-actions z-10 shrink-0 pt-4">{actions}</div>
    </div>
  );
}

/** Back control. Always present after the first step; never hover-dependent. */
export function BackButton({ onClick, label = "Back" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-[0.92rem] font-semibold text-charcoal-500 transition-colors hover:bg-paper-200 hover:text-navy-900"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15 19l-7-7 7-7" />
      </svg>
      {label}
    </button>
  );
}
