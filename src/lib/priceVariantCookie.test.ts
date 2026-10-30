import { describe, expect, it } from "vitest";
import { clearPriceVariantCookie, ensurePriceVariantCookie, readVariantCookie } from "./priceVariantCookie";

// A tiny cookie jar with the one behaviour the code relies on: assigning document.cookie sets (or, with max-age=0, removes) a cookie.
function jar() {
  const store = new Map<string, string>();
  return {
    get cookie() {
      return [...store].map(([k, v]) => `${k}=${v}`).join("; ");
    },
    set cookie(value: string) {
      const [pair, ...attrs] = value.split("; ");
      const [k, v] = [pair.slice(0, pair.indexOf("=")), pair.slice(pair.indexOf("=") + 1)];
      if (attrs.includes("max-age=0")) store.delete(k);
      else store.set(k, v);
    },
  };
}

describe("price variant cookie", () => {
  it("writes one of the offered variants and reports that it did", () => {
    const doc = jar();
    expect(ensurePriceVariantCookie(["control", "B"], doc, () => 0.9)).toBe(true);
    expect(readVariantCookie(doc)).toBe("B");
  });
  it("leaves a valid cookie alone: a visitor keeps one price", () => {
    const doc = jar();
    ensurePriceVariantCookie(["control", "B"], doc, () => 0.9);
    expect(ensurePriceVariantCookie(["control", "B"], doc, () => 0)).toBe(false);
    expect(readVariantCookie(doc)).toBe("B");
  });
  it("replaces a variant that is no longer offered", () => {
    const doc = jar();
    ensurePriceVariantCookie(["control", "B"], doc, () => 0.9);
    expect(ensurePriceVariantCookie(["control", "C"], doc, () => 0.9)).toBe(true);
    expect(readVariantCookie(doc)).toBe("C");
  });
  it("removes the cookie when the test is off or consent is gone", () => {
    const doc = jar();
    ensurePriceVariantCookie(["control", "B"], doc, () => 0.9);
    expect(ensurePriceVariantCookie([], doc)).toBe(true);
    expect(readVariantCookie(doc)).toBeNull();
    expect(clearPriceVariantCookie(doc)).toBe(false);
  });
});
