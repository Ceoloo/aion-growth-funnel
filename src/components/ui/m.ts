"use client";

/**
 * The lightweight Motion components.
 *
 * `m` carries no features of its own — they are supplied by the `LazyMotion`
 * provider in `motion.tsx`. Importing `motion` instead would bundle the full
 * feature set into every page that touches it.
 */
export { AnimatePresence } from "motion/react";
export * as m from "motion/react-m";
