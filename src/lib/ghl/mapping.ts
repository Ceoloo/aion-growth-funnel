import type { CanonicalLead } from "../canonical";
import type { CustomFieldKey, GhlConfig } from "./config";

/**
 * Maps the canonical lead onto GoHighLevel's shapes.
 *
 * Two rules govern everything here:
 *  1. An empty answer never overwrites an existing CRM value. Fields with no
 *     value are omitted from the request entirely rather than sent as "".
 *  2. Tags are additive. The upsert endpoint replaces the whole tag array, so
 *     tags are applied through the dedicated add-tags endpoint instead and the
 *     contact upsert never carries a `tags` key.
 */

export interface GhlContactUpsert {
  locationId: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email: string;
  phone?: string;
  companyName?: string;
  website?: string;
  source?: string;
  customFields?: { id: string; field_value: string }[];
}

const AUDIENCE_TAGS: Record<string, string> = {
  "contractor-builder": "audience:contractor-builder",
  "home-services": "audience:home-services",
  "local-business": "audience:local-business",
  "real-estate": "audience:real-estate",
};

const SERVICE_TAGS: Record<string, string> = {
  "sales-follow-up": "service:sales-follow-up",
  "marketing-growth": "service:marketing-growth",
  "content-production": "interest:content-production",
};

export const SOURCE_TAG = "source:aion-growth-funnel";

/**
 * Tags for one submission. Only tags that match the visitor's actual answers
 * are returned — a contact never receives a service tag for a service that was
 * not recommended.
 */
export function tagsFor(lead: CanonicalLead): string[] {
  const tags = new Set<string>([SOURCE_TAG]);

  const audienceTag = AUDIENCE_TAGS[lead.assessment.audience];
  if (audienceTag) tags.add(audienceTag);

  for (const serviceId of lead.recommendation.serviceIds) {
    const tag = SERVICE_TAGS[serviceId];
    if (tag) tags.add(tag);
  }

  // Production interest is flagged whenever the visitor asked for it, even if
  // production is not part of the recommended build. AION scopes and
  // coordinates production; the lead is not shared with the partner from here.
  if (lead.assessment.contentNeed === "need-production") {
    const productionTag = SERVICE_TAGS["content-production"];
    if (productionTag) tags.add(productionTag);
  }

  return [...tags];
}

/** Values for the mapped custom fields, keyed by AION's internal names. */
export function customFieldValues(lead: CanonicalLead): Partial<Record<CustomFieldKey, string>> {
  const values: Partial<Record<CustomFieldKey, string>> = {
    business_category: lead.assessment.audienceLabel,
    primary_bottleneck: lead.assessment.bottleneckLabel,
    inquiry_channels: lead.assessment.channelLabels.join(", "),
    current_follow_up: lead.assessment.followUpLabel,
    desired_outcome: lead.assessment.goalLabel,
    content_production_interest: lead.assessment.contentNeedLabel,
    start_timeframe: lead.assessment.timingLabel,
    recommended_service: lead.recommendation.coreServiceName,
    submission_id: lead.submissionId,
    submitted_at: lead.submittedAt,
    marketing_consent: lead.consent.marketingEmail ? "Yes" : "No",
    consent_copy_version: lead.consent.copyVersion,
  };

  if (lead.consent.marketingEmailAt) values.marketing_consent_at = lead.consent.marketingEmailAt;
  if (lead.attribution.utmSource) values.utm_source = lead.attribution.utmSource;
  if (lead.attribution.utmMedium) values.utm_medium = lead.attribution.utmMedium;
  if (lead.attribution.utmCampaign) values.utm_campaign = lead.attribution.utmCampaign;
  if (lead.attribution.utmContent) values.utm_content = lead.attribution.utmContent;
  if (lead.attribution.utmTerm) values.utm_term = lead.attribution.utmTerm;
  if (lead.attribution.landingPage) values.landing_page = lead.attribution.landingPage;
  if (lead.attribution.referrer) values.referrer = lead.attribution.referrer;

  return values;
}

/**
 * Turns the mapped values into GHL's customFields array, skipping any field
 * the operator has not supplied an id for. Empty strings are dropped so a
 * blank answer cannot clear a populated CRM field.
 */
export function customFieldsPayload(
  lead: CanonicalLead,
  map: Record<string, string>,
): { id: string; field_value: string }[] {
  const values = customFieldValues(lead);
  const out: { id: string; field_value: string }[] = [];
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value.trim() === "") continue;
    const id = map[key];
    if (!id) continue;
    out.push({ id, field_value: value });
  }
  return out;
}

export function contactUpsertPayload(lead: CanonicalLead, config: GhlConfig): GhlContactUpsert {
  if (!config.locationId) {
    throw new Error("contactUpsertPayload requires a locationId");
  }
  const payload: GhlContactUpsert = {
    locationId: config.locationId,
    email: lead.contact.email,
    source: "AION Growth Funnel",
  };

  // Omit rather than blank: an empty value must never overwrite a good one.
  if (lead.contact.firstName) payload.firstName = lead.contact.firstName;
  if (lead.contact.lastName) payload.lastName = lead.contact.lastName;
  if (lead.contact.fullName) payload.name = lead.contact.fullName;
  if (lead.contact.phone) payload.phone = lead.contact.phone;
  if (lead.contact.businessName) payload.companyName = lead.contact.businessName;
  if (lead.contact.website) payload.website = lead.contact.website;

  const customFields = customFieldsPayload(lead, config.customFieldMap);
  if (customFields.length > 0) payload.customFields = customFields;

  // NOTE: `tags` is intentionally absent. The upsert endpoint overwrites the
  // contact's whole tag array, which would strip tags applied by other
  // sources. Tags are added separately via POST /contacts/:id/tags.
  // `dnd` and `dndSettings` are also intentionally absent so an existing
  // opt-out is never cleared by a funnel submission.
  return payload;
}

export function opportunityName(lead: CanonicalLead): string {
  const suffix = lead.recommendation.productionIsAddOn
    ? `${lead.recommendation.coreServiceName} + Production`
    : lead.recommendation.coreServiceName;
  return `${lead.contact.businessName} — ${suffix}`;
}

/** Stable marker written into the note body so a retry can recognise its own work. */
export function noteMarker(submissionId: string): string {
  return `[aion-submission:${submissionId}]`;
}
