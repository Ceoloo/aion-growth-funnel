"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/ui/Wordmark";
import { cn } from "@/lib/utils";

/**
 * Funnel chrome.
 *
 * Mobile: one column, the question owning the viewport.
 * Desktop: a centred two-column layout — context on the left, the active step
 * on the right. The step column is capped by `.container-step` (552px) so the
 * question keeps a comfortable measure rather than stretching; the mobile
 * layout is never simply widened.
 *
 * Height is fixed rather than min-height, which is what lets the step region
 * scroll internally and keeps the action area out of the content's way.
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
      className="surface-light flex w-full flex-col bg-background lg:flex-row"
      style={{ height: "var(--app-height)" }}
    >
      <aside
        className={cn(
          "surface-dark hidden shrink-0 bg-background text-foreground",
          "lg:flex lg:w-[38%] lg:max-w-[28rem] lg:flex-col lg:justify-between lg:p-10 xl:p-12",
        )}
      >
        <Link
          href={exitHref}
          className="inline-flex min-h-[var(--tap-min)] items-center rounded-sm"
          aria-label="AION Systems home"
        >
          <Wordmark tone="light" />
        </Link>
        <div className="py-10">{aside}</div>
        <p className="text-small text-muted-foreground">
          Your answers stay in this browser until you send them.
        </p>
      </aside>

      <main
        className="flex min-h-0 w-full flex-1 flex-col overflow-hidden"
        style={{
          height: "var(--app-height)",
          paddingTop: "max(0.75rem, var(--safe-top))",
        }}
      >
        <div className="container-step page-gutter flex min-h-0 w-full flex-1 flex-col pb-3 lg:py-8">
          <div className="mb-5 flex shrink-0 items-center justify-between lg:hidden">
            <Link
              href={exitHref}
              className="inline-flex min-h-[var(--tap-min)] items-center rounded-sm"
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

/** Desktop-only context: the answers given so far. */
export function AnswerSummary({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div>
      <p className="text-eyebrow uppercase text-cyan-400">Your answers so far</p>
      {items.length === 0 ? (
        <p className="mt-4 text-lead text-muted-foreground">
          Seven short questions. You&rsquo;ll see a suggested starting point before we ask
          for any contact details.
        </p>
      ) : (
        <dl className="mt-5 space-y-4">
          {items.map((item) => (
            <div key={item.label} className="border-l-2 border-border pl-4">
              <dt className="text-eyebrow uppercase text-muted-foreground">{item.label}</dt>
              <dd className="mt-1 text-body leading-snug text-foreground">{item.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** Desktop-only context shown from the result screen onward. */
export function ServiceContext({
  eyebrow,
  title,
  body,
  footnote,
}: {
  eyebrow: string;
  title: string;
  body: string;
  footnote?: string;
}) {
  return (
    <div>
      <p className="text-eyebrow uppercase text-cyan-400">{eyebrow}</p>
      <p className="mt-4 text-h2 text-foreground">{title}</p>
      <p className="mt-3 text-body text-muted-foreground">{body}</p>
      {footnote ? (
        <p className="mt-6 border-t border-border pt-5 text-small text-muted-foreground">
          {footnote}
        </p>
      ) : null}
    </div>
  );
}
