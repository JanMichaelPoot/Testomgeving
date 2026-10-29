import { describe, expect, it } from "vitest";
import { defaultEngineLibrary, parseMustHaves, passesConstraints, resolveConstraints, selectSeeds } from "@/lib/discovery/engine";
import type { EngineLibrary } from "@/lib/discovery/engine";
import type { EngineInput } from "@/lib/discovery/engine";
import { evaluate, runProfiles } from "@/lib/discovery/engine/evaluate";
import { syntheticProfiles } from "@/lib/discovery/engine/synthetic";
import type { Activity, Hybrid, Tag } from "@/lib/discovery/types";

const lib = defaultEngineLibrary();
const byId = new Map(lib.activities.map((a) => [a.id, a]));

const BASE: EngineInput = {
  interests: [],
  interestDomains: [],
  socialFormats: [],
  practicalToWild: "either",
  budget: "100",
  effort: "some",
  timeAvailable: "halfday",
  ageCategory: "35-44",
  mustHaves: "",
  history: [],
  seed: "t1",
};

describe("parseMustHaves", () => {
  it("reads a single, clear wish about where it happens", () => {
    expect(parseMustHaves("Moet buiten zijn").setting).toBe("outdoor");
    expect(parseMustHaves("liefst binnen, het regent vaak").setting).toBe("indoor");
    expect(parseMustHaves("must be outdoors").setting).toBe("outdoor");
  });

  it("ignores contradictions and negations instead of guessing", () => {
    expect(parseMustHaves("buiten of binnen, maakt niet uit").setting).toBeNull();
    expect(parseMustHaves("niet per se buiten").setting).toBeNull();
  });

  it("recognises 'no groups', and no longer reads 'free' as a filter (Fase 3)", () => {
    expect(parseMustHaves("geen groepen").noGroups).toBe(true);
    expect(parseMustHaves("").noGroups).toBe(false);
    expect(parseMustHaves("Gratis graag")).not.toHaveProperty("free");
    // The budget alone sets the cost limit: a typed "gratis" does not tighten it.
    const open = resolveConstraints({ ...BASE, budget: "100", mustHaves: "Gratis graag" });
    expect(open.costCap).toBe(3);
    expect(open.nearBudgetCost).toBe(3);
  });

  it("flags what it cannot filter (no data) so it is not lost", () => {
    expect(parseMustHaves("Rolstoeltoegankelijk").verify).toContain("accessibility");
    expect(parseMustHaves("moet met de hond kunnen").verify).toContain("pet_friendly");
    expect(parseMustHaves("ik heb een notenallergie").verify).toContain("dietary");
  });
});

describe("passesConstraints", () => {
  const c = resolveConstraints({ ...BASE, budget: "free", effort: "minimal", practicalToWild: "grounded", socialFormats: ["solo"] });
  const base = byId.get("hardlopen")!;
  const patch = (p: Partial<Activity>): Activity => ({ ...base, ...p });

  it("excludes only on a known conflict", () => {
    expect(passesConstraints(patch({ cost: 2 }), c).ok).toBe(false);
    expect(passesConstraints(patch({ intensity: 3 }), c).ok).toBe(false);
    expect(passesConstraints(patch({ formats: ["large_group"] }), c).ok).toBe(false);
    expect(passesConstraints(patch({ cost: 0, intensity: 1, formats: ["solo"] }), c).ok).toBe(true);
  });

  it("lets unknown facets through and flags them for the research step", () => {
    const r = passesConstraints(patch({ cost: null, intensity: null, formats: null }), c);
    expect(r.ok).toBe(true);
    expect(r.verify).toContain("cost_unknown");
    expect(r.verify).toContain("formats_unknown");
  });

  it("hides supervised activities from cautious profiles only", () => {
    const supervised = patch({ safety: { tier: 2, note: { nl: "x", en: "x" } }, cost: 0, intensity: 0, formats: ["solo"] });
    expect(passesConstraints(supervised, c).ok).toBe(false);
    const open = resolveConstraints({ ...BASE, practicalToWild: "wild", budget: "free", effort: "minimal", socialFormats: ["solo"] });
    expect(passesConstraints(supervised, open).ok).toBe(true);
  });

  it("does not treat 'no preference' or 'depends on the day' as a restriction", () => {
    expect(resolveConstraints({ ...BASE, socialFormats: ["any"] }).formats).toBeNull();
    expect(resolveConstraints({ ...BASE, socialFormats: ["varies"] }).formats).toBeNull();
  });
});

