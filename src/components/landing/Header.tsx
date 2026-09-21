"use client";

import Link from "next/link";
import { ctaLabels } from "@/content/site";
import { track } from "@/lib/analytics";
import { Wordmark } from "@/components/ui/Wordmark";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-paper-100/90 backdrop-blur-md">
      <div
        className="aion-shell mx-auto flex w-full max-w-6xl items-center justify-between gap-4 py-3"
        style={{ paddingTop: "max(0.75rem, var(--safe-top))" }}
      >
        <Link href="/" className="aion-target flex items-center rounded-lg" aria-label="AION Systems home">
          <Wordmark />
        </Link>

        <Link
          href="/assessment"
          onClick={() => track("landing_cta_clicked", { cta_id: "primary", cta_location: "header" })}
          className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-electric-500 px-4 text-[0.88rem] font-semibold text-white transition-colors hover:bg-electric-600 sm:px-5 sm:text-[0.95rem]"
        >
          <span className="sm:hidden">Start</span>
          <span className="hidden sm:inline">{ctaLabels.primary}</span>
        </Link>
      </div>
    </header>
  );
}
