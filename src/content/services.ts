import type { ServiceId } from "./types";

export interface ServiceDefinition {
  id: ServiceId;
  name: string;
  /** One-line summary used on cards and in the recommendation. */
  summary: string;
  /** What is actually delivered. Keep these concrete and honest. */
  includes: string[];
  /** Shown on the landing page only for the three core offers. */
  showOnLanding: boolean;
  /** Production is an optional add-on and must always be labelled as such. */
  optional?: boolean;
  /** Tag applied in the CRM when this service is recommended. */
  crmTag?: string;
}

export const services: Record<ServiceId, ServiceDefinition> = {
  "sales-follow-up": {
    id: "sales-follow-up",
    name: "Sales & Follow-Up System",
    summary:
      "Every inquiry lands in one place and gets a consistent next step.",
    includes: [
      "Lead capture from your site, social profiles and calls",
      "CRM organisation so nothing sits in a personal inbox",
      "Booking and appointment handling",
      "Pipeline visibility from inquiry to customer",
      "Follow-up workflows that do not depend on memory",
    ],
    showOnLanding: true,
    crmTag: "service:sales-follow-up",
  },
  "marketing-growth": {
    id: "marketing-growth",
    name: "Marketing & Growth System",
    summary:
      "Positioning and campaigns that feed your sales process, not just your feed.",
    includes: [
      "Positioning and offer clarity for your market",
      "Campaign planning across the channels you already use",
      "Conversion-focused landing pages",
      "Marketing connected directly to your sales process",
      "Reporting that ties activity to inquiries",
    ],
    showOnLanding: true,
    crmTag: "service:marketing-growth",
  },
  "content-production": {
    id: "content-production",
    name: "Premium Content Production",
    summary:
      "Photography and video that show the real quality of your work.",
    includes: [
      "Photography for projects, teams, products and locations",
      "Video features and short-form content",
      "Customer testimonials and project features",
      "Listing media for real estate",
      "Brand content you can reuse across channels",
    ],
    showOnLanding: true,
    optional: true,
    crmTag: "interest:content-production",
  },
  "foundation-review": {
    id: "foundation-review",
    name: "Discovery-Led Foundation Review",
    summary:
      "A short working session to map what you have before anything gets built.",
    includes: [
      "A review of how inquiries arrive and where they go today",
      "A look at the tools already in place and what can be reused",
      "A written summary of the gaps we can see",
      "A recommended first build, sized to your situation",
    ],
    showOnLanding: false,
  },
};

/** The three complementary offers shown in the landing page service section. */
export const landingServices = (Object.values(services) as ServiceDefinition[]).filter(
  (s) => s.showOnLanding,
);

/**
 * Production is delivered with AION's creative production partner, Daniel.
 * Daniel is a production partner only: he does not own AION, and production is
 * never required to work with us.
 */
export const productionPartnerNote =
  "Photography and video are delivered with our creative production partner, Daniel. Production is an optional add-on — the sales and marketing systems work with content you already have.";
