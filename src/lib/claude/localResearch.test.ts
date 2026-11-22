import { describe, expect, it, vi } from "vitest";
import { createRatingEnricher } from "@/lib/claude/placesRatings";
import {
  buildResearchPrompt,
  cleanOptions,
  expiryMs,
  hasLink,
  isPhysicalOption,
  parseResearchAnswer,
  placeKey,
  rankOptions,
  researchSeeds,
  withLinks,
  type LocalOption,
  type ResearchCache,
} from "@/lib/claude/localResearch";

// The model call itself is replaced by `search` in these tests; nothing here touches the network.

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
    async put(entries, place) {
      for (const e of entries) store.set(`${e.activityId}|${place}`, e.options);
    },
  };
  return { cache, store };
}

const opt = (name: string, until: string | null = null): LocalOption => ({ name, city: "Utrecht", url: `https://${name.toLowerCase().replace(/\W/g, "")}.nl`, note: "workshop", until, rating: null });
const NOW = new Date("2026-10-25T10:00:00Z");

describe("placeKey", () => {
  it("normalises the place and adds the search radius", () => {
    expect(placeKey("Gemeente Utrecht", "city")).toBe("utrecht|city");
    expect(placeKey("Utrecht", "nearby")).toBe("utrecht|city");
    expect(placeKey("  ’s-Hertogenbosch ", "hour")).toBe("s-hertogenbosch|region");
    expect(placeKey("Zürich (ZH)", "city")).toBe("zurich|city");
  });

  it("uses one shared key for 'anywhere' and copes with an empty place", () => {
    expect(placeKey("Utrecht", "anywhere")).toBe("nl|nl");
    expect(placeKey("", "city")).toBe("nl|city");
  });
});

describe("buildResearchPrompt", () => {
  it("lists every activity with its id, in one prompt, and asks for JSON", () => {
    const text = buildResearchPrompt(["pottenbakken", "schaken"], "Utrecht", "city", "nl");
    expect(text).toContain('id "pottenbakken"');
    expect(text).toContain('id "schaken"');
    expect(text).toContain("Utrecht");
    expect(text).toContain("Dutch");
    expect(text).toContain("```json");
  });
});

describe("the person's own choices (Stap 124)", () => {
  const config = { location: "Utrecht", searchDistance: "city", locale: "nl" as const, now: NOW, verify: false as const };

  it("asks for more effort, a little more distance and older evidence for permanent places, only for those", () => {
    const own = buildResearchPrompt(["high-tea"], "Laren", "city", "nl", NOW, true);
    expect(own).toContain("chosen by the person themselves");
    expect(own).toContain("about 25 km");
    expect(own).toContain("24 for a permanent place");
    const normal = buildResearchPrompt(["high-tea"], "Laren", "city", "nl", NOW);
    expect(normal).not.toContain("chosen by the person themselves");
    expect(normal).not.toContain("25 km");
    expect(normal).toContain("the last 12 months");
  });

  it("searches them in their own call, next to the call for the rest, and keeps their empty answers only two days", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const search = vi.fn(async (ids: string[], _l?: string, _r?: string, _lo?: string, _n?: Date, _own?: boolean) => new Map(ids.map((id) => [id, id === "high-tea" ? [opt("High tea Theehuis")] : []])));
    const { cache, store } = memoryCache();
    const puts: { activityId: string; emptyTtlDays?: number }[] = [];
    const wrapped: ResearchCache = { get: cache.get, put: async (e, p, l) => { puts.push(...e); return cache.put(e, p, l); } };
    const { byActivity } = await researchSeeds({ ...config, activityIds: ["high-tea", "kralen-rijgen", "pottenbakken"], priorityIds: ["high-tea", "kralen-rijgen"], cache: wrapped, search });
    expect(search).toHaveBeenCalledTimes(2);
    const calls = search.mock.calls.map((c) => ({ ids: c[0], own: c[5] }));
    expect(calls).toContainEqual({ ids: ["high-tea", "kralen-rijgen"], own: true });
    expect(calls).toContainEqual({ ids: ["pottenbakken"], own: false });
    expect(byActivity.get("high-tea")?.options).toHaveLength(1);
    // empty answer for a pick: short memory, own key; for the rest: the usual two weeks, shared key
    expect(puts.find((p) => p.activityId === "kralen-rijgen")?.emptyTtlDays).toBe(2);
    expect(puts.find((p) => p.activityId === "pottenbakken")?.emptyTtlDays).toBeUndefined();
    expect([...store.keys()].some((k) => k.startsWith("kralen-rijgen|") && k.endsWith("|own"))).toBe(true);
  });

  it("does not trust an empty answer in the shared cache for a pick, but does trust a found one", async () => {
    const key = `utrecht|city|v6`;
    const { cache } = memoryCache({ [`high-tea|${key}`]: [], [`kralen-rijgen|${key}`]: [opt("Kralenwinkel")] });
    const search = vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, [opt("Nieuw")]])));
    const { byActivity } = await researchSeeds({ ...config, activityIds: ["high-tea", "kralen-rijgen"], priorityIds: ["high-tea", "kralen-rijgen"], cache, search });
    expect(search).toHaveBeenCalledTimes(1);
    expect(search.mock.calls[0][0]).toEqual(["high-tea"]);
    expect(byActivity.get("kralen-rijgen")?.options[0].name).toBe("Kralenwinkel");
    expect(byActivity.get("high-tea")?.options[0].name).toBe("Nieuw");
  });

  it("a failure of one call leaves the other call's answer standing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const search = vi.fn(async (ids: string[], _l: string, _r: string, _lo: string, _n: Date, own?: boolean) => (own ? null : new Map(ids.map((id) => [id, [opt("Pottenbakken Klei")]]))));
    const { byActivity, stats } = await researchSeeds({ ...config, activityIds: ["high-tea", "pottenbakken"], priorityIds: ["high-tea"], cache: null, search: search as never });
    expect(byActivity.get("high-tea")?.source).toBe("none");
    expect(byActivity.get("pottenbakken")?.options).toHaveLength(1);
    expect(stats.failed).toBe(1);
    vi.restoreAllMocks();
  });
});

