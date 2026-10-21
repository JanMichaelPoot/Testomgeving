import { describe, expect, it, vi } from "vitest";

vi.mock("posthog-js", () => ({ default: { init: vi.fn(), capture: vi.fn() } }));

import { POSTHOG_CONFIG } from "@/lib/posthog/client";

describe("POSTHOG_CONFIG", () => {
  const config = POSTHOG_CONFIG(undefined);

  it("sends only the events we choose: autocapture, session replay and the other extras are off", () => {
    // A PostHog project can switch these on in its own settings; the app must not follow.
    expect(config.autocapture).toBe(false);
    expect(config.disable_session_recording).toBe(true);
    expect(config.disable_surveys).toBe(true);
    expect(config.capture_heatmaps).toBe(false);
    expect(config.capture_dead_clicks).toBe(false);
    expect(config.rageclick).toBe(false);
    expect(config.capture_pageview).toBe(false);
    expect(config.capture_pageleave).toBe(false);
    expect(config.capture_performance).toBe(false);
    expect(config.advanced_disable_flags).toBe(true);
  });

  it("builds no person profiles for anonymous visitors", () => {
    expect(config.person_profiles).toBe("identified_only");
  });

  it("talks to the EU server unless told otherwise", () => {
    expect(config.api_host).toBe("https://eu.i.posthog.com");
    expect(POSTHOG_CONFIG("https://us.i.posthog.com").api_host).toBe("https://us.i.posthog.com");
  });
});
