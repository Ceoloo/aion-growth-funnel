"use client";

import type { AssessmentAnswers } from "./assessment";
import { isAudienceId } from "@/content/audiences";

/**
 * Session persistence for assessment answers.
 *
 * Only answer ids are stored — a closed vocabulary with no personal data in
 * it. Contact details are deliberately never written here, never written to
 * localStorage, and never put in the URL; they exist in React state for the
 * life of the form and are sent straight to the server.
 *
 * sessionStorage (not localStorage) means the answers survive a refresh or an
 * accidental back-navigation but do not outlive the browser tab.
 */

const STORAGE_KEY = "aion.assessment.v1";

function available(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    const probe = "__aion_probe__";
    window.sessionStorage.setItem(probe, "1");
    window.sessionStorage.removeItem(probe);
    return window.sessionStorage;
  } catch {
    // Private mode, blocked storage, or a browser with cookies disabled.
    return null;
  }
}

const ANSWER_KEYS: (keyof AssessmentAnswers)[] = [
  "audience",
  "bottleneck",
  "channels",
  "followUp",
  "goal",
  "contentNeed",
  "timing",
];

/** Rejects anything that is not a plain answer id, so junk cannot be rehydrated. */
function sanitise(raw: unknown): AssessmentAnswers {
  if (typeof raw !== "object" || raw === null) return {};
  const source = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of ANSWER_KEYS) {
    const value = source[key];
    if (key === "channels") {
      if (Array.isArray(value)) {
        const channels = value.filter(
          (v): v is string => typeof v === "string" && v.length <= 40 && /^[a-z-]+$/.test(v),
        );
        if (channels.length > 0) out[key] = channels.slice(0, 6);
      }
      continue;
    }
    if (typeof value === "string" && value.length <= 40 && /^[a-z-]+$/.test(value)) {
      if (key === "audience" && !isAudienceId(value)) continue;
      out[key] = value;
    }
  }
  return out as AssessmentAnswers;
}

export function readAnswers(): AssessmentAnswers {
  const storage = available();
  if (!storage) return {};
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return sanitise(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function writeAnswers(answers: AssessmentAnswers): void {
  const storage = available();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(sanitise(answers)));
  } catch {
    // Storage can be full or blocked; the funnel works without it.
  }
}

export function mergeAnswers(patch: AssessmentAnswers): AssessmentAnswers {
  const next = { ...readAnswers(), ...patch };
  writeAnswers(next);
  return next;
}

/** Called after a successful submission so a completed assessment is not replayed. */
export function clearAnswers(): void {
  const storage = available();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do; the data is non-sensitive either way.
  }
}
