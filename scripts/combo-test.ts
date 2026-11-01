// Free (no API): the seven association combinations of the "master prompt" tested against the engine, twice: on what visitors
// see today and on the library as it will be once the pending photos exist (every written activity included).
//   npx tsx scripts/combo-test.ts [--all] [--month 10]
//
// A combination is a set of abstract tags. The simulated visitor does what a real one does: picks the images that carry those
// tags (page 1), then the concrete activities that carry them (page 2), then the book is selected with the shipped weights.
// For each combination it prints the seven ideas and checks: relevance (do the ideas carry the tags), variety (worlds, social
// forms), doubles (same activity or the same name twice), surprise (ideas that do NOT carry the tags but are linked) and the
// mix against the target 40/25/20/15 of the master prompt (direct / indirect / related / surprising).
import { ASSOCIATIONS, associationsToEngineInput, hasOwnImage } from "../src/lib/discovery/associations";
import { ALL_ACTIVITIES, HYBRIDS, TAGS, getActivities } from "../src/lib/discovery/library";
import { selectSeeds } from "../src/lib/discovery/engine/select";
import { whyNot } from "../src/lib/discovery/engine/droppedPicks";
import { WEIGHTS_ANCHOR } from "../src/lib/discovery/engine/weights";
import { normalizeName } from "../src/lib/discovery/names";
import { inSeason } from "../src/lib/discovery/season";
import type { Activity } from "../src/lib/discovery/types";

const args = process.argv.slice(2);
const month = Number(args[args.indexOf("--month") + 1]) || new Date().getMonth() + 1;

const COMBOS: { name: string; tags: string[]; note: string }[] = [
  { name: "Dieren + natuur + fotografie", tags: ["animals", "nature", "technique"], note: "paarden, wildlife, fotografie" },
  { name: "Literatuur + schrijven + cultuur", tags: ["language", "story", "history"], note: "schrijven, boeken, erfgoed" },
  { name: "Competitie + sociaal + spel", tags: ["competition", "conviviality", "play"], note: "spellen, teams, avondje uit" },
  { name: "Elegantie + muziek + ontmoeten", tags: ["style", "sound", "conviviality"], note: "bal, concert, high tea" },
  { name: "Avontuur + natuur + beweging", tags: ["challenge", "outdoors", "movement"], note: "klimmen, kanoën, trektocht" },
  { name: "Creativiteit + ambacht + ontwikkeling", tags: ["craft", "color", "story"], note: "maken, leren, zelf doen" },
  { name: "Wetenschap + ontdekken + technologie", tags: ["puzzling", "technique", "stars"], note: "sterren, code, experimenteren" },
];

const generic = new Set(TAGS.filter((t) => t.generic).map((t) => t.id));
// The first tag of a combination is the main interest (weight 3), the second 2, the third 1: a visitor picks what matches the main interest first.
const score = (tags: string[], wanted: string[]) => wanted.reduce((n, t, i) => n + (tags.includes(t) ? 3 - i : 0), 0);
const hits = (tags: string[], wanted: string[]) => wanted.filter((t) => tags.includes(t)).length;

