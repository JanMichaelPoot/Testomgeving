"use client";

import posthog from "posthog-js";

let initialized = false;

/**
 * What PostHog may do in this app: send the events we choose (src/lib/analyticsEvents.ts), nothing else.
 * PostHog's own switches are decided by the project's settings and arrive in the browser at load time;
 * a project with session replay or autocapture on would otherwise record what is on screen (the
 * profile text, door titles, places) and the text of every button clicked. Both are off here, as are
 * the other extras, whatever the project says. The consent banner promises analytics of how the site
 * is used, not recordings of people.
 */
export const POSTHOG_CONFIG = (host: string | undefined) =>
  ({
    api_host: host ?? "https://eu.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false,
    capture_pageleave: false,
    autocapture: false,
    disable_session_recording: true,
    disable_surveys: true,
    capture_dead_clicks: false,
    capture_heatmaps: false,
    rageclick: false,
    capture_performance: false,
    advanced_disable_flags: true,
  }) as const;

// In development every tracked event is also pushed onto window.__windowEvents,
// so tracking can be checked in the browser without a PostHog key (and before
// consent). Compiled away in production builds.
declare global {
  interface Window {
    __windowEvents?: { name: string; properties?: Record<string, unknown> }[];
  }
}

// Call once from a top-level client component (ConsentBanner), only after
// the user has given analytics consent.
export function initPostHog() {
  if (initialized || typeof window === "undefined") return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return; // Not configured yet — no-op, same pattern as the other third-party clients in this project.

  posthog.init(key, POSTHOG_CONFIG(process.env.NEXT_PUBLIC_POSTHOG_HOST));

  initialized = true;
}

// Silently does nothing until initPostHog() has actually run — callers
// (e.g. the intake wizard) never need to check consent state themselves.
export function trackEvent(name: string, properties?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
    (window.__windowEvents ??= []).push({ name, properties });
  }
  if (!initialized) return;
  posthog.capture(name, properties);
}

export { posthog };
