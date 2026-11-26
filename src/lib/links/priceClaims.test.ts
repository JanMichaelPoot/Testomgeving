import { describe, expect, it } from "vitest";
import type { IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import { ASK_PRICE, priceKind, shownPrice, withCheckedPrices } from "@/lib/links/priceClaims";
import { budgetStatusFor } from "@/lib/pdf/ideaContent";

// Step 248: the cases below are from a generated book of 27 Nov 2026, checked on the providers' own pages.
const at = (...notes: string[]) => ({ places: notes.map((note, i) => ({ name: `Place ${i}`, city: "Utrecht", note, url: null })), activity_id: "roman-schrijven" });

describe("which price a reader may see", () => {
  it("shows no guessed price for a course of EUR 775, and so no 'within your budget'", () => {
    const entry = at("Cursussen Kort verhaal, Schrijftraining en Roman; voor beginners geschikt");
    for (const guess of ["€40-50 (indicatie eerste les)", "€40–50 (schatting) (indicatie eerste les)", "€40-50", "±€45", "vanaf ongeveer €10"]) {
      const shown = shownPrice(guess, entry, "nl");
      expect(shown, guess).toBe(ASK_PRICE.nl);
      expect(budgetStatusFor(shown, "50"), guess).toBeNull();
    }
    expect(shownPrice("€40-50", entry, "en")).toBe(ASK_PRICE.en);
  });

  it("shows a price the provider's note states", () => {
    expect(priceKind("€12", at("Dineren met onbekenden; tweegangenmenu voor €12"))).toBe("found");
    expect(priceKind("€19,50", at("Sterrenkijkavond. Prijs: €19,50"))).toBe("found");
    expect(priceKind("€12 p.p.", at("diner voor 12 euro"))).toBe("found");
    expect(priceKind("€35–45", at("tour van €35 tot €45"))).toBe("found");
  });

  it("does not take a number that is not the price", () => {
    // another amount, a number that is not money, a range put together from two providers, and a note that is itself an estimate
    expect(priceKind("€35-50", at("zelf lopen met de app: €45"))).toBe("unconfirmed");
    expect(priceKind("€50", at("kamer 50, open sinds 1950"))).toBe("unconfirmed");
    expect(priceKind("€35-50", at("tour €35", "tour €50"))).toBe("unconfirmed");
    expect(priceKind("€12", at("diner €10–15 (schatting)"))).toBe("unconfirmed");
  });

  it("treats 'free' as a claim as well", () => {
    expect(priceKind("Gratis", at("gratis inloopavond"))).toBe("free");
    expect(priceKind("Gratis", { activity_id: "wandelen" })).toBe("free");
    expect(priceKind("Gratis", at("romancursus"))).toBe(priceKind("Gratis", { activity_id: "roman-schrijven" }));
    expect(priceKind("Free", { activity_id: "wijnproeverij" })).toBe("unconfirmed");
  });

  it("applies to the idea and its three sizes, once is as good as twice", () => {
    const entry = {
      ...at("proefles €15"),
      practical: { estimated_cost: "€40-50", duration: "2 uur", difficulty: "easy", preparation: "" },
      sizes: [
        { kind: "taste", title: "Proefles", description: "Eén les.", estimated_cost: "€15", duration: "1 uur" },
        { kind: "course", title: "Cursus", description: "Tien lessen.", estimated_cost: "€100", duration: "10 weken" },
      ],
    } as unknown as IdeaBookEntry;
    const once = withCheckedPrices(entry, "nl");
    expect(once.practical.estimated_cost).toBe(ASK_PRICE.nl);
    expect(once.sizes!.map((s) => s.estimated_cost)).toEqual(["€15", ASK_PRICE.nl]);
    expect(withCheckedPrices(once, "nl")).toEqual(once);
    expect(entry.practical.estimated_cost).toBe("€40-50");
  });

  it("leaves an empty field empty", () => {
    expect(shownPrice("", at(), "nl")).toBe("");
  });
});
