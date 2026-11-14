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
    expect(nl.faq.items.map((i) => i.id)).toEqual(expect.arrayContaining(["wat-krijg-ik", "hoe-lang", "plek-klopt-niet", "privacy", "betalen"]));
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

  it("the guarantee stands under the pay button, and the homepage no longer carries a guarantee card or a 'no reviews yet' line", () => {
    expect(getDictionary("nl").checkout.payAssurance).toMatch(/binnen 2 minuten/);
    expect(getDictionary("en").checkout.payAssurance).toMatch(/within 2 minutes/);
    for (const locale of LOCALES) {
      const trust = getHomeCopy(locale).trust as Record<string, unknown>;
      expect("guaranteeTitle" in trust).toBe(false);
      expect("guaranteeBody" in trust).toBe(false);
      expect("noReviews" in trust).toBe(false);
    }
  });

  it("the hero invites discovery without suggesting a problem, and offers no gift route", () => {
    const nl = getDictionary("nl").venster.landing;
    expect(`${nl.headline} ${nl.headlineEmphasis}`).toBe("Wat als je iets ontdekt waarvan je nog niet wist dat het bij je past?");
    expect(nl.subcopy).toMatch(/echte plekken bij jou in de buurt/);
    const en = getDictionary("en").venster.landing;
    expect(`${en.headline} ${en.headlineEmphasis}`).toMatch(/discover something you didn't know/);
    for (const d of [nl, en]) {
      expect(JSON.stringify(d)).not.toMatch(/vrije tijd|free time|cadeau|gift|pensioen|retirement/i);
      expect("giftCta" in d).toBe(false);
      expect("occasion" in d).toBe(false);
    }
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
