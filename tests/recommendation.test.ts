import { describe, expect, it } from "vitest";
import type { AssessmentAnswers } from "@/lib/assessment";
import { recommend } from "@/lib/recommendation";
import type { AudienceId } from "@/content/types";

/**
 * The recommendation rules are the promise the funnel makes to a visitor, so
 * they are pinned here rule by rule. Each test states the answers and the
 * service those answers must produce.
 */

function answers(overrides: Partial<AssessmentAnswers> = {}): AssessmentAnswers {
  return {
    audience: "contractor-builder",
    bottleneck: "not-enough-inquiries",
    channels: ["referrals"],
    followUp: "crm-consistent",
    goal: "estimate-requests",
    contentNeed: "have-content",
    timing: "asap",
    ...overrides,
  };
}

describe("rule 1 — sales process gap", () => {
  it("recommends the sales system when follow-up is the stated bottleneck", () => {
    const result = recommend(answers({ bottleneck: "inconsistent-follow-up" }));
    expect(result.service.id).toBe("sales-follow-up");
    expect(result.ruleId).toBe("sales-process-gap");
  });

  it("recommends the sales system when conversations do not close", () => {
    const result = recommend(answers({ bottleneck: "closing-conversations" }));
    expect(result.service.id).toBe("sales-follow-up");
  });

  it("takes precedence over a demand gap when follow-up is manual", () => {
    // Not enough inquiries AND no dependable process: fix the leak first.
    const result = recommend(
      answers({ bottleneck: "not-enough-inquiries", followUp: "manual" }),
    );
    expect(result.service.id).toBe("sales-follow-up");
    expect(result.ruleId).toBe("sales-process-gap");
  });

  it("treats 'still figuring it out' as a weak process", () => {
    const result = recommend(
      answers({ bottleneck: "not-enough-inquiries", followUp: "figuring-it-out" }),
    );
    expect(result.service.id).toBe("sales-follow-up");
  });
});

describe("rule 2 — demand gap", () => {
  it("recommends marketing when inquiries are short and the process is solid", () => {
    const result = recommend(
      answers({ bottleneck: "not-enough-inquiries", followUp: "crm-consistent" }),
    );
    expect(result.service.id).toBe("marketing-growth");
    expect(result.ruleId).toBe("demand-gap");
  });

  it("recommends marketing when tools exist but are used inconsistently", () => {
    // "tools-inconsistent" is not counted as a weak process, so the demand
    // gap remains the binding constraint.
    const result = recommend(
      answers({ bottleneck: "not-enough-inquiries", followUp: "tools-inconsistent" }),
    );
    expect(result.service.id).toBe("marketing-growth");
  });
});

describe("rule 3 — content and credibility", () => {
  it("recommends production when the process is already established", () => {
    const result = recommend(
      answers({ bottleneck: "content-credibility", followUp: "crm-consistent" }),
    );
    expect(result.service.id).toBe("content-production");
    expect(result.ruleId).toBe("content-credibility-with-process");
  });

  it("recommends marketing first when no established process exists", () => {
    const result = recommend(
      answers({ bottleneck: "content-credibility", followUp: "tools-inconsistent" }),
    );
    expect(result.service.id).toBe("marketing-growth");
    expect(result.ruleId).toBe("content-credibility-without-process");
  });
});

describe("rule 4 — production requested with no other signal", () => {
  it("recommends production when the bottleneck is unclear", () => {
    const result = recommend(
      answers({ bottleneck: "no-clear-process", contentNeed: "need-production" }),
    );
    expect(result.service.id).toBe("content-production");
    expect(result.ruleId).toBe("production-requested-only");
  });
});

describe("rule 5 — discovery fallback", () => {
  it("recommends a foundation review when answers are unclear", () => {
    const result = recommend(answers({ bottleneck: "no-clear-process" }));
    expect(result.service.id).toBe("foundation-review");
    expect(result.ruleId).toBe("discovery-fallback");
  });

  it("recommends a foundation review when the bottleneck is missing", () => {
    const result = recommend({ audience: "local-business" });
    expect(result.service.id).toBe("foundation-review");
  });
});

describe("production add-on", () => {
  it("adds production alongside a core sales recommendation", () => {
    const result = recommend(
      answers({ bottleneck: "inconsistent-follow-up", contentNeed: "need-production" }),
    );
    expect(result.service.id).toBe("sales-follow-up");
    expect(result.productionIsAddOn).toBe(true);
    expect(result.includesProduction).toBe(true);
    expect(result.serviceIds).toEqual(["sales-follow-up", "content-production"]);
  });

  it("does not mark production as an add-on when it is the core service", () => {
    const result = recommend(
      answers({
        bottleneck: "content-credibility",
        followUp: "crm-consistent",
        contentNeed: "need-production",
      }),
    );
    expect(result.service.id).toBe("content-production");
    expect(result.productionIsAddOn).toBe(false);
    expect(result.includesProduction).toBe(true);
    expect(result.serviceIds).toEqual(["content-production"]);
  });

  it("does not add production when the visitor already has content", () => {
    const result = recommend(answers({ contentNeed: "have-content" }));
    expect(result.includesProduction).toBe(false);
    expect(result.serviceIds).toHaveLength(1);
  });
});

describe("output shape", () => {
  it("always returns exactly three priorities", () => {
    const bottlenecks = [
      "not-enough-inquiries",
      "inconsistent-follow-up",
      "content-credibility",
      "closing-conversations",
      "no-clear-process",
    ] as const;
    for (const bottleneck of bottlenecks) {
      expect(recommend(answers({ bottleneck })).priorities).toHaveLength(3);
    }
  });

  it("echoes the selected goal", () => {
    const result = recommend(answers({ audience: "real-estate", goal: "seller-consultations" }));
    expect(result.goalLabel).toBe("Seller consultations");
  });

  it("is deterministic for identical answers", () => {
    const input = answers({ bottleneck: "inconsistent-follow-up" });
    expect(recommend(input)).toEqual(recommend(input));
  });

  it("produces a reason and a scope note for every audience", () => {
    const audiences: AudienceId[] = [
      "contractor-builder",
      "home-services",
      "local-business",
      "real-estate",
    ];
    for (const audience of audiences) {
      const result = recommend(answers({ audience }));
      expect(result.reasons.length).toBeGreaterThan(0);
      expect(result.scopeNote).toContain("not a quote");
    }
  });

  it("never invents a score or a forecast", () => {
    const result = recommend(answers());
    expect(Object.keys(result)).not.toContain("score");
    expect(JSON.stringify(result)).not.toMatch(/\bscore\b|\bforecast\b|\bguarantee\b/i);
  });
});
