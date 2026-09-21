"use client";

import * as React from "react";
import { ArrowRight } from "lucide-react";
import { ctaLabels } from "@/content/site";
import { track } from "@/lib/analytics";
import type { AssessmentAnswers } from "@/lib/assessment";
import type { Recommendation } from "@/lib/recommendation";
import { Button } from "@/components/ui/button";
import { RecommendationCard } from "@/components/ui/recommendation-card";
import { BackButton, StepHeading, StepShell } from "@/components/ui/step-shell";

/**
 * The result screen — value delivered before anything is asked for.
 *
 * The recommendation is complete and readable here whether or not the visitor
 * goes any further.
 */
export function ResultStep({
  recommendation,
  answers,
  onContinue,
  onBack,
  scrollRef,
}: {
  recommendation: Recommendation;
  answers: AssessmentAnswers;
  onContinue: () => void;
  onBack: () => void;
  scrollRef?: React.Ref<HTMLDivElement>;
}) {
  React.useEffect(() => {
    track("recommendation_viewed", {
      recommended_service: recommendation.service.id,
      recommendation_rule: recommendation.ruleId,
      includes_production: recommendation.includesProduction,
      audience: answers.audience,
    });
  }, [recommendation, answers.audience]);

  return (
    <StepShell
      scrollRef={scrollRef}
      actions={
        <div className="flex flex-col gap-2">
          <Button type="button" size="action" full onClick={onContinue}>
            {ctaLabels.result}
            <ArrowRight aria-hidden="true" />
          </Button>
          <div className="flex justify-center">
            <BackButton onClick={onBack} label="Change my answers" />
          </div>
        </div>
      }
    >
      <StepHeading
        title="Here's your suggested starting point."
        supporting="Based on the seven answers you just gave us — nothing else."
      />
      <div className="mt-7">
        <RecommendationCard recommendation={recommendation} />
      </div>
    </StepShell>
  );
}
