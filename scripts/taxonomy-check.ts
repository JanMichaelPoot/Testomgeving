// Validates the discovery library and prints a coverage report, so extending it
// stays safe and you can see where it is thin.
//
//   npx tsx scripts/taxonomy-check.ts            validation only (exit code 1 on errors)
//   npx tsx scripts/taxonomy-check.ts --report   plus coverage per domain / sub-domain / format / tag
//   npx tsx scripts/taxonomy-check.ts --images   also fail on activities without a card photo
//
// The same validation runs in `npm test` (src/lib/discovery/library.test.ts).
import { existsSync } from "node:fs";
import path from "node:path";
import { ALL_ACTIVITIES, DOMAINS, HYBRIDS, SUB_DOMAINS, TAGS, VOCABULARY } from "../src/lib/discovery/library";
import { SOCIAL_FORMATS } from "../src/lib/discovery/types";
import { validateLibrary } from "../src/lib/discovery/validate";

const args = new Set(process.argv.slice(2));
const PUBLIC = path.join(process.cwd(), "public/illustrations/discovery");

const { errors, warnings } = validateLibrary({ vocabulary: VOCABULARY, activities: ALL_ACTIVITIES, hybrids: HYBRIDS });

const imageFile = (id: string) => path.join(PUBLIC, `${id}.jpg`);
const domainFile = (id: string) => path.join(PUBLIC, "domains", `${id}.jpg`);
const missingImages = ALL_ACTIVITIES.filter((a) => a.status !== "retired" && !existsSync(imageFile(a.id)));
const missingDomainImages = DOMAINS.filter((d) => !existsSync(domainFile(d.id)));

if (args.has("--report")) {
  const live = ALL_ACTIVITIES.filter((a) => a.status !== "retired");
  const pad = (s: string | number, n: number) => String(s).padEnd(n);
  console.log(`\n${live.length} activities (${ALL_ACTIVITIES.length - live.length} retired), ${HYBRIDS.length} hybrids, ${SUB_DOMAINS.length} sub-domains, ${TAGS.length} tags\n`);

  console.log("Per domain:");
  for (const d of DOMAINS) {
    const items = live.filter((a) => a.domain === d.id);
    const pct = live.length ? Math.round((items.length / live.length) * 100) : 0;
    const subs = SUB_DOMAINS.filter((s) => s.domain === d.id).map((s) => `${s.id}:${items.filter((a) => a.sub === s.id).length}`);
    console.log(`  ${pad(d.id, 14)} ${pad(items.length, 4)} ${pad(pct + "%", 5)} ${subs.join("  ")}`);
  }

  console.log("\nSocial forms (activities that support each):");
  for (const f of SOCIAL_FORMATS) {
    console.log(`  ${pad(f, 14)} ${live.filter((a) => a.formats?.includes(f)).length}`);
  }
  console.log(`  ${pad("unknown", 14)} ${live.filter((a) => a.formats === null).length}`);

  console.log("\nUnknown facets:");
  for (const k of ["intensity", "level", "cost", "duration", "setting"] as const) {
    console.log(`  ${pad(k, 14)} ${live.filter((a) => a[k] === null).length}`);
  }
  console.log(`\nSafety tier 2: ${live.filter((a) => a.safety.tier === 2).length} · status: ${(["concept", "reviewed", "live"] as const)
    .map((s) => `${s} ${live.filter((a) => a.status === s).length}`)
    .join(", ")}`);

  console.log("\nTag usage (least used first, non-generic only):");
  const use = TAGS.filter((t) => !t.generic)
    .map((t) => [t.id, live.filter((a) => a.tags.includes(t.id)).length] as const)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 10);
  console.log("  " + use.map(([id, n]) => `${id}:${n}`).join("  "));

  console.log(`\nPhotos: ${live.length - missingImages.length}/${live.length} activities, ${DOMAINS.length - missingDomainImages.length}/${DOMAINS.length} domains`);
}

for (const w of warnings) console.warn(`warning: ${w}`);
for (const e of errors) console.error(`ERROR: ${e}`);
if (args.has("--images")) {
  for (const a of missingImages) console.error(`ERROR: activity "${a.id}": no photo at public/illustrations/discovery/${a.id}.jpg`);
  for (const d of missingDomainImages) console.error(`ERROR: domain "${d.id}": no photo at public/illustrations/discovery/domains/${d.id}.jpg`);
}

const imageErrors = args.has("--images") ? missingImages.length + missingDomainImages.length : 0;
const total = errors.length + imageErrors;
console.log(`\n${total === 0 ? "OK" : "FAILED"}: ${errors.length} errors${args.has("--images") ? `, ${imageErrors} missing photos` : ""}, ${warnings.length} warnings`);
if (!args.has("--images") && missingImages.length + missingDomainImages.length > 0) {
  console.log(`(${missingImages.length} activity photos and ${missingDomainImages.length} domain photos still to generate: npm run taxonomy:images)`);
}
process.exit(total === 0 ? 0 : 1);
