import { describe, expect, it, vi } from "vitest";
import {
  buildResearchPrompt,
  cleanOptions,
  expiryMs,
  parseResearchAnswer,
  placeKey,
  researchSeeds,
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

const opt = (name: string, until: string | null = null): LocalOption => ({ name, city: "Utrecht", url: `https://${name.toLowerCase().replace(/\W/g, "")}.nl`, note: "workshop", until });
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

describe("the research prompt and the date", () => {
  it("tells the model today's date and that only what can be done in the next four weeks counts", () => {
    const text = buildResearchPrompt(["open-water"], "Utrecht", "city", "nl", NOW);
    expect(text).toContain("25 October 2026 (autumn)");
    expect(text).toContain("2026-10-25");
    expect(text).toContain("within the next four weeks");
    expect(text).toContain("closed for the season");
    expect(text).toContain('"until"');
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
    expect(expiryMs([], now)).toBe(now + 7 * day);
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
    expect(out.get("pottenbakken")).toEqual([{ name: "Klei Atelier", city: "Utrecht", url: "https://klei.nl", note: "proefles", until: null }]);
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
    const { cache } = memoryCache({ "yoga|utrecht|city|2026-10": [opt("Yoga Studio")] });
    const search = vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, [opt(id)]])));
    const { byActivity, stats } = await researchSeeds({ ...args, activityIds: ["hardlopen", "yoga"], cache, search });
    expect(search.mock.calls[0][0]).toEqual(["hardlopen"]);
    expect(byActivity.get("yoga")).toMatchObject({ source: "cache" });
    expect(stats).toMatchObject({ cached: 1, searched: 1 });
  });

  it("makes no call at all when everything is cached", async () => {
    const { cache } = memoryCache({ "yoga|utrecht|city|2026-10": [opt("Yoga Studio")] });
    const search = vi.fn();
    await researchSeeds({ ...args, activityIds: ["yoga"], cache, search });
    expect(search).not.toHaveBeenCalled();
  });

  it("does not share answers between different places or radii", async () => {
    const { cache } = memoryCache({ "yoga|utrecht|city|2026-10": [opt("Yoga Studio")] });
    const search = vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, []])));
    await researchSeeds({ ...args, location: "Haarlem", activityIds: ["yoga"], cache, search });
    await researchSeeds({ ...args, searchDistance: "hour", activityIds: ["yoga"], cache, search });
    expect(search).toHaveBeenCalledTimes(2);
  });

  it("remembers 'nothing found' so a miss is not paid for again", async () => {
    const { cache, store } = memoryCache();
    const search = vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, [] as LocalOption[]])));
    await researchSeeds({ ...args, activityIds: ["larp"], cache, search });
    expect(store.get("larp|utrecht|city|2026-10")).toEqual([]);
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

  it("keeps the cache per month: an answer from September is not an answer for October", async () => {
    const { cache } = memoryCache({ "yoga|utrecht|city|2026-09": [opt("Zomerbad")] });
    const search = vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, [opt("Winterbad")]])));
    const { byActivity } = await researchSeeds({ ...args, activityIds: ["yoga"], cache, search });
    expect(search).toHaveBeenCalledTimes(1);
    expect(byActivity.get("yoga")?.options[0].name).toBe("Winterbad");
  });

  it("searches again when every cached option has run out since", async () => {
    const { cache } = memoryCache({ "yoga|utrecht|city|2026-10": [opt("Herfstmarkt", "2026-10-10")] });
    const search = vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, [opt("Nieuwe markt", "2026-11-15")]])));
    const { byActivity } = await researchSeeds({ ...args, activityIds: ["yoga"], cache, search });
    expect(search).toHaveBeenCalledTimes(1);
    expect(byActivity.get("yoga")?.options.map((o) => o.name)).toEqual(["Nieuwe markt"]);
  });

  it("throws away options whose website does not exist before they are stored, and counts them", async () => {
    const { cache, store } = memoryCache();
    const search = vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, [opt("Echt"), opt("Verzonnen")]])));
    const verify = vi.fn(async (options: LocalOption[]) => ({
      kept: options.filter((o) => o.name === "Echt"),
      dropped: options.filter((o) => o.name !== "Echt").map((option) => ({ option, reason: "host_does_not_exist" })),
    }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { byActivity, stats } = await researchSeeds({ ...args, activityIds: ["yoga"], cache, search, verify });
    warn.mockRestore();
    expect(byActivity.get("yoga")?.options.map((o) => o.name)).toEqual(["Echt"]);
    expect(stats.dropped).toBe(1);
    expect(store.get("yoga|utrecht|city|2026-10")?.map((o) => o.name)).toEqual(["Echt"]);
  });

  it("works without a cache", async () => {
    const search = vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, [opt(id)]])));
    const { byActivity } = await researchSeeds({ ...args, activityIds: ["yoga"], cache: null, search });
    expect(byActivity.get("yoga")?.options).toHaveLength(1);
  });
});
