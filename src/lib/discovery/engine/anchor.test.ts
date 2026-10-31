import { describe, expect, it } from "vitest";
import { defaultEngineLibrary } from "@/lib/discovery/engine";
import { selectSeeds } from "@/lib/discovery/engine/select";
import { WEIGHTS_ANCHOR, WEIGHTS_CURRENT, WEIGHTS_V2 } from "@/lib/discovery/engine/weights";
import { whyNot } from "@/lib/discovery/engine/droppedPicks";
import { syntheticTwoPageProfiles } from "@/lib/discovery/engine/syntheticTwoPages";
import { evaluate, type Run } from "@/lib/discovery/engine/evaluate";
import { getActivity } from "@/lib/discovery/library";

// Stap 125, the anchor model: with three or more usable choices of their own, up to four of them are seeds themselves,
// one idea is built around them, one is unexpected, and the wildcard stays separate. Free: no model, no research.

const lib = defaultEngineLibrary();
const profiles = syntheticTwoPageProfiles(60, "anchor-test");

const usable = (id: string, result: ReturnType<typeof selectSeeds>) => {
  const a = getActivity(id);
  return !!a && whyNot(a, result.constraints, { explicitPick: true }) === null;
};

describe("the anchor model", () => {
  it("is off in every set but WEIGHTS_ANCHOR, so nothing changes for the ones that ship today", () => {
    expect(WEIGHTS_CURRENT.anchor.picks).toBe(0);
    expect(WEIGHTS_V2.anchor.picks).toBe(0);
    expect(WEIGHTS_ANCHOR.anchor.picks).toBe(4);
  });

  it("puts min(4, usable choices) of the person's own choices in the book, seven ideas, one wildcard", () => {
    for (const p of profiles) {
      const off = selectSeeds(p.input, lib, { weights: WEIGHTS_V2 });
      const on = selectSeeds(p.input, lib, { weights: WEIGHTS_ANCHOR });
      const own = [...new Set(p.input.interests)].filter((id) => usable(id, on));
      const inBook = own.filter((id) => on.seeds.some((s) => s.activityId === id)).length;
      if (own.length >= 3) {
        expect(inBook, p.id).toBeGreaterThanOrEqual(Math.min(4, own.length));
        expect(on.notes.some((n) => n.startsWith("anchor_picks:")), p.id).toBe(true);
      } else {
        // fewer than three usable choices: the ordinary structure, bit for bit
        expect(on.seeds.map((s) => s.activityId), p.id).toEqual(off.seeds.map((s) => s.activityId));
      }
      expect(on.seeds.length, p.id).toBeGreaterThanOrEqual(6);
      expect(on.seeds.filter((s) => s.direction === "wildcard"), p.id).toHaveLength(1);
      expect(new Set(on.seeds.map((s) => s.activityId)).size, p.id).toBe(on.seeds.length);
    }
  }, 120000);

  it("does not weaken the picks of the person who gave fewer than three", () => {
    const base = profiles[0];
    const few = { ...base.input, interests: base.input.interests.slice(0, 2) };
    const off = selectSeeds(few, lib, { weights: WEIGHTS_V2 });
    const on = selectSeeds(few, lib, { weights: WEIGHTS_ANCHOR });
    expect(on.seeds.map((s) => s.activityId)).toEqual(off.seeds.map((s) => s.activityId));
  });

  it("is only for choices the person made themselves: image-derived interests are not anchored", () => {
    const base = profiles.find((p) => p.input.interests.length >= 4)!;
    const derived = { ...base.input, explicitPicks: false };
    const off = selectSeeds(derived, lib, { weights: WEIGHTS_V2 });
    const on = selectSeeds(derived, lib, { weights: WEIGHTS_ANCHOR });
    expect(on.seeds.map((s) => s.activityId)).toEqual(off.seeds.map((s) => s.activityId));
  });

  it("never breaks a hard rule (E1, E3, E4, E5, E6) over the simulated visitors", () => {
    const runs: Run[] = profiles.map((profile) => {
      const s1 = selectSeeds({ ...profile.input, history: [] }, lib, { weights: WEIGHTS_ANCHOR });
      const ids1 = s1.seeds.map((s) => s.activityId);
      const s2 = selectSeeds({ ...profile.input, seed: `${profile.input.seed}-s2`, history: ids1 }, lib, { weights: WEIGHTS_ANCHOR });
      const s3 = selectSeeds({ ...profile.input, seed: `${profile.input.seed}-s3`, history: [...ids1, ...s2.seeds.map((s) => s.activityId)] }, lib, { weights: WEIGHTS_ANCHOR });
      return { profile, result: s1, sessions: [s1, s2, s3] };
    });
    const report = evaluate(runs, lib, { strictFreeCost: true });
    for (const k of ["E1", "E3", "E4", "E5", "E6"] as const) expect(report.violations[k], k).toEqual([]);
  }, 300000);

  it("keeps every anchored idea tied to a choice of the person: the picks carry 'picked', the rest a chain from a pick", () => {
    const p = profiles.find((x) => new Set(x.input.interests).size >= 4)!;
    const r = selectSeeds(p.input, lib, { weights: WEIGHTS_ANCHOR });
    const picks = new Set(p.input.interests);
    for (const s of r.seeds) {
      if (s.direction === "wildcard") continue;
      if (picks.has(s.activityId)) expect(s.reasons).toContain("picked");
      else if (s.direction === "adjacent") expect(picks.has(s.chain[0]), s.activityId).toBe(true);
    }
  });
});
