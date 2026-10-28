// Knowledge import (stage B3): one source at a time, idempotent, nothing goes live.
//
//   npx tsx scripts/knowledge/import.ts --source S3                 dry run: prints the summary, writes nothing
//   npx tsx scripts/knowledge/import.ts --source S3 --write         writes staging, review queue, log and report
//   npx tsx scripts/knowledge/import.ts --source S3 --write --apply also writes the merges (source link + names) into the library
//
// Options: --input <file> (default data/sources/raw/<id>/hobby.json, which is not in git), --queue-cap <n> (default 80).
// The logic is in src/lib/knowledge (pure, unit-tested); this file only reads and writes files.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { ALL_ACTIVITIES, VOCABULARY } from "../../src/lib/discovery/library";
import type { Activity } from "../../src/lib/discovery/types";
import { validateLibrary } from "../../src/lib/discovery/validate";
import { HYBRIDS } from "../../src/lib/discovery/library";
import { DEFAULT_QUEUE_CAP, applyMerges, buildReport, fingerprint, runImport } from "../../src/lib/knowledge/importer";
import { parseWikidata } from "../../src/lib/knowledge/parseWikidata";
import type { Decision, ProposalFile, QueueEntry } from "../../src/lib/knowledge/types";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const value = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const source = value("source");
if (source !== "S3") {
  console.error("Only S3 (Wikidata) has a parser so far. Usage: --source S3 [--write] [--apply] [--input file] [--queue-cap n]");
  process.exit(2);
}

const root = process.cwd();
const KNOWLEDGE = path.join(root, "data/knowledge");
const DATA_DIR = path.join(root, "src/lib/discovery/data");
const input = value("input") ?? path.join(root, "data/sources/raw/S3/hobby.json");
if (!existsSync(input)) {
  console.error(`Input not found: ${input}\nThe raw source files are not in git; download them first (docs/knowledge-sources.md).`);
  process.exit(2);
}

const rawText = readFileSync(input, "utf8");
const records = parseWikidata(JSON.parse(rawText), source);
const readJson = <T>(file: string, fallback: T): T => (existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : fallback);
const proposals = readJson<ProposalFile | null>(path.join(KNOWLEDGE, "proposals", `${source}.json`), null);
const queueFile = readJson<{ entries: QueueEntry[] }>(path.join(KNOWLEDGE, "review-queue.json"), { entries: [] });
const previousQueue = queueFile.entries.filter((e) => e.source_id === source);
const queueCap = Number(value("queue-cap") ?? DEFAULT_QUEUE_CAP);
// Decisions live apart from the queue (which is regenerated), so they last: data/knowledge/decisions/<source>.json.
const decisionFile = readJson<{ decisions: Record<string, Decision> } | null>(path.join(KNOWLEDGE, "decisions", `${source}.json`), null);

const result = runImport({ records, library: ALL_ACTIVITIES, proposals, previousQueue, decisions: decisionFile?.decisions, queueCap });
const newMerges = result.merges.filter((m) => !m.alreadyLinked);
const aliasCount = newMerges.reduce((n, m) => n + m.addAliases.nl.length + m.addAliases.en.length, 0);
const byReason = new Map<string, number>();
for (const r of result.rejected) byReason.set(r.reason, (byReason.get(r.reason) ?? 0) + 1);

console.log(`${source}: ${result.records} records -> ${result.merges.length} merged (${newMerges.length} new, ${aliasCount} new names), ${result.added.length} written as new activities, ${result.queue.length} in review, ${result.rejected.length} rejected`);
console.log(`  rejected by reason: ${[...byReason.entries()].map(([k, v]) => `${k} ${v}`).join(", ") || "-"}`);
console.log(`  review queue: ${result.queue.length} of max ${queueCap}; proposed accept ${result.queue.filter((q) => q.proposal?.verdict === "accept").length}, unsure ${result.queue.filter((q) => q.proposal?.verdict === "unsure").length}, needs Dutch label ${result.queue.filter((q) => q.needs_nl_label).length}`);

if (!flag("write")) {
  console.log("Dry run: nothing written. Add --write to write the staging file, review queue, log and report.");
  process.exit(0);
}

