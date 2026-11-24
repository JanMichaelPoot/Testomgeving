import { describe, expect, it } from "vitest";
import type { IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import { ideaCardPath, ideaPhotoIndex, ideaShareLink, ideaSharePath, parseShareTarget, resolveShared, shortExplanation, truncateAtWord } from "@/lib/ideaShare";
import { getIdeaShareCopy } from "@/lib/i18n/ideaShare";

const PLAN = "11111111-2222-3333-4444-555555555555";
const idea = (over: Partial<IdeaBookEntry> = {}) => ({ title: "Kanoën", intro: "", why_it_fits: "", ...over }) as IdeaBookEntry;

describe("shortExplanation", () => {
  it("prefers the idea's own intro, else the first sentence of why it fits", () => {
    expect(shortExplanation(idea({ intro: " Even het water op. ", why_it_fits: "Iets anders." }))).toBe("Even het water op.");
    expect(shortExplanation(idea({ why_it_fits: "Je houdt van water. En van stilte." }))).toBe("Je houdt van water.");
    expect(shortExplanation(idea({ why_it_fits: "Geen punt aan het einde" }))).toBe("Geen punt aan het einde");
  });
});

describe("truncateAtWord", () => {
  it("leaves a short text alone and flattens white space", () => {
    expect(truncateAtWord("  een   korte\nzin ", 50)).toBe("een korte zin");
  });
  it("cuts at a word boundary with an ellipsis, within the maximum", () => {
    const out = truncateAtWord("de kano glijdt langzaam door het riet en de reigers kijken toe", 30);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(30);
    expect(out).toBe("de kano glijdt langzaam door…");
  });
  it("does not leave a comma or dash before the ellipsis", () => {
    expect(truncateAtWord("eerst dit, daarna dat, en dan nog iets heel anders", 21)).toBe("eerst dit, daarna…");
  });
  it("cuts a single very long word instead of failing", () => {
    expect(truncateAtWord("x".repeat(100), 20)).toHaveLength(20);
  });
});

describe("parseShareTarget", () => {
  it("accepts a plan id with a real idea key", () => {
    expect(parseShareTarget(PLAN, "idea-3")).toEqual({ planId: PLAN, key: "idea-3" });
    expect(parseShareTarget(PLAN, "wildcard")).toEqual({ planId: PLAN, key: "wildcard" });
  });
  it("refuses anything else before it can reach the database", () => {
    for (const bad of ["", "idea-", "idea-123", "idea--1", "../etc", "idea-1/../x", "WILDCARD", undefined, null, 4, ["idea-1"]]) expect(parseShareTarget(PLAN, bad)).toBeNull();
    for (const bad of ["not-an-id", "'; drop table window_plans;--", "", undefined, 5]) expect(parseShareTarget(bad, "idea-1")).toBeNull();
  });
});

describe("addresses", () => {
  it("builds the page, the card and the link with where it came from", () => {
    expect(ideaSharePath(PLAN, "idea-2")).toBe(`/shared/${PLAN}/idee/idea-2`);
    expect(ideaCardPath(PLAN, "idea-2")).toBe(`/shared/${PLAN}/idee/idea-2/opengraph-image`);
    expect(ideaShareLink("https://windowinto.nl", PLAN, "wildcard")).toBe(`https://windowinto.nl/shared/${PLAN}/idee/wildcard?utm_source=window_share&utm_medium=idea_card`);
  });
});

describe("resolveShared", () => {
  const ideas = [idea({ title: "Een" }), idea({ title: "Twee" })];
  const wildcard = idea({ title: "Wild" });
  it("finds an idea with the index of its photo, and the wildcard after the last idea", () => {
    expect(resolveShared("idea-1", ideas, wildcard)).toMatchObject({ idea: { title: "Twee" }, photoIndex: 1, isWildcard: false });
    expect(resolveShared("wildcard", ideas, wildcard)).toMatchObject({ idea: { title: "Wild" }, photoIndex: 2, isWildcard: true });
    expect(ideaPhotoIndex("wildcard", 4)).toBe(4);
  });
  it("is null for an idea the book does not have", () => {
    expect(resolveShared("idea-5", ideas, wildcard)).toBeNull();
    expect(resolveShared("wildcard", ideas, null)).toBeNull();
    expect(resolveShared("nonsense", ideas, wildcard)).toBeNull();
  });
});

describe("the idea card's copy", () => {
  it("has every line in both languages with the same placeholders, and never says WINDOW", () => {
    const nl = getIdeaShareCopy("nl");
    const en = getIdeaShareCopy("en");
    expect(Object.keys(nl).sort()).toEqual(Object.keys(en).sort());
    const holes = (s: string) => (s.match(/\{[a-z]+\}/g) ?? []).sort().join();
    for (const k of Object.keys(nl) as (keyof typeof nl)[]) {
      expect(nl[k].length, `nl.${k}`).toBeGreaterThan(0);
      expect(holes(nl[k]), k).toBe(holes(en[k]));
      expect(`${nl[k]} ${en[k]}`).not.toMatch(/\bWINDOW\b(?!into)/);
    }
    expect(nl.shareText).toContain("{title}");
  });
});
