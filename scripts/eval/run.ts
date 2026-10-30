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
//   npx tsx scripts/eval/run.ts --engine current,v2 --full --only P01,P12 --confirm-cost 1 --max-usd 1
//       writes the same profiles with both engines, interleaved (so the second book finds the research of the
//       first in the cache), under one spending cap, and renders each book as a PDF into <out>/books.
//   add --out <dir> for another output folder (default docs/eval), --no-write to only print the summary,
//   --only P01,P12 to run just those fixed profiles; --book-reserve <usd> (default 0.30) is what a whole book may still
//   cost at the very most before one is started (lower it only when the research is known to be cached);
//   --call-reserve <usd> (default 0.12) is what one API call may cost at the very most, kept free per call in flight.
//
// "--seeds-only" (the default) is free and deterministic: only the selection engine runs, no text is written.
// "--full" calls the Claude API and costs real money, so it refuses to run without --confirm-cost <usd>
// that covers the estimate, and it stops by itself before a call could take the total over --max-usd
// (default: the confirmed amount). Engine "v2" = the knowledge engine so far: the same selection as "current",
// written and rendered with KNOWLEDGE_ENGINE_V2 on.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getActivity } from "../../src/lib/discovery/library";
import { getAssociation } from "../../src/lib/discovery/associations";
import { syntheticProfiles } from "../../src/lib/discovery/engine/synthetic";
import { syntheticAssociationProfiles } from "../../src/lib/discovery/engine/syntheticAssociations";
import type { SyntheticProfile } from "../../src/lib/discovery/engine/synthetic";
import { EngineNotAvailableError, getEngine, type EvalEngine } from "../../src/lib/discovery/eval/engines";
import { BudgetExceededError, BudgetMeter } from "../../src/lib/discovery/eval/budget";
import { intakeFor, loadEvalProfiles, toSyntheticProfile, type EvalProfile } from "../../src/lib/discovery/eval/profiles";
import { runWithEngine } from "../../src/lib/discovery/eval/run";
import { buildResults, type EvalRunInfo } from "../../src/lib/discovery/eval/results";
import { renderReport } from "../../src/lib/discovery/eval/report";
import { currentMonth } from "../../src/lib/discovery/season";
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
  const engineNames = (value("engine") ?? "current")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
  const engines: EvalEngine[] = [];
  try {
    for (const name of engineNames) engines.push(getEngine(name));
  } catch (err) {
    if (err instanceof EngineNotAvailableError) {
      console.error(err.message);
      process.exit(2);
    }
    throw err;
  }
  if (engines.length === 0) {
    console.error("Give at least one engine: --engine current or --engine current,v2.");
    process.exit(2);
  }

  const which = value("profiles") ?? "all";
  const full = flag("full");
  const mode = full ? "full" : "seeds-only";
  let source: string;
  let profiles: SyntheticProfile[];
  let evalProfiles: EvalProfile[] = [];
  if (which === "all") {
    evalProfiles = loadEvalProfiles();
    const only = value("only")
      ?.split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (only) {
      const missing = only.filter((id) => !evalProfiles.some((p) => p.id === id));
      if (missing.length) {
        console.error(`Unknown profile id(s) in --only: ${missing.join(", ")}.`);
        process.exit(2);
      }
      evalProfiles = evalProfiles.filter((p) => only.includes(p.id));
    }
    // The writing pipeline reads the clock (seasonal activities, "today is ..." in the prompt), so a --full run
    // asks every profile in the current month. Doing the same for the free part keeps the seeds in the report
    // identical to the seeds of the written books.
    if (full) evalProfiles = evalProfiles.map((p) => ({ ...p, month: currentMonth() }));
    profiles = evalProfiles.map(toSyntheticProfile);
    source = `scripts/eval/profiles (${profiles.length} vaste profielen${only ? `: ${only.join(", ")}` : ""})`;
  } else if (which === "synthetic-cards" || which === "synthetic-images") {
    const n = Number(value("n") ?? 500);
    const seed = value("seed") ?? "ke-1";
    profiles =
      which === "synthetic-cards"
        ? syntheticProfiles(n, seed, engines[0].library)
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

  const outDir = path.resolve(value("out") ?? "docs/eval");
  const today = new Date().toISOString().slice(0, 10);

  // --- the paid mode is guarded: a confirmed amount first, then a meter that stops the run at the cap ---------
  const books: Record<string, Record<string, GeneratedIdeaBook>> = {};
  const runInfo: Record<string, Record<string, EvalRunInfo>> = {};
  if (full) {
    const estimate = evalProfiles.length * engines.length * COST_PER_BOOK_USD;
    const confirmed = Number(value("confirm-cost") ?? 0);
    if (!(confirmed >= estimate)) {
      console.log(`A --full run writes ${evalProfiles.length * engines.length} books with the Claude API: up to about $${estimate.toFixed(2)} (${COST_PER_BOOK_USD} per book, prices of docs/discovery-api-costs.md).`);
      console.log(`Nothing was run. To go ahead, repeat the command with --confirm-cost ${Math.ceil(estimate * 10) / 10}.`);
      process.exit(2);
    }
    const cap = Number(value("max-usd") ?? confirmed);
    if (!(cap > 0 && cap <= confirmed)) {
      console.error(`--max-usd must be above 0 and not above the confirmed amount ($${confirmed}).`);
      process.exit(2);
    }
    if (!process.env.ANTHROPIC_API_KEY && existsSync(".env.local")) process.loadEnvFile(".env.local");
    const { anthropic } = await import("../../src/lib/anthropic");
    const meter = new BudgetMeter(cap, Number(value("call-reserve") ?? 0.12));
    meter.wrap(anthropic.messages as unknown as { create: (...a: never[]) => Promise<unknown> });
    const { generateIdeaBookFromSeeds } = await import("../../src/lib/claude/generateFromSeeds");
    const { computeCharacterProfile } = await import("../../src/lib/characterProfile");
    const { renderIdeaBookPdf } = await import("../../src/lib/pdf/ideaBook");
    const { buildAssociationSources } = await import("../../src/lib/discovery/associations");
    const { buildIdeaThreads, threadSentence } = await import("../../src/lib/ideaThread");
    const { getDictionary } = await import("../../src/lib/i18n/dictionaries");
    const { ideaKey, WILDCARD_KEY } = await import("../../src/lib/ideaKeys");
    if (!flag("no-write")) mkdirSync(path.join(outDir, "books"), { recursive: true });

    let stopped = false;
    // Interleaved per profile (first engine, then the next): the second book finds the research of the first in the cache.
    for (const p of evalProfiles) {
      if (stopped) break;
      for (const eng of engines) {
        if (!meter.canStartBook(Number(value("book-reserve") ?? 0.3))) {
          console.log(`Stopping before ${p.id}/${eng.name}: $${meter.spent.toFixed(3)} spent of the $${cap.toFixed(2)} cap, a whole book might not fit any more.`);
          stopped = true;
          break;
        }
        // The flag is read at call time by the pipeline and by the PDF renderer.
        if (eng.knowledgeV2) process.env.KNOWLEDGE_ENGINE_V2 = "1";
        else delete process.env.KNOWLEDGE_ENGINE_V2;
        const intake = intakeFor(p);
        const before = meter.spent;
        const startedAt = Date.now();
        console.log(`writing ${p.id} ${p.title} with ${eng.name} ...`);
        try {
          const { book, report } = await generateIdeaBookFromSeeds(intake, "nl", computeCharacterProfile(intake), { sessionId: p.seed });
          const seconds = (Date.now() - startedAt) / 1000;
          const all = [...book.ideas, book.wildcard];
          const info: EvalRunInfo = { usd: meter.spent - before, seconds, issues: report.issues, fillCount: all.filter((e) => e.fill).length };

          // The PDF as the buyer would get it (without the personal cover window), to read next to the other engine's.
          try {
            const threadLines: Record<string, string> = {};
            if (intake.associations?.length) {
              const built = buildAssociationSources(all, intake.associations);
              const copy = getDictionary("nl").venster;
              const threads = buildIdeaThreads(book.ideas, book.wildcard, built, "nl", { showPath: eng.knowledgeV2 });
              all.forEach((idea, i) => {
                const line = threadSentence(threads[i < book.ideas.length ? ideaKey(i) : WILDCARD_KEY], copy.thread, copy.profile.and);
                if (line && idea.activity_id) threadLines[idea.activity_id] = line;
              });
            }
            const bytes = await renderIdeaBookPdf(book, p.title, "nl", { company: intake.company, budget: intake.budget, timeAvailable: intake.timeAvailable, threadLines });
            if (!flag("no-write")) {
              const file = path.join(outDir, "books", `${today}-${p.id}-${eng.name}.pdf`);
              writeFileSync(file, bytes);
              info.pdf = path.relative(process.cwd(), file).split(path.sep).join("/");
            }
          } catch (err) {
            console.warn(`  PDF render failed for ${p.id}/${eng.name}: ${err instanceof Error ? err.message : String(err)}`);
          }

          (books[eng.name] ??= {})[p.id] = book;
          (runInfo[eng.name] ??= {})[p.id] = info;
          console.log(`  done: $${info.usd.toFixed(3)}, ${seconds.toFixed(0)} s, ${info.fillCount}/7 with own fill, issues: ${info.issues.length ? info.issues.join("; ") : "none"} | total $${meter.spent.toFixed(3)}`);
        } catch (err) {
          if (err instanceof BudgetExceededError) {
            console.log(`  ${err.message}`);
          } else {
            console.error(`  ${p.id}/${eng.name} failed: ${err instanceof Error ? err.message : String(err)} (spent so far $${meter.spent.toFixed(3)})`);
          }
          stopped = true;
          break;
        }
      }
    }
    delete process.env.KNOWLEDGE_ENGINE_V2;
    console.log(`\nSpent $${meter.spent.toFixed(3)} of the $${cap.toFixed(2)} cap over ${meter.calls} API calls.`);
  }

  let anyErrors = false;
  for (const eng of engines) {
    const runs = runWithEngine(profiles, eng);
    const titles = Object.fromEntries(evalProfiles.map((p) => [p.id, { title: p.title, kind: p.kind, edge: !!p.edge, brief: briefOf(p) }]));
    // A written book is made in the month of today (the pipeline reads the clock), so the quality checks use that month.
    const qaContexts = full ? Object.fromEntries(evalProfiles.map((p) => { const i = intakeFor(p); return [p.id, { locale: "nl" as const, month: currentMonth(), budget: i.budget, timeAvailable: i.timeAvailable }]; })) : undefined;
    const result = buildResults({ engine: eng.name, mode, source, runs, lib: eng.library, evalOptions: { strictFreeCost: eng.weights.strictFreeCost }, qaContexts, titles, books: full ? (books[eng.name] ?? {}) : undefined, runInfo: full ? runInfo[eng.name] : undefined });

    const m = result.metrics;
    const errors = result.profiles.flatMap((p) => p.findings.filter((f) => f.severity === "error"));
    if (errors.length) anyErrors = true;
    if (result.quality) {
      const q = result.quality;
      console.log(`kwaliteitspoort: ${q.releaseGate.pass ? "geslaagd" : "NIET geslaagd (" + q.releaseGate.failures.join("; ") + ")"} | seizoen ${q.counts.season} | tijdchip ${q.counts.time_chip} | tijd niet gevuld ${q.counts.coverage_time} | budget niet benut ${q.counts.coverage_budget} | plek bij ${(q.placeRate * 100).toFixed(0)}% van de ideeën`);
    }
    console.log(`\n${source}: ${m.profiles} profielen, engine ${eng.name}, ${mode}`);
    console.log(`harde regels E1/E3/E4/E5/E6: ${m.violations.E1}/${m.violations.E3}/${m.violations.E4}/${m.violations.E5}/${m.violations.E6}`);
    console.log(`werelden/boek ${m.worldsPerBook.toFixed(2)} | fotocategorieën ${m.photoCategoriesPerBook.toFixed(2)} | paar met ≥2 tags ${(m.pairBooks * 100).toFixed(1)}% | One Thing ${Object.entries(m.oneThingByDoor).map(([d, v]) => `${d} ${(v * 100).toFixed(0)}%`).join(", ")}`);
    console.log(`controles: ${errors.length} fouten, ${result.profiles.reduce((s, p) => s + p.findings.length, 0) - errors.length} waarschuwingen`);

    if (flag("write-baseline")) {
      if (which !== "all" || full || eng.name !== "current" || engines.length !== 1 || value("only")) {
        console.error("--write-baseline only works for --engine current --profiles all --seeds-only, without --only.");
        process.exit(2);
      }
      const dir = path.resolve("scripts/eval/baseline");
      mkdirSync(dir, { recursive: true });
      const snapshot = Object.fromEntries(result.profiles.map((p) => [p.id, p.seeds.map((s) => `${s.direction}:${s.door}:${s.activityId}`)]));
      writeFileSync(path.join(dir, "current.json"), JSON.stringify({ note: "Seeds of the current engine for the 20 fixed profiles. Regenerate with: npx tsx scripts/eval/run.ts --engine current --write-baseline", seeds: snapshot }, null, 1) + "\n");
      console.log(`baseline written to scripts/eval/baseline/current.json`);
    }

    if (!flag("no-write")) {
      mkdirSync(outDir, { recursive: true });
      const date = result.generatedAt.slice(0, 10);
      const only = value("only");
      const slug = which === "all" ? (only ? `-only-${only.replace(/,/g, "-")}` : "") : `-${which}`;
      const base = path.join(outDir, `${date}-${eng.name}${slug}${full ? "-full" : ""}`);
      writeFileSync(`${base}.md`, renderReport(result));
      writeFileSync(`${base}.json`, JSON.stringify(result, null, 1) + "\n");
      console.log(`report: ${path.relative(process.cwd(), base)}.md (+ .json)`);
    }
  }
  process.exit(anyErrors ? 1 : 0);
}

main();
