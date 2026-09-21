"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/ui/Wordmark";

/**
 * Funnel chrome.
 *
 * Mobile: one full-height column, the active step filling the screen.
 * Desktop (lg+): two columns — brand and context on the left, the live step on
 * the right. The right column stays the visually dominant element; the left is
 * deliberately quieter so it frames the question rather than competing with it.
 *
 * Height uses `--app-height`, which resolves to `100dvh` where supported and
 * falls back to `100vh`, so mobile browser chrome does not clip the actions.
 */
export function FunnelShell({
  aside,
  children,
  exitHref = "/",
}: {
  aside: ReactNode;
  children: ReactNode;
  exitHref?: string;
}) {
  return (
    <div
      className="flex w-full flex-col bg-paper-100 lg:flex-row"
      style={{ height: "var(--app-height)" }}
    >
      {/* Left column: brand and context. Hidden on small screens where the
          question must own the viewport. */}
      <aside className="hidden shrink-0 bg-navy-900 text-paper-100 lg:flex lg:w-[38%] lg:max-w-[30rem] lg:flex-col lg:justify-between lg:p-10 xl:p-12">
        <Link
          href={exitHref}
          className="aion-target inline-flex items-center"
          aria-label="AION Systems home"
        >
          <Wordmark tone="light" />
        </Link>
        <div className="py-10">{aside}</div>
        <p className="text-[0.82rem] text-charcoal-400">
          Your answers stay in this browser until you send them.
        </p>
      </aside>

      {/*
        A fixed height (not min-height) is what makes the internal scroll area
        work: content scrolls inside the step while the action bar stays a
        normal flex item at the bottom, so it can never float over a field or
        the last option. On a short screen the step scrolls rather than being
        clipped, and when a mobile keyboard shrinks the viewport `100dvh`
        follows it, so the focused field stays reachable.
      */}
      <main
        className="flex min-h-0 w-full flex-1 flex-col overflow-hidden"
        style={{
          paddingTop: "max(0.75rem, var(--safe-top))",
          height: "var(--app-height)",
        }}
      >
        <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col px-4 pb-3 sm:px-6 lg:max-w-2xl lg:px-10 lg:py-8">
          {/* Compact brand bar on mobile only. */}
          <div className="mb-4 flex shrink-0 items-center justify-between lg:hidden">
            <Link
              href={exitHref}
              className="aion-target inline-flex items-center"
              aria-label="AION Systems home"
            >
              <Wordmark />
            </Link>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

/** Left-column content for the question steps: the answers so far. */
export function AnswerSummary({
  items,
}: {
  items: { label: string; value: string }[];
}) {
  return (
    <div>
      <p className="text-[0.72rem] font-semibold tracking-[0.2em] text-cyan-500 uppercase">
        Your answers so far
      </p>
      {items.length === 0 ? (
        <p className="mt-4 text-[1.05rem] leading-relaxed text-paper-300">
          Seven short questions. You&rsquo;ll see a suggested starting point before we ask for
          any contact details.
        </p>
      ) : (
        <dl className="mt-5 space-y-4">
          {items.map((item) => (
            <div key={item.label} className="border-l-2 border-white/15 pl-4">
              <dt className="text-[0.76rem] font-medium tracking-wide text-charcoal-400 uppercase">
                {item.label}
              </dt>
              <dd className="mt-1 text-[0.98rem] leading-snug text-paper-100">{item.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
