import { BRIDGE_MIN, buildGraph } from "@/lib/discovery/engine/graph";
import { selectSeeds, type EngineLibrary } from "@/lib/discovery/engine/select";
import type { SyntheticProfile } from "@/lib/discovery/engine/synthetic";
import type { EngineInput, EngineResult } from "@/lib/discovery/engine/types";

// Measures the engine's rules over a set of profiles: the automatic acceptance
// criteria E1-E8 of the test plan. Used by the vitest regression test and by
// scripts/discovery-shadow.ts. The hard-constraint check (E1) is written out again
// here on purpose, straight from the input, so a bug in the engine's own filter
// cannot hide itself.

// A cost class is a range (0 free, 1 <=15, 2 15-50, 3 >50): "up to 25" allows class 2, "up to 100" class 3.
const COST_CAP: Record<string, number> = { free: 0, "25": 2, "100": 3, allin: 3 };
const INTENSITY_CAP: Record<string, number> = { minimal: 1, some: 2, committed: 3 };

export interface Run {
  profile: SyntheticProfile;
  result: EngineResult;
  /** Three consecutive sessions for the repetition check (E3). */
  sessions: EngineResult[];
}

export interface Report {
  profiles: number;
  /** Lists of "profile: problem" strings; empty = the criterion holds. */
  violations: Record<"E1" | "E3" | "E4" | "E5" | "E6", string[]>;
  /** Share of profiles (0..1) that meet a softer criterion. */
  rates: {
    seedsAtLeastSix: number;
    fourDomains: number;
    maxTwoPerDomain: number;
    allDirections: number;
    nicheOwnWorld: number;
    unexpectedHasBridge: number;
    noRelaxation: number;
  };
  notes: Record<string, number>;
}

export function runProfiles(profiles: readonly SyntheticProfile[], lib: EngineLibrary): Run[] {
  return profiles.map((profile) => {
    const s1 = selectSeeds({ ...profile.input, history: [] }, lib);
    const ids1 = s1.seeds.map((s) => s.activityId);
    const s2 = selectSeeds({ ...profile.input, seed: `${profile.input.seed}-s2`, history: ids1 }, lib);
    const ids2 = s2.seeds.map((s) => s.activityId);
    const s3 = selectSeeds({ ...profile.input, seed: `${profile.input.seed}-s3`, history: [...ids1, ...ids2] }, lib);
    return { profile, result: s1, sessions: [s1, s2, s3] };
  });
}

const rate = (hits: number, of: number) => (of === 0 ? 1 : hits / of);

