import { describe, expect, it } from "vitest";
import {
  contactUpsertPayload,
  customFieldsPayload,
  noteMarker,
  opportunityName,
  tagsFor,
} from "@/lib/ghl/mapping";
import { parseCustomFieldMap, type GhlConfig } from "@/lib/ghl/config";
import { assessmentSummaryText } from "@/lib/canonical";
import { makeLead } from "./helpers/lead";

function config(overrides: Partial<GhlConfig> = {}): GhlConfig {
  return {
    mode: "api",
    baseUrl: "https://services.leadconnectorhq.com",
    apiVersion: "v3",
    accessToken: "test-token",
    locationId: "loc_123",
    pipelineId: "pipe_123",
    newAssessmentStageId: "stage_new",
    customFieldMap: {},
    timeoutMs: 5_000,
    ...overrides,
  };
}

describe("tags", () => {
  it("maps each audience to exactly its own audience tag", () => {
    const cases = [
      ["contractor-builder", "audience:contractor-builder"],
      ["home-services", "audience:home-services"],
      ["local-business", "audience:local-business"],
      ["real-estate", "audience:real-estate"],
    ] as const;

    for (const [audience, expected] of cases) {
      const tags = tagsFor(
        makeLead({
          audience,
          answers: audience === "real-estate" ? { goal: "seller-consultations" } : {},
        }),
      );
      expect(tags).toContain(expected);
      // No other audience tag is applied.
      expect(tags.filter((t) => t.startsWith("audience:"))).toEqual([expected]);
    }
  });

  it("always carries the source tag", () => {
    expect(tagsFor(makeLead())).toContain("source:aion-growth-funnel");
  });

  it("only applies the service tag that was actually recommended", () => {
    const salesLead = makeLead({ answers: { bottleneck: "inconsistent-follow-up" } });
    const tags = tagsFor(salesLead);
    expect(tags).toContain("service:sales-follow-up");
    expect(tags).not.toContain("service:marketing-growth");
  });

  it("flags production interest when the visitor asked for it", () => {
    const tags = tagsFor(makeLead({ answers: { contentNeed: "need-production" } }));
    expect(tags).toContain("interest:content-production");
  });

  it("does not flag production interest when content is already usable", () => {
    const tags = tagsFor(makeLead({ answers: { contentNeed: "have-content" } }));
    expect(tags).not.toContain("interest:content-production");
  });

  it("produces no duplicate tags", () => {
    const tags = tagsFor(
      makeLead({
        answers: {
          bottleneck: "content-credibility",
          followUp: "crm-consistent",
          contentNeed: "need-production",
        },
      }),
    );
    expect(new Set(tags).size).toBe(tags.length);
  });
});

describe("contact upsert payload", () => {
  it("never sends a tags array, because upsert would overwrite existing tags", () => {
    const payload = contactUpsertPayload(makeLead(), config());
    expect(payload).not.toHaveProperty("tags");
  });

  it("never sends dnd settings, so an existing opt-out is preserved", () => {
    const payload = contactUpsertPayload(makeLead(), config());
    expect(payload).not.toHaveProperty("dnd");
    expect(payload).not.toHaveProperty("dndSettings");
  });

  it("omits empty optional values rather than blanking a CRM field", () => {
    const lead = makeLead();
    const stripped = {
      ...lead,
      contact: { ...lead.contact, phone: undefined, website: undefined },
    };
    const payload = contactUpsertPayload(stripped, config());
    expect(payload).not.toHaveProperty("phone");
    expect(payload).not.toHaveProperty("website");
    expect(payload.email).toBe("dana@examplebuilders.test");
  });

  it("normalises the email to lower case", () => {
    expect(contactUpsertPayload(makeLead(), config()).email).toBe("dana@examplebuilders.test");
  });
});

describe("custom fields", () => {
  it("sends nothing when no ids are mapped, rather than inventing them", () => {
    expect(customFieldsPayload(makeLead(), {})).toEqual([]);
  });

  it("only sends fields the operator supplied an id for", () => {
    const fields = customFieldsPayload(makeLead(), {
      primary_bottleneck: "cf_bottleneck",
      recommended_service: "cf_service",
    });
    expect(fields).toHaveLength(2);
    expect(fields).toContainEqual({
      id: "cf_bottleneck",
      field_value: "People inquire, but follow-up is inconsistent",
    });
  });

  it("skips a mapped field whose value is empty", () => {
    const lead = makeLead();
    const withoutUtm = { ...lead, attribution: { ...lead.attribution, utmTerm: "" } };
    const fields = customFieldsPayload(withoutUtm, { utm_term: "cf_term" });
    expect(fields).toEqual([]);
  });
});

describe("custom field map parsing", () => {
  it("ignores unknown keys and reports them", () => {
    const { map, warnings } = parseCustomFieldMap(
      JSON.stringify({ primary_bottleneck: "cf_1", nonsense_key: "cf_2" }),
    );
    expect(map).toEqual({ primary_bottleneck: "cf_1" });
    expect(warnings.some((w) => w.message.includes("nonsense_key"))).toBe(true);
  });

  it("returns an empty map and a warning for invalid JSON", () => {
    const { map, warnings } = parseCustomFieldMap("{not json");
    expect(map).toEqual({});
    expect(warnings).toHaveLength(1);
  });

  it("treats an unset variable as simply no mapping", () => {
    expect(parseCustomFieldMap(undefined)).toEqual({ map: {}, warnings: [] });
  });
});

describe("opportunity and note", () => {
  it("names the opportunity after the business and recommended service", () => {
    expect(opportunityName(makeLead())).toBe("Example Builders — Sales & Follow-Up System");
  });

  it("marks a production add-on in the opportunity name", () => {
    const lead = makeLead({ answers: { contentNeed: "need-production" } });
    expect(opportunityName(lead)).toContain("+ Production");
  });

  it("writes a readable summary that carries the submission marker", () => {
    const lead = makeLead();
    const summary = assessmentSummaryText(lead);
    expect(summary).toContain("Main bottleneck: People inquire, but follow-up is inconsistent");
    expect(summary).toContain("Suggested starting point: Sales & Follow-Up System");
    expect(summary).toContain("Phone submission is not SMS consent.");
    expect(noteMarker(lead.submissionId)).toBe(
      "[aion-submission:11111111-1111-4111-8111-111111111111]",
    );
  });

  it("records consent state and version in the summary", () => {
    expect(assessmentSummaryText(makeLead({ marketingEmail: false }))).toContain(
      "Marketing email consent: no",
    );
    const consented = assessmentSummaryText(makeLead({ marketingEmail: true }));
    expect(consented).toContain("Marketing email consent: yes");
    expect(consented).toContain("2026-09-21.v1");
  });
});