describe("the research prompt and the date", () => {
  it("tells the model today's date and that a dated event or seasonal offer only counts in the next four weeks", () => {
    const text = buildResearchPrompt(["open-water"], "Utrecht", "city", "nl", NOW);
    expect(text).toContain("25 October 2026 (autumn)");
    expect(text).toContain("2026-10-25");
    expect(text).toContain("a date in the next four weeks");
    expect(text).toContain("closed for the season");
    expect(text).toContain('"until"');
  });

  it("lets a permanent place or group count without a dated session, and asks how a beginner takes part", () => {
    const text = buildResearchPrompt(["nordic-walking"], "Utrecht", "city", "nl", NOW);
    expect(text).toContain("A permanent place or group");
    expect(text).toContain("does NOT need a dated session");
    expect(text).toContain("how a beginner takes part");
  });

  it("gives each activity the kind of option and the search terms that fit it (a repair cafe for a bike, a club for nordic walking)", () => {
    const text = buildResearchPrompt(["fietsreparatie", "nordic-walking"], "Utrecht", "city", "nl", NOW);
    expect(text).toContain("repair café fiets");
    expect(text).toContain("nordic walking club");
    expect(text).toContain("Look for a club, association or regular group");
  });

  it("the second, broad attempt names the wider kinds of provider; the first search does not", () => {
    const standard = buildResearchPrompt(["fietsreparatie"], "Utrecht", "city", "nl", NOW);
    const broad = buildResearchPrompt(["fietsreparatie"], "Utrecht", "city", "nl", NOW, false, [], null, "broad");
    expect(standard).not.toContain("SECOND ATTEMPT");
    expect(broad).toContain("SECOND ATTEMPT");
    expect(broad).toContain("libraries, repair cafes");
    expect(broad).toContain("PHYSICAL places"); // still physical only
  });
});

describe("the broad pass", () => {
  const cfg = { location: "Utrecht", searchDistance: "city", locale: "nl" as const, now: NOW, verify: false as const };

  it("is a pass of its own: its answers are cached under their own key and the standard cache does not answer for it", async () => {
    const { cache, store } = memoryCache({ "yoga|utrecht|city|v6": [] });
    const search = vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, [opt("Brede club")]])));
    const { byActivity } = await researchSeeds({ ...cfg, activityIds: ["yoga"], cache, search, pass: "broad" });
    expect(search).toHaveBeenCalledTimes(1);
    expect((search.mock.calls[0] as unknown[])[9]).toBe("broad");
    expect(byActivity.get("yoga")?.options[0].name).toBe("Brede club");
    expect(store.get("yoga|utrecht|city|v6|broad")?.map((o) => o.name)).toEqual(["Brede club"]);
    expect(store.get("yoga|utrecht|city|v6")).toEqual([]);
  });

  it("is never used for the online providers", async () => {
    const search = vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, [{ ...opt("Cursus"), city: "Online" }]])));
    await researchSeeds({ ...cfg, activityIds: ["yoga"], cache: null, search, mode: "online", pass: "broad" });
    expect((search.mock.calls[0] as unknown[])[9]).toBe("standard");
  });
});

