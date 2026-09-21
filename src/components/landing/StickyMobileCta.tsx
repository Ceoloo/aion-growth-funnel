"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ctaLabels } from "@/content/site";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Mobile-only sticky CTA.
 *
 * Appears once the hero CTA has scrolled out of view, so the two never compete
 * for the same tap, and is hidden on desktop where the header CTA is always
 * visible.
 *
 * It watches a sentinel element by id rather than sharing a ref, which keeps
 * the hero free of this component's concerns. The show/hide is a CSS
 * transition rather than a Motion animation so the landing page does not have
 * to load an animation runtime for one element; `prefers-reduced-motion` is
 * handled by the global rule in globals.css.
 *
 * `LandingPage` reserves matching space at the end of the page, so this can
 * never cover the footer.
 */
export function StickyMobileCta({ sentinelId }: { sentinelId: string }) {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const sentinel = document.getElementById(sentinelId);
    if (!sentinel || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!(entry?.isIntersecting ?? false)),
      { rootMargin: "0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinelId]);

  return (
    <div
      // Hidden from assistive technology while off-screen, so a screen-reader
      // user does not meet a duplicate CTA they cannot see.
      aria-hidden={!visible}
      className={cn(
        "surface-light fixed inset-x-0 bottom-0 z-40 lg:hidden",
        "transition-[opacity,transform] duration-200 ease-[var(--ease-out-soft)]",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-4 opacity-0",
      )}
    >
      <div
        className="page-gutter border-t border-border bg-background/95 pt-3 backdrop-blur-md"
        style={{ paddingBottom: "max(0.75rem, var(--safe-bottom))" }}
      >
        <Button asChild size="action" full>
          <Link
            href="/assessment"
            tabIndex={visible ? undefined : -1}
            onClick={() =>
              track("landing_cta_clicked", {
                cta_id: "primary",
                cta_location: "sticky_mobile",
              })
            }
          >
            {ctaLabels.stickyMobile}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
