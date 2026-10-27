import type { Run } from "@/lib/discovery/engine/evaluate";
import type { SyntheticProfile } from "@/lib/discovery/engine/synthetic";
import type { EvalEngine } from "@/lib/discovery/eval/engines";

/**
 * Runs every profile through an engine: the book itself plus two follow-up sessions with the earlier
 * ideas as history (the repetition check E3 needs them). Same shape and same seeds as
 * engine/evaluate.ts `runProfiles`, so a "current" run reproduces the numbers of the shadow run.
 */
export function runWithEngine(profiles: readonly SyntheticProfile[], engine: EvalEngine): Run[] {
  return profiles.map((profile) => {
    const s1 = engine.select({ ...profile.input, history: [] });
    const ids1 = s1.seeds.map((s) => s.activityId);
    const s2 = engine.select({ ...profile.input, seed: `${profile.input.seed}-s2`, history: ids1 });
    const ids2 = s2.seeds.map((s) => s.activityId);
    const s3 = engine.select({ ...profile.input, seed: `${profile.input.seed}-s3`, history: [...ids1, ...ids2] });
    return { profile, result: s1, sessions: [s1, s2, s3] };
  });
}
