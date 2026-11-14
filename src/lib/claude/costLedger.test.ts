import { describe, expect, it } from "vitest";
import { DEFAULT_BOOK_CAP_USD, DEFAULT_ROUND_USD, WRITING_RESERVE_USD, bookCostCap, createCostLedger, priceUsage } from "@/lib/claude/costLedger";

describe("pricing a model call", () => {
  it("prices Haiku research with its searches, as the cost meters do", () => {
    // 40,000 input tokens at $1/M, 1,500 output at $5/M, 5 searches at $0.01
    const usd = priceUsage({ input_tokens: 40_000, output_tokens: 1_500, server_tool_use: { web_search_requests: 5 } }, "claude-haiku-4-5-20251001");
    expect(usd).toBeCloseTo(0.04 + 0.0075 + 0.05, 6);
  });

  it("prices Sonnet writing, with the cache read and write multipliers", () => {
    const usd = priceUsage({ input_tokens: 10_000, output_tokens: 3_000, cache_creation_input_tokens: 4_000, cache_read_input_tokens: 20_000 }, "claude-sonnet-5");
    expect(usd).toBeCloseTo(0.02 + 0.03 + 0.01 + 0.004, 6);
  });

  it("counts nothing for a missing usage", () => {
    expect(priceUsage(null)).toBe(0);
    expect(priceUsage(undefined)).toBe(0);
  });
});

describe("the cap", () => {
  it("is 0.40 by default, set by WINDOW_BOOK_COST_CAP, and off with 0 or off", () => {
    expect(bookCostCap({})).toBe(DEFAULT_BOOK_CAP_USD);
    expect(bookCostCap({ WINDOW_BOOK_COST_CAP: "0.55" })).toBe(0.55);
    expect(bookCostCap({ WINDOW_BOOK_COST_CAP: "off" })).toBeNull();
    expect(bookCostCap({ WINDOW_BOOK_COST_CAP: "0" })).toBeNull();
    expect(bookCostCap({ WINDOW_BOOK_COST_CAP: "nonsense" })).toBe(DEFAULT_BOOK_CAP_USD);
  });
});

describe("the ledger of one book", () => {
  // A call that costs exactly `usd`: searches are worth $0.01 each.
  const cost = (usd: number) => ({ server_tool_use: { web_search_requests: Math.round(usd * 100) } });

  it("starts empty and affords every round", () => {
    const l = createCostLedger({ capUsd: 0.4 });
    expect(l.spentUsd()).toBe(0);
    for (const kind of ["standard", "own", "broad", "online"] as const) expect(l.canAfford(kind)).toBe(true);
  });

  it("adds up what is spent, per kind, and keeps the writing apart", () => {
    const l = createCostLedger({ capUsd: 0.4 });
    l.add("standard", cost(0.06));
    l.add("own", cost(0.1));
    l.add("writing", cost(0.09));
    expect(l.spentUsd()).toBeCloseTo(0.25, 6);
    expect(l.breakdown()).toEqual({ standard: 0.06, own: 0.1, writing: 0.09 });
  });

  it("refuses a round that would take the book past the cap, with the writing still to come", () => {
    const l = createCostLedger({ capUsd: 0.4 });
    l.add("standard", cost(0.08));
    l.add("own", cost(0.14)); // 0.22 spent: broad (0.09) + the writing reserve (0.11) = 0.42 > 0.40
    expect(l.canAfford("broad")).toBe(false);
    expect(l.canAfford("online")).toBe(true); // 0.22 + 0.05 + 0.11 = 0.38
    expect(0.22 + DEFAULT_ROUND_USD.broad + WRITING_RESERVE_USD).toBeGreaterThan(0.4);
  });

  it("expects a round to cost what the last one of its kind did, when that was more than usual", () => {
    const l = createCostLedger({ capUsd: 0.5 });
    l.add("broad", cost(0.13));
    expect(l.estimate("broad")).toBeCloseTo(0.13, 6);
    expect(l.estimate("online")).toBe(DEFAULT_ROUND_USD.online);
    l.add("broad", cost(0.03));
    expect(l.estimate("broad")).toBe(DEFAULT_ROUND_USD.broad); // the usual is the floor
  });

  it("never refuses anything without a cap", () => {
    const l = createCostLedger({ capUsd: null });
    l.add("standard", cost(5));
    expect(l.canAfford("broad")).toBe(true);
    expect(l.capUsd).toBeNull();
  });

  it("notes a skipped round once", () => {
    const l = createCostLedger({ capUsd: 0.4 });
    l.skip("broad");
    l.skip("broad");
    l.skip("online");
    expect(l.skipped()).toEqual(["broad", "online"]);
  });
});