describe("options with a last day", () => {
  it("reads until, and drops what has already ended when a date is given", () => {
    const raw = [
      { name: "A", until: "2026-10-20" },
      { name: "B", until: "2026-11-30" },
      { name: "C", until: "soon" },
    ];
    expect(cleanOptions(raw).map((o) => o.name)).toEqual(["A", "B", "C"]);
    expect(cleanOptions(raw, "2026-10-25").map((o) => o.name)).toEqual(["B", "C"]);
    expect(cleanOptions(raw, "2026-10-25").map((o) => o.until)).toEqual(["2026-11-30", null]);
    // what has ended does not use up one of the three places
    expect(cleanOptions([{ name: "old", until: "2026-01-01" }, { name: "x" }, { name: "y" }, { name: "z" }], "2026-10-25").map((o) => o.name)).toEqual(["x", "y", "z"]);
  });

  it("never keeps a cached answer longer than the day an option ends", () => {
    const now = Date.parse("2026-10-25T10:00:00Z");
    const day = 86400000;
    expect(expiryMs([opt("A")], now)).toBe(now + 30 * day);
    expect(expiryMs([], now)).toBe(now + 14 * day); // an empty answer is remembered for 14 days (EMPTY_TTL_DAYS), found options for 30
    const ends = expiryMs([opt("A", "2026-10-27")], now);
    expect(ends).toBeLessThan(now + 3 * day);
    expect(ends).toBeGreaterThan(now);
    expect(expiryMs([opt("A", "2026-10-01")], now)).toBe(now);
  });
});

describe("parseResearchAnswer", () => {
  const wanted = ["pottenbakken", "schaken"];

  it("reads the fenced JSON block", () => {
    const answer = 'Some notes.\n```json\n[{"activity_id":"pottenbakken","options":[{"name":"Klei Atelier","city":"Utrecht","url":"https://klei.nl","note":"proefles"}]}]\n```';
    const out = parseResearchAnswer(answer, wanted)!;
    expect(out.get("pottenbakken")).toEqual([{ name: "Klei Atelier", city: "Utrecht", url: "https://klei.nl", note: "proefles", until: null, rating: null, kind: null, match: null }]);
  });

  it("treats an activity the model skipped as searched-but-nothing-found", () => {
    const out = parseResearchAnswer('```json\n[{"activity_id":"pottenbakken","options":[]}]\n```', wanted)!;
    expect(out.get("schaken")).toEqual([]);
  });

  it("drops unknown activity ids, options without a name, non-http urls and more than three options", () => {
    const rows = JSON.stringify([
      { activity_id: "made-up", options: [{ name: "X" }] },
      {
        activity_id: "schaken",
        options: [{ name: "" }, { name: "A", url: "javascript:alert(1)" }, { name: "B", url: "https://b.nl" }, { name: "C" }, { name: "D" }],
      },
    ]);
    const out = parseResearchAnswer("```json\n" + rows + "\n```", wanted)!;
    expect(out.has("made-up")).toBe(false);
    const options = out.get("schaken")!;
    expect(options).toHaveLength(3);
    expect(options[0].url).toBeNull();
    expect(options[1].url).toBe("https://b.nl");
  });

  it("returns null for an answer that cannot be read", () => {
    expect(parseResearchAnswer("I could not search.", wanted)).toBeNull();
    expect(parseResearchAnswer("```json\n{not json}\n```", wanted)).toBeNull();
  });
});

