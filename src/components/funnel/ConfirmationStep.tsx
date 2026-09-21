"use client";

import Link from "next/link";
import { trackBookingLinkClicked } from "@/lib/analytics";
import type { Recommendation } from "@/lib/recommendation";
import { Alert } from "@/components/ui/Alert";
import { StepContainer } from "@/components/ui/StepContainer";

export interface SubmissionSuccess {
  submissionId: string;
  recommendedService: string;
  bookingUrl: string | null;
  contactEmail: string | null;
  /** "complete" once the CRM writes finished; "pending" while queued. */
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
 * This is only ever rendered after the server confirmed it durably stored the
 * submission. The wording distinguishes "received" from "synced": we never
 * claim CRM synchronisation is finished while delivery is still pending.
 *
 * If no booking link is configured, the screen says so honestly instead of
 * inventing a calendar URL or implying availability.
 */
export function ConfirmationStep({
  result,
  recommendation,
}: {
  result: SubmissionSuccess;
  recommendation: Recommendation;
}) {
  return (
    <StepContainer
      stepKey="confirmation"
      question="Your request has been received."
      help={`We have your answers and your suggested starting point: ${result.recommendedService}.`}
      actions={
        <div className="flex justify-center pb-1">
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center rounded-full px-4 text-[0.92rem] font-semibold text-charcoal-500 transition-colors hover:bg-paper-200 hover:text-navy-900"
          >
            Back to the homepage
          </Link>
        </div>
      }
      footnote={
        <p>
          Reference: <span className="font-mono text-[0.82rem]">{result.submissionId}</span>
        </p>
      }
    >
      <div className="space-y-5">
        <Alert tone="success" title="Saved and queued for our team.">
          <p>
            {result.delivery === "complete"
              ? "It's in our system and assigned for follow-up."
              : "It's safely stored and on its way to our team. Nothing further is needed from you."}
          </p>
        </Alert>

        <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
          <h2 className="text-[0.74rem] font-semibold tracking-[0.18em] text-charcoal-400 uppercase">
            Your suggested starting point
          </h2>
          <p className="mt-2 text-[1.15rem] font-semibold text-navy-900">
            {recommendation.service.name}
          </p>
          {recommendation.productionIsAddOn ? (
            <p className="mt-1.5 text-[0.9rem] text-charcoal-500">
              With Premium Content Production as an optional add-on.
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
          <h2 className="text-[0.74rem] font-semibold tracking-[0.18em] text-charcoal-400 uppercase">
            What the strategy call covers
          </h2>
          <ul className="mt-3 space-y-2.5">
            {AGENDA.map((item) => (
              <li key={item} className="flex gap-3 text-[0.95rem] leading-relaxed text-charcoal-700">
                <span
                  aria-hidden="true"
                  className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-electric-500"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          {result.bookingUrl ? (
            <div className="mt-6">
              <a
                href={result.bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={trackBookingLinkClicked}
                className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-electric-500 px-7 text-[1.02rem] font-semibold text-white transition-colors hover:bg-electric-600 sm:w-auto"
              >
                Pick a time for the call
              </a>
              <p className="mt-3 text-[0.84rem] leading-relaxed text-charcoal-400">
                Opens our booking calendar in a new tab. If it doesn&rsquo;t open, the link is{" "}
                <a
                  href={result.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={trackBookingLinkClicked}
                  className="break-all underline underline-offset-4"
                >
                  {result.bookingUrl}
                </a>
                .
              </p>
            </div>
          ) : (
            <div className="mt-6">
              <Alert tone="info" title="We'll reach out to arrange a time.">
                <p>
                  Online booking isn&rsquo;t set up yet, so we&rsquo;ll contact you directly to
                  find a time that works.
                </p>
                {result.contactEmail ? (
                  <p>
                    Prefer to reach us first? Email{" "}
                    <a
                      href={`mailto:${result.contactEmail}`}
                      className="font-semibold text-electric-600 underline underline-offset-4"
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
      </div>
    </StepContainer>
  );
}
