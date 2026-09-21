"use client";

import Link from "next/link";
import { brand, ctaLabels, hero, servicesSection } from "@/content/site";
import { track } from "@/lib/analytics";

/** The chain graphic: five stages, connected. Pure SVG-free flex, so it reflows on small screens. */
function GrowthChain() {
  return (
    <ul className="flex flex-wrap items-center gap-x-2 gap-y-2.5" aria-label="How a customer arrives">
      {brand.chain.map((stage, index) => (
        <li key={stage} className="flex items-center gap-2">
          <span className="rounded-full border border-line-strong bg-white px-3 py-1.5 text-[0.78rem] font-semibold text-navy-900 sm:text-[0.84rem]">
            {stage}
          </span>
          {index < brand.chain.length - 1 ? (
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-3.5 w-3.5 text-electric-500"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function Hero() {
  return (
    <section className="aion-shell relative overflow-hidden bg-paper-100 pt-10 pb-14 sm:pt-16 sm:pb-20 lg:pt-20 lg:pb-24">
      {/* Restrained accent wash — no glass, no neon. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -right-32 h-[26rem] w-[26rem] rounded-full bg-electric-100/60 blur-3xl"
      />
      <div className="relative mx-auto w-full max-w-6xl">
        <div className="grid items-center gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
          <div className="max-w-2xl">
            <p className="text-[0.7rem] font-semibold tracking-[0.18em] text-electric-600 uppercase sm:text-[0.76rem] sm:tracking-[0.2em]">
              {hero.eyebrow}
            </p>

            <h1 className="mt-4 text-[2rem] leading-[1.1] font-semibold tracking-[-0.025em] text-navy-900 sm:text-[2.85rem] lg:text-[3.4rem]">
              {hero.headline}
            </h1>

            <p className="mt-5 max-w-xl text-[1.05rem] leading-relaxed text-charcoal-500 sm:text-[1.18rem]">
              {hero.supporting}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/assessment"
                onClick={() =>
                  track("landing_cta_clicked", { cta_id: "primary", cta_location: "hero" })
                }
                className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-electric-500 px-7 text-[1.02rem] font-semibold text-white shadow-[0_10px_30px_-14px_rgba(23,80,216,0.95)] transition-colors hover:bg-electric-600 sm:w-auto"
              >
                {ctaLabels.primary}
              </Link>
              <a
                href={`#${servicesSection.id}`}
                onClick={() =>
                  track("landing_cta_clicked", { cta_id: "secondary", cta_location: "hero" })
                }
                className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full border border-line-strong bg-white px-7 text-[1.02rem] font-semibold text-navy-900 transition-colors hover:border-charcoal-400 sm:w-auto"
              >
                {ctaLabels.secondary}
              </a>
            </div>

            <p className="mt-4 text-[0.9rem] text-charcoal-400">{hero.microcopy}</p>
          </div>

          <div className="lg:pl-4">
            <div className="rounded-3xl border border-line bg-white p-6 shadow-[var(--shadow-card)] sm:p-8">
              <p className="text-[0.72rem] font-semibold tracking-[0.18em] text-charcoal-400 uppercase">
                The system we build
              </p>
              <p className="mt-3 text-[1.15rem] leading-snug font-semibold text-navy-900 sm:text-[1.3rem]">
                {brand.tagline}
              </p>
              <div className="mt-6">
                <GrowthChain />
              </div>
              <p className="mt-6 border-t border-line pt-5 text-[0.92rem] leading-relaxed text-charcoal-500">
                {brand.description}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
