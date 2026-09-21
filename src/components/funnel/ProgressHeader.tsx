"use client";

import { Progress } from "@/components/ui/progress";

/**
 * Question progress.
 *
 * Values come from the active branch rather than a fixed total, so a
 * conditional branch cannot make the bar lie. The numeric position is exposed
 * to assistive technology through the Radix progressbar's `aria-valuetext`,
 * and the bar itself animates width only — no layout shift.
 */
export function ProgressHeader({
  current,
  total,
  percent,
  label,
}: {
  current: number;
  total: number;
  percent: number;
  label: string;
}) {
  return (
    <div className="w-full">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className="text-eyebrow uppercase text-muted-foreground">{label}</span>
        <span className="text-eyebrow text-muted-foreground" aria-hidden="true">
          {current} / {total}
        </span>
      </div>
      <Progress
        value={percent}
        aria-label={`Question ${current} of ${total}`}
        aria-valuetext={`Question ${current} of ${total}`}
        className="h-1.5 bg-secondary"
      />
    </div>
  );
}
