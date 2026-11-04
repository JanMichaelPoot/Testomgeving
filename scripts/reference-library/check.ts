// Checks the reference library (reference-library/data) against its rules and against the app's own library.
//
//   npm run reflib:check            errors fail (exit 1), warnings are printed
//   npm run reflib:check -- --report  also prints coverage per category and relation form
import { ALL_ACTIVITIES } from "../../src/lib/discovery/library";
import { coverage } from "../../src/lib/referenceLibrary/derive";
import { loadLibrary } from "../../src/lib/referenceLibrary/load";
import { validateLibrary } from "../../src/lib/referenceLibrary/validate";

const lib = loadLibrary();
const app = {
  activities: ALL_ACTIVITIES.map((a) => ({ id: a.id, nl: a.label.nl, en: a.label.en, aliases: [...(a.aliases?.nl ?? []), ...(a.aliases?.en ?? [])] })),
};
const issues = validateLibrary(lib, app);
const errors = issues.filter((i) => i.level === "error");
const warnings = issues.filter((i) => i.level === "warning");

for (const i of errors) console.log(`ERROR   ${i.where}: ${i.message}`);
for (const i of warnings) console.log(`warning ${i.where}: ${i.message}`);

const cov = coverage(lib);
console.log(
  `\nreference library: ${cov.activities} activities, ${lib.categories.length} categories, ${cov.associationsTotal} associations (${cov.associationsUsed} in use), ` +
    `${cov.links} links (${cov.linksPerActivity.toFixed(1)} per activity, ${cov.discoveryLinks} discovery). ` +
    `${errors.length} errors, ${warnings.length} warnings.`,
);

if (process.argv.includes("--report")) {
  console.log("\nper category (count / target):");
  for (const c of lib.categories) console.log(`  ${c.id} ${c.nl.padEnd(48)} ${String(cov.byCategory[c.id] ?? 0).padStart(3)} / ${c.target}`);
  console.log("\nper relation form:", JSON.stringify(cov.byRelation));
  console.log("per match with the app:", JSON.stringify(cov.byMatch));
  console.log("links per association domain:", JSON.stringify(cov.byDomain));
}
process.exit(errors.length ? 1 : 0);