describe("researchSeeds", () => {
  const args = { location: "Utrecht", searchDistance: "city", locale: "nl" as const, verify: false as const, now: NOW };

  it("researches everything that is not cached in ONE call and stores the answers", async () => {
    const { cache, store } = memoryCache();
    const search = vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, [opt(id)]])));
    const { byActivity, stats } = await researchSeeds({ ...args, activityIds: ["hardlopen", "yoga", "schaken"], cache, search });
    expect(search).toHaveBeenCalledTimes(1);
    expect(search.mock.calls[0][0]).toEqual(["hardlopen", "yoga", "schaken"]);
    expect(stats).toMatchObject({ cached: 0, searched: 3, failed: 0 });
    expect([...byActivity.values()].every((r) => r.source === "search")).toBe(true);
    expect(store.size).toBe(3);
  });

  it("uses cached answers and only searches for what is missing", async () => {
    const { cache } = memoryCache({ "yoga|utrecht|city|v6": [opt("Yoga Studio")] });
    const search = vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, [opt(id)]])));
    const { byActivity, stats } = await researchSeeds({ ...args, activityIds: ["hardlopen", "yoga"], cache, search });
    expect(search.mock.calls[0][0]).toEqual(["hardlopen"]);
    expect(byActivity.get("yoga")).toMatchObject({ source: "cache" });
    expect(stats).toMatchObject({ cached: 1, searched: 1 });
  });

  it("makes no call at all when everything is cached", async () => {
    const { cache } = memoryCache({ "yoga|utrecht|city|v6": [opt("Yoga Studio")] });
    const search = vi.fn();
    await researchSeeds({ ...args, activityIds: ["yoga"], cache, search });
    expect(search).not.toHaveBeenCalled();
  });

  it("does not share answers between different places or radii", async () => {
    const { cache } = memoryCache({ "yoga|utrecht|city|v6": [opt("Yoga Studio")] });
    const search = vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, []])));
    await researchSeeds({ ...args, location: "Haarlem", activityIds: ["yoga"], cache, search });
    await researchSeeds({ ...args, searchDistance: "hour", activityIds: ["yoga"], cache, search });
    expect(search).toHaveBeenCalledTimes(2);
  });

  it("remembers 'nothing found' so a miss is not paid for again", async () => {
    const { cache, store } = memoryCache();
    const search = vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, [] as LocalOption[]])));
    await researchSeeds({ ...args, activityIds: ["larp"], cache, search });
    expect(store.get("larp|utrecht|city|v6")).toEqual([]);
    await researchSeeds({ ...args, activityIds: ["larp"], cache, search });
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("fails soft: no options, nothing cached, no exception", async () => {
    const { cache, store } = memoryCache();
    const search = vi.fn(async () => {
      throw new Error("boom");
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { byActivity, stats } = await researchSeeds({ ...args, activityIds: ["yoga"], cache, search });
    spy.mockRestore();
    expect(byActivity.get("yoga")).toEqual({ activityId: "yoga", options: [], source: "none" });
    expect(stats.failed).toBe(1);
    expect(store.size).toBe(0);
  });

  it("does not read the older keys that carried a month (Stap 195): those rows are left unused, the time limit of a row decides now", async () => {
    const { cache } = memoryCache({ "yoga|utrecht|city|2026-09": [opt("Zomerbad")] });
    const search = vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, [opt("Winterbad")]])));
    const { byActivity } = await researchSeeds({ ...args, activityIds: ["yoga"], cache, search });
    expect(search).toHaveBeenCalledTimes(1);
    expect(byActivity.get("yoga")?.options[0].name).toBe("Winterbad");
  });

  it("searches again when every cached option has run out since", async () => {
    const { cache } = memoryCache({ "yoga|utrecht|city|v6": [opt("Herfstmarkt", "2026-10-10")] });
    const search = vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, [opt("Nieuwe yogaklas", "2026-11-15")]])));
    const { byActivity } = await researchSeeds({ ...args, activityIds: ["yoga"], cache, search });
    expect(search).toHaveBeenCalledTimes(1);
    expect(byActivity.get("yoga")?.options.map((o) => o.name)).toEqual(["Nieuwe yogaklas"]);
  });

  it("throws away options whose website does not exist before they are stored, and counts them", async () => {
    const { cache, store } = memoryCache();
    const search = vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, [opt("Yoga Echt"), opt("Yoga Verzonnen")]])));
    const verify = vi.fn(async (options: LocalOption[]) => ({
      kept: options.filter((o) => o.name === "Yoga Echt"),
      dropped: options.filter((o) => o.name !== "Yoga Echt").map((option) => ({ option, reason: "host_does_not_exist" })),
    }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { byActivity, stats } = await researchSeeds({ ...args, activityIds: ["yoga"], cache, search, verify });
    warn.mockRestore();
    expect(byActivity.get("yoga")?.options.map((o) => o.name)).toEqual(["Yoga Echt"]);
    expect(stats.dropped).toBe(1);
    expect(store.get("yoga|utrecht|city|v6")?.map((o) => o.name)).toEqual(["Yoga Echt"]);
  });

  it("works without a cache", async () => {
    const search = vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, [opt(id)]])));
    const { byActivity } = await researchSeeds({ ...args, activityIds: ["yoga"], cache: null, search });
    expect(byActivity.get("yoga")?.options).toHaveLength(1);
  });
});

describe("physical places only", () => {
  it("keeps a venue with a real city and drops what is online, national or a webshop", () => {
    expect(isPhysicalOption({ name: "Klei Atelier", city: "Utrecht" })).toBe(true);
    expect(isPhysicalOption({ name: "Schaakclub Zuid", city: "Den Haag" })).toBe(true);
    for (const city of ["", "Online", "online", "Nederland", "Netherlands", "Zwitserland", "Landelijk"]) expect(isPhysicalOption({ name: "X", city }), city).toBe(false);
    for (const name of ["Bike Repair Academy webshop", "Online cursus fiets repareren", "Meneer E-learning", "Video lessen tekenen"]) expect(isPhysicalOption({ name, city: "Utrecht" }), name).toBe(false);
  });

  it("says in the prompt that only physical places count, and never asks for products", () => {
    const text = buildResearchPrompt(["pottenbakken"], "Utrecht", "city", "nl", new Date("2026-10-25T10:00:00Z"));
    expect(text).toMatch(/Only PHYSICAL places count/);
    expect(text).toMatch(/online course, a video lesson, an app, a\s+webshop/);
    expect(text).toMatch(/never "Online"/);
  });
});

