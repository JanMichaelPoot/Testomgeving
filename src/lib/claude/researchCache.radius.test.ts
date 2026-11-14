import { describe, expect, it, vi } from "vitest";
import { RESEARCH_CACHE_EPOCH, radiusKeys, researchSeeds, type LocalOption, type ResearchCache } from "@/lib/claude/localResearch";

// Cache hygiene (Stap 195, R2 of docs/kostenonderzoek-boekgeneratie.md): no month in the key, and an answer for one radius also serves the radii it is
// valid for. Nothing here touches the network: the model call is replaced by `search`.

function memoryCache(initial: Record<string, LocalOption[]> = {}) {
  const store = new Map<string, LocalOption[]>(Object.entries(initial));
  const cache: ResearchCache = {
    async get(ids, place) {
      const out = new Map<string, LocalOption[]>();
      for (const id of ids) {
        const hit = store.get(`${id}|${place}`);
        if (hit) out.set(id, hit);
      }
      return out;
    },
    async getAcross(ids, keys) {
      const out = new Map<string, { key: string; options: LocalOption[] }[]>();
      for (const id of ids) for (const key of keys) {
        const hit = store.get(`${id}|${key}`);
        if (hit) out.set(id, [...(out.get(id) ?? []), { key, options: hit }]);
      }
      return out;
    },
    async put(entries, place) {
      for (const e of entries) store.set(`${e.activityId}|${place}`, e.options);
    },
  };
  return { cache, store };
}

const opt = (name: string): LocalOption => ({ name, city: "Utrecht", url: `https://${name.toLowerCase().replace(/\W/g, "")}.nl`, note: "workshop", until: null, rating: null });
const NOW = new Date("2026-10-25T10:00:00Z");
// A request for 25 km around Utrecht.
const args = { location: "Utrecht", searchDistance: "city", searchDistanceKm: 25, locale: "nl" as const, verify: false as const, now: NOW };
const searchAll = () => vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, [opt(`Nieuw ${id}`)]])));

describe("radiusKeys", () => {
  it("lists the same question at the smaller and at the larger radii, keeping the pass and the needs", () => {
    const keys = radiusKeys(`utrecht|25km|${RESEARCH_CACHE_EPOCH}|broad|n:evening`)!;
    expect(keys.narrower).toEqual([`utrecht|5km|v6|broad|n:evening`, `utrecht|10km|v6|broad|n:evening`, `utrecht|15km|v6|broad|n:evening`]);
    expect(keys.wider).toEqual([`utrecht|50km|v6|broad|n:evening`, `utrecht|75km|v6|broad|n:evening`, `utrecht|100km|v6|broad|n:evening`]);
  });

  it("treats the older classes as their kilometres: 'city' is 15, and shares the answers of the 15 km key", () => {
    const keys = radiusKeys("utrecht|city|v6")!;
    expect(keys.narrower).toContain("utrecht|15km|v6");
    expect(keys.wider).toContain("utrecht|15km|v6");
    expect(keys.narrower).toContain("utrecht|10km|v6");
    expect(keys.wider).toContain("utrecht|25km|v6");
  });

  it("has nothing to say about the whole country, the online answers, or a key it does not know", () => {
    expect(radiusKeys("nl|nl|v6")).toBeNull();
    expect(radiusKeys("online|v6|online")).toBeNull();
    expect(radiusKeys("utrecht|whatever|v6")).toBeNull();
  });
});

describe("the key", () => {
  it("has no month and carries the research version", async () => {
    const { cache, store } = memoryCache();
    await researchSeeds({ ...args, activityIds: ["yoga"], cache, search: searchAll() });
    expect([...store.keys()]).toEqual(["yoga|utrecht|25km|v6"]);
  });
});

