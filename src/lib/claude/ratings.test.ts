import { describe, expect, it } from "vitest";
import { adjustedScore, buildResearchPrompt, cleanOptions, rankOptions, type LocalOption } from "@/lib/claude/localResearch";
import { cleanRating } from "@/lib/claude/rating";
import { normalizePlaces } from "@/lib/claude/ideaLayers";

// Real options only, and the best rated of them: ratings (shown only when a search result showed them), ranking, and the
// rules the research prompt gives the model.

const NOW = new Date("2026-10-25T10:00:00Z");
const base = (name: string): LocalOption => ({ name, city: "Madrid", url: `https://${name.toLowerCase().replace(/\W/g, "")}.es`, note: "", until: null, rating: null });
const rated = (name: string, score: number | null, reviews: number | null = 100): LocalOption => ({ ...base(name), rating: score === null ? null : { score, reviews, source: "Google" } });

describe("ratings", () => {
  it("accepts a score only with a named source, on a scale of 5 or 10, and normalises it to 0-5", () => {
    expect(cleanRating({ score: 4.6, scale: 5, reviews: 312, source: "Google" })).toEqual({ score: 4.6, reviews: 312, source: "Google" });
    expect(cleanRating({ score: 8.4, scale: 10, reviews: null, source: "Tripadvisor" })).toEqual({ score: 4.2, reviews: null, source: "Tripadvisor" });
    expect(cleanRating({ score: 4.6, scale: 5 })).toBeNull(); // no source: not a rating
    expect(cleanRating({ score: 4.6, scale: 5, source: "  " })).toBeNull();
    expect(cleanRating({ score: 4.6, scale: 100, source: "Google" })).toBeNull();
    expect(cleanRating({ score: 7, scale: 5, source: "Google" })).toBeNull();
    expect(cleanRating({ score: 0.2, scale: 5, source: "Google" })).toBeNull();
    expect(cleanRating("4.5 stars")).toBeNull();
    expect(cleanRating(null)).toBeNull();
  });

  it("puts the best rated first and does not let a few reviews beat many", () => {
    const ranked = rankOptions([rated("Few", 5.0, 3), rated("Many", 4.7, 800), rated("Mid", 4.4, 100)]);
    expect(ranked.map((o) => o.name)).toEqual(["Many", "Mid", "Few"]);
    expect(adjustedScore({ score: 5, reviews: 3, source: "x" })).toBeLessThan(adjustedScore({ score: 4.7, reviews: 800, source: "x" }));
  });

  it("keeps unrated options after the rated ones, in the order given", () => {
    expect(rankOptions([rated("U1", null), rated("R", 4.5), rated("U2", null)]).map((o) => o.name)).toEqual(["R", "U1", "U2"]);
  });

  it("drops a poorly rated option when a good one exists, but keeps it when it is all there is", () => {
    expect(rankOptions([rated("Poor", 2.8, 200), rated("Good", 4.5, 200)]).map((o) => o.name)).toEqual(["Good"]);
    expect(rankOptions([rated("Poor", 2.8, 200)]).map((o) => o.name)).toEqual(["Poor"]);
  });

  it("keeps at most three, the best of up to six candidates, and is stable when applied twice", () => {
    const six = ["A", "B", "C", "D", "E", "F"].map((n, i) => ({ name: n, url: `https://${n.toLowerCase()}.nl`, rating: { score: 3.8 + i * 0.2, scale: 5, reviews: 100, source: "Google" } }));
    const once = cleanOptions(six);
    expect(once.map((o) => o.name)).toEqual(["F", "E", "D"]);
    expect(cleanOptions(once)).toEqual(once);
  });

  it("reads a rating from a stored (already normalised) option too, so the cache keeps it", () => {
    const [o] = cleanOptions([{ name: "X", rating: { score: 4.3, reviews: 12, source: "Google" } }]);
    expect(o.rating).toEqual({ score: 4.3, reviews: 12, source: "Google" });
  });

  it("carries a valid rating into the places of a book, and leaves a bad one out", () => {
    const places = normalizePlaces([
      { name: "A", city: "Madrid", rating: { score: 4.5, reviews: 10, source: "Google" } },
      { name: "B", city: "Madrid", rating: { score: 4.5, reviews: 10 } },
    ]);
    expect(places[0].rating).toEqual({ score: 4.5, reviews: 10, source: "Google" });
    expect(places[1].rating).toBeUndefined();
  });
});

describe("the research prompt asks for real, open, local and best rated", () => {
  const prompt = buildResearchPrompt(["schaken"], "Madrid, Spain", "city", "en", NOW).replace(/\s+/g, " ");

  it("treats an empty answer as correct and forbids a substitute in another city or country", () => {
    expect(prompt).toContain("options list for that activity is empty");
    expect(prompt).toContain("Never offer a venue in another city or country as a substitute");
    expect(prompt).toContain("permanently closed");
  });

  it("asks for ratings only from the search results, never estimated", () => {
    expect(prompt).toContain("Never estimate or remember a score");
    expect(prompt).toContain('"rating"');
  });

  it("does not pin the search to the Netherlands for a place elsewhere", () => {
    expect(prompt).toContain("Place: Madrid, Spain");
    expect(prompt).not.toContain("in the Netherlands");
  });
});
