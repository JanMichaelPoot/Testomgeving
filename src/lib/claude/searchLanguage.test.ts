import { describe, expect, it } from "vitest";
import { buildResearchPrompt } from "@/lib/claude/localResearch";
import { searchLanguageFor } from "@/lib/claude/searchLanguage";
import { hintLine } from "@/lib/discovery/searchHints";

// Wernigerode (Germany), 15 Nov 2026: the book found a place for 3 of 15 activities. The prompt said "search in the local language", but its example queries
// ("proefles", "beoordelingen") and every activity's search terms ("Search terms to try (Dutch)") were Dutch. A place abroad is searched with the words of that country.

const NOW = new Date("2026-11-15T10:00:00+01:00");
const flat = (s: string) => s.replace(/\s+/g, " ");

describe("the language a place abroad is searched in", () => {
  it("knows the words a local types, for the countries people search in most", () => {
    expect(searchLanguageFor("DE")?.words.trial).toBe("Probestunde");
    expect(searchLanguageFor("de")?.words.reviews).toBe("Bewertungen");
    expect(searchLanguageFor("FR")?.words.trial).toBe("cours d'essai");
    expect(searchLanguageFor("ES")?.words.near).toBe("cerca de");
    expect(searchLanguageFor("BE")?.name).toContain("Dutch");
    expect(searchLanguageFor("NL")).toBeNull();
    expect(searchLanguageFor(null)).toBeNull();
    expect(searchLanguageFor("MN")).toBeNull();
  });

  it("puts German words in the queries of a German place, and no Dutch ones", () => {
    const text = flat(buildResearchPrompt(["stadsspel", "schilderen"], "Wernigerode", "15km", "nl", NOW, true, [], "Germany", "standard", "DE"));
    expect(text).toContain("(German) (and in English)");
    expect(text).toContain("Probestunde");
    expect(text).toContain("Bewertungen");
    expect(text).toContain("translate each into what people in Germany call it");
    // (The Dutch terms inside an activity's own hint may still say "proefles"; it is the example queries that must not.)
    expect(text).not.toContain("<activity> proefles <place>");
    expect(text).not.toContain("cursus <place> beoordelingen");
    // The Dutch search terms of each activity are handed over as a meaning to translate, not as the words to type.
    expect(text).toContain("Dutch, so put them into German before you search");
  });

  it("says 'the local language' when there is no vocabulary for the country", () => {
    const text = flat(buildResearchPrompt(["yoga"], "Ulaanbaatar", "15km", "en", NOW, false, [], "Mongolia", "standard", "MN"));
    expect(text).toContain("the local language of the country (and in English)");
    expect(text).toContain("translate each into what people in Mongolia call it");
    expect(text).toContain("Dutch, so put them into the local language before you search");
  });

  it("keeps the Dutch prompt as it was", () => {
    const text = flat(buildResearchPrompt(["yoga"], "Utrecht", "15km", "nl", NOW, true));
    expect(text).toContain("proefles");
    expect(text).toContain("beoordelingen");
    expect(text).toContain("Search terms to try (Dutch):");
    expect(text).not.toContain("translate each into");
    expect(hintLine("yoga")).toContain("Search terms to try (Dutch):");
  });
});

describe("the cache version of a place abroad", () => {
  const OLD = new Date("2026-11-20T10:00:00Z").getTime();
  const row = (place_key: string, activity_id: string) => ({ activity_id, place_key, searched_at: "2026-11-15T10:00:00Z", options: [] });

  it("is its own: the answers found with Dutch words (v6) are not read for a German place", async () => {
    const { cacheEpochFor, FOREIGN_CACHE_EPOCH, RESEARCH_CACHE_EPOCH } = await import("@/lib/claude/localResearch");
    expect(cacheEpochFor("de:wernigerode|15km")).toBe(FOREIGN_CACHE_EPOCH);
    expect(cacheEpochFor("utrecht|15km")).toBe(RESEARCH_CACHE_EPOCH);
    expect(FOREIGN_CACHE_EPOCH).not.toBe(RESEARCH_CACHE_EPOCH);
  });

  it("does not let old empty answers make an activity 'quiet' for a German place, but keeps counting the new ones", async () => {
    const { quietActivities } = await import("@/lib/claude/supplyIndex");
    const req = { place: "de:wernigerode", radiusKm: 15 };
    const dutchWords = [row("de:wernigerode|15km|v6", "stadsspel"), row("de:wernigerode|15km|v6|broad", "stadsspel")];
    expect(quietActivities(dutchWords, req, OLD)).toEqual([]);
    const local = [row("de:wernigerode|15km|v7", "stadsspel"), row("de:wernigerode|15km|v7|broad", "stadsspel")];
    expect(quietActivities(local, req, OLD)).toEqual(["stadsspel"]);
    // A Dutch place is untouched.
    expect(quietActivities([row("utrecht|15km|v6", "x"), row("utrecht|15km|v6|broad", "x")], { place: "utrecht", radiusKm: 15 }, OLD)).toEqual(["x"]);
  });
});
