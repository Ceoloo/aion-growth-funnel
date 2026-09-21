import type {
  AudienceId,
  BottleneckId,
  ChannelId,
  ContentNeedId,
  FollowUpId,
  GoalId,
  TimingId,
} from "@/content/types";
import { stepIds, type StepId } from "@/content/assessment";

/**
 * The visitor's answers. Every field is optional because the object exists
 * from the first screen onward and fills in as they progress.
 *
 * This object is non-sensitive by construction: it holds only answer ids from
 * a fixed vocabulary. It is safe to keep in sessionStorage and safe to send to
 * analytics. Contact details are deliberately kept in a separate structure.
 */
export interface AssessmentAnswers {
  audience?: AudienceId;
  bottleneck?: BottleneckId;
  channels?: ChannelId[];
  followUp?: FollowUpId;
  goal?: GoalId;
  contentNeed?: ContentNeedId;
  timing?: TimingId;
}

export const emptyAnswers: AssessmentAnswers = {};

/** Maps a step to the answer key it writes. */
export const stepAnswerKey = {
  "business-type": "audience",
  bottleneck: "bottleneck",
  channels: "channels",
  "follow-up": "followUp",
  goal: "goal",
  "content-needs": "contentNeed",
  timing: "timing",
} as const satisfies Record<StepId, keyof AssessmentAnswers>;

/**
 * The active branch of steps.
 *
 * Every audience currently answers the same seven questions — only the wording
 * and options of the goal step change. Returning the branch from a function
 * (rather than hard-coding a count) means progress stays correct if a future
 * audience skips or adds a step.
 */
export function branchFor(_answers: AssessmentAnswers): readonly StepId[] {
  return stepIds;
}

export function isStepAnswered(step: StepId, answers: AssessmentAnswers): boolean {
  const value = answers[stepAnswerKey[step]];
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined;
}

/** True once every question on the active branch has an answer. */
export function isComplete(answers: AssessmentAnswers): boolean {
  return branchFor(answers).every((step) => isStepAnswered(step, answers));
}

/**
 * Progress against the active branch.
 * `current` is 1-based and clamped to the branch length.
 */
export function progressFor(
  step: StepId,
  answers: AssessmentAnswers,
): { current: number; total: number; percent: number } {
  const branch = branchFor(answers);
  const index = branch.indexOf(step);
  const total = branch.length;
  const current = index < 0 ? total : index + 1;
  return { current, total, percent: Math.round((current / total) * 100) };
}

export function nextStep(step: StepId, answers: AssessmentAnswers): StepId | null {
  const branch = branchFor(answers);
  const index = branch.indexOf(step);
  if (index < 0 || index >= branch.length - 1) return null;
  return branch[index + 1] ?? null;
}

export function previousStep(step: StepId, answers: AssessmentAnswers): StepId | null {
  const branch = branchFor(answers);
  const index = branch.indexOf(step);
  if (index <= 0) return null;
  return branch[index - 1] ?? null;
}

/**
 * Clears answers that a changed earlier answer has invalidated.
 *
 * Changing the business type can invalidate the goal, because real estate uses
 * a different goal vocabulary. Every other answer is preserved so that going
 * back and forth never silently loses work.
 */
export function reconcileAnswers(answers: AssessmentAnswers): AssessmentAnswers {
  const realEstateGoals: GoalId[] = [
    "seller-consultations",
    "buyer-consultations",
    "listing-promotion",
    "agent-brand",
    "nurture-contacts",
  ];
  const goal = answers.goal;
  if (!goal) return answers;

  const goalIsRealEstate = realEstateGoals.includes(goal);
  const audienceIsRealEstate = answers.audience === "real-estate";
  if (answers.audience !== undefined && goalIsRealEstate !== audienceIsRealEstate) {
    const { goal: _dropped, ...rest } = answers;
    return rest;
  }
  return answers;
}
