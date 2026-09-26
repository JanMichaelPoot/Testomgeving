"use client";

import posthog from "posthog-js";

let initialized = false;

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

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false,
  });

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
