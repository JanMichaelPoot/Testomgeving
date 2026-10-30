import { describe, expect, it } from "vitest";
import { decideDraft } from "./giftArrival";
import { fillName } from "./recipientName";
import { getDictionary } from "@/lib/i18n/dictionaries";

const selfDraft = { purpose: "self" as const, page: 2 };
const giftDraft = { purpose: "gift" as const, page: 2 };

describe("gift arrival", () => {
  it("a gift arrival from the landing page with a new value never inherits an earlier intake", () => {
    expect(decideDraft({ purpose: "gift", arrival: "abc", seenArrival: null, draft: selfDraft })).toBe("discard");
    expect(decideDraft({ purpose: "gift", arrival: "abc", seenArrival: "old", draft: giftDraft })).toBe("discard");
  });

  it("the same value again (a reload) keeps a gift that is under way", () => {
    expect(decideDraft({ purpose: "gift", arrival: "abc", seenArrival: "abc", draft: giftDraft })).toBe("keep");
  });

  it("a gift link without a value only continues a gift in progress", () => {
    expect(decideDraft({ purpose: "gift", arrival: null, seenArrival: null, draft: giftDraft })).toBe("keep");
    expect(decideDraft({ purpose: "gift", arrival: null, seenArrival: null, draft: selfDraft })).toBe("discard");
    expect(decideDraft({ purpose: "gift", arrival: null, seenArrival: null, draft: { purpose: "gift", page: 0 } })).toBe("discard");
  });

  it("a visit for yourself never continues a gift draft, and keeps its own", () => {
    expect(decideDraft({ purpose: "self", arrival: null, seenArrival: "abc", draft: giftDraft })).toBe("discard");
    expect(decideDraft({ purpose: "self", arrival: null, seenArrival: null, draft: selfDraft })).toBe("keep");
    expect(decideDraft({ purpose: "gift", arrival: "x", seenArrival: null, draft: null })).toBe("keep");
  });
});

describe("recipient name", () => {
  it("fills a name and capitalises at the start of a sentence", () => {
    expect(fillName("{name} zoekt rust.", "de ontvanger")).toBe("De ontvanger zoekt rust.");
    expect(fillName("Waar zou {name} nu willen zijn?", "de ontvanger")).toBe("Waar zou de ontvanger nu willen zijn?");
    expect(fillName("Het is gedaan. {name} kiest.", "Anna")).toBe("Het is gedaan. Anna kiest.");
  });

  it("no gift text in nl or en is left with a pronoun placeholder when the name is empty", () => {
    for (const locale of ["nl", "en"] as const) {
      const v = getDictionary(locale).venster;
      expect(v.recipientFallback).toBe(locale === "nl" ? "de ontvanger" : "the recipient");
      const texts = JSON.stringify(v).match(/"[^"]*\{name\}[^"]*"/g) ?? [];
      expect(texts.length).toBeGreaterThan(20);
      for (const text of texts) {
        const filled = fillName(text.slice(1, -1), v.recipientFallback);
        expect(filled).not.toMatch(/diegene|\bthem\b|them's|\{name\}/i);
      }
    }
  });
});
