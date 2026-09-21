import { AudienceSelector } from "./AudienceSelector";
import { DirectBooking } from "./DirectBooking";
import { ExampleWork } from "./ExampleWork";
import { Faq } from "./Faq";
import { FinalCta } from "./FinalCta";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { PainPoints } from "./PainPoints";
import { Services } from "./Services";
import { StickyMobileCta } from "./StickyMobileCta";

const HERO_CTA_ID = "hero-cta";

/**
 * Landing page composition — a server component.
 *
 * Only the sections that genuinely need the browser (CTA tracking, the
 * audience router, the accordion, the sticky bar) are client components. The
 * static bands ship as HTML with no JavaScript at all.
 *
 * Section order follows the conversion sequence: relevance (hero, audience
 * cards), clarity (problems, services), value (example work, how it works),
 * trust (FAQ), conversion (final CTA) — with the direct-booking path for warm
 * traffic sitting just before the FAQ.
 *
 * Surfaces alternate deliberately and never repeat back to back, in both the
 * with-booking and without-booking configurations. The two dark bands mark the
 * moments that matter most: what we actually do, and the final ask.
 */
export function LandingPage({
  bookingUrl,
  contactEmail,
}: {
  bookingUrl?: string;
  contactEmail?: string;
}) {
  return (
    <>
      <a href="#main" className="skip-link rounded-pill bg-navy-900 px-4 py-2 text-paper-100">
        Skip to content
      </a>
      <Header />
      <main id="main">
        <Hero ctaSentinelId={HERO_CTA_ID} />
        <AudienceSelector />
        <PainPoints />
        <Services />
        <ExampleWork />
        <HowItWorks />
        {bookingUrl ? <DirectBooking bookingUrl={bookingUrl} /> : null}
        {/* The direct-booking band is optional, so the FAQ takes whichever
            surface keeps the alternation intact either way. */}
        <Faq surface={bookingUrl ? "light" : "tint"} />
        <FinalCta />
      </main>
      <Footer contactEmail={contactEmail} />

      {/* Reserves room so the sticky bar can never cover the footer. */}
      <div aria-hidden="true" className="h-[5.5rem] lg:hidden" />

      <StickyMobileCta sentinelId={HERO_CTA_ID} />
    </>
  );
}
