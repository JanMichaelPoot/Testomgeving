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
import { ALL_ACTIVITIES, ALL_DOMAINS, DOMAINS, HYBRIDS, SUB_DOMAINS, TAGS, VOCABULARY, isImagePending } from "../src/lib/discovery/library";
import { SOCIAL_FORMATS } from "../src/lib/discovery/types";
import { validateAssociations, validateLibrary } from "../src/lib/discovery/validate";
import { ASSOCIATIONS, hasOwnImage } from "../src/lib/discovery/associations";
import { familyOf, validateRegisters } from "../src/lib/discovery/register";

const args = new Set(process.argv.slice(2));
const PUBLIC = path.join(process.cwd(), "public/illustrations/discovery");

const library = validateLibrary({ vocabulary: VOCABULARY, activities: ALL_ACTIVITIES, hybrids: HYBRIDS });
// The association images of the image intake are checked in the same run.
const associations = validateAssociations(ASSOCIATIONS, VOCABULARY);
// Every activity and every card family needs a style register (src/lib/discovery/register.json).
const registers = validateRegisters({ activities: ALL_ACTIVITIES, families: [...new Set(ASSOCIATIONS.map((c) => familyOf(c)))] });
const errors = [...library.errors, ...associations.errors, ...registers.errors];
const warnings = [...library.warnings, ...associations.warnings, ...registers.warnings];

const imageFile = (id: string) => path.join(PUBLIC, `${id}.jpg`);
const domainFile = (id: string) => path.join(PUBLIC, "domains", `${id}.jpg`);
// Activities (and domains) flagged image_pending are written but not shown yet: they wait for their photo.
const pendingActivities = ALL_ACTIVITIES.filter((a) => a.status !== "retired" && isImagePending(a));
const pendingDomains = ALL_DOMAINS.filter((d) => d.image_pending);
const missingImages = ALL_ACTIVITIES.filter((a) => a.status !== "retired" && !isImagePending(a) && !existsSync(imageFile(a.id)));
// A flag that is still set although the photo exists is a leftover: remove it so the activity goes live.
for (const a of ALL_ACTIVITIES) if (a.image_pending && existsSync(imageFile(a.id))) warnings.push(`activity "${a.id}": has a photo but is still flagged image_pending (remove the flag)`);
for (const d of pendingDomains) if (existsSync(domainFile(d.id))) warnings.push(`domain "${d.id}": has a photo but is still flagged image_pending (remove the flag)`);
const missingDomainImages = DOMAINS.filter((d) => !existsSync(domainFile(d.id)));

if (args.has("--report")) {
  const live = ALL_ACTIVITIES.filter((a) => a.status !== "retired");
  const pad = (s: string | number, n: number) => String(s).padEnd(n);
  console.log(`\n${live.length} activities (${ALL_ACTIVITIES.length - live.length} retired), ${HYBRIDS.length} hybrids, ${SUB_DOMAINS.length} sub-domains, ${TAGS.length} tags\n`);

  console.log("Per domain:");
  for (const d of ALL_DOMAINS) {
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
if (pendingActivities.length > 0 || pendingDomains.length > 0) {
  console.log(`(${pendingActivities.length} activities and ${pendingDomains.length} domains are written but wait for their photo and are not shown yet: npm run taxonomy:images)`);
}
const waiting = ASSOCIATIONS.filter((c) => !hasOwnImage(c));
if (waiting.length > 0) {
  console.log(`(${waiting.length} association cards still wait for their own image and are not shown yet: npm run taxonomy:images -- --associations --sheet 3x3)`);
  if (args.has("--images")) process.exit(1);
}
const pendingBlocks = args.has("--images") && (pendingActivities.length > 0 || pendingDomains.length > 0);
process.exit(total === 0 && !pendingBlocks ? 0 : 1);
