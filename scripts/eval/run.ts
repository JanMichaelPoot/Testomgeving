// Evaluation harness for the knowledge engine (stage B1 of WINDOW_Bouwopdracht_Kennisengine.md).
// Runs one engine over a set of profiles, measures it, checks it and writes a report plus a result file
// that the blind A/B sheet (scripts/eval/blind-sheet.ts) can compare with another run.
//
//   npx tsx scripts/eval/run.ts --engine current                          the 20 fixed profiles, seeds only (free)
//   npx tsx scripts/eval/run.ts --engine current --profiles synthetic-cards --n 500 --seed ke-1
//   npx tsx scripts/eval/run.ts --engine current --profiles synthetic-images --n 500 --seed ke-1 --overrides
//   npx tsx scripts/eval/run.ts --engine current --write-baseline         refresh scripts/eval/baseline/current.json
//   npx tsx scripts/eval/run.ts --engine current --full                   prints what a paid run would cost and stops
//   npx tsx scripts/eval/run.ts --engine current --full --confirm-cost 5  really writes the books (about $0.19-0.23 each)
//   add --out <dir> for another output folder (default docs/eval), --no-write to only print the summary.
//
// "--seeds-only" (the default) is free and deterministic: only the selection engine runs, no text is written.
// "--full" calls the Claude API and costs real money, so it refuses to run without --confirm-cost <usd>
// that covers the estimate. Engine "v2" does not exist yet and is refused with a clear message.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getActivity } from "../../src/lib/discovery/library";
import { getAssociation } from "../../src/lib/discovery/associations";
import { syntheticProfiles } from "../../src/lib/discovery/engine/synthetic";
import { syntheticAssociationProfiles } from "../../src/lib/discovery/engine/syntheticAssociations";
import type { SyntheticProfile } from "../../src/lib/discovery/engine/synthetic";
import { EngineNotAvailableError, getEngine } from "../../src/lib/discovery/eval/engines";
import { intakeFor, loadEvalProfiles, toSyntheticProfile, type EvalProfile } from "../../src/lib/discovery/eval/profiles";
import { runWithEngine } from "../../src/lib/discovery/eval/run";
import { buildResults } from "../../src/lib/discovery/eval/results";
import { renderReport } from "../../src/lib/discovery/eval/report";
import type { GeneratedIdeaBook } from "../../src/lib/claude/ideaBookTypes";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

/** Upper estimate of one written book (Stap 78: $0.187 without and $0.229 with a retry of the writing call). */
const COST_PER_BOOK_USD = 0.23;

function briefOf(p: EvalProfile): string[] {
  const s = p.stored;
  const lines: string[] = [];
  const who = [s.purpose === "gift" ? `cadeau voor ${s.recipientName || "iemand"}` : "voor zichzelf", s.ageCategory ? `leeftijd ${s.ageCategory}` : null, s.location].filter(Boolean);
  lines.push(who.join(", "));
  lines.push(`budget ${s.budget ?? "?"}, tijd ${s.timeAvailable ?? "?"}, gezelschap ${(s.socialFormats ?? []).join(" / ") || "niet gezegd"}`);
  if (p.kind === "images") {
    const labels = (s.associations ?? []).map((id) => getAssociation(id)?.label.nl ?? id);
    lines.push(labels.length ? `koos beelden: ${labels.join(", ")}` : "koos geen beelden (verras me)");
  } else {
    lines.push(`koos activiteiten: ${(s.interests ?? []).map((id) => getActivity(id)?.label.nl ?? id).join(", ")}`);
  }
  if (s.interestDomains?.length) lines.push(`richtingen: ${s.interestDomains.join(", ")}`);
  if (s.mustHaves) lines.push(`harde grenzen: ${s.mustHaves}`);
  return lines;
}

