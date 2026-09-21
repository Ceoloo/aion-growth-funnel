import type { CanonicalLead } from "../canonical";
import { assessmentSummaryText } from "../canonical";
import { tagsFor } from "./mapping";

/**
 * The versioned event posted to a GoHighLevel inbound workflow webhook.
 *
 * The version is part of the payload so a workflow built against v1 can be
 * left alone when a v2 is introduced. Never change the meaning of a field
 * without bumping `eventVersion`.
 */
export const ASSESSMENT_EVENT_VERSION = "1.0";
export const ASSESSMENT_EVENT_TYPE = "aion.assessment.submitted";

export interface AssessmentEvent {
  eventType: typeof ASSESSMENT_EVENT_TYPE;
  eventVersion: typeof ASSESSMENT_EVENT_VERSION;
  eventId: string;
  occurredAt: string;
  source: "aion-growth-funnel";

  submissionId: string;

  /**
   * GoHighLevel ids, present only in hybrid mode after the API steps have
   * succeeded. In webhook mode these are null and the workflow owns the CRM
   * writes; in hybrid mode they are populated and the workflow must resolve
   * the existing contact rather than creating a new one.
   */
  ghl: {
    /** "workflow" = the workflow owns CRM writes. "api" = AION already wrote them. */
    recordOwner: "workflow" | "api";
    locationId: string | null;
    contactId: string | null;
    opportunityId: string | null;
    noteId: string | null;
  };

  contact: {
    fullName: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    businessName: string;
    website: string | null;
  };

  assessment: CanonicalLead["assessment"];
  recommendation: CanonicalLead["recommendation"];
  consent: CanonicalLead["consent"];
  attribution: CanonicalLead["attribution"];

  tags: string[];
  /** Ready-to-use summary for notifications and internal tasks. */
  summary: string;

  /**
   * True when the visitor asked for production support. This is an internal
   * flag for AION to scope and coordinate — it must not be used to forward
   * the lead to the production partner automatically.
   */
  contentProductionInterest: boolean;
  internalReviewRequired: boolean;
}

export function buildAssessmentEvent(input: {
  lead: CanonicalLead;
  eventId: string;
  recordOwner: "workflow" | "api";
  locationId?: string;
  contactId?: string;
  opportunityId?: string;
  noteId?: string;
}): AssessmentEvent {
  const { lead } = input;
  const productionInterest = lead.assessment.contentNeed === "need-production";

  return {
    eventType: ASSESSMENT_EVENT_TYPE,
    eventVersion: ASSESSMENT_EVENT_VERSION,
    eventId: input.eventId,
    occurredAt: new Date().toISOString(),
    source: "aion-growth-funnel",
    submissionId: lead.submissionId,
    ghl: {
      recordOwner: input.recordOwner,
      locationId: input.locationId ?? null,
      contactId: input.contactId ?? null,
      opportunityId: input.opportunityId ?? null,
      noteId: input.noteId ?? null,
    },
    contact: {
      fullName: lead.contact.fullName,
      firstName: lead.contact.firstName,
      lastName: lead.contact.lastName,
      email: lead.contact.email,
      phone: lead.contact.phone ?? null,
      businessName: lead.contact.businessName,
      website: lead.contact.website ?? null,
    },
    assessment: lead.assessment,
    recommendation: lead.recommendation,
    consent: lead.consent,
    attribution: lead.attribution,
    tags: tagsFor(lead),
    summary: assessmentSummaryText(lead),
    contentProductionInterest: productionInterest,
    internalReviewRequired: productionInterest || lead.assessment.contentNeed === "help-me-decide",
  };
}
