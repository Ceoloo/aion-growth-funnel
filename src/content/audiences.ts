import type { Audience, AudienceId } from "./types";

export const audiences: Audience[] = [
  {
    id: "contractor-builder",
    label: "Contractors & Builders",
    blurb: "Remodels, custom builds, trades and specialty contracting.",
    descriptor: "a contracting or building business",
    contentExamples: [
      "Finished project galleries",
      "Jobsite and walkthrough video",
      "Owner introductions that build trust",
    ],
  },
  {
    id: "home-services",
    label: "Home Services",
    blurb: "HVAC, plumbing, electrical, roofing, cleaning and recurring service.",
    descriptor: "a home-services business",
    contentExamples: [
      "Technicians and crews at work",
      "Customer stories after a service call",
      "Short service explainers",
    ],
  },
  {
    id: "local-business",
    label: "Local Businesses",
    blurb: "Studios, clinics, retail, hospitality and appointment-based services.",
    descriptor: "a local business",
    contentExamples: [
      "Products and signature offers",
      "Your location and atmosphere",
      "The customer experience end to end",
    ],
  },
  {
    id: "real-estate",
    label: "Real Estate Agents & Teams",
    blurb: "Listing agents, buyer agents, teams and brokerages.",
    descriptor: "a real estate practice",
    contentExamples: [
      "Listing photography and video",
      "Agent brand and introduction pieces",
      "Neighborhood and market features",
    ],
  },
];

export const audienceById: Record<AudienceId, Audience> = Object.fromEntries(
  audiences.map((a) => [a.id, a]),
) as Record<AudienceId, Audience>;

export const audienceIds = audiences.map((a) => a.id) as [AudienceId, ...AudienceId[]];

export function isAudienceId(value: unknown): value is AudienceId {
  return typeof value === "string" && audienceIds.includes(value as AudienceId);
}