describe("searching for the form and for reviews (Jan, 14 Nov 2026)", () => {
  const text = buildResearchPrompt(["high-tea"], "Laren", "city", "nl", new Date("2026-11-14T10:00:00Z"));

  it("tells the researcher how to search: queries that surface reviews, and that the Google score is looked up afterwards", () => {
    expect(text).toMatch(/How to search/);
    expect(text).toMatch(/"<activity> <place>"/);
    expect(text).toMatch(/beoordelingen/);
    expect(text).toMatch(/Google score\s+of\s+each place is looked up afterwards/);
    expect(text).not.toMatch(/Spend at least one search on the reviews/);
  });

  it("asks for the form the idea names first, and for what each place really is", () => {
    expect(text).toMatch(/Match the form first/);
    expect(text).toMatch(/a café on the heath is not a country house/);
    expect(text).toMatch(/"kind": "\.\.\."/);
    expect(text).toMatch(/"match": "exact"/);
  });

  it("reads kind and match from an answer, and ignores a match it does not know", () => {
    const out = cleanOptions([
      { name: "Theehuis 't Bluk", city: "Laren", kind: " café op de hei ", match: "close", url: "https://example.nl", note: "high tea" },
      { name: "Landhuis X", city: "Blaricum", kind: "high tea in een landhuis", match: "perfect", url: null, note: "" },
    ]);
    expect(out.map((o) => [o.name, o.kind, o.match])).toEqual([
      ["Landhuis X", "high tea in een landhuis", null],
      ["Theehuis 't Bluk", "café op de hei", "close"],
    ]);
  });

  it("puts the option of the form the idea names before a close one, and keeps the better rated first within a form", () => {
    const o = (name: string, match: "exact" | "close" | null, score: number | null): LocalOption => ({
      name,
      city: "Laren",
      url: null,
      note: "",
      until: null,
      rating: score ? { score, reviews: 200, source: "Google" } : null,
      kind: null,
      match,
    });
    const ranked = rankOptions([o("Close best", "close", 4.9), o("Exact good", "exact", 4.5), o("Exact better", "exact", 4.7)]);
    expect(ranked.map((x) => x.name)).toEqual(["Exact better", "Exact good", "Close best"]);
  });
});

describe("the Google score in the research (Jan, 14 Nov 2026)", () => {
  const args = { location: "Utrecht", searchDistance: "city", locale: "nl" as const, now: NOW, verify: false as const };
  const enricher = (rating = 4.7) =>
    createRatingEnricher({
      apiKey: "KEY",
      counter: async (n) => n,
      fetchImpl: (async () => new Response(JSON.stringify({ places: [{ displayName: { text: "Yoga Studio" }, formattedAddress: "Straat 1, Utrecht", businessStatus: "OPERATIONAL", rating, userRatingCount: 150 }] }), { status: 200 })) as unknown as typeof fetch,
    });

  it("adds the score to a place that was just found and stores it with the option, so the cache holds it", async () => {
    const { cache, store } = memoryCache();
    const search = vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, [opt("Yoga Studio")]])));
    const { byActivity } = await researchSeeds({ ...args, activityIds: ["yoga"], cache, search, ratings: enricher() });
    expect(byActivity.get("yoga")?.options[0]).toMatchObject({ name: "Yoga Studio", rating: { score: 4.7, reviews: 150, source: "Google" }, ratingChecked: true });
    expect(store.get("yoga|utrecht|city|v6")?.[0]).toMatchObject({ rating: { score: 4.7 }, ratingChecked: true });
  });

  it("gives a cached place that never had a score one, once, and puts the improved answer back", async () => {
    const { cache, store } = memoryCache({ "yoga|utrecht|city|v6": [opt("Yoga Studio")] });
    const search = vi.fn();
    const { byActivity } = await researchSeeds({ ...args, activityIds: ["yoga"], cache, search, ratings: enricher(4.4) });
    expect(search).not.toHaveBeenCalled(); // still an answer from the cache
    expect(byActivity.get("yoga")?.options[0].rating?.score).toBe(4.4);
    expect(store.get("yoga|utrecht|city|v6")?.[0]).toMatchObject({ rating: { score: 4.4 }, ratingChecked: true });
  });

  it("does not look a cached place up again once it was looked up, also when there was no score", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
    const ratings = createRatingEnricher({ apiKey: "KEY", counter: async (n) => n, fetchImpl: f, maxFinds: 0 });
    const { cache } = memoryCache({ "yoga|utrecht|city|v6": [{ ...opt("Yoga Studio"), ratingChecked: true }] });
    await researchSeeds({ ...args, activityIds: ["yoga"], cache, search: vi.fn(), ratings });
    expect(f).not.toHaveBeenCalled();
  });

  it("keeps the flag when options are read back from the cache", () => {
    expect(cleanOptions([{ name: "X", city: "Utrecht", url: null, note: "", ratingChecked: true }])[0].ratingChecked).toBe(true);
    expect(cleanOptions([{ name: "X", city: "Utrecht", url: null, note: "" }])[0].ratingChecked).toBeUndefined();
  });
});

