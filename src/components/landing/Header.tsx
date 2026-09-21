"use client";

import Link from "next/link";
import { ctaLabels } from "@/content/site";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/Wordmark";

export function Header() {
  return (
    <header className="surface-light sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-md">
      <div
        className="page-gutter container-page flex items-center justify-between gap-4 py-2.5"
        style={{ paddingTop: "max(0.625rem, var(--safe-top))" }}
      >
        <Link
          href="/"
          className="inline-flex min-h-[var(--tap-min)] items-center rounded-sm"
          aria-label="AION Systems home"
        >
          <Wordmark />
        </Link>

        <Button asChild size="default" className="px-4 sm:px-6">
          <Link
            href="/assessment"
            onClick={() =>
              track("landing_cta_clicked", { cta_id: "primary", cta_location: "header" })
            }
          >
            <span className="sm:hidden">{ctaLabels.primaryShort}</span>
            <span className="hidden sm:inline">{ctaLabels.primary}</span>
          </Link>
        </Button>
      </div>
    </header>
  );
}
