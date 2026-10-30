import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const capture = vi.fn();
const flush = vi.fn(async () => {});

vi.mock("posthog-node", () => ({
  PostHog: class {
    capture = capture;
    flush = flush;
  },
}));

import { trackServerEvent } from "@/lib/posthog/server";

describe("trackServerEvent", () => {
  const original = process.env.NEXT_PUBLIC_POSTHOG_KEY;

  beforeEach(() => {
    capture.mockClear();
    flush.mockClear();
  });
  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    else process.env.NEXT_PUBLIC_POSTHOG_KEY = original;
  });

  it("does nothing without a PostHog key", async () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    await trackServerEvent("payment_succeeded", { is_gift: false, amount_cents: 350 }, "session-1");
    expect(capture).not.toHaveBeenCalled();
  });

  it("sends the event without a person profile and without a location lookup, and waits for the flush", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";
    await trackServerEvent("payment_succeeded", { is_gift: true, amount_cents: 600 }, "session-1");
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith({
      distinctId: "session-1",
      event: "payment_succeeded",
      properties: { is_gift: true, amount_cents: 600, $process_person_profile: false },
      disableGeoip: true,
    });
    expect(flush).toHaveBeenCalled();
  });

  it("never throws, so an analytics problem cannot hurt an order", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";
    capture.mockImplementationOnce(() => {
      throw new Error("network down");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(trackServerEvent("payment_succeeded", { is_gift: false, amount_cents: 350 }, "session-1")).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
