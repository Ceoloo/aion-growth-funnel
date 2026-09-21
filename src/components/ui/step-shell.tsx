"use client";

import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The frame every funnel screen sits in.
 *
 * Layout contract:
 *  - the shell is exactly one viewport tall (`--app-height`, which resolves to
 *    100dvh where supported), so the step region scrolls internally instead of
 *    the page growing;
 *  - the action area is a flex sibling of that scroll region, never an
 *    overlay, so it is structurally incapable of covering an answer or a
 *    focused input;
 *  - on short screens the content simply scrolls — nothing is clipped.
 *
 * When the on-screen keyboard is open (see `useKeyboardOpen`) the action area
 * is un-stuck and scrolls away with the content, so a visitor is never trapped
 * between the keyboard and a fixed footer.
 */
export function StepShell({
  header,
  children,
  actions,
  scrollRef,
  detachActions = false,
}: {
  header?: React.ReactNode;
  children: React.ReactNode;
  actions: React.ReactNode;
  scrollRef?: React.Ref<HTMLDivElement>;
  detachActions?: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {header ? <div className="shrink-0 pb-6">{header}</div> : null}

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        // Room for the action area plus the home indicator, so the final
        // element can always be scrolled fully clear of it.
        style={{ scrollPaddingBottom: "6rem" }}
      >
        {children}

        {detachActions ? (
          <div className="pt-6 pb-[max(1rem,var(--safe-bottom))]">{actions}</div>
        ) : (
          <div className="h-4" aria-hidden="true" />
        )}
      </div>

      {detachActions ? null : (
        <div className="action-bar z-10 shrink-0 pt-4">{actions}</div>
      )}
    </div>
  );
}

/** The question or screen title. Exactly one per screen. */
export function StepHeading({
  title,
  supporting,
  id,
}: {
  title: string;
  supporting?: string;
  id?: string;
}) {
  return (
    <div>
      <h1 id={id} className="text-h1 text-balance text-foreground">
        {title}
      </h1>
      {supporting ? (
        <p className="mt-3 text-lead text-muted-foreground">{supporting}</p>
      ) : null}
    </div>
  );
}

/** Back control. Visually quieter than the primary and kept left, away from the thumb's default arc. */
export function BackButton({
  onClick,
  label = "Back",
  className,
}: {
  onClick: () => void;
  label?: string;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="quiet"
      size="compact"
      onClick={onClick}
      className={cn("gap-1.5", className)}
    >
      <ArrowLeft aria-hidden="true" />
      {label}
    </Button>
  );
}
