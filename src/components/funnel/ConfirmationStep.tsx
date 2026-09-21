"use client";

import * as React from "react";
import Link from "next/link";
import { m } from "@/components/ui/m";
import { CalendarClock, ExternalLink } from "lucide-react";
import { trackBookingLinkClicked } from "@/lib/analytics";
import type { Recommendation } from "@/lib/recommendation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { usePrefersReducedMotion } from "@/components/ui/motion";
import { StepHeading, StepShell } from "@/components/ui/step-shell";

export interface SubmissionSuccess {
  submissionId: string;
  recommendedService: string;
  bookingUrl: string | null;
  contactEmail: string | null;
  /** "complete" once the CRM writes finished; "pending" while still queued. */
  delivery: "complete" | "pending" | "needs_operator";
}

const AGENDA = [
  "Review how inquiries reach you today and what happens to them",
  "Identify the priorities worth addressing first",
  "Define a scope that suits your situation and timing",
];

/**
 * Post-submission screen.
 *
 * Only rendered after the server confirmed it durably stored the submission.
 * The wording separates "received" from "synced": we never claim CRM
 * synchronisation is finished while delivery is still pending.
 *
 * The booking step is a plain external link rather than an embedded calendar.
 * An embed is the part most likely to fail on a phone — blocked third-party
 * frames, a slow connection, a private window — and a link cannot fail in
 * those ways. The full URL is also printed beneath it as a fallback.
 */
export function ConfirmationStep({
  result,
  recommendation,
  scrollRef,
}: {
  result: SubmissionSuccess;
  recommendation: Recommendation;
  scrollRef?: React.Ref<HTMLDivElement>;
}) {
  const reduced = usePrefersReducedMotion();

  const enter = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const },
      };

  return (
    <StepShell
      scrollRef={scrollRef}
      actions={
        <div className="flex justify-center pb-1">
          <Button asChild variant="quiet" size="compact">
            <Link href="/">Back to the homepage</Link>
          </Button>
        </div>
      }
    >
      <StepHeading
        title="Your request has been received."
        supporting={`We have your answers and your suggested starting point: ${result.recommendedService}.`}
      />

      <m.div {...enter} className="mt-7 space-y-5">
        <Alert tone="success" title="Saved and queued for our team.">
          <p>
            {result.delivery === "complete"
              ? "It's in our system and assigned for follow-up."
              : "It's safely stored and on its way to our team. Nothing further is needed from you."}
          </p>
        </Alert>

        <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <h2 className="text-eyebrow uppercase text-muted-foreground">
            Your suggested starting point
          </h2>
          <p className="mt-2 text-h3 text-card-foreground">{recommendation.service.name}</p>
          {recommendation.productionIsAddOn ? (
            <p className="mt-1.5 text-small text-muted-foreground">
              With Premium Content Production as an optional add-on.
            </p>
          ) : null}
        </section>

        <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <h2 className="text-eyebrow uppercase text-muted-foreground">
            What the strategy call covers
          </h2>
          <ul className="mt-3 space-y-2.5">
            {AGENDA.map((item) => (
              <li key={item} className="flex gap-3 text-body text-card-foreground">
                <span
                  aria-hidden="true"
                  className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-primary"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          {result.bookingUrl ? (
            <div className="mt-6">
              <Button asChild size="action" full className="sm:w-auto">
                <a
                  href={result.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackBookingLinkClicked({ entry_point: "confirmation" })}
                >
                  <CalendarClock aria-hidden="true" />
                  Pick a time for the call
                </a>
              </Button>
              <p className="mt-3 text-small text-muted-foreground">
                Opens our booking calendar in a new tab. If it doesn&rsquo;t open, the link
                is{" "}
                <a
                  href={result.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackBookingLinkClicked({ entry_point: "confirmation" })}
                  className="inline-flex items-baseline gap-1 break-all underline underline-offset-4"
                >
                  {result.bookingUrl}
                  <ExternalLink aria-hidden="true" className="size-3 shrink-0" />
                </a>
                .
              </p>
            </div>
          ) : (
            <div className="mt-6">
              <Alert tone="info" title="We'll reach out to arrange a time.">
                <p>
                  Online booking isn&rsquo;t set up yet, so we&rsquo;ll contact you directly
                  to find a time that works.
                </p>
                {result.contactEmail ? (
                  <p>
                    Prefer to reach us first? Email{" "}
                    <a
                      href={`mailto:${result.contactEmail}`}
                      className="font-semibold text-primary underline underline-offset-4"
                    >
                      {result.contactEmail}
                    </a>
                    .
                  </p>
                ) : null}
              </Alert>
            </div>
          )}
        </section>

        <p className="text-small text-muted-foreground">
          Reference: <span className="font-mono text-[0.85rem]">{result.submissionId}</span>
        </p>
      </m.div>
    </StepShell>
  );
}
