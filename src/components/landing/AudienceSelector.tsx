"use client";

import { useRouter } from "next/navigation";
import { audiences } from "@/content/audiences";
import { audienceSection } from "@/content/site";
import { Section } from "@/components/ui/Section";
import { track } from "@/lib/analytics";
import { writeAnswers } from "@/lib/session-answers";

/**
 * Audience cards.
 *
 * Selecting one writes the business-type answer into session storage and opens
 * the funnel on the next question, so the visitor never re-answers something
 * they have already told us.
 */
export function AudienceSelector() {
  const router = useRouter();

  function choose(id: (typeof audiences)[number]["id"]) {
    writeAnswers({ audience: id });
    track("landing_cta_clicked", { cta_id: "audience", cta_location: "audience_selector" });
    track("assessment_started", { audience: id });
    router.push(`/assessment?audience=${id}`);
  }

  return (
    <Section
      tone="white"
      eyebrow={audienceSection.eyebrow}
      heading={audienceSection.heading}
      supporting={audienceSection.supporting}
    >
      <ul className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {audiences.map((audience) => (
          <li key={audience.id}>
            <button
              type="button"
              onClick={() => choose(audience.id)}
              className="group flex h-full w-full flex-col items-start gap-2 rounded-2xl border border-line bg-paper-50 p-5 text-left transition-[border-color,box-shadow,transform] duration-200 hover:border-electric-400 hover:shadow-[var(--shadow-card)]"
            >
              <span className="text-[1.05rem] leading-snug font-semibold text-navy-900">
                {audience.label}
              </span>
              <span className="text-[0.9rem] leading-relaxed text-charcoal-500">
                {audience.blurb}
              </span>
              <span className="mt-auto inline-flex items-center gap-1.5 pt-3 text-[0.86rem] font-semibold text-electric-600">
                Start here
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Section>
  );
}
