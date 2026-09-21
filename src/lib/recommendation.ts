import { audienceById } from "@/content/audiences";
import { labelFor } from "@/content/assessment";
import {
  audienceFraming,
  contentBottlenecks,
  demandBottlenecks,
  establishedFollowUpAnswers,
  priorityLibrary,
  salesProcessBottlenecks,
  scopeNote,
  unclearBottlenecks,
  weakFollowUpAnswers,
} from "@/content/recommendation-rules";
import { services, type ServiceDefinition } from "@/content/services";
import type { ServiceId } from "@/content/types";
import type { AssessmentAnswers } from "./assessment";

export interface Recommendation {
  /** The core build we would start with. */
  service: ServiceDefinition;
  /** True when Premium Content Production is added alongside the core build. */
  includesProduction: boolean;
  /** Production added but not the core service. */
  productionIsAddOn: boolean;
  /** Machine-readable rule that fired, for CRM and debugging. Never shown as a score. */
  ruleId: RecommendationRuleId;
  /** Plain-language reasons, each one traceable to an answer they gave. */
  reasons: string[];
  /** Exactly three things we would look at first. */
  priorities: string[];
  /** Their selected goal, echoed back in their own words. */
  goalLabel: string;
  /** Standing note that scope follows a conversation. */
  scopeNote: string;
  /** Every service id involved, core first. Used for CRM tagging. */
  serviceIds: ServiceId[];
}

export type RecommendationRuleId =
  | "sales-process-gap"
  | "demand-gap"
  | "content-credibility-with-process"
  | "content-credibility-without-process"
  | "production-requested-only"
  | "discovery-fallback";

interface CoreResult {
  service: ServiceId;
  ruleId: RecommendationRuleId;
  reasons: string[];
}

/**
 * Chooses the core service. First match wins; the order encodes AION's view
 * that a leaking process is worth fixing before more traffic is added.
 */
function chooseCore(answers: AssessmentAnswers): CoreResult {
  const { bottleneck, followUp, contentNeed } = answers;
  const reasons: string[] = [];

  // Rule 1 — the sales side is the constraint.
  const bottleneckIsSales = bottleneck !== undefined && salesProcessBottlenecks.includes(bottleneck);
  const followUpIsWeak = followUp !== undefined && weakFollowUpAnswers.includes(followUp);
  if (bottleneckIsSales || followUpIsWeak) {
    if (bottleneckIsSales) {
      reasons.push(`You told us the sticking point is "${labelFor(bottleneck)}".`);
    }
    if (followUpIsWeak) {
      reasons.push(
        `Your follow-up today is "${labelFor(followUp)}", so inquiries depend on someone remembering.`,
      );
    }
    reasons.push(
      "Adding more inquiries before that is fixed usually increases the number that go cold, not the number that convert.",
    );
    return { service: "sales-follow-up", ruleId: "sales-process-gap", reasons };
  }

  // Rule 2 — not enough is arriving in the first place.
  if (bottleneck !== undefined && demandBottlenecks.includes(bottleneck)) {
    reasons.push(`You told us the sticking point is "${labelFor(bottleneck)}".`);
    if (followUp !== undefined && establishedFollowUpAnswers.includes(followUp)) {
      reasons.push(
        "You already have a CRM and a consistent process, so the constraint is what reaches it, not what happens after.",
      );
    }
    return { service: "marketing-growth", ruleId: "demand-gap", reasons };
  }

  // Rule 3 — credibility is the constraint and the process is already established.
  if (bottleneck !== undefined && contentBottlenecks.includes(bottleneck)) {
    const processEstablished =
      followUp !== undefined && establishedFollowUpAnswers.includes(followUp);
    if (processEstablished) {
      reasons.push(
        `You told us the sticking point is "${labelFor(bottleneck)}" and that you already have a CRM and a consistent process.`,
      );
      reasons.push(
        "With the process already in place, the highest-value work is showing the quality of what you deliver.",
      );
      return {
        service: "content-production",
        ruleId: "content-credibility-with-process",
        reasons,
      };
    }
    reasons.push(
      `You told us the sticking point is "${labelFor(bottleneck)}", and your follow-up is "${labelFor(followUp)}".`,
    );
    reasons.push(
      "Better content raises interest, so we'd make sure that interest has somewhere consistent to land first.",
    );
    return {
      service: "marketing-growth",
      ruleId: "content-credibility-without-process",
      reasons,
    };
  }

  // Rule 4 — production asked for, and nothing else pointed at a specific build.
  const unclear = bottleneck === undefined || unclearBottlenecks.includes(bottleneck);
  if (unclear && contentNeed === "need-production") {
    reasons.push(
      "You asked for production support, and the rest of your answers don't yet point at one specific system.",
    );
    reasons.push(
      "We'd start with production and use a short review to decide what should connect to it.",
    );
    return { service: "content-production", ruleId: "production-requested-only", reasons };
  }

  // Rule 5 — not enough signal to responsibly name a build.
  reasons.push(
    bottleneck === undefined
      ? "Your answers don't yet point at one specific constraint."
      : `You told us "${labelFor(bottleneck)}", which usually means several things are unclear at once.`,
  );
  reasons.push(
    "Rather than guess at a build, we'd start with a short review of how inquiries move through your business today.",
  );
  return { service: "foundation-review", ruleId: "discovery-fallback", reasons };
}

/**
 * Produces the visitor-facing recommendation.
 *
 * Deterministic: the same answers always produce the same result. No scoring,
 * no forecasting, no inference beyond the rules in
 * `src/content/recommendation-rules.ts`.
 */
export function recommend(answers: AssessmentAnswers): Recommendation {
  const core = chooseCore(answers);
  const wantsProduction = answers.contentNeed === "need-production";
  const coreIsProduction = core.service === "content-production";
  const includesProduction = wantsProduction || coreIsProduction;
  const productionIsAddOn = wantsProduction && !coreIsProduction;

  const reasons = [...core.reasons];
  if (productionIsAddOn) {
    reasons.push(
      "You also asked for production support, so we'd add Premium Content Production alongside the core build. It stays optional.",
    );
  }
  if (answers.contentNeed === "help-me-decide") {
    reasons.push(
      "You asked for help deciding on content, so we'd give you an honest read on whether production is worth it before anything is booked.",
    );
  }
  if (answers.audience) {
    reasons.push(audienceFraming[answers.audience]);
  }

  const priorities = (priorityLibrary[core.service] ?? []).slice(0, 3);
  if (productionIsAddOn) {
    // Swap the third priority for a production one so the add-on is represented.
    const productionPriority = priorityLibrary["content-production"]?.[0];
    if (productionPriority && priorities.length === 3) {
      priorities[2] = productionPriority;
    }
  }

  const serviceIds: ServiceId[] = [core.service];
  if (productionIsAddOn) serviceIds.push("content-production");

  return {
    service: services[core.service],
    includesProduction,
    productionIsAddOn,
    ruleId: core.ruleId,
    reasons,
    priorities,
    goalLabel: labelFor(answers.goal),
    scopeNote,
    serviceIds,
  };
}

/** Short, human summary used in CRM notes and the confirmation screen. */
export function recommendationHeadline(rec: Recommendation, answers: AssessmentAnswers): string {
  const audience = answers.audience ? audienceById[answers.audience].label : "Your business";
  return rec.productionIsAddOn
    ? `${audience}: ${rec.service.name} + Premium Content Production`
    : `${audience}: ${rec.service.name}`;
}
