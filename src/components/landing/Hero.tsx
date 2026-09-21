"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { brand, ctaLabels, hero, servicesSection } from "@/content/site";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/button";

/** The five stages, connected. Wraps rather than scrolling on a 360px screen. */
function GrowthChain() {
  return (
    <ul className="flex flex-wrap items-center gap-x-2 gap-y-2.5" aria-label="How a customer arrives">
      {brand.chain.map((stage, index) => (
        <li key={stage} className="flex items-center gap-2">
          <span className="rounded-pill border border-border bg-card px-3 py-1.5 text-small font-semibold text-card-foreground">
            {stage}
          </span>
          {index < brand.chain.length - 1 ? (
            <ArrowRight aria-hidden="true" className="size-3.5 text-primary" />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * Above the fold this has to answer four things at a glance: who we help, the
 * problem, what starting gets you, and the next action. The eyebrow carries
 * the first, the headline and supporting copy the second and third, and the
 * primary button the fourth.
 */
export function Hero({ ctaSentinelId }: { ctaSentinelId?: string }) {
  return (
    <section className="surface-light page-gutter relative overflow-hidden bg-background pt-10 pb-16 sm:pt-16 sm:pb-20 lg:pt-20 lg:pb-28">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -right-32 size-[26rem] rounded-full bg-accent/60 blur-3xl"
      />
      <div className="container-page relative">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div className="max-w-2xl">
            <p className="text-eyebrow uppercase text-electric-600">{hero.eyebrow}</p>

            <h1 className="mt-4 text-display text-balance text-foreground">{hero.headline}</h1>

            <p className="mt-5 max-w-xl text-lead text-muted-foreground">{hero.supporting}</p>

            <div id={ctaSentinelId} className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild size="action" full className="sm:w-auto">
                <Link
                  href="/assessment"
                  onClick={() =>
                    track("landing_cta_clicked", { cta_id: "primary", cta_location: "hero" })
                  }
                >
                  {ctaLabels.primary}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="secondary" size="action" full className="sm:w-auto">
                <a
                  href={`#${servicesSection.id}`}
                  onClick={() =>
                    track("landing_cta_clicked", { cta_id: "secondary", cta_location: "hero" })
                  }
                >
                  {ctaLabels.secondary}
                </a>
              </Button>
            </div>

            <p className="mt-4 text-small text-muted-foreground">{hero.microcopy}</p>
          </div>

          <div className="lg:pl-4">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
              <p className="text-eyebrow uppercase text-muted-foreground">The system we build</p>
              <p className="mt-3 text-h3 leading-snug text-card-foreground sm:text-h2">
                {brand.tagline}
              </p>
              <div className="mt-6">
                <GrowthChain />
              </div>
              <p className="mt-6 border-t border-border pt-5 text-small text-muted-foreground">
                {brand.description}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
