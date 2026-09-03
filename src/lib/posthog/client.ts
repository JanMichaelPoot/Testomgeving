"use client";

import posthog from "posthog-js";

let initialized = false;

// Call once from a top-level client component (e.g. a PostHogProvider),
// after the user has given cookie/analytics consent.
export function initPostHog() {
  if (initialized || typeof window === "undefined") return;

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false,
  });

  initialized = true;
}

export { posthog };