async function main() {
  const engineName = value("engine") ?? "current";
  let engine;
  try {
    engine = getEngine(engineName);
  } catch (err) {
    if (err instanceof EngineNotAvailableError) {
      console.error(err.message);
      process.exit(2);
    }
    throw err;
  }

  const which = value("profiles") ?? "all";
  const full = flag("full");
  const mode = full ? "full" : "seeds-only";
  let source: string;
  let profiles: SyntheticProfile[];
  let evalProfiles: EvalProfile[] = [];
  if (which === "all") {
    evalProfiles = loadEvalProfiles();
    profiles = evalProfiles.map(toSyntheticProfile);
    source = `scripts/eval/profiles (${profiles.length} vaste profielen)`;
  } else if (which === "synthetic-cards" || which === "synthetic-images") {
    const n = Number(value("n") ?? 500);
    const seed = value("seed") ?? "ke-1";
    profiles =
      which === "synthetic-cards"
        ? syntheticProfiles(n, seed, engine.library)
        : syntheticAssociationProfiles(n, seed, { overrides: flag("overrides") });
    source = `${which === "synthetic-cards" ? "synthetische kaartenbezoekers" : "synthetische beeldbezoekers"}, n = ${n}, seed ${seed}${flag("overrides") ? ", met schuiven" : ""}`;
    if (full) {
      console.error("--full only works on the fixed profiles (--profiles all).");
      process.exit(2);
    }
  } else {
    console.error(`Unknown --profiles "${which}"; use all, synthetic-cards or synthetic-images.`);
    process.exit(2);
  }

  // --- the paid mode is guarded ---------------------------------------------------------
  const books: Record<string, GeneratedIdeaBook> = {};
  if (full) {
    const estimate = profiles.length * COST_PER_BOOK_USD;
    const confirmed = Number(value("confirm-cost") ?? 0);
    if (!(confirmed >= estimate)) {
      console.log(`A --full run writes ${profiles.length} books with the Claude API: up to about $${estimate.toFixed(2)} (${COST_PER_BOOK_USD} per book, prices of docs/discovery-api-costs.md).`);
      console.log(`Nothing was run. To go ahead, repeat the command with --confirm-cost ${Math.ceil(estimate * 10) / 10}.`);
      process.exit(2);
    }
    if (!process.env.ANTHROPIC_API_KEY && existsSync(".env.local")) process.loadEnvFile(".env.local");
    const { generateIdeaBookFromSeeds } = await import("../../src/lib/claude/generateFromSeeds");
    const { computeCharacterProfile } = await import("../../src/lib/characterProfile");
    for (const p of evalProfiles) {
      const intake = intakeFor(p);
      console.log(`writing ${p.id} ${p.title} ...`);
      const { book } = await generateIdeaBookFromSeeds(intake, "nl", computeCharacterProfile(intake), { sessionId: p.seed });
      books[p.id] = book;
    }
  }

  const runs = runWithEngine(profiles, engine);
  const titles = Object.fromEntries(evalProfiles.map((p) => [p.id, { title: p.title, kind: p.kind, edge: !!p.edge, brief: briefOf(p) }]));
  const result = buildResults({ engine: engine.name, mode, source, runs, lib: engine.library, titles, books: full ? books : undefined });

  const m = result.metrics;
  const errors = result.profiles.flatMap((p) => p.findings.filter((f) => f.severity === "error"));
  console.log(`\n${source}: ${m.profiles} profielen, engine ${engine.name}, ${mode}`);
  console.log(`harde regels E1/E3/E4/E5/E6: ${m.violations.E1}/${m.violations.E3}/${m.violations.E4}/${m.violations.E5}/${m.violations.E6}`);
  console.log(`werelden/boek ${m.worldsPerBook.toFixed(2)} | fotocategorieën ${m.photoCategoriesPerBook.toFixed(2)} | paar met ≥2 tags ${(m.pairBooks * 100).toFixed(1)}% | One Thing ${Object.entries(m.oneThingByDoor).map(([d, v]) => `${d} ${(v * 100).toFixed(0)}%`).join(", ")}`);
  console.log(`controles: ${errors.length} fouten, ${result.profiles.reduce((s, p) => s + p.findings.length, 0) - errors.length} waarschuwingen`);

  if (flag("write-baseline")) {
    if (which !== "all" || full || engine.name !== "current") {
      console.error("--write-baseline only works for --engine current --profiles all --seeds-only.");
      process.exit(2);
    }
    const dir = path.resolve("scripts/eval/baseline");
    mkdirSync(dir, { recursive: true });
    const snapshot = Object.fromEntries(result.profiles.map((p) => [p.id, p.seeds.map((s) => `${s.direction}:${s.door}:${s.activityId}`)]));
    writeFileSync(path.join(dir, "current.json"), JSON.stringify({ note: "Seeds of the current engine for the 20 fixed profiles. Regenerate with: npx tsx scripts/eval/run.ts --engine current --write-baseline", seeds: snapshot }, null, 1) + "\n");
    console.log(`baseline written to scripts/eval/baseline/current.json`);
  }

  if (!flag("no-write")) {
    const out = path.resolve(value("out") ?? "docs/eval");
    mkdirSync(out, { recursive: true });
    const date = result.generatedAt.slice(0, 10);
    const slug = which === "all" ? "" : `-${which}`;
    const base = path.join(out, `${date}-${engine.name}${slug}${full ? "-full" : ""}`);
    writeFileSync(`${base}.md`, renderReport(result));
    writeFileSync(`${base}.json`, JSON.stringify(result, null, 1) + "\n");
    console.log(`report: ${path.relative(process.cwd(), base)}.md (+ .json)`);
  }
  process.exit(errors.length === 0 ? 0 : 1);
}

main();
