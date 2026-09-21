"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ctaLabels, finalCta } from "@/content/site";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/button";

export function FinalCta() {
  return (
    <section className="surface-dark page-gutter bg-background py-20 text-foreground sm:py-24">
      <div className="container-page max-w-3xl text-center">
        <h2 className="text-h1 text-balance">{finalCta.heading}</h2>
        <p className="mx-auto mt-4 max-w-xl text-lead text-muted-foreground">
          {finalCta.supporting}
        </p>
        <div className="mt-9 flex justify-center">
          <Button asChild size="action" full className="sm:w-auto">
            <Link
              href="/assessment"
              onClick={() =>
                track("landing_cta_clicked", { cta_id: "primary", cta_location: "final" })
              }
            >
              {ctaLabels.primary}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
