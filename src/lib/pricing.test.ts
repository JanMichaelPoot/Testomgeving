import { describe, expect, it } from "vitest";
import { formatPrice, formatAmount, WINDOW_PLAN_PRICE } from "./pricing";

describe("formatPrice", () => {
  it("uses a comma decimal separator for nl", () => {
    expect(formatPrice("nl")).toBe("€3,50");
  });

  it("uses a dot decimal separator for en", () => {
    expect(formatPrice("en")).toBe("€3.50");
  });
});

describe("formatAmount", () => {
  it("formats the given amount, not the live WINDOW_PLAN_PRICE constant", () => {
    // The whole reason this exists (see pricing.ts): an order confirmation
    // e-mail must show what THAT order actually cost, even after
    // WINDOW_PLAN_PRICE changes. Asserting against a value that differs
    // from the current constant guards against silently regressing to
    // formatPrice()'s always-current behaviour.
    expect(formatAmount(499, "eur", "nl")).toBe("€4,99");
    expect(formatAmount(499, "eur", "nl")).not.toBe(formatPrice("nl"));
  });

  it("matches formatPrice's output when given the current live price", () => {
    expect(formatAmount(WINDOW_PLAN_PRICE.amountCents, WINDOW_PLAN_PRICE.currency, "nl")).toBe(
      formatPrice("nl")
    );
  });

  it("falls back to a generic 'CUR amount' shape for a non-EUR currency", () => {
    expect(formatAmount(1000, "usd", "en")).toBe("USD 10.00");
  });

  it("is case-insensitive on the currency code", () => {
    expect(formatAmount(350, "EUR", "nl")).toBe("€3,50");
  });
});
