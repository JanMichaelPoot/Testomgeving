// Measures what the association layer (src/lib/discovery/associationLayer.ts) does to page 2 of the two-page intake: the same synthetic
// visitors choose images on page 1, and page 2 is composed with and without the layer. Free, deterministic, no API calls.
//
//   npx tsx scripts/association-layer-measure.ts            400 visitors + the sample sets
//   npx tsx scripts/association-layer-measure.ts 800 seed2
import { buildAssociationLibrary } from "../src/lib/discovery/associations";
import { buildConcretePool } from "../src/lib/discovery/concretePool";
import { ASSOC_WEIGHT, MAX_IMAGE_PICKS, MIN_IMAGE_PICKS, composeConcretePage, registerMix, sampleBalancedBatch, type RegisteredCard } from "../src/lib/discovery/twoPages";
import { assocProfile, sharedAssociations } from "../src/lib/discovery/associationLayer";
import { averageAxes, tagProfile } from "../src/lib/discovery/associationProfile";
import { mulberry32, hashSeed, shuffled } from "../src/lib/discovery/rng";
import { REGISTERS } from "../src/lib/discovery/registerTypes";

const N = Number(process.argv[2] ?? 400);
const SEED = process.argv[3] ?? "assoc-1";
const lib = buildAssociationLibrary("nl", 10, true);
const pool = buildConcretePool("nl", 10, true);
const generic = new Set(pool.genericTags);
const labels = new Map(pool.activities.map((a) => [a.id, a.label]));
const withVector = pool.activities.filter((a) => a.assoc).length;
const cards = lib.cards as (typeof lib.cards[number] & RegisteredCard)[];
const byId = new Map(cards.map((c) => [c.id, c]));

function page(ids: string[], seed: string, layer: boolean) {
  const chosen = ids.map((id) => byId.get(id)!);
  return composeConcretePage(pool.activities, {
    seed,
    profile: tagProfile(cards, ids),
    assocProfile: layer ? assocProfile(chosen) : undefined,
    assocWeight: process.env.ASSOC_W ? Number(process.env.ASSOC_W) : undefined,
    axes: averageAxes(cards, ids),
    genericTags: generic,
    mix: registerMix(chosen.filter((c) => c.register !== undefined)),
  });
}

let overlap = 0;
const floorBreaks = [0, 0];
const used = [new Map<string, number>(), new Map<string, number>()];
const domains = [0, 0];
for (let i = 0; i < N; i++) {
  const rnd = mulberry32(hashSeed(`${SEED}:${i}`));
  const batch = sampleBalancedBatch(cards, { seed: `${SEED}-${i}` });
  const n = MIN_IMAGE_PICKS + Math.floor(rnd() * (MAX_IMAGE_PICKS - MIN_IMAGE_PICKS + 1));
  const ids = shuffled(batch, rnd).slice(0, n).map((c) => c.id);
  const pages = [page(ids, `${SEED}-${i}`, false), page(ids, `${SEED}-${i}`, true)];
  const a = new Set(pages[0].map((s) => s.activity.id));
  overlap += pages[1].filter((s) => a.has(s.activity.id)).length / pages[1].length;
  pages.forEach((p, k) => {
    for (const s of p) used[k].set(s.activity.id, (used[k].get(s.activity.id) ?? 0) + 1);
    const counts = Object.fromEntries(REGISTERS.map((r) => [r, p.filter((s) => s.activity.register === r).length]));
    if (Math.min(...Object.values(counts)) < 2) floorBreaks[k]++;
    domains[k] += new Set(p.map((s) => s.activity.domain)).size;
  });
}
const top = (m: Map<string, number>) => [...m.entries()].sort((x, y) => y[1] - x[1])[0];
console.log(`activities with a vector: ${withVector} of ${pool.activities.length} in October; layer weight ${ASSOC_WEIGHT}`);
console.log(`${N} visitors: pages share ${((overlap / N) * 100).toFixed(0)}% of their 18 activities with and without the layer`);
for (const [k, name] of [[0, "tags only"], [1, "with layer"]] as const) {
  const t = top(used[k]);
  console.log(`  ${name.padEnd(10)} distinct activities offered ${used[k].size}, most offered ${t[0]} on ${((t[1] / N) * 100).toFixed(0)}% of pages, domains per page ${(domains[k] / N).toFixed(1)}, register floor broken on ${floorBreaks[k]} pages`);
}

// What a person would see: three sets of images, page 2 with and without the layer (only the activities that differ).
const SAMPLES: [string, string[]][] = [
  ["warm and quiet", ["sense-warm-steam", "moment-tea-pour", "sense-lavender", "place-bathhouse"]],
  ["wind and height", ["moment-summit", "sense-wind", "place-mountain-ridge", "moment-leap"]],
  ["hands and wood", ["moment-clay", "sense-wood", "place-workshop", "sense-leather-bag"]],
  ["stage and glitter", ["place-dressing-room", "moment-applause", "sense-spotlight", "sense-facets"]],
];
for (const [name, want] of SAMPLES) {
  const ids = want.map((w) => cards.find((c) => c.family === w)?.id).filter((x): x is string => !!x);
  const p0 = page(ids, "sample", false);
  const p1 = page(ids, "sample", true);
  const s0 = new Set(p0.map((s) => s.activity.id));
  const s1 = new Set(p1.map((s) => s.activity.id));
  const prof = assocProfile(ids.map((id) => byId.get(id)!));
  console.log(`\n== ${name} (${want.join(", ")})`);
  console.log("  in with layer, not in tags only:", p1.filter((s) => !s0.has(s.activity.id)).map((s) => `${labels.get(s.activity.id)} [${sharedAssociations(prof, s.activity.assoc, 2).join("+")}]`).join("; ") || "-");
  console.log("  in tags only, not with layer:   ", p0.filter((s) => !s1.has(s.activity.id)).map((s) => labels.get(s.activity.id)).join("; ") || "-");
}
