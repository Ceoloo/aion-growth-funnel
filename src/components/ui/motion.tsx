"use client";

import * as React from "react";
import { LazyMotion, MotionConfig, domAnimation, useReducedMotion } from "motion/react";

/**
 * Motion runtime for the funnel.
 *
 * `LazyMotion` with `domAnimation` loads only the features actually used —
 * animations, variants, exit animations and tap gestures — instead of the full
 * bundle. Pair it with the `m` components from `motion/react-m` (see
 * `src/components/ui/m.ts`); using `motion.*` here would pull the whole bundle
 * back in and defeat the point.
 *
 * `reducedMotion="user"` makes Motion drop transform and layout animations
 * while keeping opacity, so a visitor with Reduced Motion gets a plain
 * cross-fade rather than nothing at all. The CSS media query in globals.css
 * covers everything Motion does not.
 *
 * This is deliberately NOT in the root layout: the landing page animates with
 * CSS only, so it should not pay for the Motion runtime.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user" transition={stepTransition}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}

/** 240ms — inside the 180–280ms band for step transitions. */
export const stepTransition = {
  duration: 0.24,
  ease: [0.22, 1, 0.36, 1] as const,
};

/** 150ms — inside the 120–180ms band for control feedback. */
export const feedbackTransition = {
  duration: 0.15,
  ease: [0.22, 1, 0.36, 1] as const,
};

export type Direction = "forward" | "back";

/**
 * Direction-aware step variants.
 *
 * Movement is a single 16px axis shift and the element is never absolutely
 * positioned, so nothing around it reflows while it animates.
 */
export const stepVariants = {
  enter: (direction: Direction) => ({
    opacity: 0,
    x: direction === "forward" ? 16 : -16,
  }),
  center: { opacity: 1, x: 0 },
  exit: (direction: Direction) => ({
    opacity: 0,
    x: direction === "forward" ? -16 : 16,
  }),
};

/** True when the visitor has asked for reduced motion. */
export function usePrefersReducedMotion(): boolean {
  return useReducedMotion() ?? false;
}