// Jan, 22 Nov 2026: every option needs at least one real place with a link to a working site, preferably two. The link is part of the place.
describe("a place has a link", () => {
  const args = { location: "Utrecht", searchDistance: "city", locale: "nl" as const, verify: false as const, now: NOW };
  const noLink = (name: string): LocalOption => ({ ...opt(name), url: null });

  it("counts a public web address as a link and nothing else", () => {
    expect(hasLink({ url: "https://www.klimhal.nl/proefles" })).toBe(true);
    expect(hasLink({ url: "http://klimhal.nl" })).toBe(true);
    expect(hasLink({ url: null })).toBe(false);
    expect(hasLink({ url: "" })).toBe(false);
    expect(hasLink({ url: "http://localhost:3000/x" })).toBe(false);
    expect(hasLink({ url: "https://192.168.0.1/" })).toBe(false);
    expect(withLinks([noLink("A"), opt("B")]).map((o) => o.name)).toEqual(["B"]);
  });

  it("leaves a place without a website out before it is stored, and counts it as dropped", async () => {
    const { cache, store } = memoryCache();
    const search = vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, [noLink("Yoga Zonder Site"), opt("Yoga Met Site")]])));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { byActivity, stats } = await researchSeeds({ ...args, activityIds: ["yoga"], cache, search });
    warn.mockRestore();
    expect(byActivity.get("yoga")?.options.map((o) => o.name)).toEqual(["Yoga Met Site"]);
    expect(stats.dropped).toBe(1);
    expect([...store.values()][0].map((o) => o.name)).toEqual(["Yoga Met Site"]);
  });

  it("an idea whose only places have no website ends with none, which the pipeline then repairs", async () => {
    const { cache } = memoryCache();
    const search = vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, [noLink("Alleen Facebook")]])));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { byActivity } = await researchSeeds({ ...args, activityIds: ["yoga"], cache, search });
    warn.mockRestore();
    expect(byActivity.get("yoga")?.options).toEqual([]);
  });

  it("does not trust a cached answer that only holds places without a website: it is a new question", async () => {
    const { cache } = memoryCache({ "yoga|utrecht|city|v6": [noLink("Oude Yogaplek")] });
    const search = vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, [opt("Nieuwe Yogaklas")]])));
    const { byActivity } = await researchSeeds({ ...args, activityIds: ["yoga"], cache, search });
    expect(search).toHaveBeenCalledTimes(1);
    expect(byActivity.get("yoga")?.options.map((o) => o.name)).toEqual(["Nieuwe Yogaklas"]);
  });

  it("keeps the places with a website from a mixed cached answer, and does not search again", async () => {
    const { cache } = memoryCache({ "yoga|utrecht|city|v6": [noLink("Zonder"), opt("Yoga Studio")] });
    const search = vi.fn();
    const { byActivity } = await researchSeeds({ ...args, activityIds: ["yoga"], cache, search });
    expect(search).not.toHaveBeenCalled();
    expect(byActivity.get("yoga")?.options.map((o) => o.name)).toEqual(["Yoga Studio"]);
  });

  it("tells the research that every option needs a website and that two are better than one", () => {
    const prompt = buildResearchPrompt(["hardlopen"], "Utrecht", "city", "nl", NOW);
    expect(prompt).toMatch(/Every option needs a website address/);
    expect(prompt).toMatch(/not listed/);
    expect(prompt).toMatch(/list at least two/);
  });

  // The links of cached places are looked at again (a cached place is up to 30 days old).
  it("looks at the links of cached places again: a dead one is dropped and the cleaned answer is written back", async () => {
    const { cache, store } = memoryCache({ "yoga|utrecht|city|v6": [opt("Yoga Dood"), opt("Yoga Levend")] });
    const search = vi.fn();
    const verify = vi.fn(async (options: LocalOption[]) => ({
      kept: options.filter((o) => o.name !== "Yoga Dood"),
      dropped: options.filter((o) => o.name === "Yoga Dood").map((option) => ({ option, reason: "page_gone" })),
    }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { byActivity, stats } = await researchSeeds({ ...args, activityIds: ["yoga"], cache, search, verify });
    warn.mockRestore();
    expect(search).not.toHaveBeenCalled();
    expect(byActivity.get("yoga")?.options.map((o) => o.name)).toEqual(["Yoga Levend"]);
    expect(stats.dropped).toBe(1);
    expect(store.get("yoga|utrecht|city|v6")?.map((o) => o.name)).toEqual(["Yoga Levend"]);
  });

  it("an answer whose links are all dead is a new question, searched again", async () => {
    const { cache } = memoryCache({ "yoga|utrecht|city|v6": [opt("Yoga Dood")] });
    const search = vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, [opt("Yoga Nieuw")]])));
    const verify = vi.fn(async (options: LocalOption[]) =>
      options[0].name === "Yoga Dood" ? { kept: [], dropped: [{ option: options[0], reason: "host_does_not_exist" }] } : { kept: options, dropped: [] },
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { byActivity } = await researchSeeds({ ...args, activityIds: ["yoga"], cache, search, verify });
    warn.mockRestore();
    expect(search).toHaveBeenCalledTimes(1);
    expect(byActivity.get("yoga")?.options.map((o) => o.name)).toEqual(["Yoga Nieuw"]);
  });

  it("writes nothing back when every cached link still answers", async () => {
    const { cache } = memoryCache({ "yoga|utrecht|city|v6": [opt("Yoga Studio")] });
    const put = vi.spyOn(cache, "put");
    const verify = vi.fn(async (options: LocalOption[]) => ({ kept: options, dropped: [] }));
    await researchSeeds({ ...args, activityIds: ["yoga"], cache, search: vi.fn(), verify });
    expect(verify).toHaveBeenCalledTimes(1);
    expect(put).not.toHaveBeenCalled();
  });
});