function run(combo: (typeof COMBOS)[number], activities: Activity[], label: string) {
  const visible = activities.filter((a) => a.status !== "retired" && inSeason(a, month));
  // page 1: the three cards per round that carry the wanted tags best (image choices)
  const cards = ASSOCIATIONS.filter(hasOwnImage);
  const imageIds: string[] = [];
  for (const round of ["places", "moments", "senses"]) {
    const best = cards
      .filter((c) => c.round === round && !imageIds.some((id) => cards.find((x) => x.id === id)?.family === c.family))
      .map((c) => ({ id: c.id, s: combo.tags.reduce((n, t, i) => n + (c.tagWeights[t] ?? 0) * (3 - i), 0) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 2);
    imageIds.push(...best.map((b) => b.id));
  }
  // page 2: the four activities that carry most wanted tags, one per sub-domain, easy and cheap first (a person who picks four)
  const ranked = visible
    .map((a) => ({ a, s: score(a.tags, combo.tags) + (a.supply === "rare" ? -0.5 : 0) }))
    .filter((x) => x.s > 0)
    .sort((x, y) => y.s - x.s || (x.a.cost ?? 1) - (y.a.cost ?? 1));
  const picks: Activity[] = [];
  for (const x of ranked) {
    if (picks.length >= 4) break;
    if (picks.some((p) => p.domain === x.a.domain && p.sub === x.a.sub)) continue;
    picks.push(x.a);
  }
  const derived = associationsToEngineInput({
    associationIds: imageIds,
    interestDomains: [],
    explicitInterests: picks.map((p) => p.id),
    constraints: { budget: "100", timeAvailable: "halfday", mustHaves: "", socialFormats: [], ageCategory: "35-44" },
    seed: `combo-${combo.name}`,
    month,
  });
  const result = selectSeeds(
    { interests: picks.map((p) => p.id), interestDomains: [], socialFormats: [], practicalToWild: derived.practicalToWild, budget: "100", effort: derived.effort, timeAvailable: "halfday", ageCategory: "35-44", mustHaves: "", history: [], seed: `combo-${combo.name}`, month, explicitPicks: true },
    { activities: visible, tags: TAGS, hybrids: HYBRIDS },
    { weights: WEIGHTS_ANCHOR },
  );
  const byId = new Map(visible.map((a) => [a.id, a]));
  const seeds = result.seeds.map((s) => ({ s, a: byId.get(s.activityId)! }));
  const pickSet = new Set(picks.map((p) => p.id));
  const kind = (x: (typeof seeds)[number]) =>
    pickSet.has(x.s.activityId) ? "direct" : x.s.direction === "adjacent" && result.notes.includes("indirect_slot") ? "indirect" : x.s.direction === "unexpected" || x.s.direction === "stretch" || x.s.direction === "wildcard" ? "surprising" : hits(x.a.tags, combo.tags) >= 2 ? "indirect" : "related";
  const mix = { direct: 0, indirect: 0, related: 0, surprising: 0 };
  for (const x of seeds) mix[kind(x)]++;
  const names = seeds.map((x) => normalizeName(x.a.label.nl));
  const doubles = names.length - new Set(names).size + (seeds.length - new Set(seeds.map((x) => x.s.activityId)).size);
  const worlds = new Set(seeds.map((x) => x.a.domain)).size;
  const relevant = seeds.filter((x) => hits(x.a.tags.filter((t) => !generic.has(t)), combo.tags) >= 1).length;
  const fresh = ALL_ACTIVITIES.filter((a) => a.image_pending).map((a) => a.id);
  const newOnes = seeds.filter((x) => fresh.includes(x.s.activityId)).length;
  console.log(`\n[${label}] ${combo.name}  (${combo.note})`);
  console.log(`  picked images ${imageIds.length}, own picks: ${picks.map((p) => p.label.nl).join(" | ")}`);
  for (const x of seeds) console.log(`   ${kind(x).padEnd(10)} ${x.s.direction.padEnd(10)} ${x.a.domain.padEnd(11)} ${x.a.label.nl}${fresh.includes(x.a.id) ? "  [nieuw]" : ""}`);
  const lost = picks.filter((p) => !seeds.some((x) => x.s.activityId === p.id)).map((p) => `${p.label.nl} (${whyNot(p, result.constraints, { explicitPick: true }) ?? "niet gekozen door de motor"})`);
  if (lost.length) console.log(`  eigen keuzes die niet in het boek staan: ${lost.join("; ")}`);
  console.log(`  worlds ${worlds} | carry the tags ${relevant}/${seeds.length} | doubles ${doubles} | new items ${newOnes} | mix d/i/r/s ${mix.direct}/${mix.indirect}/${mix.related}/${mix.surprising} (target of 7: 2.8/1.8/1.4/1.0)`);
  return { mix, doubles, worlds, relevant, n: seeds.length, newOnes };
}

for (const [label, acts] of [
  ["vandaag", getActivities()],
  ["met alle nieuwe items", ALL_ACTIVITIES.filter((a) => a.status !== "retired")],
] as const) {
  const t = COMBOS.map((c) => run(c, acts as Activity[], label));
  const sum = (f: (x: (typeof t)[number]) => number) => t.reduce((n, x) => n + f(x), 0);
  const total = sum((x) => x.n);
  console.log(`\n== ${label}: doubles ${sum((x) => x.doubles)}, worlds avg ${(sum((x) => x.worlds) / t.length).toFixed(1)}, carry the tags ${sum((x) => x.relevant)}/${total}, new items ${sum((x) => x.newOnes)}, mix direct ${((sum((x) => x.mix.direct) / total) * 100).toFixed(0)}% indirect ${((sum((x) => x.mix.indirect) / total) * 100).toFixed(0)}% related ${((sum((x) => x.mix.related) / total) * 100).toFixed(0)}% surprising ${((sum((x) => x.mix.surprising) / total) * 100).toFixed(0)}%`);
}
