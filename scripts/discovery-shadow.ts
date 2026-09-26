// Offline check of the discovery selection engine on synthetic profiles: the
// automatic acceptance criteria (E1-E8 of the test plan) plus a few example
// results. No API calls, no cost.
//
//   npx tsx scripts/discovery-shadow.ts                 200 profiles, summary
//   npx tsx scripts/discovery-shadow.ts --n 500 --seed abc
//   npx tsx scripts/discovery-shadow.ts --show 5        also print 5 example results
import { getActivity } from "../src/lib/discovery/library";
import { defaultEngineLibrary } from "../src/lib/discovery/engine";
import { evaluate, runProfiles } from "../src/lib/discovery/engine/evaluate";
import { syntheticProfiles } from "../src/lib/discovery/engine/synthetic";

const args = process.argv.slice(2);
const value = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const n = Number(value("n") ?? 200);
const seed = value("seed") ?? "shadow-1";
const show = Number(value("show") ?? 0);

const lib = defaultEngineLibrary();
const profiles = syntheticProfiles(n, seed, lib);
const runs = runProfiles(profiles, lib);
const report = evaluate(runs, lib);

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
console.log(`\n${report.profiles} synthetic profiles (seed ${seed})\n`);
console.log("Hard rules (must be 0 violations):");
for (const [k, list] of Object.entries(report.violations)) {
  console.log(`  ${k}: ${list.length}${list.length ? "   e.g. " + list.slice(0, 3).join(" | ") : ""}`);
}
console.log("\nSoft criteria:");
const r = report.rates;
console.log(`  six regular ideas .............. ${pct(r.seedsAtLeastSix)}`);
console.log(`  at least 4 worlds .............. ${pct(r.fourDomains)}`);
console.log(`  at most 2 per world ............ ${pct(r.maxTwoPerDomain)}`);
console.log(`  all four directions ............ ${pct(r.allDirections)}`);
console.log(`  niche gets its own world (E8) .. ${pct(r.nicheOwnWorld)}`);
console.log(`  unexpected is explainable ...... ${pct(r.unexpectedHasBridge)}`);
console.log(`  no rule had to be relaxed ...... ${pct(r.noRelaxation)}`);
// Concentration, comparable with scripts/discovery-baseline.ts: does the same idea keep coming back?
const perActivity = new Map<string, number>();
let worldsTotal = 0;
for (const run of runs) {
  const worlds = new Set<string>();
  for (const s of run.result.seeds) {
    perActivity.set(s.activityId, (perActivity.get(s.activityId) ?? 0) + 1);
    worlds.add(getActivity(s.activityId)!.domain);
  }
  worldsTotal += worlds.size;
}
const top = [...perActivity.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
console.log("\nSpread across profiles:");
console.log(`  average worlds per book ........ ${(worldsTotal / runs.length).toFixed(1)} of 10 (out of about 7 ideas)`);
console.log(`  library activities used ........ ${perActivity.size} of ${lib.activities.length}`);
console.log(`  most frequent ideas ............ ${top.map(([id, c]) => `${getActivity(id)?.label.nl} in ${((c / runs.length) * 100).toFixed(0)}% of books`).join("; ")}`);
console.log("\nNotes (how often a fallback was used):", report.notes);

for (const run of runs.slice(0, show)) {
  const i = run.profile.input;
  console.log(`\n== ${run.profile.id} [${run.profile.archetype}] picks: ${i.interests.map((id) => getActivity(id)?.label.nl).join(", ") || "-"} | social: ${i.socialFormats.join(",") || "-"} | dial ${i.practicalToWild}, budget ${i.budget}, effort ${i.effort} | must: ${i.mustHaves || "-"}`);
  for (const s of run.result.seeds) {
    const chain = s.chain.length > 1 ? "  via " + s.chain.map((id) => getActivity(id)?.label.nl).join(" → ") : "";
    const hy = s.hybrid ? `  (= ${s.hybrid.label.nl})` : "";
    console.log(`  ${s.direction.padEnd(10)} ${getActivity(s.activityId)?.label.nl}${hy}${chain}  [${s.lead ?? "-"}]${s.verify.length ? " verify:" + s.verify.join(",") : ""}`);
  }
  if (run.result.notes.length) console.log(`  notes: ${run.result.notes.join(", ")}`);
}
const bad = Object.values(report.violations).reduce((s, l) => s + l.length, 0);
process.exit(bad === 0 ? 0 : 1);
