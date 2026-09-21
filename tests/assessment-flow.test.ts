import { describe, expect, it } from "vitest";
import {
  branchFor,
  isComplete,
  isStepAnswered,
  nextStep,
  previousStep,
  progressFor,
  reconcileAnswers,
  type AssessmentAnswers,
} from "@/lib/assessment";
import { goalChoicesFor, goalQuestionFor, labelFor } from "@/content/assessment";
import { audiences } from "@/content/audiences";

describe("branch and progress", () => {
  it("reports progress against the active branch, not a fixed number", () => {
    const total = branchFor({}).length;
    expect(progressFor("business-type", {})).toEqual({ current: 1, total, percent: Math.round(100 / total) });
    expect(progressFor("timing", {}).current).toBe(total);
    expect(progressFor("timing", {}).percent).toBe(100);
  });

  it("walks forwards and backwards through the branch", () => {
    expect(nextStep("business-type", {})).toBe("bottleneck");
    expect(previousStep("bottleneck", {})).toBe("business-type");
    expect(previousStep("business-type", {})).toBeNull();
    expect(nextStep("timing", {})).toBeNull();
  });
});

describe("answer preservation", () => {
  it("keeps every other answer when one is changed", () => {
    const answers: AssessmentAnswers = {
      audience: "home-services",
      bottleneck: "not-enough-inquiries",
      channels: ["referrals", "google-website"],
      followUp: "manual",
      goal: "booked-appointments",
      contentNeed: "have-content",
      timing: "asap",
    };
    const changed = reconcileAnswers({ ...answers, bottleneck: "closing-conversations" });
    expect(changed.channels).toEqual(["referrals", "google-website"]);
    expect(changed.goal).toBe("booked-appointments");
    expect(changed.timing).toBe("asap");
  });

  it("keeps the goal when switching between two non-real-estate audiences", () => {
    const changed = reconcileAnswers({
      audience: "local-business",
      goal: "booked-appointments",
    });
    expect(changed.goal).toBe("booked-appointments");
  });

  it("clears a goal that the new audience cannot offer", () => {
    // Real-estate goals do not exist for a contractor, so keeping the answer
    // would leave an option selected that is no longer on screen.
    const changed = reconcileAnswers({
      audience: "contractor-builder",
      goal: "seller-consultations",
    });
    expect(changed.goal).toBeUndefined();

    const reverse = reconcileAnswers({ audience: "real-estate", goal: "estimate-requests" });
    expect(reverse.goal).toBeUndefined();
  });
});

describe("audience branches", () => {
  it("asks real estate a different goal question with its own options", () => {
    expect(goalQuestionFor("real-estate")).toBe("What do you want to improve first?");
    expect(goalChoicesFor("real-estate").map((c) => c.id)).toContain("seller-consultations");

    for (const audience of audiences.filter((a) => a.id !== "real-estate")) {
      expect(goalQuestionFor(audience.id)).toBe("What do you want more of?");
      expect(goalChoicesFor(audience.id).map((c) => c.id)).toContain("estimate-requests");
    }
  });

  it("gives every audience its own content examples", () => {
    for (const audience of audiences) {
      expect(audience.contentExamples.length).toBeGreaterThanOrEqual(3);
      expect(audience.descriptor).toBeTruthy();
    }
  });
});

describe("completion", () => {
  it("treats an empty multi-select as unanswered", () => {
    expect(isStepAnswered("channels", { channels: [] })).toBe(false);
    expect(isStepAnswered("channels", { channels: ["referrals"] })).toBe(true);
  });

  it("is complete only when every branch step has an answer", () => {
    const partial: AssessmentAnswers = {
      audience: "real-estate",
      bottleneck: "no-clear-process",
      channels: ["referrals"],
      followUp: "manual",
      goal: "buyer-consultations",
      contentNeed: "help-me-decide",
    };
    expect(isComplete(partial)).toBe(false);
    expect(isComplete({ ...partial, timing: "exploring" })).toBe(true);
  });
});

describe("labels", () => {
  it("resolves every answer id to human copy", () => {
    expect(labelFor("inconsistent-follow-up")).toBe(
      "People inquire, but follow-up is inconsistent",
    );
    expect(labelFor("real-estate")).toBe("Real Estate Agents & Teams");
    expect(labelFor(undefined)).toBe("Not answered");
  });
});