describe("selectSeeds", () => {
  const picks = ["hardlopen", "boulderen", "pottenbakken"];

  it("gives six regular seeds and one wildcard, all different", () => {
    const { seeds } = selectSeeds({ ...BASE, interests: picks, interestDomains: ["movement", "creative"] }, lib);
    expect(seeds).toHaveLength(7);
    expect(seeds.filter((s) => s.direction === "wildcard")).toHaveLength(1);
    expect(seeds.at(-1)!.direction).toBe("wildcard");
    expect(new Set(seeds.map((s) => s.activityId)).size).toBe(7);
  });

  it("is deterministic for a seed and varies with another", () => {
    const input = { ...BASE, interests: picks };
    const a = selectSeeds(input, lib).seeds.map((s) => s.activityId);
    const b = selectSeeds(input, lib).seeds.map((s) => s.activityId);
    const c = selectSeeds({ ...input, seed: "t2" }, lib).seeds.map((s) => s.activityId);
    expect(a).toEqual(b);
    expect(c).not.toEqual(a);
  });

  it("builds the two familiar ideas from what they picked", () => {
    const { seeds } = selectSeeds({ ...BASE, interests: picks }, lib);
    const familiar = seeds.filter((s) => s.direction === "familiar");
    expect(familiar).toHaveLength(2);
    for (const s of familiar) expect(picks).toContain(s.activityId);
  });

  it("orders the six regular seeds by door and gives each direction its own door", () => {
    const { seeds } = selectSeeds({ ...BASE, interests: picks }, lib);
    const doors = seeds.filter((s) => s.direction !== "wildcard").map((s) => s.door);
    const order = ["natural", "discovery", "unexpected", "stretch"];
    expect(doors.map((d) => order.indexOf(d))).toEqual([...doors.map((d) => order.indexOf(d))].sort((x, y) => x - y));
    expect(seeds.find((s) => s.direction === "wildcard")!.door).toBe("wildcard");
  });

  it("never repeats what was shown recently, unless the person picked it again", () => {
    const first = selectSeeds({ ...BASE, interests: picks }, lib).seeds.map((s) => s.activityId);
    const second = selectSeeds({ ...BASE, interests: picks, history: first, seed: "t2" }, lib).seeds.map((s) => s.activityId);
    const repeated = second.filter((id) => first.includes(id) && !picks.includes(id));
    expect(repeated).toEqual([]);
    // Picks may return: a person who picks it again wants it.
    const again = selectSeeds({ ...BASE, interests: ["hardlopen"], history: ["hardlopen"] }, lib).seeds.map((s) => s.activityId);
    expect(again).toContain("hardlopen");
  });

  it("explains an unexpected idea by a chain or a curated combination", () => {
    const { seeds } = selectSeeds({ ...BASE, interests: picks }, lib);
    const u = seeds.find((s) => s.direction === "unexpected")!;
    expect(u.chain.length).toBeGreaterThanOrEqual(2);
    expect(u.chain[0]).not.toBe(u.activityId);
    expect(u.chain.at(-1)).toBe(u.activityId);
  });

  it("uses a curated combination when the person picked one half of it", () => {
    // A minimal library where the only far-away, bridged option is a curated combination.
    const tag = (id: string, generic = false): Tag => ({ id, generic, label: { nl: id, en: id } });
    const act = (id: string, domain: string, sub: string, tags: string[]): Activity => ({
      id, domain, sub, tags, label: { nl: id, en: id }, formats: ["solo"], intensity: 1, level: 0, cost: 1,
      duration: 2, setting: "both", safety: { tier: 0 }, entry: { nl: "x", en: "x" }, scene: "a scene without people", status: "concept",
    });
    const small: EngineLibrary = {
      tags: ["a", "b", "c", "d", "e", "f"].map((t) => tag(t)),
      activities: [
        act("pick", "d1", "s1", ["a", "b"]),
        act("partner", "d2", "s2", ["a", "b"]),
        ...["x1", "x2", "x3", "x4", "x5", "x6", "x7", "x8", "x9", "x10", "x11", "x12"].map((id, i) => act(id, `d${3 + (i % 4)}`, `s${i}`, ["e", "f", i % 2 ? "c" : "d"])),
      ],
      hybrids: [{ a: "pick", b: "partner", label: { nl: "Gecombineerd", en: "Combined" } } as Hybrid],
    };
    const { seeds } = selectSeeds({ ...BASE, interests: ["pick"] }, small);
    const u = seeds.find((s) => s.direction === "unexpected");
    expect(u?.activityId).toBe("partner");
    expect(u?.hybrid?.label.nl).toBe("Gecombineerd");
    expect(u?.chain).toEqual(["pick", "partner"]);
  });

  it("gives a broad, varied set when nothing is known, with doors by how demanding it is", () => {
    const { seeds, notes } = selectSeeds({ ...BASE, surpriseMe: true }, lib);
    expect(notes).toContain("surprise_me");
    const regular = seeds.filter((s) => s.direction !== "wildcard");
    expect(regular).toHaveLength(6);
    expect(new Set(regular.map((s) => byId.get(s.activityId)!.domain)).size).toBe(6);
    expect(regular[0].door).toBe("natural");
  });

  it("uses the chosen worlds when there are no cards", () => {
    const { seeds, notes } = selectSeeds({ ...BASE, interestDomains: ["creative"] }, lib);
    expect(notes).toContain("worlds_only");
    expect(seeds.filter((s) => s.direction === "familiar").every((s) => byId.get(s.activityId)!.domain === "creative")).toBe(true);
  });

  it("leads with the social form they chose and never with one they did not", () => {
    const { seeds } = selectSeeds({ ...BASE, interests: picks, socialFormats: ["drop_in_alone"] }, lib);
    for (const s of seeds) {
      const a = byId.get(s.activityId)!;
      if (a.formats) {
        expect(a.formats).toContain("drop_in_alone");
        expect(s.lead).toBe("drop_in_alone");
      }
    }
  });

  it("passes on what it cannot check, such as accessibility", () => {
    const { seeds } = selectSeeds({ ...BASE, interests: picks, mustHaves: "Rolstoeltoegankelijk" }, lib);
    expect(seeds.every((s) => s.verify.includes("accessibility"))).toBe(true);
  });
});

