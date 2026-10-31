// Free (no API): how much of the person's own page-2 choices end up in the book, per engine, over simulated two-page visitors.
//   npx tsx scripts/anchor-measure.ts [visitors]
import { syntheticTwoPageProfiles } from "../src/lib/discovery/engine/syntheticTwoPages";
import { computeMetrics } from "../src/lib/discovery/eval/metrics";
import { ENGINE_NAMES, getEngine } from "../src/lib/discovery/eval/engines";
import type { Run } from "../src/lib/discovery/engine/evaluate";

const N = Number(process.argv[2] ?? 500);
const profiles = syntheticTwoPageProfiles(N, "anchor-1");
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

for (const name of ENGINE_NAMES) {
  const engine = getEngine(name);
  const runs: Run[] = profiles.map((profile) => {
    const s1 = engine.select({ ...profile.input, history: [] });
    const ids1 = s1.seeds.map((s) => s.activityId);
    const s2 = engine.select({ ...profile.input, seed: `${profile.input.seed}-s2`, history: ids1 });
    const s3 = engine.select({ ...profile.input, seed: `${profile.input.seed}-s3`, history: [...ids1, ...s2.seeds.map((s) => s.activityId)] });
    return { profile, result: s1, sessions: [s1, s2, s3] };
  });
  const m = computeMetrics(runs, engine.library, { strictFreeCost: engine.weights.strictFreeCost });
  const v = m.violations;
  console.log(
    `${name.padEnd(8)} own picks in book: ${pct(m.pickCoverage.mean)} (mean ${m.pickCoverage.meanInBook.toFixed(2)}), goal met ${pct(m.pickCoverage.goalMet)}, none ${pct(m.pickCoverage.none)} | worlds ${m.worldsPerBook.toFixed(2)}, 7 levels ${pct(m.levelCompleteBooks)}, top activity ${pct(m.topActivity.share)}, pair-books ${pct(m.pairBooks)} | E1 ${v.E1} E3 ${v.E3} E4 ${v.E4} E5 ${v.E5} E6 ${v.E6}`,
  );
}
