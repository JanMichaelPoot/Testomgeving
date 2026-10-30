// Measures the two image pages over simulated visitors (no API, no cost): how balanced page 1 is, how page 2 follows the
// register mix of page 1, how much of it lies outside the visitor's own taste, and how much variety there is.
//   npx tsx scripts/twopages-measure.ts [visitors]
import { ASSOCIATIONS, activityAxes, hasOwnImage } from "../src/lib/discovery/associations";
import { TAGS, getActivities } from "../src/lib/discovery/library";
import { tagProfile, averageAxes } from "../src/lib/discovery/associationProfile";
import { registerOfActivity, registerOfCard } from "../src/lib/discovery/register";
import { hashSeed, mulberry32, shuffled } from "../src/lib/discovery/rng";
import { REGISTERS, countRegisters, type Register } from "../src/lib/discovery/registerTypes";
import { composeConcretePage, registerMix, sampleBalancedBatch, type ConcreteActivity, type RegisteredCard } from "../src/lib/discovery/twoPages";

const N = Number(process.argv[2] ?? 1000);
const cards: RegisteredCard[] = ASSOCIATIONS.filter(hasOwnImage).map((c) => ({ id: c.id, family: c.family, round: c.round, tagWeights: c.tagWeights, axes: c.axes, register: registerOfCard(c) }));
const pool: ConcreteActivity[] = getActivities().map((a) => ({ id: a.id, domain: a.domain, sub: a.sub, register: registerOfActivity(a), tags: a.tags, axes: activityAxes(a) }));
const generic = new Set(TAGS.filter((t) => t.generic).map((t) => t.id));
const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

const leanings: (Register | null)[] = [...REGISTERS, null];
const rows: Record<string, { own: number[]; outside: number[]; picks: number[]; strict: number[] }> = {};
const seenActs = new Map<string, number>();
const pageSets: Set<string>[] = [];
let minBatch = 99;
const batchCounts: Record<Register, number[]> = { expressive: [], nurturing: [], technical: [], nature: [] };

for (let i = 0; i < N; i++) {
  const leaning = leanings[i % leanings.length];
  const seed = `m${i}`;
  const batch = sampleBalancedBatch(cards, { seed });
  const bc = countRegisters(batch.map((c) => c.register));
  for (const r of REGISTERS) { batchCounts[r].push(bc[r]); minBatch = Math.min(minBatch, bc[r]); }
  const rnd = mulberry32(hashSeed(`pick:${seed}`));
  const preferred = leaning ? shuffled(batch.filter((c) => c.register === leaning), rnd) : [];
  const rest = shuffled(batch.filter((c) => !preferred.includes(c)), rnd);
  const picks = [...preferred, ...rest].slice(0, 5 + (i % 4));
  const mix = registerMix(picks);
  const ids = picks.map((c) => c.id);
  const slots = composeConcretePage(pool, { seed, profile: tagProfile(cards, ids), axes: averageAxes(cards, ids), genericTags: generic, mix });
  const c2 = countRegisters(slots.map((s) => s.activity.register));
  const dominant = mix.dominant;
  const key = String(leaning);
  const row = (rows[key] ??= { own: [], outside: [], picks: [], strict: [] });
  if (dominant) {
    row.own.push(c2[dominant]);
    row.outside.push((18 - c2[dominant]) / 18);
    row.picks.push(mix.counts[dominant] / mix.total);
  }
  row.strict.push(Math.min(...REGISTERS.map((r) => c2[r])));
  for (const s of slots) seenActs.set(s.activity.id, (seenActs.get(s.activity.id) ?? 0) + 1);
  pageSets.push(new Set(slots.map((s) => s.activity.id)));
}

