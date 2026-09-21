import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";
import { faqItems } from "@/content/faq";
import { brand, metadata as siteCopy } from "@/content/site";
import { publicConfig } from "@/lib/public-config";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/**
 * FAQPage structured data, generated from the same source as the visible FAQ
 * so the two cannot drift apart.
 */
function FaqJsonLd() {
  const json = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
  return (
    <script
      type="application/ld+json"
      // Static, authored in-repo — never user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}

function OrganizationJsonLd() {
  const json = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: brand.name,
    description: siteCopy.description,
    url: publicConfig.siteUrl,
    slogan: brand.tagline,
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}

/**
 * The landing page is statically prerendered, which is what keeps its TTFB and
 * LCP low. That means the values below are read at BUILD time, so
 * `NEXT_PUBLIC_BOOKING_URL` and `NEXT_PUBLIC_CONTACT_EMAIL` must be present in
 * the build environment for the direct-booking section and the footer address
 * to appear.
 *
 * The confirmation screen is different: it takes its booking URL from the lead
 * endpoint's response, which resolves `BOOKING_URL` at request time. So a
 * booking link can be changed without a rebuild for people finishing the
 * assessment — only this marketing section needs one.
 *
 * Both are documented in .env.example and docs/measurement.md.
 */
export default function HomePage() {
  return (
    <>
      {/* The direct-booking section renders only when a real URL is configured. */}
      <LandingPage
        bookingUrl={publicConfig.bookingUrl}
        contactEmail={publicConfig.contactEmail}
      />
      <FaqJsonLd />
      <OrganizationJsonLd />
    </>
  );
}
