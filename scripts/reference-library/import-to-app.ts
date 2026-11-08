// Step 1 of "implement the reference library in the app": writes the reference activities the app does not have into the app's
// discovery library, hidden (concept + image_pending) until their photos exist, and links the ones it already has.
//
//   npx tsx scripts/reference-library/import-to-app.ts           dry run: prints the plan, writes nothing
//   npx tsx scripts/reference-library/import-to-app.ts --write   writes src/lib/discovery/data/*.json, register.json and the report
//
// The logic is in src/lib/referenceLibrary/appImport.ts (pure, tested). Input: reference-library/data and the hand-written
// reference-library/crosswalk/app-import.json. Idempotent. No API calls, no cost.
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { normalizeName } from "../../src/lib/discovery/names";
import type { Activity } from "../../src/lib/discovery/types";
import { loadLibrary } from "../../src/lib/referenceLibrary/load";
import { addAliases, addSourceLink, planImport, type Crosswalk } from "../../src/lib/referenceLibrary/appImport";

const write = process.argv.includes("--write");
const root = process.cwd();
const DATA_DIR = path.join(root, "src/lib/discovery/data");
const REGISTER_FILE = path.join(root, "src/lib/discovery/register.json");
const CROSSWALK_FILE = path.join(root, "reference-library/crosswalk/app-import.json");
const REPORT_FILE = path.join(root, "docs/reference-library-import.md");

interface FileState {
  file: string;
  crlf: boolean;
  items: Activity[];
  dirty: boolean;
}

function readJsonFile(file: string): { value: unknown; crlf: boolean } {
  const text = readFileSync(file, "utf8");
  return { value: JSON.parse(text), crlf: text.includes("\r\n") };
}
function writeJsonFile(file: string, value: unknown, crlf: boolean): void {
  const text = JSON.stringify(value, null, 2) + "\n";
  writeFileSync(file, crlf ? text.replace(/\n/g, "\r\n") : text, "utf8");
}

const files = new Map<string, FileState>();
const byId = new Map<string, { activity: Activity; state: FileState }>();
for (const name of readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"))) {
  const file = path.join(DATA_DIR, name);
  const { value, crlf } = readJsonFile(file);
  if (!Array.isArray(value)) continue; // vocabulary-like files are not activity lists
  const state: FileState = { file, crlf, items: value as Activity[], dirty: false };
  files.set(path.basename(name, ".json"), state);
  for (const activity of state.items) byId.set(activity.id, { activity, state });
}

const crosswalk = readJsonFile(CROSSWALK_FILE).value as Crosswalk;
const lib = loadLibrary();
const plan = planImport(lib.activities, crosswalk, new Map([...byId].map(([id, v]) => [id, v.activity])));

// 1. Links and aliases on activities the app already has.
const taken = new Set<string>();
for (const { activity } of byId.values()) {
  taken.add(normalizeName(activity.label.nl));
  taken.add(normalizeName(activity.label.en));
  for (const n of [...(activity.aliases?.nl ?? []), ...(activity.aliases?.en ?? [])]) taken.add(normalizeName(n));
}
let linkChanges = 0;
let aliasChanges = 0;
for (const link of plan.links) {
  const target = byId.get(link.appId);
  if (target && addSourceLink(target.activity, link.recordId)) {
    target.state.dirty = true;
    linkChanges++;
  }
}
for (const change of plan.aliases) {
  const target = byId.get(change.appId);
  if (target && addAliases(target.activity, change.nl, change.en, taken)) {
    target.state.dirty = true;
    aliasChanges++;
  }
}

// 2. New activities, appended to the file of their domain.
const perDomain = new Map<string, number>();
for (const activity of plan.create) {
  const state = files.get(activity.domain);
  if (!state) throw new Error(`No data file for domain ${activity.domain} (${activity.id})`);
  state.items.push(activity);
  state.dirty = true;
  perDomain.set(activity.domain, (perDomain.get(activity.domain) ?? 0) + 1);
}

// 3. The style register of the new activities.
const registerFile = readJsonFile(REGISTER_FILE);
const register = registerFile.value as { activities: Record<string, string>; families: Record<string, string> };
let registerAdded = 0;
for (const [slug, reg] of Object.entries(plan.registers)) {
  if (register.activities[slug] === undefined) {
    register.activities[slug] = reg;
    registerAdded++;
  }
}
register.activities = Object.fromEntries(Object.entries(register.activities).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

const exact = lib.activities.filter((a) => a.match === "exact").length;
const close = lib.activities.filter((a) => a.match === "close").length;
const decisions = Object.keys(crosswalk.decisions).length;
const summary = [
  `reference library: ${lib.activities.length} activities (${exact} exact, ${close} close, ${lib.activities.filter((a) => a.match === "new").length} new)`,
  `new in the app: ${plan.create.length} (hidden: concept + image_pending), merged into existing: ${decisions}`,
  `source links added: ${linkChanges}, alias changes: ${aliasChanges}, register lines added: ${registerAdded}`,
  `per domain: ${[...perDomain.entries()].sort().map(([d, n]) => `${d} ${n}`).join(", ") || "-"}`,
];
console.log(summary.join("\n"));
for (const note of plan.notes) console.log(`  note: ${note}`);

if (!write) {
  console.log("\nDry run: nothing written. Add --write to write.");
  process.exit(0);
}

for (const state of files.values()) if (state.dirty) writeJsonFile(state.file, state.items, state.crlf);
writeJsonFile(REGISTER_FILE, register, registerFile.crlf);

// 4. The report (deterministic: no dates, same text for the same input).
const lines: string[] = [];
lines.push("# Import of the reference library into the app");
lines.push("");
lines.push("Written by `npx tsx scripts/reference-library/import-to-app.ts --write` (step 1 of the plan to implement the reference library). No API calls.");
lines.push("");
lines.push("## What happened");
lines.push("");
for (const s of summary) lines.push(`- ${s}`);
lines.push("");
lines.push("New activities are `concept` and `image_pending`: visitors and the engine do not see them until their photos exist and the flag is removed (`npm run taxonomy:check --images` tells which).");
lines.push("");
lines.push("## Merged into an activity the app already has");
lines.push("");
for (const [id, d] of Object.entries(crosswalk.decisions)) lines.push(`- ${id} -> \`${d.app_id}\`${d.alias ? ` (names: ${[...d.alias.nl, ...d.alias.en].join("; ")})` : ""}`);
lines.push("");
lines.push("## New activities per domain");
lines.push("");
for (const [domain, n] of [...perDomain.entries()].sort()) {
  lines.push(`### ${domain} (${n})`);
  for (const a of plan.create.filter((x) => x.domain === domain)) lines.push(`- \`${a.id}\`: ${a.label.nl} / ${a.label.en} (${a.provenance?.source_record_id})`);
  lines.push("");
}
if (plan.notes.length) {
  lines.push("## Notes");
  lines.push("");
  for (const n of plan.notes) lines.push(`- ${n}`);
  lines.push("");
}
mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
if (!existsSync(path.dirname(REPORT_FILE))) throw new Error("docs missing");
writeFileSync(REPORT_FILE, lines.join("\n") + "\n", "utf8");
console.log(`\nWritten. Report: ${path.relative(root, REPORT_FILE)}`);