describe("seasons", () => {
  const picks = ["open-water", "schaatsen", "paddenstoelen"];
  const idsOf = (month: number, extra: Partial<EngineInput> = {}) =>
    selectSeeds({ ...BASE, interests: picks, interestDomains: ["nature"], month, ...extra }, lib).seeds.map((s) => s.activityId);

  it("never suggests an activity outside its months, not even one the person picked", () => {
    expect(idsOf(1)).not.toContain("open-water");
    expect(idsOf(7)).not.toContain("schaatsen");
    expect(idsOf(7)).not.toContain("paddenstoelen");
    expect(idsOf(10)).not.toContain("open-water");
  });

  it("does suggest them in season", () => {
    const all = new Set([...[7, 8, 9].flatMap((m) => idsOf(m)), ...[11, 12, 1].flatMap((m) => idsOf(m)), ...[10, 11].flatMap((m) => idsOf(m))]);
    expect(all.has("open-water")).toBe(true);
    expect(all.has("schaatsen")).toBe(true);
    expect(all.has("paddenstoelen")).toBe(true);
  });

  it("passesConstraints is the one place that decides: an out-of-season activity is a known conflict", () => {
    const water = byId.get("open-water")!;
    expect(passesConstraints(water, resolveConstraints({ ...BASE, budget: "allin", month: 7 })).ok).toBe(true);
    expect(passesConstraints(water, resolveConstraints({ ...BASE, budget: "allin", month: 1 })).ok).toBe(false);
    expect(passesConstraints(water, resolveConstraints({ ...BASE, budget: "allin" })).ok).toBe(true); // no month: no filter
  });

  it("leaves out what must not be suggested (no real local offer was found)", () => {
    const first = selectSeeds({ ...BASE, interests: ["pottenbakken"], seed: "x", month: 6 }, lib).seeds.map((s) => s.activityId);
    expect(first).toContain("pottenbakken");
    const again = selectSeeds({ ...BASE, interests: ["pottenbakken"], seed: "x", month: 6, exclude: ["pottenbakken"] }, lib).seeds.map((s) => s.activityId);
    expect(again).not.toContain("pottenbakken");
    expect(again.length).toBeGreaterThanOrEqual(6);
  });
});

