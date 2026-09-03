import { PostHog } from "posthog-node";

let client: PostHog | null = null;

// Server-side capture (API routes, webhooks) — separate from the browser
// client so events can fire without waiting on consent-gated client init.
export function getPostHogServerClient() {
  if (!client) {
    client = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}