export function evaluate(runs: readonly Run[], lib: EngineLibrary): Report {
  const byId = new Map(lib.activities.map((a) => [a.id, a]));
  const graph = buildGraph(lib.activities.filter((a) => a.status !== "retired"), lib.tags);
  const v: Report["violations"] = { E1: [], E3: [], E4: [], E5: [], E6: [] };
  const notes: Record<string, number> = {};
  const hits = { six: 0, four: 0, cap2: 0, dirs: 0, niche: 0, nicheOf: 0, unexp: 0, unexpOf: 0, clean: 0 };

  for (const { profile, result, sessions } of runs) {
    const input: EngineInput = profile.input;
    const pickSet = new Set(input.interests);
    const seeds = result.seeds;
    for (const n of result.notes) notes[n.split(":")[0]] = (notes[n.split(":")[0]] ?? 0) + 1;
    // Informational notes (no picks, surprise me, ...) are not relaxations.
    if (!result.notes.some((n) => /^(direction_|filled|pool_small)/.test(n))) hits.clean++;

    // E1: hard constraints, straight from the input.
    const costCap = /gratis/i.test(input.mustHaves) ? 0 : (COST_CAP[input.budget] ?? 2);
    const intCap = INTENSITY_CAP[input.effort] ?? 2;
    const explicit = input.socialFormats.filter((f) => f !== "any" && f !== "varies");
    const hide = input.practicalToWild === "grounded" || input.practicalToWild === "practical";
    for (const s of seeds) {
      const a = byId.get(s.activityId)!;
      const at = `${profile.id} ${a.id}`;
      if (a.cost !== null && a.cost > costCap) v.E1.push(`${at}: cost ${a.cost} > cap ${costCap}`);
      if (a.intensity !== null && a.intensity > intCap) v.E1.push(`${at}: intensity ${a.intensity} > cap ${intCap}`);
      if (/buiten/i.test(input.mustHaves) && a.setting === "indoor") v.E1.push(`${at}: indoor but must be outdoors`);
      if (/binnen/i.test(input.mustHaves) && a.setting === "outdoor") v.E1.push(`${at}: outdoor but must be indoors`);
      if (/geen groepen/i.test(input.mustHaves) && a.formats && a.formats.every((f) => f === "small_group" || f === "large_group")) {
        v.E1.push(`${at}: group-only but "no groups"`);
      }
      // E5: an explicit social choice is respected and led with.
      if (explicit.length > 0 && a.formats) {
        if (!a.formats.some((f) => explicit.includes(f))) v.E5.push(`${at}: supports none of ${explicit.join("/")}`);
        else if (s.lead === null || !explicit.includes(s.lead)) v.E5.push(`${at}: does not lead with a chosen form`);
      }
      // E6: supervised activities only for people open to less predictable things.
      if (a.safety.tier === 2) {
        if (hide) v.E6.push(`${at}: supervised activity offered to a cautious profile`);
        if (!a.safety.note?.nl || !a.safety.note?.en) v.E6.push(`${at}: supervised activity without a safety note`);
      }
    }

    // E4: exactly one wildcard.
    // (Exempt: contradictory input that leaves fewer than seven activities to choose from.)
    const wild = seeds.filter((s) => s.direction === "wildcard").length;
    const exhausted = result.notes.includes("pool_small") && seeds.length < 7;
    if (wild !== 1 && !exhausted) v.E4.push(`${profile.id}: ${wild} wildcards`);

    // E3: nothing repeated from the previous two sessions unless picked again.
    for (let k = 1; k < sessions.length; k++) {
      const prev = new Set(sessions.slice(Math.max(0, k - 2), k).flatMap((r) => r.seeds.map((s) => s.activityId)));
      for (const s of sessions[k].seeds) {
        if (prev.has(s.activityId) && !pickSet.has(s.activityId)) v.E3.push(`${profile.id} session ${k + 1}: ${s.activityId} repeated`);
      }
    }

    // Soft criteria.
    const regular = seeds.filter((s) => s.direction !== "wildcard");
    if (regular.length >= 6) hits.six++;
    const domains = seeds.map((s) => byId.get(s.activityId)!.domain);
    if (new Set(domains).size >= 4) hits.four++;
    const perDomain = new Map<string, number>();
    for (const d of domains) perDomain.set(d, (perDomain.get(d) ?? 0) + 1);
    if ([...perDomain.values()].every((n) => n <= 2)) hits.cap2++;
    const dirs = new Set(seeds.map((s) => s.direction));
    if (dirs.has("explore") || (dirs.has("familiar") && dirs.has("adjacent") && dirs.has("unexpected") && dirs.has("stretch"))) hits.dirs++;

    // E8: a niche gets its own world in at least two of the six ideas (when that is possible).
    if (profile.archetype === "niche" && profile.nicheDomain) {
      const possible = lib.activities.filter((a) => a.domain === profile.nicheDomain && a.status !== "retired").filter((a) => {
        const cost = a.cost === null || a.cost <= costCap;
        const inten = a.intensity === null || a.intensity <= intCap;
        const sup = !(a.safety.tier === 2 && hide);
        const fmt = explicit.length === 0 || !a.formats || a.formats.some((f) => explicit.includes(f));
        return cost && inten && sup && fmt;
      });
      if (possible.length >= 2) {
        hits.nicheOf++;
        const own = regular.filter((s) => byId.get(s.activityId)!.domain === profile.nicheDomain).length;
        if (own >= 2) hits.niche++;
      }
    }

    // An unexpected idea must be explainable: a curated combination or a chain with real bridges.
    for (const s of seeds.filter((x) => x.direction === "unexpected")) {
      hits.unexpOf++;
      const bridged = s.chain.length >= 2 && s.chain.slice(1).every((id, i) => graph.bridge(byId.get(s.chain[i])!, byId.get(id)!) >= BRIDGE_MIN);
      if (s.hybrid || bridged) hits.unexp++;
    }
  }

  const n = runs.length;
  return {
    profiles: n,
    violations: v,
    rates: {
      seedsAtLeastSix: rate(hits.six, n),
      fourDomains: rate(hits.four, n),
      maxTwoPerDomain: rate(hits.cap2, n),
      allDirections: rate(hits.dirs, n),
      nicheOwnWorld: rate(hits.niche, hits.nicheOf),
      unexpectedHasBridge: rate(hits.unexp, hits.unexpOf),
      noRelaxation: rate(hits.clean, n),
    },
    notes,
  };
}
