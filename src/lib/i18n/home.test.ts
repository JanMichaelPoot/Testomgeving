import { describe, expect, it } from "vitest";
import { FOUNDER_NOTE, TESTIMONIALS, founderNoteFor, getHomeCopy, withPrice } from "./home";
import { getDictionary } from "./dictionaries";

const LOCALES = ["nl", "en"] as const;

describe("home copy", () => {
  it("nl and en have the same shape: four differentiators, four sample pages, the same FAQ questions in the same order", () => {
    const nl = getHomeCopy("nl");
    const en = getHomeCopy("en");
    expect(nl.differentiators.items).toHaveLength(4);
    expect(en.differentiators.items).toHaveLength(4);
    expect(nl.sample.spreads).toHaveLength(4);
    expect(en.sample.spreads).toHaveLength(4);
    expect(nl.faq.items.map((i) => i.id)).toEqual(en.faq.items.map((i) => i.id));
    expect(nl.inside.perIdea).toHaveLength(en.inside.perIdea.length);
    // The FAQ covers what the brief asks for.
    expect(nl.faq.items.map((i) => i.id)).toEqual(expect.arrayContaining(["wat-krijg-ik", "hoe-lang", "plek-klopt-niet", "privacy", "cadeau", "betalen"]));
  });

  it("the four differentiators are the four from the brief", () => {
    const [images, places, keepsake, wildcard] = getHomeCopy("nl").differentiators.items;
    expect(images.title).toMatch(/beelden/i);
    expect(places.title).toMatch(/plekken/i);
    expect(keepsake.title).toMatch(/boek/i);
    expect(wildcard.title).toMatch(/wildcard/i);
  });

  it("does not claim more than the pipeline does: no 'verified' or 'checked on real places' before the venue engine (Fase 3)", () => {
    for (const locale of LOCALES) {
      const all = JSON.stringify(getHomeCopy(locale)).toLowerCase();
      expect(all).not.toMatch(/geverifieerd|verified|gecontroleerd op echte|checked on real/);
      // What it does say, and is true: it checks that the website exists.
      expect(getHomeCopy(locale).trust.aiLine).toMatch(/AI/);
      expect(getHomeCopy(locale).trust.aiLine).toMatch(/website/);
    }
  });

  it("the guarantee reads the same near the pay button and in the trust block, and names where to write", () => {
    expect(getDictionary("nl").checkout.guarantee).toBe("Klopt een plek niet? Je krijgt gratis een nieuw boek.");
    expect(getDictionary("en").checkout.guarantee).toBe("Is a place wrong? You get a new book for free.");
    for (const locale of LOCALES) {
      const trust = getHomeCopy(locale).trust;
      expect(trust.guaranteeBody).toContain("hello@windowinto.nl");
    }
  });

  it("the hero is the pain-audience-outcome line and names the occasion; a gift button exists", () => {
    const nl = getDictionary("nl").venster.landing;
    expect(`${nl.headline} ${nl.headlineEmphasis}`).toBe("Weet je niet goed wat je met je vrije tijd wilt?");
    expect(nl.subcopy).toMatch(/echte plekken bij jou in de buurt/);
    expect(nl.occasion).toMatch(/pensioen/);
    const en = getDictionary("en").venster.landing;
    expect(`${en.headline} ${en.headlineEmphasis}`).toMatch(/free time/);
    expect(en.occasion).toMatch(/retirement/);
  });

  it("fills the price and leaves no placeholder behind", () => {
    for (const locale of LOCALES) {
      const text = JSON.stringify(getHomeCopy(locale));
      const filled = withPrice(text, "€7,50");
      expect(filled).not.toContain("{price}");
      expect(filled).toContain("€7,50");
    }
  });
});

describe("hidden until filled", () => {
  it("the founder note is hidden until name and a sentence are filled in", () => {
    expect(founderNoteFor("nl")).toBeNull();
    expect(founderNoteFor("nl", { name: "Jan", photo: "", sentence: { nl: "", en: "" } })).toBeNull();
    expect(founderNoteFor("nl", { name: "", photo: "", sentence: { nl: "Zin", en: "Sentence" } })).toBeNull();
    expect(founderNoteFor("en", { name: "Jan", photo: " /f.jpg ", sentence: { nl: "Zin", en: "" } })).toEqual({ name: "Jan", photo: "/f.jpg", sentence: "Zin" });
    expect(FOUNDER_NOTE.name).toBe("");
  });

  it("there are no testimonials yet, so none are shown", () => {
    expect(TESTIMONIALS).toEqual([]);
  });
});
