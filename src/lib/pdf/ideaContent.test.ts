import { describe, expect, it } from "vitest";
import { PHOTO_CATEGORIES, type IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import {
  EXPERIENCE_DIMENSIONS,
  activityKindFor,
  budgetStatusFor,
  editorialFor,
  experienceProfileFor,
  extractUrl,
  ideaPageLabels,
  kindCopy,
  parseDurationHours,
  parseMaxCost,
  pickStable,
  scheduleFor,
  type ActivityKind,
} from "./ideaContent";

const scores = (over: Partial<IdeaBookEntry["scores"]> = {}): IdeaBookEntry["scores"] => ({
  relevance: 50,
  novelty: 50,
  feasibility: 50,
  surprise: 50,
  shareability: 50,
  effort: 50,
  cost: 50,
  social_fit: 50,
  challenge_level: 50,
  ...over,
});

const idea = (over: Partial<Pick<IdeaBookEntry, "photo_category" | "door" | "scores">> = {}) => ({
  photo_category: "creative_workshop" as const,
  door: "discovery" as const,
  scores: scores(),
  ...over,
});

describe("activityKindFor", () => {
  it("types every photo category", () => {
    for (const category of PHOTO_CATEGORIES) {
      expect(activityKindFor({ photo_category: category })).toBeTruthy();
    }
  });
});

describe("experienceProfileFor", () => {
  it("keeps every dimension within 1-5, even for extreme scores", () => {
    const extremes = [scores({ novelty: 0, effort: 0, challenge_level: 0 }), scores({ novelty: 100, effort: 100, challenge_level: 100 })];
    for (const category of PHOTO_CATEGORIES) {
      for (const s of extremes) {
        for (const door of ["natural", "discovery", "unexpected", "stretch", "wildcard"] as const) {
          const profile = experienceProfileFor({ photo_category: category, door, scores: s });
          for (const d of EXPERIENCE_DIMENSIONS) {
            expect(profile[d]).toBeGreaterThanOrEqual(1);
            expect(profile[d]).toBeLessThanOrEqual(5);
            expect(Number.isInteger(profile[d])).toBe(true);
          }
        }
      }
    }
  });

  it("puts a wildcard further outside the comfort zone than a familiar idea", () => {
    const familiar = experienceProfileFor(idea({ door: "natural", scores: scores({ challenge_level: 10 }) }));
    const wild = experienceProfileFor(idea({ door: "wildcard", scores: scores({ challenge_level: 90 }) }));
    expect(wild.comfortZone).toBeGreaterThan(familiar.comfortZone);
  });

  it("makes a demanding idea less calm", () => {
    const easy = experienceProfileFor(idea({ scores: scores({ effort: 10 }) }));
    const hard = experienceProfileFor(idea({ scores: scores({ effort: 95 }) }));
    expect(hard.calm).toBeLessThan(easy.calm);
  });

  it("caps the social stimulus when the person goes alone", () => {
    const social = idea({ photo_category: "social_games" });
    expect(experienceProfileFor(social).social).toBe(5);
    expect(experienceProfileFor(social, { company: ["alone"] }).social).toBeLessThanOrEqual(2);
    expect(experienceProfileFor(social, { company: ["alone", "friends"] }).social).toBe(5);
  });
});

describe("budget", () => {
  it("reads the highest amount in a free-text cost", () => {
    expect(parseMaxCost("€35–50 p.p.")).toBe(50);
    expect(parseMaxCost("Circa €7,50 per persoon")).toBe(7.5);
    expect(parseMaxCost("Gratis")).toBe(0);
    expect(parseMaxCost("Free")).toBe(0);
    expect(parseMaxCost("op aanvraag")).toBeNull();
  });

  it("compares it with the budget the person chose", () => {
    expect(budgetStatusFor("€10–20", "25")).toBe("within");
    expect(budgetStatusFor("€30", "25")).toBe("slightlyAbove");
    expect(budgetStatusFor("€120", "25")).toBe("above");
    expect(budgetStatusFor("Gratis", "free")).toBe("within");
    expect(budgetStatusFor("€5", "free")).toBe("above");
    expect(budgetStatusFor("€500", "allin")).toBe("within");
  });

  it("stays silent when it cannot tell", () => {
    expect(budgetStatusFor("op aanvraag", "25")).toBeNull();
    expect(budgetStatusFor("€10", undefined)).toBeNull();
    expect(budgetStatusFor("€10", "unknown")).toBeNull();
  });
});

describe("parseDurationHours / scheduleFor", () => {
  it("reads common duration phrasings in both languages", () => {
    expect(parseDurationHours("2-3 uur")).toBe(3);
    expect(parseDurationHours("1–2 hours")).toBe(2);
    expect(parseDurationHours("Een dagdeel")).toBe(4);
    expect(parseDurationHours("Half a day")).toBe(4);
    expect(parseDurationHours("Een heel weekend")).toBe(24);
    expect(parseDurationHours("ongeveer")).toBeNull();
  });

  it("gives three steps to a short idea and four otherwise", () => {
    expect(scheduleFor("food", "1 uur", "nl")).toHaveLength(3);
    expect(scheduleFor("food", "2-3 uur", "nl")).toHaveLength(4);
    expect(scheduleFor("food", "", "nl")).toHaveLength(4);
  });
});

describe("extractUrl", () => {
  it("pulls a web address out of a sentence", () => {
    expect(extractUrl("Open steckutrecht.nl en boek een plek.")).toEqual({
      display: "steckutrecht.nl",
      href: "https://steckutrecht.nl",
    });
    expect(extractUrl("Ga naar https://www.example.com/tijden.")).toEqual({
      display: "www.example.com/tijden",
      href: "https://www.example.com/tijden",
    });
  });

  it("does not mistake abbreviations for addresses", () => {
    expect(extractUrl("€35–50 p.p. en e.g. zo")).toBeNull();
    expect(extractUrl("Zoek 'pottenbakken workshop' + je woonplaats")).toBeNull();
  });
});

describe("content libraries", () => {
  const kinds: ActivityKind[] = ["creative", "cultural", "outdoor", "active", "water", "food", "social", "restful", "adventure", "market"];

  it("has complete nl and en copy for every kind", () => {
    for (const locale of ["nl", "en"] as const) {
      for (const kind of kinds) {
        const copy = kindCopy(kind, locale);
        expect(copy.label).toBeTruthy();
        expect(copy.timeline.every(Boolean)).toBe(true);
        expect(copy.takeaways.length).toBeGreaterThanOrEqual(3);
        expect(copy.suggestions.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("keeps the micro-editorial short (15-25 words is the brief; never longer)", () => {
    for (const locale of ["nl", "en"] as const) {
      for (const door of ["natural", "discovery", "unexpected", "stretch", "wildcard"] as const) {
        for (const seed of ["a", "b", "c", "d"]) {
          const { text } = editorialFor(door, seed, locale);
          const words = text.split(/\s+/).length;
          expect(words).toBeGreaterThanOrEqual(10);
          expect(words).toBeLessThanOrEqual(25);
        }
      }
    }
  });

  it("has every page label in both languages", () => {
    for (const locale of ["nl", "en"] as const) {
      const labels = ideaPageLabels(locale);
      for (const value of Object.values(labels)) {
        if (typeof value === "string") expect(value).toBeTruthy();
      }
      expect(Object.values(labels.dimensions).every(Boolean)).toBe(true);
    }
  });
});

describe("pickStable", () => {
  const items = ["a", "b", "c", "d", "e"];

  it("is deterministic for the same seed and returns distinct items", () => {
    const first = pickStable(items, 3, "Pottenbakken");
    expect(pickStable(items, 3, "Pottenbakken")).toEqual(first);
    expect(new Set(first).size).toBe(3);
  });

  it("returns everything when there are not enough items", () => {
    expect(pickStable(["a", "b"], 3, "x")).toEqual(["a", "b"]);
  });
});
