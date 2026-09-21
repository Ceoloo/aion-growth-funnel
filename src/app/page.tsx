import type { Metadata } from "next";
import { AudienceSelector } from "@/components/landing/AudienceSelector";
import { Faq } from "@/components/landing/Faq";
import { FinalCta } from "@/components/landing/FinalCta";
import { Footer } from "@/components/landing/Footer";
import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { PainPoints } from "@/components/landing/PainPoints";
import { Services } from "@/components/landing/Services";
import { faqItems } from "@/content/faq";
import { brand, metadata as siteCopy } from "@/content/site";
import { publicConfig } from "@/lib/public-config";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/**
 * FAQPage structured data, built from the same source as the visible FAQ so
 * the two can never drift apart.
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
      // Content is static and authored in-repo, not user input.
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

export default function HomePage() {
  return (
    <>
      <a href="#main" className="aion-skip-link rounded-full bg-navy-900 px-4 py-2 text-white">
        Skip to content
      </a>
      <Header />
      <main id="main">
        <Hero />
        <AudienceSelector />
        <PainPoints />
        <Services />
        <HowItWorks />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
      <FaqJsonLd />
      <OrganizationJsonLd />
    </>
  );
}
