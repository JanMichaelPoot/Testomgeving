// The price model of 26 Nov 2026: EUR 5,99 once; friends and early bird 25% off, EUR 4,49.
import { afterEach, describe, expect, it } from "vitest";
import { CODE_DISCOUNT_PERCENT, EARLY_BIRD, percentOffCents, priceAfterPercent } from "@/lib/discountConfig";
import { checkEarlyBird, discountOn, DISCOUNT_CENTS } from "@/lib/discountCode";
import { PRICE_CENTS } from "@/lib/pricing";

const saved = { ...EARLY_BIRD };
afterEach(() => {
  Object.assign(EARLY_BIRD, saved);
});

describe("the price model", () => {
  it("is EUR 5,99, with 25% off for a friend code and for the early bird: EUR 4,49", () => {
    expect(PRICE_CENTS).toBe(599);
    expect(CODE_DISCOUNT_PERCENT).toBe(25);
    expect(EARLY_BIRD.percent).toBe(25);
    expect(priceAfterPercent(599, 25)).toBe(449);
    expect(percentOffCents(599, 25)).toBe(150);
    expect(PRICE_CENTS - DISCOUNT_CENTS).toBe(449);
  });

  it("knows the early-bird code in any spelling, and nothing else", () => {
    for (const typed of ["EARLYBIRD", "earlybird", " Early Bird ", "early-bird"]) expect(checkEarlyBird(typed), typed).toMatchObject({ ok: true, id: null, percent: 25 });
    for (const typed of ["", "EARLY", "EARLYBIRD2", "WI-ABCD-EFGH", "EARLYBIRD EARLYBIRD"]) expect(checkEarlyBird(typed), typed).toBeNull();
  });

  it("works through its last day in Dutch time and not after it, and not when switched off", () => {
    EARLY_BIRD.validUntil = "2026-12-31";
    expect(checkEarlyBird("EARLYBIRD", new Date("2026-12-31T22:30:00Z"))).toMatchObject({ ok: true });
    expect(checkEarlyBird("EARLYBIRD", new Date("2026-12-31T23:30:00Z"))).toEqual({ ok: false, reason: "expired" });
    EARLY_BIRD.validUntil = null;
    EARLY_BIRD.enabled = false;
    expect(checkEarlyBird("EARLYBIRD")).toEqual({ ok: false, reason: "expired" });
  });

  it("takes a stored code's own amount and the early bird's percentage of the price in force", () => {
    expect(discountOn(650, { amountCents: 150 })).toBe(150);
    expect(discountOn(650, { amountCents: 150, percent: 25 })).toBe(162);
  });
});