describe("acceptance criteria over synthetic profiles (E1-E8)", () => {
  for (const seed of ["regression-1", "regression-2"]) {
    const profiles = syntheticProfiles(200, seed, lib);
    const report = evaluate(runProfiles(profiles, lib), lib);

    it(`${seed}: no hard rule is ever broken (E1 constraints, E3 repetition, E4 one wildcard, E5 social choice, E6 safety)`, () => {
      expect(report.violations.E1).toEqual([]);
      expect(report.violations.E3).toEqual([]);
      expect(report.violations.E4).toEqual([]);
      expect(report.violations.E5).toEqual([]);
      expect(report.violations.E6).toEqual([]);
    });

    it(`${seed}: the set is varied and complete (E2, E8)`, () => {
      expect(report.rates.seedsAtLeastSix).toBeGreaterThanOrEqual(0.98);
      expect(report.rates.fourDomains).toBeGreaterThanOrEqual(0.98);
      expect(report.rates.maxTwoPerDomain).toBeGreaterThanOrEqual(0.97);
      expect(report.rates.allDirections).toBeGreaterThanOrEqual(0.95);
      expect(report.rates.nicheOwnWorld).toBeGreaterThanOrEqual(0.95);
      expect(report.rates.unexpectedHasBridge).toBeGreaterThanOrEqual(0.95);
    });
  }
});

describe("variety (Stap 88): the long tail is lifted, the same few activities do not lead every book", () => {
  it("scores rare tag mixes above hubs", async () => {
    const { buildGraph } = await import("@/lib/discovery/engine/graph");
    const graph = buildGraph(lib.activities, lib.tags);
    for (const a of lib.activities) {
      expect(graph.rarity(a)).toBeGreaterThanOrEqual(0);
      expect(graph.rarity(a)).toBeLessThanOrEqual(1);
    }
    expect(graph.rarity(byId.get("glasblazen")!)).toBeGreaterThan(graph.rarity(byId.get("wandelen")!));
  });

  it("goes easy on activities that need a provider that may not be near", async () => {
    const { supplyPenalty } = await import("@/lib/discovery/engine/select");
    expect(supplyPenalty(byId.get("grotduiken")!)).toBeGreaterThan(supplyPenalty(byId.get("glasblazen")!));
    expect(supplyPenalty(byId.get("glasblazen")!)).toBeGreaterThan(supplyPenalty(byId.get("wandelen")!));
    expect(supplyPenalty(byId.get("wandelen")!)).toBe(0);
  });

  it("spreads over the library: no activity leads more than a fifth of the books, and most of the library is used", () => {
    const books = runProfiles(syntheticProfiles(200, "variety-test", lib), lib).map((r) => new Set(r.result.seeds.map((s) => s.activityId)));
    const count = new Map<string, number>();
    for (const b of books) for (const id of b) count.set(id, (count.get(id) ?? 0) + 1);
    expect(Math.max(...count.values()) / books.length).toBeLessThan(0.2);
    expect(count.size).toBeGreaterThan(lib.activities.length * 0.6);
  }, 120_000);

  it("includes the new, exotic activities in the library the engine draws from", () => {
    for (const id of ["grotduiken", "meswerpen", "canyoning", "schietles", "escape-room", "abseilen", "boulderen"]) expect(byId.has(id), id).toBe(true);
  });
});
