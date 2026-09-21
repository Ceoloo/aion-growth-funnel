import { branchFor, isStepAnswered, nextStep, previousStep, type AssessmentAnswers } from "./assessment";
import type { StepId } from "@/content/assessment";

/**
 * Explicit funnel state model.
 *
 * Kept out of the component so the transitions are testable on their own and
 * so every screen change goes through one place. A screen is either a question
 * from the active branch or one of the three outcome screens.
 */
export type Screen = StepId | "result" | "contact" | "confirmation";

export type Direction = "forward" | "back";

export interface FunnelState {
  screen: Screen;
  direction: Direction;
}

export type FunnelEvent =
  | { type: "CONTINUE"; answers: AssessmentAnswers }
  | { type: "BACK"; answers: AssessmentAnswers }
  | { type: "GOTO"; screen: Screen; direction?: Direction }
  | { type: "SUBMITTED" };

const OUTCOME: Screen[] = ["result", "contact", "confirmation"];

export function isQuestionScreen(screen: Screen): screen is StepId {
  return !OUTCOME.includes(screen);
}

/**
 * Computes the next state.
 *
 * `direction` is part of the state rather than derived at render time, because
 * the transition needs to know which way the visitor is travelling and the
 * screen alone cannot tell you that.
 */
export function funnelReducer(state: FunnelState, event: FunnelEvent): FunnelState {
  switch (event.type) {
    case "CONTINUE": {
      const { screen } = state;
      if (screen === "confirmation") return state;
      if (screen === "contact") return state; // submission drives this, not CONTINUE
      if (screen === "result") return { screen: "contact", direction: "forward" };

      const following = nextStep(screen, event.answers);
      return {
        screen: following ?? "result",
        direction: "forward",
      };
    }

    case "BACK": {
      const { screen } = state;
      // The confirmation screen is terminal: the submission is already stored,
      // so there is nothing coherent to go back to.
      if (screen === "confirmation") return state;
      if (screen === "contact") return { screen: "result", direction: "back" };
      if (screen === "result") {
        const branch = branchFor(event.answers);
        return {
          screen: branch[branch.length - 1] ?? "business-type",
          direction: "back",
        };
      }
      const prior = previousStep(screen, event.answers);
      return prior ? { screen: prior, direction: "back" } : state;
    }

    case "GOTO":
      return { screen: event.screen, direction: event.direction ?? "forward" };

    case "SUBMITTED":
      return { screen: "confirmation", direction: "forward" };

    default:
      return state;
  }
}

/** The first question without an answer, or the result when all are answered. */
export function resumeScreen(answers: AssessmentAnswers): Screen {
  const branch = branchFor(answers);
  const firstUnanswered = branch.find((step) => !isStepAnswered(step, answers));
  return firstUnanswered ?? "result";
}

/** Whether Continue should be enabled on the current screen. */
export function canContinue(screen: Screen, answers: AssessmentAnswers): boolean {
  if (!isQuestionScreen(screen)) return true;
  return isStepAnswered(screen, answers);
}
