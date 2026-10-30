import { describe, expect, it } from "vitest";
import { GIFT_PRICE_CENTS, PRICE_CENTS } from "./pricing";
import { assignVariant, parsePriceTest, resolvePrice, variantIds } from "./priceTest";

const CONFIG = parsePriceTest('{"B":{"self":650,"gift":1295},"C":{"self":850}}');

describe("price test setting", () => {
  it("is off when nothing is set", () => {
    expect(parsePriceTest(undefined)).toBeNull();
    expect(parsePriceTest("")).toBeNull();
    expect(variantIds(null)).toEqual([]);
    expect(assignVariant(null)).toBeNull();
  });

  it("reads the variants", () => {
    expect(CONFIG).toEqual({ B: { self: 650, gift: 1295 }, C: { self: 850 } });
    expect(variantIds(CONFIG)).toEqual(["control", "B", "C"]);
  });

  it("fails closed on any mistake: the whole test is off", () => {
    for (const bad of [
      "not json",
      "[]",
      '{"B":{"self":7.5}}', // someone typed euros, not cents
      '{"B":{"self":7}}', // 7 cents
      '{"B":{"self":99999999}}',
      '{"B":{"other":650}}',
      '{"B":{}}',
      '{"control":{"self":650}}',
      '{"a b":{"self":650}}',
      '{"B":{"self":"650"}}',
    ]) {
      expect(parsePriceTest(bad)).toBeNull();
    }
  });
});

describe("assigning a variant", () => {
  it("picks evenly among control and the variants", () => {
    expect(assignVariant(CONFIG, () => 0)).toBe("control");
    expect(assignVariant(CONFIG, () => 0.4)).toBe("B");
    expect(assignVariant(CONFIG, () => 0.99999)).toBe("C");
  });
  it("splits roughly a third each over many visitors", () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 3000; i++) {
      const v = assignVariant(CONFIG)!;
      counts[v] = (counts[v] ?? 0) + 1;
    }
    for (const id of ["control", "B", "C"]) expect(counts[id]).toBeGreaterThan(850);
  });
});

describe("the price a visitor pays", () => {
  it("is the normal price, and records nothing, while the test is off", () => {
    expect(resolvePrice("self", null, "B")).toEqual({ cents: PRICE_CENTS, variant: null });
    expect(resolvePrice("gift", null, null)).toEqual({ cents: GIFT_PRICE_CENTS, variant: null });
  });
  it("is the variant's price per product, and the normal price where the variant names none", () => {
    expect(resolvePrice("self", CONFIG, "B")).toEqual({ cents: 650, variant: "B" });
    expect(resolvePrice("gift", CONFIG, "B")).toEqual({ cents: 1295, variant: "B" });
    expect(resolvePrice("gift", CONFIG, "C")).toEqual({ cents: GIFT_PRICE_CENTS, variant: "C" });
  });
  it("treats no cookie, 'control' and a variant that was removed as control at the normal price", () => {
    for (const cookie of [null, undefined, "control", "Z"]) {
      expect(resolvePrice("self", CONFIG, cookie)).toEqual({ cents: PRICE_CENTS, variant: "control" });
    }
  });
});
