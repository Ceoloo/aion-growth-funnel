"use client";

import { CalendarClock, ExternalLink } from "lucide-react";
import { directBooking } from "@/content/site";
import { trackBookingLinkClicked } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";

/**
 * Direct booking path for warm traffic.
 *
 * Someone arriving from a referral has already done the qualifying
 * conversation; making them walk an assessment to reach a calendar adds
 * friction without adding information. This gives them the calendar directly.
 *
 * Rendered only when a booking URL is configured — no calendar link is ever
 * invented, and nothing here claims availability. A click is tracked as a
 * click, not as a booking.
 */
export function DirectBooking({ bookingUrl }: { bookingUrl: string }) {
  return (
    <Section surface="tint">
      <div className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <p className="text-eyebrow uppercase text-electric-600">{directBooking.eyebrow}</p>
          <h2 className="mt-2.5 text-h2 text-card-foreground">{directBooking.heading}</h2>
          <p className="mt-3 text-body text-muted-foreground">{directBooking.supporting}</p>
        </div>

        <div className="shrink-0">
          <Button asChild variant="secondary" size="action" full className="lg:w-auto">
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackBookingLinkClicked({ entry_point: "landing_direct" })}
            >
              <CalendarClock aria-hidden="true" />
              Book a call directly
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
          </Button>
        </div>
      </div>
    </Section>
  );
}
