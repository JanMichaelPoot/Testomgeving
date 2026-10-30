import { PostHog } from "posthog-node";
import type { AnalyticsEventName } from "@/lib/analyticsEvents";

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

/**
 * Sends one catalogued event from the server (src/lib/analyticsEvents.ts), for moments that happen without the
 * browser: a payment confirmed by Stripe. It carries no person: the id is only the random session id, the profile
 * is not processed (`$process_person_profile: false`) and the visitor's location is not looked up. That is also why
 * it cannot be joined to the browser events of the same visitor. Never throws and does nothing without a key, so an
 * analytics problem cannot hurt an order. The test in analyticsEvents.test.ts checks the name and properties of every
 * call against the catalogue, like it does for trackEvent.
 */
export async function trackServerEvent(
  name: AnalyticsEventName,
  properties: Record<string, string | number | boolean>,
  distinctId: string,
): Promise<void> {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  try {
    const posthog = getPostHogServerClient();
    posthog.capture({
      distinctId,
      event: name,
      properties: { ...properties, $process_person_profile: false },
      disableGeoip: true,
    });
    await posthog.flush();
  } catch (err) {
    console.warn("WINDOW: could not send analytics event", name, err instanceof Error ? err.message : err);
  }
}
