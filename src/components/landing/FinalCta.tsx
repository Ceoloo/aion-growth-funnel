"use client";

import Link from "next/link";
import { ctaLabels, finalCta } from "@/content/site";
import { track } from "@/lib/analytics";

export function FinalCta() {
  return (
    <section className="aion-shell bg-paper-100 py-16 sm:py-20 lg:py-24">
      <div className="mx-auto w-full max-w-4xl">
        <div className="rounded-3xl border border-line bg-white px-6 py-10 text-center shadow-[var(--shadow-card)] sm:px-10 sm:py-14">
          <h2 className="text-[1.7rem] leading-[1.15] font-semibold tracking-[-0.02em] text-navy-900 sm:text-[2.25rem]">
            {finalCta.heading}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[1rem] leading-relaxed text-charcoal-500 sm:text-[1.08rem]">
            {finalCta.supporting}
          </p>
          <Link
            href="/assessment"
            onClick={() =>
              track("landing_cta_clicked", { cta_id: "primary", cta_location: "final" })
            }
            className="mt-8 inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-electric-500 px-8 text-[1.02rem] font-semibold text-white shadow-[0_10px_30px_-14px_rgba(23,80,216,0.95)] transition-colors hover:bg-electric-600 sm:w-auto"
          >
            {ctaLabels.primary}
          </Link>
        </div>
      </div>
    </section>
  );
}
