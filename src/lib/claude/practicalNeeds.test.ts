import { describe, expect, it, vi } from "vitest";
import { buildResearchPrompt, needsBlock, researchNeedsFrom, researchSeeds, type LocalOption, type ResearchCache } from "@/lib/claude/localResearch";
import { practicalNeedsPrompt } from "@/lib/claude/generateFromSeeds";
import { defaultEngineLibrary, resolveConstraints, runEngine, passesConstraints, type EngineInput } from "@/lib/discovery/engine";
import { MINOR_UNSUITABLE } from "@/lib/discovery/audience";
import { whyNot } from "@/lib/discovery/engine/droppedPicks";
import { getActivity } from "@/lib/discovery/library";

// Practical wishes of the start page (evening, no car, step-free, with children). The engine has no data to filter most of them on, so
// they must reach the places we do have a say: the research step (which venue is a good one), the writer (what to tell the person)
// and, for children, the selection itself (what is not for children stays out).

const NOW = new Date("2026-10-25T10:00:00+01:00");
const opt = (name: string): LocalOption => ({ name, city: "Utrecht", url: null, note: "x", until: null, rating: null });

describe("practical needs in the research step", () => {
  it("reads the relevant wishes from the engine flags, in a fixed order, ignoring the rest", () => {
    expect(researchNeedsFrom(["children", "dietary", "evening", "cost_unknown", "transport"])).toEqual(["evening", "transport", "children"]);
    expect(researchNeedsFrom([])).toEqual([]);
  });

  it("adds a paragraph only when there is a wish, and never lets it override the rule that an option must exist", () => {
    expect(needsBlock([])).toBe("");
    const text = buildResearchPrompt(["yoga"], "Utrecht", "city", "nl", NOW, false, ["evening", "transport"]);
    expect(text).toContain("well lit");
    expect(text).toContain("public transport");
    expect(text).toContain("never lets you list something that fails the rules below");
    expect(buildResearchPrompt(["yoga"], "Utrecht", "city", "nl", NOW)).not.toContain("well lit");
  });

  it("keeps answers for different wishes apart in the cache, and shares the plain answers", async () => {
    const store = new Map<string, LocalOption[]>();
    const cache: ResearchCache = {
      get: async (ids, place) => new Map(ids.flatMap((id) => (store.has(`${id}|${place}`) ? [[id, store.get(`${id}|${place}`)!] as const] : []))),
      put: async (entries, place) => { for (const e of entries) store.set(`${e.activityId}|${place}`, e.options); },
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const search = vi.fn(async (ids: string[], ..._rest: unknown[]) => new Map(ids.map((id) => [id, [opt("Studio")]])));
    const base = { location: "Utrecht", searchDistance: "city", locale: "nl" as const, now: NOW, cache, search, verify: false as const, activityIds: ["yoga"] };
    await researchSeeds({ ...base, needs: ["evening"] });
    await researchSeeds({ ...base, needs: ["evening"] }); // same wish: served from the cache
    expect(search).toHaveBeenCalledTimes(1);
    await researchSeeds({ ...base }); // no wish: a different key, searched again
    expect(search).toHaveBeenCalledTimes(2);
    expect([...store.keys()].some((k) => k.endsWith("|n:evening"))).toBe(true);
    // the wishes arrive in the search call
    expect(search.mock.calls[0][6]).toEqual(["evening"]);
    expect(search.mock.calls[1][6]).toEqual([]);
  });
});

describe("practical needs in the writing", () => {
  it("is empty without a wish and carries each wish as a rule, never an invented fact", () => {
    expect(practicalNeedsPrompt([])).toBe("");
    const text = practicalNeedsPrompt(["evening", "children"]);
    expect(text).toContain("evening");
    expect(text).toContain("never suggest being somewhere remote or unlit after dark".replace("never", "Never"));
    expect(text).toContain("minimum age");
    expect(text).not.toContain("parking");
    expect(practicalNeedsPrompt(["transport"])).toContain("Never assume parking");
  });
});

describe("going with children", () => {
  const base: EngineInput = {
    interests: [], interestDomains: [], socialFormats: [], practicalToWild: "balanced", budget: "100", effort: "some",
    timeAvailable: "halfday", ageCategory: "35-44", mustHaves: "Kinderen", seed: "kids", month: 6,
  };

  it("leaves out what is not for children, like a search for a young person does", () => {
    const c = resolveConstraints(base);
    expect(c.withKids).toBe(true);
    for (const id of ["schietles", "bier-brouwen", "mes-smeden", "paaldansen"]) {
      const a = getActivity(id)!;
      expect(passesConstraints(a, c).ok, id).toBe(false);
      expect(whyNot(a, c), id).toBe("kids");
    }
    expect(passesConstraints(getActivity("pottenbakken")!, c).ok).toBe(true);
    // without the wish nothing changes
    expect(resolveConstraints({ ...base, mustHaves: "" }).withKids).toBeUndefined();
  });

  it("never offers a parent with children an idea from the unsuitable list (40 profiles with varied picks)", () => {
    const acts = defaultEngineLibrary().activities;
    for (let i = 0; i < 40; i++) {
      const picks = acts.filter((_, k) => (k * 7 + i) % 31 === 0).slice(0, 4).map((a) => a.id);
      const r = runEngine({ ...base, interests: picks, seed: `kids-${i}`, month: (i % 12) + 1 });
      for (const s of r.seeds) expect(MINOR_UNSUITABLE.has(s.activityId), `${s.activityId} #${i}`).toBe(false);
    }
  }, 120_000);
});
