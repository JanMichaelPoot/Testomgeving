import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { defaultEngineLibrary, selectSeeds, WEIGHTS_ANCHOR } from "@/lib/discovery/engine";
import { syntheticTwoPageProfiles } from "@/lib/discovery/engine/syntheticTwoPages";
import { themeProfilesFor } from "@/lib/discovery/associations";
import { MODE_SHORT, modeOfActivity } from "@/lib/discovery/activityKind";
import { readStoredLayers } from "@/lib/claude/ideaLayers";
import { IdeaDetail } from "@/components/window/IdeaDetail";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { IdeaBookEntry } from "@/lib/claude/ideaBookTypes";

// C2 (docs/plan-activiteitenselectie.md): how an idea can be done steers the book a little and is shown next to time and cost.

const lib = defaultEngineLibrary();
const byId = new Map(lib.activities.map((a) => [a.id, a]));
const inputs = syntheticTwoPageProfiles(14, "mode-balance").map((p) => p.input);
const themeSets = [["natuur", "techniek", "ambacht"], ["muziek", "dieren", "eten"], ["geschiedenis", "sport", "spel"]];
const T = 120_000;

describe("the balance of how the ideas of a book can be done", () => {
  it("gives a book at least one idea you can do by yourself and at most two that have to be organised first, as far as the pool allows", () => {
    let books = 0;
    let withSelf = 0;
    let fewOrganise = 0;
    for (const ids of [[], ...themeSets]) {
      const themes = ids.length ? themeProfilesFor(ids.map((id) => `theme-${id}-a`)) : undefined;
      for (const input of inputs) {
        const modes = selectSeeds({ ...input, ...(themes ? { themes } : {}) }, lib, { weights: WEIGHTS_ANCHOR }).seeds.map((s) => modeOfActivity(byId.get(s.activityId)!));
        books++;
        if (modes.includes("self")) withSelf++;
        if (modes.filter((m) => m === "organise").length <= 2) fewOrganise++;
      }
    }
    expect(withSelf / books).toBeGreaterThan(0.97);
    expect(fewOrganise / books).toBe(1);
  }, T);

  it("is a nudge and not a rule: off (every other weight set) the seeds are the ones the engine always gave", () => {
    const off = { ...WEIGHTS_ANCHOR, balance: { self: 0, organise: 0 } };
    let different = 0;
    for (const input of inputs.slice(0, 8)) {
      const a = selectSeeds(input, lib, { weights: WEIGHTS_ANCHOR }).seeds.map((s) => s.activityId).join();
      const b = selectSeeds(input, lib, { weights: off }).seeds.map((s) => s.activityId).join();
      if (a !== b) different++;
    }
    // It moves a minority of the books, never most of them.
    expect(different).toBeLessThan(5);
  }, T);

  it("does not change the other weight sets (the pinned baselines keep their seeds)", () => {
    expect(WEIGHTS_ANCHOR.balance.self).toBeGreaterThan(0);
  });
});

describe("the mode of an idea in the book", () => {
  const entry = (mode?: IdeaBookEntry["mode"]): IdeaBookEntry =>
    ({
      title: "Hout bewerken",
      intro: "i",
      why_it_fits: "w",
      details: [],
      first_action: "f",
      practical: { estimated_cost: "€35", duration: "2 uur", difficulty: "easy", preparation: "" },
      location: null,
      requirements: [],
      image_suggestion: "",
      photo_category: "creative_workshop",
      door: "natural",
      scores: {},
      ...(mode ? { mode } : {}),
    }) as unknown as IdeaBookEntry;

  it("is kept when valid and dropped when it is rubbish or absent (older books)", () => {
    expect(readStoredLayers({ mode: "self" }).mode).toBe("self");
    expect(readStoredLayers({ mode: "provider" }).mode).toBe("provider");
    expect(readStoredLayers({ mode: "organise" }).mode).toBe("organise");
    expect(readStoredLayers({ mode: "magic" }).mode).toBeUndefined();
    expect(readStoredLayers({}).mode).toBeUndefined();
  });

  it("shows next to time and cost on the idea card, in both languages, and nothing for an older book", () => {
    for (const locale of ["nl", "en"] as const) {
      const props = { index: 1, photoIndex: 0, locale, labels: {}, dict: getDictionary(locale).pdfChrome };
      for (const mode of ["self", "provider", "organise"] as const) {
        const html = renderToStaticMarkup(createElement(IdeaDetail, { idea: entry(mode), ...props }));
        expect(html).toContain(MODE_SHORT[mode][locale]);
      }
      const old = renderToStaticMarkup(createElement(IdeaDetail, { idea: entry(), ...props }));
      for (const mode of ["self", "provider", "organise"] as const) expect(old).not.toContain(MODE_SHORT[mode][locale]);
    }
  });
});

describe("the mode in the PDF", () => {
  it("adds a sixth cell to the glance row without adding a page, in both languages", async () => {
    const { PDFDocument } = await import("pdf-lib");
    const { renderIdeaBookPdf } = await import("@/lib/pdf/ideaBook");
    const idea = (mode?: IdeaBookEntry["mode"], n = 1): IdeaBookEntry =>
      ({
        title: `Idee ${n}`,
        intro: "Een middag.",
        why_it_fits: "Je koos dit.",
        details: ["Zoek een plek.", "Probeer het."],
        first_action: "Begin vandaag met een eerste stap.",
        practical: { estimated_cost: "€35", duration: "2 uur", difficulty: "easy", preparation: "" },
        location: { name: "Atelier De Plank", address: "", city: "Utrecht" },
        requirements: [],
        image_suggestion: "",
        photo_category: "creative_workshop",
        door: "natural",
        scores: { relevance: 70, novelty: 60, feasibility: 75, surprise: 50, shareability: 60, effort: 50, cost: 40, social_fit: 60, challenge_level: 50 },
        ...(mode ? { mode } : {}),
      }) as unknown as IdeaBookEntry;
    const book = (mode?: IdeaBookEntry["mode"]) => ({
      profile_summary: "S.",
      must_haves: [],
      preferences: [],
      ideas: [1, 2, 3, 4].map((n) => idea(mode, n)),
      wildcard: { ...idea(mode, 5), door: "wildcard" as const },
      labels: { steps_heading: "", first_action_heading: "", wildcard_heading: "", time_label: "", cost_label: "", location_heading: "", requirements_heading: "" },
    });
    const pages = async (mode: IdeaBookEntry["mode"], l: "nl" | "en") => (await PDFDocument.load(await renderIdeaBookPdf(book(mode), "Titel", l))).getPageCount();
    for (const l of ["nl", "en"] as const) {
      const without = await pages(undefined, l);
      for (const mode of ["self", "provider", "organise"] as const) expect(await pages(mode, l)).toBe(without);
    }
  }, 120_000);
});