// 1. Merges into the library (optional), then check that the library is still valid.
let library: Activity[] = ALL_ACTIVITIES;
if (flag("apply")) {
  library = applyMerges(ALL_ACTIVITIES, result.merges, source);
  const issues = validateLibrary({ vocabulary: VOCABULARY, activities: library, hybrids: HYBRIDS });
  if (issues.errors.length) {
    console.error("The merged library is not valid; nothing was written to it:\n" + issues.errors.join("\n"));
    process.exit(1);
  }
  const changed = new Map(library.map((a) => [a.id, a]));
  let files = 0;
  for (const f of readdirSync(DATA_DIR).filter((n) => n.endsWith(".json")).sort()) {
    const file = path.join(DATA_DIR, f);
    const before = JSON.parse(readFileSync(file, "utf8")) as Activity[];
    const after = before.map((a) => changed.get(a.id) ?? a);
    const text = `${JSON.stringify(after, null, 2)}\n`;
    if (text !== `${JSON.stringify(before, null, 2)}\n`) {
      writeFileSync(file, text);
      files++;
    }
  }
  console.log(`  applied: ${newMerges.length} activities updated in ${files} data file(s)`);
}

// 2. Staging: every record with what happened to it, before anything is reviewed.
const outcome = new Map<string, Record<string, unknown>>();
for (const m of result.merges) outcome.set(m.source_record_id, { outcome: "merged", activityId: m.activityId, tier: m.tier });
for (const x of result.added) outcome.set(x.source_record_id, { outcome: "added", activityId: x.activityId });
for (const q of result.queue) outcome.set(q.source_record_id, { outcome: "review", reason: q.reason, candidates: q.candidates });
for (const r of result.rejected) outcome.set(r.source_record_id, { outcome: "rejected", reason: r.reason });
const staging = {
  source_id: source,
  records: records.map((r) => ({ ...r, ...(outcome.get(r.source_record_id) ?? { outcome: "unclassified" }) })),
};
const write = (rel: string, text: string) => {
  const file = path.join(root, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
};
write(`data/knowledge/staging/${source}.json`, `${JSON.stringify(staging, null, 2)}\n`);

// 3. Review queue: this source's entries replaced, other sources kept; decisions already taken are preserved by runImport.
const otherSources = queueFile.entries.filter((e) => e.source_id !== source);
write("data/knowledge/review-queue.json", `${JSON.stringify({ entries: [...otherSources, ...result.queue] }, null, 2)}\n`);

// 4. Log: a line only when something changed (a second identical run adds nothing).
const logFile = path.join(KNOWLEDGE, "imports.log.json");
const log = readJson<{ imports: Record<string, unknown>[] }>(logFile, { imports: [] });
const print = fingerprint(result);
const last = [...log.imports].reverse().find((e) => e.source_id === source);
const inputHash = createHash("sha256").update(rawText).digest("hex").slice(0, 16);
if (!last || last.fingerprint !== print || last.input_sha256 !== inputHash) {
  log.imports.push({
    source_id: source,
    imported_at: new Date().toISOString().slice(0, 10),
    input_sha256: inputHash,
    fingerprint: print,
    records: result.records,
    merged: result.merges.length,
    merged_new: newMerges.length,
    added: result.added.length,
    names_added: aliasCount,
    in_review: result.queue.length,
    rejected: result.rejected.length,
    queue_cap: queueCap,
  });
  write("data/knowledge/imports.log.json", `${JSON.stringify(log, null, 2)}\n`);
  console.log("  log: entry added");
} else {
  console.log("  log: unchanged (same input and same outcome as the last run)");
}

// 5. Report, from the library as it is after the merges.
const domainLabels = Object.fromEntries(VOCABULARY.domains.map((d) => [d.id, d.label.nl]));
write(`docs/knowledge/import-${source}.md`, buildReport({ result, library, domainLabels, sourceName: "Wikidata (hobby-activiteiten, CC0)" }));
console.log(`  wrote data/knowledge/{staging,review-queue,imports.log}.json and docs/knowledge/import-${source}.md`);