// Jan, 22 Nov 2026: Google Places used sparingly (free allowance) to give an idea with fewer than two places a second one, before any paid round.
describe("the free Google top-up", () => {
  const args = { location: "Utrecht", searchDistance: "city", locale: "nl" as const, verify: false as const, now: NOW };
  const gResult = (name: string, extra: Record<string, unknown> = {}) => ({
    displayName: { text: name },
    formattedAddress: "Oudegracht 1, 3511 AB Utrecht, Nederland",
    businessStatus: "OPERATIONAL",
    rating: 4.6,
    userRatingCount: 80,
    websiteUri: `https://www.${name.toLowerCase().replace(/\W/g, "")}.nl/`,
    primaryTypeDisplayName: { text: "Klimhal" },
    ...extra,
  });
  /** A Google that answers every search with the given places, and records the queries. */
  const google = (places: Record<string, unknown>[]) => {
    const queries: string[] = [];
    const impl = vi.fn(async (_u: unknown, init?: RequestInit) => {
      // only the finds (their mask has the website): the score lookups of the same enricher are not what these tests count
      if (String((init?.headers as Record<string, string>)["X-Goog-FieldMask"]).includes("websiteUri")) queries.push(String((JSON.parse(String(init?.body)) as { textQuery: string }).textQuery));
      return new Response(JSON.stringify({ places }), { status: 200 });
    }) as unknown as typeof fetch;
    return { impl, queries };
  };
  const enricher = (places: Record<string, unknown>[], maxFinds = 3) => {
    const g = google(places);
    return { ...g, ratings: createRatingEnricher({ apiKey: "k", counter: async (n) => n, fetchImpl: g.impl, maxFinds }) };
  };

  it("gives an idea with one place a second one from Google, and stores the pair", async () => {
    const { cache, store } = memoryCache();
    const g = enricher([gResult("Boulderhal Zuid"), gResult("Klimmuur Noord")]);
    const search = vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, [opt("Boulderen Centrum")]])));
    const { byActivity } = await researchSeeds({ ...args, activityIds: ["boulderen"], cache, search, ratings: g.ratings });
    const names = byActivity.get("boulderen")!.options.map((o) => o.name);
    expect(names).toHaveLength(2);
    expect(names).toContain("Boulderen Centrum");
    expect(g.queries[0]).toBe("klimhal boulderen introductie beginners Utrecht");
    expect([...store.values()][0]).toHaveLength(2);
  });

  it("fills an idea with no place at all, with up to two, before any paid round has to", async () => {
    const g = enricher([gResult("Boulderhal Zuid"), gResult("Boulderhal Noord"), gResult("Boulderhal Oost")]);
    const search = vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, [] as LocalOption[]])));
    const { byActivity } = await researchSeeds({ ...args, activityIds: ["boulderen"], cache: null, search, ratings: g.ratings });
    expect(byActivity.get("boulderen")!.options).toHaveLength(2);
    expect(byActivity.get("boulderen")!.options.every((o) => hasLink(o))).toBe(true);
  });

  it("leaves out what is not about the activity, what has no working site, and a place the idea already has", async () => {
    const g = enricher([gResult("Kapsalon Mooi", { primaryTypeDisplayName: { text: "Kapper" } }), gResult("Boulderhal Dood"), gResult("Boulderen Centrum"), gResult("Boulderhal Goed")]);
    const verify = vi.fn(async (options: LocalOption[]) => ({
      kept: options.filter((o) => !o.name.includes("Dood")),
      dropped: options.filter((o) => o.name.includes("Dood")).map((option) => ({ option, reason: "dead" })),
    }));
    const search = vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, [opt("Boulderen Centrum")]])));
    const { byActivity } = await researchSeeds({ ...args, verify, activityIds: ["boulderen"], cache: null, search, ratings: g.ratings });
    expect(byActivity.get("boulderen")!.options.map((o) => o.name).sort()).toEqual(["Boulderen Centrum", "Boulderhal Goed"]);
  });

  it("does not ask for an idea that already has two, and stops at its cap", async () => {
    const g = enricher([gResult("Boulderhal Zuid")], 1);
    const search = vi.fn(async (ids: string[]) =>
      new Map(ids.map((id) => [id, id === "boulderen" ? [opt("Boulderen Een"), opt("Boulderen Twee")] : id === "hardlopen" ? [] : [opt("Yoga Een")]])),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await researchSeeds({ ...args, activityIds: ["boulderen", "hardlopen", "yoga"], cache: null, search, ratings: g.ratings });
    warn.mockRestore();
    // boulderen has two: no search. hardlopen (none) comes before yoga (one), and the cap of one find is used on it.
    expect(g.queries).toHaveLength(1);
    expect(g.queries[0]).not.toContain("klimhal");
  });

  it("does nothing for a place abroad (the terms are Dutch), online research, or without the key", async () => {
    const g = enricher([gResult("Boulderhal Zuid")]);
    const search = vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, [] as LocalOption[]])));
    await researchSeeds({ ...args, activityIds: ["boulderen"], cache: null, search, ratings: g.ratings, country: "DE" });
    await researchSeeds({ ...args, activityIds: ["boulderen"], cache: null, search, ratings: g.ratings, mode: "online" });
    const off = createRatingEnricher({ apiKey: "", counter: async (n) => n, fetchImpl: g.impl });
    await researchSeeds({ ...args, activityIds: ["boulderen"], cache: null, search, ratings: off });
    expect(g.queries).toEqual([]);
  });
});

