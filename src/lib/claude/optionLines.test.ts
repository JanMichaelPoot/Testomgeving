import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PDFDocument } from "pdf-lib";
import { companionLine, companionsOf, directionLabel } from "@/lib/claude/optionLines";
import { LAYER_LIMITS, normalizeRelated, readStoredLayers, withValidLayers } from "@/lib/claude/ideaLayers";
import { autoFix, relatedIsPlausible } from "@/lib/claude/qualityGate";
import { renderIdeaBookPdf } from "@/lib/pdf/ideaBook";
import { IdeaMore } from "@/components/plan/IdeaMore";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { ALL_ACTIVITIES, getActivity } from "@/lib/discovery/library";
import type { Seed } from "@/lib/discovery/engine/types";
import type { GeneratedIdeaBook, IdeaBookEntry } from "@/lib/claude/ideaBookTypes";

// R1 in the book (docs/plan-activiteitenselectie.md): an idea heads an option of three; its two companions are one line of facts each.

const locales = ["nl", "en"] as const;
const seedWith = (option: Seed["option"]) => ({ activityId: "houtbewerking", direction: "familiar", door: "natural", chain: [], via: [], lead: null, alsoFormats: [], verify: [], option }) as unknown as Seed;

describe("the facts line of a companion", () => {
  it("names the kind, the cost, the duration and how it can be done, from the library, in both languages", () => {
    for (const locale of locales) {
      const copy = getDictionary(locale).venster.more.option;
      const line = companionLine("houtbewerking", locale, copy)!;
      expect(line.id).toBe("houtbewerking");
      expect(line.label).toBe(getActivity("houtbewerking")!.label[locale]);
      expect(line.facts!.split(" · ").length).toBeGreaterThanOrEqual(3);
      expect(line.facts).not.toContain("undefined");
      expect(line.facts).not.toContain("{");
    }
    expect(companionLine("does-not-exist", "nl", getDictionary("nl").venster.more.option)).toBeNull();
  });

  it("fits the limit for every activity of the library, so a facts line is never dropped by the layer check", () => {
    for (const locale of locales) {
      const copy = getDictionary(locale).venster.more.option;
      for (const a of ALL_ACTIVITIES) {
        const line = companionLine(a.id, locale, copy)!;
        expect(line.facts!.length, `${a.id} ${locale}`).toBeLessThanOrEqual(LAYER_LIMITS.facts);
      }
    }
  });

  it("makes the direction of an option from its theme names", () => {
    for (const locale of locales) {
      const copy = getDictionary(locale).venster.more.option;
      expect(directionLabel([], locale, copy)).toBeNull();
      const one = directionLabel(["theme-natuur"], locale, copy)!;
      expect(one.length).toBeGreaterThan(2);
      const two = directionLabel(["theme-natuur", "theme-ambacht"], locale, copy)!;
      expect(two).toContain(copy.and.trim());
      expect(two).toContain(one);
      expect(two.length).toBeLessThanOrEqual(LAYER_LIMITS.direction);
    }
  });

  it("takes the companions of a seed in order and nothing for a seed without an option", () => {
    const copy = getDictionary("nl").venster.more.option;
    expect(companionsOf(seedWith({ for: "houtbewerking", themes: [], companions: ["wandelen", "yoga"] }), "nl", copy).map((c) => c.id)).toEqual(["wandelen", "yoga"]);
    expect(companionsOf(seedWith(undefined), "nl", copy)).toEqual([]);
  });
});

describe("the stored layers with facts and a direction", () => {
  it("keeps them, drops rubbish, and reads an older book without them", () => {
    const stored = { related: [{ id: "yoga", label: "Yoga", facts: "Bewegen · gratis" }, { id: "x", label: "X", facts: "a".repeat(LAYER_LIMITS.facts + 1) }], direction: "natuur + ambacht" };
    const layers = readStoredLayers(stored);
    expect(layers.related).toEqual([{ id: "yoga", label: "Yoga", facts: "Bewegen · gratis" }, { id: "x", label: "X" }]);
    expect(layers.direction).toBe("natuur + ambacht");
    expect(readStoredLayers({ direction: "a".repeat(LAYER_LIMITS.direction + 1) }).direction).toBeUndefined();
    expect(readStoredLayers({ related: [{ id: "yoga", label: "Yoga" }] })).toEqual({ related: [{ id: "yoga", label: "Yoga" }] });
    expect(normalizeRelated([{ id: "a", label: "A", facts: 5 }])).toEqual([{ id: "a", label: "A" }]);
    const entry = withValidLayers({ title: "t", direction: "x", related: [{ id: "a", label: "A", facts: "f" }] } as unknown as IdeaBookEntry);
    expect(entry.direction).toBe("x");
  });
});

