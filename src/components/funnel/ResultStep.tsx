"use client";

import { useEffect } from "react";
import { ctaLabels } from "@/content/site";
import { track } from "@/lib/analytics";
import type { AssessmentAnswers } from "@/lib/assessment";
import type { Recommendation } from "@/lib/recommendation";
import { Button } from "@/components/ui/Button";
import { RecommendationCard } from "@/components/ui/RecommendationCard";
import { BackButton, StepContainer } from "@/components/ui/StepContainer";

/**
 * The result screen.
 *
 * Shown BEFORE any contact details are requested: the visitor gets something
 * useful whether or not they choose to go further.
 */
export function ResultStep({
  recommendation,
  answers,
  onContinue,
  onBack,
}: {
  recommendation: Recommendation;
  answers: AssessmentAnswers;
  onContinue: () => void;
  onBack: () => void;
}) {
  useEffect(() => {
    track("recommendation_viewed", {
      recommended_service: recommendation.service.id,
      recommendation_rule: recommendation.ruleId,
      includes_production: recommendation.includesProduction,
      audience: answers.audience,
    });
  }, [recommendation, answers.audience]);

  return (
    <StepContainer
      stepKey="result"
      question="Here's your suggested starting point."
      help="Based on the seven answers you just gave us — nothing else."
      actions={
        <div className="flex flex-col gap-3">
          <Button type="button" size="lg" fullWidth onClick={onContinue}>
            {ctaLabels.result}
          </Button>
          <div className="flex justify-center">
            <BackButton onClick={onBack} label="Change my answers" />
          </div>
        </div>
      }
    >
      <RecommendationCard recommendation={recommendation} />
    </StepContainer>
  );
}