describe("the top-up says where it stops", () => {
  it("logs one line with what Google gave, what was about the activity, what had a working site and what was added", async () => {
    const places = [
      { displayName: { text: "Boulderhal Zuid" }, formattedAddress: "Oudegracht 1, 3511 AB Utrecht, Nederland", businessStatus: "OPERATIONAL", rating: 4.6, userRatingCount: 80, websiteUri: "https://www.boulderhalzuid.nl/", primaryTypeDisplayName: { text: "Klimhal" } },
      { displayName: { text: "Kapsalon Mooi" }, formattedAddress: "Oudegracht 2, 3511 AB Utrecht, Nederland", businessStatus: "OPERATIONAL", rating: 4.9, userRatingCount: 90, websiteUri: "https://www.kapsalonmooi.nl/", primaryTypeDisplayName: { text: "Kapper" } },
    ];
    const impl = vi.fn(async (_u: unknown, init?: RequestInit) =>
      String((init?.headers as Record<string, string>)["X-Goog-FieldMask"]).includes("websiteUri") ? new Response(JSON.stringify({ places }), { status: 200 }) : new Response("{}", { status: 200 }),
    ) as unknown as typeof fetch;
    const ratings = createRatingEnricher({ apiKey: "k", counter: async (n) => n, fetchImpl: impl });
    const search = vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, [] as LocalOption[]])));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await researchSeeds({ location: "Utrecht", searchDistance: "city", locale: "nl", verify: false, now: NOW, activityIds: ["boulderen"], cache: null, search, ratings });
    const line = log.mock.calls.map((c) => String(c[0])).find((l) => l.includes("google top-up for boulderen"));
    log.mockRestore();
    expect(line).toContain("(had 0): 2 usable from Google, 1 about the activity and new, 1 with a site that answers, 1 added (Boulderhal Zuid)");
  });
});

describe("a score that two options share is one listing", () => {
  it("lets only the first of two options with the very same Google score and review count keep it, when an answer is read", () => {
    const g = (score: number, reviews: number) => ({ score, reviews, source: "Google" });
    const read = cleanOptions([
      { name: "Repair Café Utrecht-Oost", city: "Utrecht", url: "https://a.nl", note: "", rating: g(4.6, 8), ratingChecked: true },
      { name: "Repair Café Overvecht", city: "Utrecht", url: "https://b.nl", note: "", rating: g(4.6, 8), ratingChecked: true },
      { name: "Fietsenmaker Noord", city: "Utrecht", url: "https://c.nl", note: "", rating: g(4.6, 9), ratingChecked: true },
    ]);
    const byName = new Map(read.map((o) => [o.name, o]));
    expect(byName.get("Repair Café Utrecht-Oost")?.rating).toMatchObject({ score: 4.6, reviews: 8 });
    expect(byName.get("Repair Café Overvecht")?.rating).toBeNull();
    expect(byName.get("Repair Café Overvecht")?.ratingChecked).toBe(true);
    expect(byName.get("Fietsenmaker Noord")?.rating).toMatchObject({ score: 4.6, reviews: 9 });
  });
});