const entryBase = (): IdeaBookEntry =>
  ({
    title: "Hout bewerken",
    intro: "Een middag.",
    why_it_fits: "Je koos hout.",
    details: ["Zoek een atelier."],
    first_action: "Boek een proefles.",
    practical: { estimated_cost: "€35", duration: "2 uur", difficulty: "easy", preparation: "" },
    location: null,
    requirements: [],
    image_suggestion: "",
    photo_category: "creative_workshop",
    door: "natural",
    scores: { relevance: 70, novelty: 60, feasibility: 75, surprise: 50, shareability: 60, effort: 50, cost: 40, social_fit: 60, challenge_level: 50 },
    activity_id: "houtbewerking",
  }) as unknown as IdeaBookEntry;

const wrap = (e: IdeaBookEntry): GeneratedIdeaBook => ({
  profile_summary: "S.",
  must_haves: [],
  preferences: [],
  ideas: [1, 2, 3, 4].map((n) => ({ ...e, title: `Idee ${n}` })),
  wildcard: { ...e, title: "Wildcard", door: "wildcard" },
  labels: { steps_heading: "", first_action_heading: "", wildcard_heading: "", time_label: "", cost_label: "", location_heading: "", requirements_heading: "" },
});

describe("the quality gate and the companions", () => {
  it("keeps an option companion that shares no tag with the idea, and still drops an unrelated item from the graph", () => {
    const stranger = "tandem-parachute";
    expect(relatedIsPlausible(getActivity("houtbewerking"), stranger)).toBe(false);
    const kept = autoFix(wrap({ ...entryBase(), related: [{ id: stranger, label: "Parachute", facts: "Bewegen · meer dan €50" }] }), "nl").book.ideas[0];
    expect(kept.related).toHaveLength(1);
    const dropped = autoFix(wrap({ ...entryBase(), related: [{ id: stranger, label: "Parachute" }] }), "nl").book.ideas[0];
    expect(dropped.related).toBeUndefined();
  });
});

describe("the option in the web page and the PDF", () => {
  const withOption = (): IdeaBookEntry => ({
    ...entryBase(),
    feels_like: "Koel. Stil.",
    direction: "natuur + ambacht en handwerk",
    related: [
      { id: "wandelen", label: "Wandelen", facts: "Erop uit en ontdekken · gratis · 1 tot 3 uur · zelf te doen" },
      { id: "yoga", label: "Yoga", facts: "Bewegen en sporten · tot €15 · 1 tot 3 uur · via een aanbieder of plek" },
    ],
  });

  it("shows the direction as the heading and each companion with its facts line (and the old pills for an older book)", () => {
    const copy = getDictionary("nl").venster.more;
    const html = renderToStaticMarkup(createElement(IdeaMore, { idea: withOption(), copy }));
    expect(html).toContain("In deze richting: natuur + ambacht en handwerk");
    expect(html).toContain("Wandelen");
    expect(html).toContain("zelf te doen");
    expect(html).toContain("via een aanbieder of plek");
    expect(html).not.toContain(copy.relatedHeading);
    const old = { ...withOption(), direction: undefined, related: [{ id: "wandelen", label: "Wandelen" }] } as IdeaBookEntry;
    const oldHtml = renderToStaticMarkup(createElement(IdeaMore, { idea: old, copy }));
    expect(oldHtml).toContain(copy.relatedHeading);
    expect(oldHtml).not.toContain("In deze richting");
  });

  it("draws the option on the same extra page of the PDF, so an idea with companions still adds exactly one page", async () => {
    const plain = { ...withOption(), direction: undefined, related: undefined } as IdeaBookEntry;
    const pages = async (b: GeneratedIdeaBook, l: "nl" | "en") => (await PDFDocument.load(await renderIdeaBookPdf(b, "Titel", l))).getPageCount();
    for (const l of ["nl", "en"] as const) expect(await pages(wrap(withOption()), l)).toBe(await pages(wrap(plain), l));
  }, 90_000);
});
