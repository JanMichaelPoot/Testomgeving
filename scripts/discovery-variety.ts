// Variety of the selection engine over synthetic profiles: how many different activities show up, how much the most frequent ones lead.
//   npx tsx scripts/discovery-variety.ts 300
import { getActivity, ALL_ACTIVITIES } from "../src/lib/discovery/library";
import { defaultEngineLibrary } from "../src/lib/discovery/engine";
import { runProfiles } from "../src/lib/discovery/engine/evaluate";
import { syntheticProfiles } from "../src/lib/discovery/engine/synthetic";
import { syntheticAssociationProfiles } from "../src/lib/discovery/engine/syntheticAssociations";

const lib = defaultEngineLibrary();
const N = Number(process.argv[2] ?? 400);
const kinds: [string, () => ReturnType<typeof syntheticProfiles>][] = [
  ["cards", () => syntheticProfiles(N, "variety-1", lib)],
  ["images", () => syntheticAssociationProfiles(N, "variety-1", { overrides: true }) as never],
];

for (const [name, make] of kinds) {
  const runs = runProfiles(make(), lib);
  const books = runs.map((r) => r.result.seeds.map((s) => s.activityId));
  const slots = books.flat();
  const count = new Map<string, number>();
  for (const b of books) for (const id of new Set(b)) count.set(id, (count.get(id) ?? 0) + 1);
  const ranked = [...count.entries()].sort((a, b) => b[1] - a[1]);
  const top = (k: number) => ranked.slice(0, k).reduce((s, [, n]) => s + n, 0) / slots.length;
  const domains = books.map((b) => new Set(b.map((id) => getActivity(id)!.domain)).size);
  const rare = slots.filter((id) => getActivity(id)!.supply === "rare").length / slots.length;
  console.log(
    `${name.padEnd(6)} books ${books.length} | library ${ALL_ACTIVITIES.length} | distinct used ${count.size} | top-1 in ${((ranked[0][1] / books.length) * 100).toFixed(1)}% of books (${getActivity(ranked[0][0])!.id})` +
      ` | top-10 share of slots ${(top(10) * 100).toFixed(1)}% | worlds/book ${(domains.reduce((a, b) => a + b, 0) / domains.length).toFixed(2)} | rare-supply slots ${(rare * 100).toFixed(1)}%`,
  );
  console.log("       most frequent:", ranked.slice(0, 6).map(([id, n]) => `${id} ${((n / books.length) * 100).toFixed(0)}%`).join(", "));
}
