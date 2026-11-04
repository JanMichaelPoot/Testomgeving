// Shows, for one activity, what a visitor would get from recognition (alike) and from discovery (a surprising bridge).
//   npx tsx scripts/reference-library/explore.ts pottenbakken
import { discoveryNeighbours, recognitionNeighbours, resolveLinks } from "../../src/lib/referenceLibrary/derive";
import { loadLibrary } from "../../src/lib/referenceLibrary/load";

const lib = loadLibrary();
const slug = process.argv[2];
const a = lib.activities.find((x) => x.slug === slug);
if (!a) {
  console.log("Unknown slug. Try one of: " + lib.activities.slice(0, 12).map((x) => x.slug).join(", ") + ", ...");
  process.exit(1);
}
const name = (s: string) => lib.associations.find((x) => x.slug === s)?.nl ?? s;
console.log(`${a.nl} (${a.id}) - ${resolveLinks(lib, a).filter((l) => l.score >= 4).map((l) => l.nl).join(", ")}\n`);
console.log("Herkenning (lijkt erop):");
for (const n of recognitionNeighbours(lib, a)) console.log(`  ${n.activity.nl}  [${n.score}]  via ${n.via.slice(0, 3).map(name).join(", ")}`);
console.log("\nOntdekking (onverwachte brug):");
for (const n of discoveryNeighbours(lib, a)) {
  console.log(`  ${n.activity.nl}  [${n.score}]  via ${name(n.via[0])}: ${a.why[n.via[0]]?.nl}`);
}
