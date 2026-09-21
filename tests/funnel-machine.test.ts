import { describe, expect, it } from "vitest";
import {
  canContinue,
  funnelReducer,
  isQuestionScreen,
  resumeScreen,
  type FunnelState,
} from "@/lib/funnel-machine";
import type { AssessmentAnswers } from "@/lib/assessment";

const full: AssessmentAnswers = {
  audience: "contractor-builder",
  bottleneck: "inconsistent-follow-up",
  channels: ["referrals"],
  followUp: "manual",
  goal: "estimate-requests",
  contentNeed: "have-content",
  timing: "asap",
};

const at = (screen: FunnelState["screen"]): FunnelState => ({ screen, direction: "forward" });

describe("forward navigation", () => {
  it("walks the question branch in order", () => {
    let state = at("business-type");
    const seen = [state.screen];
    for (let i = 0; i < 6; i += 1) {
      state = funnelReducer(state, { type: "CONTINUE", answers: full });
      seen.push(state.screen);
    }
    expect(seen).toEqual([
      "business-type",
      "bottleneck",
      "channels",
      "follow-up",
      "goal",
      "content-needs",
      "timing",
    ]);
  });

  it("goes from the last question to the result, not to contact", () => {
    // The recommendation is always shown before contact details are requested.
    const next = funnelReducer(at("timing"), { type: "CONTINUE", answers: full });
    expect(next.screen).toBe("result");
  });

  it("goes from the result to the contact step", () => {
    expect(funnelReducer(at("result"), { type: "CONTINUE", answers: full }).screen).toBe(
      "contact",
    );
  });

  it("marks forward moves as forward", () => {
    expect(funnelReducer(at("bottleneck"), { type: "CONTINUE", answers: full }).direction).toBe(
      "forward",
    );
  });
});

describe("back navigation", () => {
  it("steps back through the branch", () => {
    const next = funnelReducer(at("follow-up"), { type: "BACK", answers: full });
    expect(next).toEqual({ screen: "channels", direction: "back" });
  });

  it("returns from the result to the last question", () => {
    expect(funnelReducer(at("result"), { type: "BACK", answers: full }).screen).toBe("timing");
  });

  it("returns from contact to the result, so the recommendation is re-readable", () => {
    expect(funnelReducer(at("contact"), { type: "BACK", answers: full }).screen).toBe("result");
  });

  it("does nothing at the first question", () => {
    const state = at("business-type");
    expect(funnelReducer(state, { type: "BACK", answers: full })).toBe(state);
  });

  it("treats the confirmation screen as terminal", () => {
    // The submission is already stored; there is nothing coherent to go back to.
    const state = at("confirmation");
    expect(funnelReducer(state, { type: "BACK", answers: full })).toBe(state);
    expect(funnelReducer(state, { type: "CONTINUE", answers: full })).toBe(state);
  });

  it("marks back moves as back, so the transition runs the other way", () => {
    expect(funnelReducer(at("goal"), { type: "BACK", answers: full }).direction).toBe("back");
  });
});

describe("submission", () => {
  it("only SUBMITTED reaches the confirmation screen", () => {
    expect(funnelReducer(at("contact"), { type: "SUBMITTED" }).screen).toBe("confirmation");
    // CONTINUE on the contact step is inert: the form submit drives it.
    expect(funnelReducer(at("contact"), { type: "CONTINUE", answers: full }).screen).toBe(
      "contact",
    );
  });
});

describe("resume", () => {
  it("opens on the first unanswered question", () => {
    expect(resumeScreen({})).toBe("business-type");
    expect(resumeScreen({ audience: "home-services" })).toBe("bottleneck");
  });

  it("skips a preselected audience", () => {
    expect(resumeScreen({ audience: "real-estate" })).toBe("bottleneck");
  });

  it("opens on the result when everything is answered", () => {
    expect(resumeScreen(full)).toBe("result");
  });

  it("treats an empty multi-select as unanswered", () => {
    expect(resumeScreen({ ...full, channels: [] })).toBe("channels");
  });
});

describe("continue gating", () => {
  it("blocks continue until the current question is answered", () => {
    expect(canContinue("bottleneck", { audience: "local-business" })).toBe(false);
    expect(canContinue("bottleneck", full)).toBe(true);
  });

  it("requires at least one option on a multi-select", () => {
    expect(canContinue("channels", { ...full, channels: [] })).toBe(false);
    expect(canContinue("channels", full)).toBe(true);
  });

  it("never blocks the outcome screens", () => {
    for (const screen of ["result", "contact", "confirmation"] as const) {
      expect(canContinue(screen, {})).toBe(true);
    }
  });
});

describe("screen classification", () => {
  it("separates questions from outcome screens", () => {
    expect(isQuestionScreen("goal")).toBe(true);
    expect(isQuestionScreen("result")).toBe(false);
    expect(isQuestionScreen("contact")).toBe(false);
    expect(isQuestionScreen("confirmation")).toBe(false);
  });
});

describe("no auto-advance", () => {
  it("answering does not move the screen — only CONTINUE does", () => {
    // The reducer has no event for "an answer changed", which is the
    // structural guarantee that selecting an option cannot auto-advance.
    const state = at("bottleneck");
    const events = [{ type: "BACK" as const, answers: {} }];
    for (const event of events) {
      expect(funnelReducer(state, event).screen).not.toBe("channels");
    }
    expect(funnelReducer(state, { type: "CONTINUE", answers: full }).screen).toBe("channels");
  });
});
