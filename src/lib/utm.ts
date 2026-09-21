"use client";

import type { Attribution } from "./lead-schema";

/**
 * Captures campaign attribution from the URL on first load.
 *
 * Kept in sessionStorage so it survives the walk through the funnel without
 * being appended to every link. Values are length-capped before storage so a
 * crafted URL cannot inflate the submission.
 */

const STORAGE_KEY = "aion.attribution.v1";
const MAX = 200;

const UTM_PARAMS = [
  ["utm_source", "utmSource"],
  ["utm_medium", "utmMedium"],
  ["utm_campaign", "utmCampaign"],
  ["utm_content", "utmContent"],
  ["utm_term", "utmTerm"],
] as const;

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function clamp(value: string | null | undefined, max = MAX): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().slice(0, max);
  return trimmed === "" ? undefined : trimmed;
}

/** Records attribution once per session; later page views do not overwrite it. */
export function captureAttribution(): Attribution {
  const store = storage();
  if (typeof window === "undefined") return {};

  const existing = readAttribution();
  if (Object.keys(existing).length > 0) return existing;

  const params = new URLSearchParams(window.location.search);
  const captured: Record<string, string> = {};
  for (const [param, key] of UTM_PARAMS) {
    const value = clamp(params.get(param));
    if (value) captured[key] = value;
  }

  const landingPage = clamp(`${window.location.origin}${window.location.pathname}`, 1024);
  if (landingPage) captured.landingPage = landingPage;

  // Only record an external referrer; internal navigation is not attribution.
  const referrer = clamp(document.referrer, 1024);
  if (referrer && !referrer.startsWith(window.location.origin)) {
    captured.referrer = referrer;
  }

  if (store && Object.keys(captured).length > 0) {
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(captured));
    } catch {
      // Attribution is optional; never block on it.
    }
  }
  return captured as Attribution;
}

export function readAttribution(): Attribution {
  const store = storage();
  if (!store) return {};
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [, key] of UTM_PARAMS) {
      const value = parsed[key];
      if (typeof value === "string") out[key] = value.slice(0, MAX);
    }
    for (const key of ["landingPage", "referrer"] as const) {
      const value = parsed[key];
      if (typeof value === "string") out[key] = value.slice(0, 1024);
    }
    return out as Attribution;
  } catch {
    return {};
  }
}
