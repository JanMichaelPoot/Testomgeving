// Writes src/lib/discovery/activityAssociations.json from the reference library: per app activity, its strongest non-discovery
// associations (score 3-5, at most 8), plus the idf of every association (how rare it is across activities). Deterministic, free.
//
//   npx tsx scripts/reference-library/export-activity-associations.ts          prints a summary
//   npx tsx scripts/reference-library/export-activity-associations.ts --write  writes the file
//
// The app reads only this file (the layer in src/lib/discovery/associationLayer.ts), never reference-library/data at run time.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { loadLibrary } from "../../src/lib/referenceLibrary/load";
import { parseLink } from "../../src/lib/referenceLibrary/validate";
import type { ParsedLink } from "../../src/lib/referenceLibrary/types";
import { ALL_ACTIVITIES } from "../../src/lib/discovery/library";

const MAX_PER_ACTIVITY = 8;
const lib = loadLibrary();
const appIds = new Set(ALL_ACTIVITIES.map((a) => a.id));
const activities: Record<string, [string, number][]> = {};
const df = new Map<string, number>();
// An exact record describes the activity itself; a close one (a neighbour with another scope) only when nothing exact exists.
for (const ref of [...lib.activities].sort((a, b) => Number(b.match === "exact") - Number(a.match === "exact"))) {
  const appId = ref.legacy_id;
  if (!appId || !appIds.has(appId) || activities[appId]) continue;
  const links = ref.links
    .map(parseLink)
    .filter((l): l is ParsedLink => l !== null && l.relation !== "O" && l.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_PER_ACTIVITY);
  if (links.length === 0) continue;
  activities[appId] = links.map((l) => [l.association, l.score]);
  for (const l of links) df.set(l.association, (df.get(l.association) ?? 0) + 1);
}
const n = Object.keys(activities).length;
// idf, scaled so the rarest association counts 1 and the commonest about 0.35 (a common one still says something).
const raw = new Map([...df].map(([s, c]) => [s, Math.log(1 + n / c)]));
const max = Math.max(...raw.values());
const idf: Record<string, number> = {};
for (const [s, v] of [...raw].sort(([a], [b]) => (a < b ? -1 : 1))) idf[s] = Math.round((v / max) * 100) / 100;
const sortedActivities = Object.fromEntries(Object.entries(activities).sort(([a], [b]) => (a < b ? -1 : 1)));
const out = { idf, activities: sortedActivities };
console.log(`${n} of ${appIds.size} app activities have a vector (the rest are not in the reference library); ${df.size} associations in use; idf ${Math.min(...Object.values(idf))}-${Math.max(...Object.values(idf))}`);
if (process.argv.includes("--write")) {
  const file = path.join(process.cwd(), "src/lib/discovery/activityAssociations.json");
  writeFileSync(file, JSON.stringify(out) + "\n", "utf8");
  console.log("written", path.relative(process.cwd(), file));
}