describe("one answer for several radii", () => {
  it("uses what a smaller radius found: real options, nothing to search, and nothing stored under the new key", async () => {
    const { cache, store } = memoryCache({ "yoga|utrecht|15km|v6": [opt("Yoga Studio")] });
    const search = searchAll();
    const { byActivity, stats } = await researchSeeds({ ...args, activityIds: ["yoga"], cache, search });
    expect(search).not.toHaveBeenCalled();
    expect(byActivity.get("yoga")).toMatchObject({ source: "cache" });
    expect(byActivity.get("yoga")?.options[0].name).toBe("Yoga Studio");
    expect(stats).toMatchObject({ cached: 1, searched: 0 });
    expect(store.has("yoga|utrecht|25km|v6")).toBe(false); // a borrowed answer never gets a new time limit
  });

  it("takes the nearest smaller radius that found something", async () => {
    const { cache } = memoryCache({ "yoga|utrecht|5km|v6": [opt("Yoga dichtbij")], "yoga|utrecht|15km|v6": [opt("Yoga iets verder")] });
    const { byActivity } = await researchSeeds({ ...args, activityIds: ["yoga"], cache, search: searchAll() });
    expect(byActivity.get("yoga")?.options[0].name).toBe("Yoga iets verder");
  });

  it("does not use what only a larger radius found: it may be too far for this person", async () => {
    const { cache } = memoryCache({ "yoga|utrecht|50km|v6": [opt("Yoga ver weg")] });
    const search = searchAll();
    const { byActivity } = await researchSeeds({ ...args, activityIds: ["yoga"], cache, search });
    expect(search).toHaveBeenCalledTimes(1);
    expect(byActivity.get("yoga")?.options[0].name).toBe("Nieuw yoga");
  });

  it("uses an empty answer of a larger radius (nothing within 50 km is nothing within 25) but not of a smaller one", async () => {
    const wide = memoryCache({ "yoga|utrecht|50km|v6": [] });
    const searchWide = searchAll();
    const a = await researchSeeds({ ...args, activityIds: ["yoga"], cache: wide.cache, search: searchWide });
    expect(searchWide).not.toHaveBeenCalled();
    expect(a.byActivity.get("yoga")).toMatchObject({ source: "cache", options: [] });

    const narrow = memoryCache({ "yoga|utrecht|10km|v6": [] });
    const searchNarrow = searchAll();
    const b = await researchSeeds({ ...args, activityIds: ["yoga"], cache: narrow.cache, search: searchNarrow });
    expect(searchNarrow).toHaveBeenCalledTimes(1);
    expect(b.byActivity.get("yoga")?.options).toHaveLength(1);
  });

  it("lets what was found win over an empty answer of another radius", async () => {
    const { cache } = memoryCache({ "yoga|utrecht|10km|v6": [opt("Yoga gevonden")], "yoga|utrecht|50km|v6": [] });
    const search = searchAll();
    const { byActivity } = await researchSeeds({ ...args, activityIds: ["yoga"], cache, search });
    expect(search).not.toHaveBeenCalled();
    expect(byActivity.get("yoga")?.options[0].name).toBe("Yoga gevonden");
  });

  it("keeps the passes and the needs apart: a standard answer never serves a broad question", async () => {
    const { cache } = memoryCache({ "yoga|utrecht|15km|v6": [opt("Yoga standaard")] });
    const search = searchAll();
    await researchSeeds({ ...args, activityIds: ["yoga"], pass: "broad", cache, search });
    expect(search).toHaveBeenCalledTimes(1);
    const evening = await researchSeeds({ ...args, activityIds: ["yoga"], needs: ["evening"], cache, search });
    expect(evening.byActivity.get("yoga")?.source).toBe("search");
  });

  it("does not serve a person's own choice from another radius: that one has its own, wider search", async () => {
    const { cache } = memoryCache({ "yoga|utrecht|15km|v6": [opt("Yoga Studio")] });
    const search = searchAll();
    const { byActivity } = await researchSeeds({ ...args, activityIds: ["yoga"], priorityIds: ["yoga"], cache, search });
    // The shared answer of the same radius would count for a found option, but another radius does not.
    expect(search).toHaveBeenCalledTimes(1);
    expect(byActivity.get("yoga")?.source).toBe("search");
  });

  it("works for the older 'city' keys of a request without kilometres", async () => {
    const { cache } = memoryCache({ "yoga|utrecht|10km|v6": [opt("Yoga Studio")] });
    const search = searchAll();
    const { byActivity } = await researchSeeds({ ...args, searchDistanceKm: undefined, activityIds: ["yoga"], cache, search });
    expect(search).not.toHaveBeenCalled();
    expect(byActivity.get("yoga")?.options[0].name).toBe("Yoga Studio");
  });

  it("is simply off for a cache without getAcross", async () => {
    const { cache } = memoryCache({ "yoga|utrecht|15km|v6": [opt("Yoga Studio")] });
    const search = searchAll();
    await researchSeeds({ ...args, activityIds: ["yoga"], cache: { get: cache.get, put: cache.put }, search });
    expect(search).toHaveBeenCalledTimes(1);
  });
});