console.log(`${N} simulated visitors, pool: ${cards.length} cards (${new Set(cards.map((c) => c.family ?? c.id)).size} families), ${pool.length} activities\n`);
console.log(`Page 1: smallest count of one register on any page: ${minBatch} (floor 4); mean per register: ${REGISTERS.map((r) => `${r} ${avg(batchCounts[r]).toFixed(1)}`).join(", ")}`);
console.log("\nPage 2 by the register the visitor leaned to on page 1 (the simulated visitor takes ~80% of the picks from it):");
console.log("  leaning       picks in dominant | page 2 dominant (of 18) | outside dominant | fewest of any register");
for (const [k, r] of Object.entries(rows)) {
  console.log(`  ${k.padEnd(12)} ${pct(avg(r.picks)).padStart(8)}          ${avg(r.own).toFixed(1).padStart(6)}                    ${pct(avg(r.outside)).padStart(6)}            ${Math.min(...r.strict)}`);
}
const used = [...seenActs.values()];
console.log(`\nVariety: ${seenActs.size} of ${pool.length} activities appear on at least one page (most-shown activity: ${pct(Math.max(...used) / N)} of visitors)`);
let overlap = 0;
const pairs = Math.min(400, N - 1);
for (let i = 0; i < pairs; i++) overlap += [...pageSets[i]].filter((id) => pageSets[i + 1].has(id)).length / 18;
console.log(`Overlap between two consecutive visitors' pages: ${pct(overlap / pairs)}`);

// --- the engine on the two-page visitors ----------------------------------------------------------------------------------------
import { defaultEngineLibrary, resolveConstraints } from "../src/lib/discovery/engine";
import { evaluate, runProfiles } from "../src/lib/discovery/engine/evaluate";
import { syntheticTwoPageProfiles } from "../src/lib/discovery/engine/syntheticTwoPages";
import { explainDroppedPicks } from "../src/lib/discovery/engine/droppedPicks";
import { getActivity } from "../src/lib/discovery/library";

const lib = defaultEngineLibrary();
const profiles = syntheticTwoPageProfiles(Math.min(N, 500), "two-measure");
const runs = runProfiles(profiles, lib);
const report = evaluate(runs, lib);
console.log(`\nEngine on ${profiles.length} two-page visitors: hard rules E1/E3/E4/E5/E6 violations: ${(["E1", "E3", "E4", "E5", "E6"] as const).map((k) => report.violations[k].length).join("/")}`);
console.log(`  soft: ${Object.entries(report.rates).map(([k, v]) => `${k} ${pct(v)}`).join(", ")}`);
let pickTotal = 0;
let pickInBook = 0;
let pickRuledOut = 0;
let booksWithPick = 0;
let worlds = 0;
const tracesById = new Map(profiles.map((p) => [p.id, p.trace]));
for (const { profile, result } of runs) {
  const picks = profile.input.interests;
  const inBook = new Set(result.seeds.map((s) => s.activityId));
  const c = resolveConstraints(profile.input);
  const ruled = new Set(explainDroppedPicks(picks.map((id) => getActivity(id)!), c).map((d) => d.activityId));
  pickTotal += picks.length;
  pickInBook += picks.filter((id) => inBook.has(id)).length;
  pickRuledOut += ruled.size;
  if (picks.some((id) => inBook.has(id))) booksWithPick += 1;
  worlds += new Set(result.seeds.map((s) => getActivity(s.activityId)!.domain)).size;
  void tracesById;
}
console.log(`  chosen activities (page 2): ${(pickTotal / runs.length).toFixed(1)} per visitor; in the book: ${pct(pickInBook / pickTotal)} of them, ${pct(booksWithPick / runs.length)} of the books have at least one; ruled out by a hard limit: ${pct(pickRuledOut / pickTotal)}`);
console.log(`  worlds per book: ${(worlds / runs.length).toFixed(2)}`);

const reasons: Record<string, number> = {};
for (const { profile } of runs) {
  const c = resolveConstraints(profile.input);
  for (const d of explainDroppedPicks(profile.input.interests.map((id) => getActivity(id)!), c)) reasons[d.reason] = (reasons[d.reason] ?? 0) + 1;
}
console.log(`  reasons a chosen activity is ruled out: ${JSON.stringify(reasons)}`);
