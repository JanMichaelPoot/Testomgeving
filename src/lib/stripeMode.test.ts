import { describe, expect, it } from "vitest";
import { keyMode, stripeModeInfo, stripeTestNotice } from "./stripeMode";

describe("stripe mode", () => {
  it("reads the mode from the key prefix", () => {
    expect(keyMode("sk_test_abc")).toBe("test");
    expect(keyMode(" sk_live_abc ")).toBe("live");
    expect(keyMode("rk_live_abc")).toBe("live");
    expect(keyMode("pk_live_abc")).toBeNull();
    expect(keyMode(undefined)).toBeNull();
  });

  it("follows STRIPE_MODE when it agrees with the key, and the key when STRIPE_MODE is absent", () => {
    expect(stripeModeInfo({ STRIPE_MODE: "live", STRIPE_SECRET_KEY: "sk_live_x" })).toEqual({ mode: "live", problem: null });
    expect(stripeModeInfo({ STRIPE_MODE: "TEST", STRIPE_SECRET_KEY: "sk_test_x" })).toEqual({ mode: "test", problem: null });
    expect(stripeModeInfo({ STRIPE_SECRET_KEY: "sk_live_x" })).toEqual({ mode: "live", problem: null });
    expect(stripeModeInfo({ STRIPE_SECRET_KEY: "sk_test_x" })).toEqual({ mode: "test", problem: null });
  });

  it("flags a live setting with a test key (and the reverse), a bad value and a missing key", () => {
    expect(stripeModeInfo({ STRIPE_MODE: "live", STRIPE_SECRET_KEY: "sk_test_x" }).problem).toMatch(/live.*test key/);
    expect(stripeModeInfo({ STRIPE_MODE: "test", STRIPE_SECRET_KEY: "sk_live_x" }).problem).toMatch(/test.*live key/);
    expect(stripeModeInfo({ STRIPE_MODE: "prod", STRIPE_SECRET_KEY: "sk_live_x" }).problem).toMatch(/must be/);
    expect(stripeModeInfo({}).problem).toMatch(/not set/);
    expect(stripeModeInfo({ STRIPE_SECRET_KEY: "whatever" }).problem).toMatch(/not a Stripe secret key/);
  });

  it("shows the tester notice only in test mode, never when real money is charged", () => {
    expect(stripeTestNotice("Testversie", { STRIPE_SECRET_KEY: "sk_test_x" })).toBe("Testversie");
    expect(stripeTestNotice("Testversie", { STRIPE_MODE: "live", STRIPE_SECRET_KEY: "sk_live_x", NEXT_PUBLIC_TEST_FEEDBACK: "1" })).toBeUndefined();
  });
});
