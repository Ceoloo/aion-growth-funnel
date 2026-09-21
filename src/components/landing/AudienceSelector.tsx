"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Building2, HardHat, Home, Wrench } from "lucide-react";
import { audiences } from "@/content/audiences";
import { audienceSection } from "@/content/site";
import type { AudienceId } from "@/content/types";
import { Section } from "@/components/ui/section";
import { track } from "@/lib/analytics";
import { writeAnswers } from "@/lib/session-answers";

const icons: Record<AudienceId, typeof HardHat> = {
  "contractor-builder": HardHat,
  "home-services": Wrench,
  "local-business": Building2,
  "real-estate": Home,
};

/**
 * Audience entry cards.
 *
 * Choosing one writes the business-type answer and opens the funnel on the
 * next question, so a visitor never answers the same thing twice. This is the
 * "relevance" step: the funnel starts by reflecting what they told us.
 */
export function AudienceSelector() {
  const router = useRouter();

  function choose(id: AudienceId) {
    writeAnswers({ audience: id });
    track("landing_cta_clicked", {
      cta_id: "audience",
      cta_location: "audience_selector",
      audience: id,
    });
    router.push(`/assessment?audience=${id}`);
  }

  return (
    <Section
      surface="tint"
      eyebrow={audienceSection.eyebrow}
      heading={audienceSection.heading}
      supporting={audienceSection.supporting}
    >
      <ul className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {audiences.map((audience) => {
          const Icon = icons[audience.id];
          return (
            <li key={audience.id}>
              <button
                type="button"
                onClick={() => choose(audience.id)}
                className="press group flex h-full w-full flex-col items-start gap-2 rounded-xl border border-border bg-card p-5 text-left hover:border-primary hover:shadow-card active:scale-[0.995]"
              >
                <Icon aria-hidden="true" className="size-6 text-primary" />
                <span className="mt-1 text-h3 leading-snug text-card-foreground">
                  {audience.label}
                </span>
                <span className="text-small text-muted-foreground">{audience.blurb}</span>
                <span className="mt-auto inline-flex items-center gap-1.5 pt-3 text-small font-semibold text-primary">
                  Start here
                  <ArrowRight
                    aria-hidden="true"
                    className="size-3.5 transition-transform duration-[var(--duration-feedback)] group-hover:translate-x-0.5 motion-reduce:transition-none"
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
