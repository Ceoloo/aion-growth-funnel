"use client";

import { m } from "@/components/ui/m";
import { Check } from "lucide-react";
import { services } from "@/content/services";
import type { Recommendation } from "@/lib/recommendation";
import { usePrefersReducedMotion } from "@/components/ui/motion";

/**
 * The suggested starting point.
 *
 * The reveal is a short, staggered fade — it makes the sections land in
 * reading order rather than all at once. It is decorative only: the content is
 * already in the DOM and readable, and with Reduced Motion the stagger is
 * dropped entirely rather than merely shortened. Nothing is gated behind it,
 * and there is no artificial "analysing" delay.
 */
export function RecommendationCard({ recommendation }: { recommendation: Recommendation }) {
  const production = services["content-production"];
  const reduced = usePrefersReducedMotion();

  const reveal = (index: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 8 },
          animate: { opacity: 1, y: 0 },
          transition: {
            duration: 0.24,
            delay: 0.06 * index,
            ease: [0.22, 1, 0.36, 1] as const,
          },
        };

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <m.div
        {...reveal(0)}
        className="surface-dark border-b border-border bg-background px-5 py-6 sm:px-7"
      >
        <p className="text-eyebrow uppercase text-cyan-400">Suggested starting point</p>
        <h2 className="mt-2 text-h2 text-foreground">{recommendation.service.name}</h2>
        <p className="mt-2 text-body text-muted-foreground">
          {recommendation.service.summary}
        </p>
        {recommendation.productionIsAddOn ? (
          <p className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-pill bg-secondary px-3.5 py-2 text-small font-medium text-foreground">
            <span aria-hidden="true">+</span>
            <span>{production.name}</span>
            <span className="text-muted-foreground">— optional add-on</span>
          </p>
        ) : null}
      </m.div>

      <div className="space-y-7 px-5 py-6 sm:px-7 sm:py-7">
        <m.section {...reveal(1)}>
          <h3 className="text-eyebrow uppercase text-muted-foreground">
            Why this matches your answers
          </h3>
          <ul className="mt-3 space-y-2.5">
            {recommendation.reasons.map((reason) => (
              <li key={reason} className="flex gap-3 text-body text-card-foreground">
                <span
                  aria-hidden="true"
                  className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-primary"
                />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </m.section>

        <m.section {...reveal(2)}>
          <h3 className="text-eyebrow uppercase text-muted-foreground">
            Three priorities we&rsquo;d start with
          </h3>
          <ol className="mt-3 space-y-3">
            {recommendation.priorities.map((priority, index) => (
              <li key={priority} className="flex gap-3.5">
                <span
                  aria-hidden="true"
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-[0.82rem] font-bold text-accent-foreground"
                >
                  {index + 1}
                </span>
                <span className="pt-0.5 text-body text-card-foreground">{priority}</span>
              </li>
            ))}
          </ol>
        </m.section>

        <m.section
          {...reveal(3)}
          className="rounded-xl border border-border bg-muted/60 p-4 sm:p-5"
        >
          <h3 className="text-eyebrow uppercase text-muted-foreground">
            What you said you want
          </h3>
          <p className="mt-2 flex items-center gap-2 text-h3 text-card-foreground">
            <Check aria-hidden="true" className="size-5 text-primary" />
            {recommendation.goalLabel}
          </p>
        </m.section>

        <m.p
          {...reveal(4)}
          className="border-t border-border pt-5 text-small text-muted-foreground"
        >
          {recommendation.scopeNote}
        </m.p>
      </div>
    </article>
  );
}
