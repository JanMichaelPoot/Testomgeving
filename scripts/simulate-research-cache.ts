// How often would a shared local-research cache (per activity x place) already hold the
// answer, as the number of orders grows? Uses the selection engine on synthetic
// profiles and a made-up but plausible spread of places (a few large cities take a big
// share of visitors, the rest is a long tail of towns). The place distribution is an
// ASSUMPTION: replace it with real numbers once there are real orders.
//
//   npx tsx scripts/simulate-research-cache.ts
//   npx tsx scripts/simulate-research-cache.ts --top-share 0.5 --tail 150
//   npx tsx scripts/simulate-research-cache.ts --by-sub     cache per theme instead of per activity
import { defaultEngineLibrary, selectSeeds } from "../src/lib/discovery/engine";
import { syntheticProfiles } from "../src/lib/discovery/engine/synthetic";
import { hashSeed, mulberry32 } from "../src/lib/discovery/rng";
import { getActivity } from "../src/lib/discovery/library";

const args = process.argv.slice(2);
const value = (name: string, fallback: number) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const topShare = value("top-share", 0.4); // share of visitors living in the 20 biggest cities
const tailPlaces = value("tail", 150); // number of other towns
// Cache granularity: one answer per activity, or one per sub-domain (a theme such as "clay workshops"
// answers every activity in it).
const bySub = args.includes("--by-sub");

// Rough population weights (millions) of the 20 biggest Dutch cities.
const TOP = [0.93, 0.66, 0.57, 0.37, 0.24, 0.24, 0.23, 0.22, 0.19, 0.18, 0.16, 0.16, 0.16, 0.16, 0.16, 0.16, 0.16, 0.13, 0.13, 0.12];
const topTotal = TOP.reduce((s, x) => s + x, 0);

const rnd = mulberry32(hashSeed("cache-sim"));
function pickPlace(): string {
  if (rnd() < topShare) {
    let roll = rnd() * topTotal;
    for (let i = 0; i < TOP.length; i++) {
      roll -= TOP[i];
      if (roll <= 0) return `city${i}`;
    }
    return "city0";
  }
  // Long tail, mildly skewed (bigger towns come up more often).
  return `town${Math.floor(Math.pow(rnd(), 1.6) * tailPlaces)}`;
}

const lib = defaultEngineLibrary();
const CHECKPOINTS = [50, 100, 300, 1000, 3000, 10000];
const total = CHECKPOINTS[CHECKPOINTS.length - 1];
const profiles = syntheticProfiles(total, "cache-sim", lib);

const cache = new Set<string>();
let seedsSeen = 0;
let hits = 0;
let windowSeeds = 0;
let windowHits = 0;
let windowBooks = 0;
let windowAll = 0;

console.log(`Cache key: ${bySub ? "sub-domain" : "activity"} x place. Places: 20 big cities carry ${(topShare * 100).toFixed(0)}% of visitors, plus ${tailPlaces} other towns.\n`);
console.log("orders   seeds cached (cumulative)   seeds cached (last window)   books fully cached (window)");
profiles.forEach((p, i) => {
  const place = pickPlace();
  const { seeds } = selectSeeds(p.input, lib);
  let allCached = true;
  for (const s of seeds) {
    const key = `${bySub ? (getActivity(s.activityId)?.sub ?? s.activityId) : s.activityId}|${place}`;
    seedsSeen++;
    windowSeeds++;
    if (cache.has(key)) {
      hits++;
      windowHits++;
    } else {
      allCached = false;
      cache.add(key);
    }
  }
  windowBooks++;
  if (allCached) windowAll++;
  if (CHECKPOINTS.includes(i + 1)) {
    console.log(
      `${String(i + 1).padStart(6)}   ${((hits / seedsSeen) * 100).toFixed(0).padStart(6)}%                    ${((windowHits / windowSeeds) * 100).toFixed(0).padStart(6)}%                    ${((windowAll / windowBooks) * 100).toFixed(0).padStart(6)}%`,
    );
    windowSeeds = 0;
    windowHits = 0;
    windowBooks = 0;
    windowAll = 0;
  }
});
console.log(`\nDistinct (activity, place) answers stored after ${total} orders: ${cache.size}`);
