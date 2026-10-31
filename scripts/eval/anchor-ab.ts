// Paid, small blind comparison of the anchor model (Stap 125): the same real two-page intakes written twice, once with the B4/B5
// knowledge engine only ("zonder anker") and once with KNOWLEDGE_ANCHOR_PICKS on ("met anker"). Everything else is equal: same
// session id (so the same research from the cache), same writer prompts (KNOWLEDGE_ENGINE_V2 on in both).
//
//   npx tsx scripts/eval/anchor-ab.ts --confirm-cost 1.3 [--only 990a18c4,93b8053a] [--out docs/eval]
//
// Writes docs/eval/blind-anchor-ronde-1.html (give to the rater), its .key.json (keep), and the PDFs as
// docs/eval/books-blind/<profile>-A.pdf / -B.pdf (the side is random per profile, like the other blind sheets).
import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { IntakeAnswers } from "../../src/app/intake/actions";
import { BudgetExceededError, BudgetMeter } from "../../src/lib/discovery/eval/budget";
import { buildBlindSheet } from "../../src/lib/discovery/eval/blind";
import { liteBook, type EvalProfileResult, type EvalResultFile, type EvalRunInfo } from "../../src/lib/discovery/eval/results";
import { getActivity } from "../../src/lib/discovery/library";

const args = process.argv.slice(2);
const value = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const SESSIONS: { id: string; prefix: string; title: string }[] = [
  { id: "990a18c4", prefix: "E1", title: "Enschede, vrienden, stoomtrein en escape" },
  { id: "93b8053a", prefix: "L1", title: "Laren, partner, parfum en kralen" },
  { id: "f6a6bd84", prefix: "L2", title: "Laren, partner, pluktuin en banket" },
];

async function main() {
  const cap = Number(value("confirm-cost") ?? (args.includes("--build-only") ? "0.01" : ""));
  if (!(cap > 0)) {
    console.error("This run costs real money (about $0.40-0.45 for a pair). Repeat with --confirm-cost <usd>, e.g. --confirm-cost 1.3.");
    process.exit(2);
  }
  if (!process.env.ANTHROPIC_API_KEY && existsSync(".env.local")) process.loadEnvFile(".env.local");
  const only = value("only")?.split(",");
  const chosen = SESSIONS.filter((s) => !only || only.includes(s.id));

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data } = await supabase.from("intake_answers").select("session_id, raw_json").order("created_at", { ascending: false }).limit(400);
  const rows = new Map((data ?? []).map((r) => [r.session_id as string, r.raw_json as IntakeAnswers]));
  const find = (prefix: string) => [...rows.entries()].find(([id]) => id.startsWith(prefix));

  const { anthropic } = await import("../../src/lib/anthropic");
  const meter = new BudgetMeter(cap, 0.12);
  meter.wrap(anthropic.messages as unknown as { create: (...a: never[]) => Promise<unknown> });
  const { generateIdeaBookFromSeeds } = await import("../../src/lib/claude/generateFromSeeds");
  const { computeCharacterProfile } = await import("../../src/lib/characterProfile");
  const { renderIdeaBookPdf } = await import("../../src/lib/pdf/ideaBook");
  const { buildAssociationSources } = await import("../../src/lib/discovery/associations");
  const { buildIdeaThreads, threadSentence } = await import("../../src/lib/ideaThread");
  const { getDictionary } = await import("../../src/lib/i18n/dictionaries");
  const { ideaKey, WILDCARD_KEY } = await import("../../src/lib/ideaKeys");
  const { explicitPickIds } = await import("../../src/lib/claude/generateFromSeeds");

  const date = new Date().toISOString().slice(0, 10);
  const outDir = path.resolve(value("out") ?? "docs/eval");
  mkdirSync(path.join(outDir, "books-blind"), { recursive: true });
  const pdfs: Record<string, { without?: Uint8Array; with?: Uint8Array }> = {};
  const profiles: Record<"without" | "with", EvalProfileResult[]> = { without: [], with: [] };
  // Every finished book is saved at once, so an interrupted run never loses what was already paid for.
  const ckpt = path.resolve("scratch/anchor-ab-checkpoint");
  mkdirSync(ckpt, { recursive: true });
  const loadCheckpoints = () => {
    for (const f of readdirSync(ckpt).filter((x) => x.endsWith(".json"))) {
      const [id, arm] = f.replace(".json", "").split("__") as [string, "without" | "with"];
      if (profiles[arm].some((p) => p.id === id)) continue;
      profiles[arm].push(JSON.parse(readFileSync(path.join(ckpt, f), "utf8")) as EvalProfileResult);
      (pdfs[id] ??= {})[arm] = readFileSync(path.join(ckpt, `${id}__${arm}.pdf`));
    }
  };
  if (args.includes("--resume") || args.includes("--build-only")) loadCheckpoints();
  const done = (id: string, arm: "without" | "with") => profiles[arm].some((p) => p.id === id);

  let stopped = false;
  for (const s of chosen) {
    if (stopped) break;
    const hit = find(s.id);
    if (!hit) {
      console.warn(`session ${s.id} not found, skipped`);
      continue;
    }
    const [sessionId, intake] = hit;
    const picks = explicitPickIds(intake);
    const brief = [
      `Plaats: ${intake.location.split(",")[0]}, budget ${intake.budget}, ${intake.timeAvailable}, gezelschap: ${(intake.company ?? []).join(" + ") || "niet opgegeven"}`,
      `Koos zelf: ${picks.map((id) => getActivity(id)?.label.nl ?? id).join(", ")}`,
    ];
    for (const arm of ["without", "with"] as const) {
      if (args.includes("--build-only") || done(s.prefix, arm)) continue;
      if (!meter.canStartBook(0.3)) {
        console.log(`Stopping before ${s.prefix}/${arm}: $${meter.spent.toFixed(3)} of $${cap.toFixed(2)} spent, a whole book might not fit any more.`);
        stopped = true;
        break;
      }
      process.env.KNOWLEDGE_ENGINE_V2 = "1";
      if (arm === "with") process.env.KNOWLEDGE_ANCHOR_PICKS = "1";
      else delete process.env.KNOWLEDGE_ANCHOR_PICKS;
      const before = meter.spent;
      const startedAt = Date.now();
      console.log(`writing ${s.prefix} (${arm} anchor) ...`);
      try {
        const { book, report } = await generateIdeaBookFromSeeds(intake, "nl", computeCharacterProfile(intake), { sessionId });
        const all = [...book.ideas, book.wildcard];
        const inBook = picks.filter((p) => report.seeds.some((x) => x.activityId === p)).length;
        const info: EvalRunInfo = { usd: meter.spent - before, seconds: (Date.now() - startedAt) / 1000, issues: report.issues, fillCount: all.filter((e) => e.fill).length };

        const threadLines: Record<string, string> = {};
        if (intake.associations?.length) {
          const built = buildAssociationSources(all, intake.associations);
          const copy = getDictionary("nl").venster;
          const threads = buildIdeaThreads(book.ideas, book.wildcard, built, "nl", { showPath: true });
          all.forEach((idea, i) => {
            const line = threadSentence(threads[i < book.ideas.length ? ideaKey(i) : WILDCARD_KEY], copy.thread, copy.profile.and);
            if (line && idea.activity_id) threadLines[idea.activity_id] = line;
          });
        }
        const bytes = await renderIdeaBookPdf(book, s.title, "nl", { company: intake.company, budget: intake.budget, timeAvailable: intake.timeAvailable, threadLines });
        (pdfs[s.prefix] ??= {})[arm] = bytes;

        profiles[arm].push({
          id: s.prefix,
          title: s.title,
          kind: "images2",
          edge: false,
          brief,
          notes: report.notes,
          seeds: report.seeds.map((x) => ({ activityId: x.activityId, label: { nl: getActivity(x.activityId)?.label.nl ?? x.activityId, en: x.activityId }, door: x.door, direction: x.direction, chain: x.chain, lead: x.lead, verify: x.verify })),
          book: liteBook(book),
          run: info,
          findings: [],
        });
        writeFileSync(path.join(ckpt, `${s.prefix}__${arm}.json`), JSON.stringify(profiles[arm][profiles[arm].length - 1]));
        writeFileSync(path.join(ckpt, `${s.prefix}__${arm}.pdf`), bytes);
        console.log(`  done: ${inBook} of ${picks.length} own picks in the book, $${info.usd.toFixed(3)}, ${info.seconds.toFixed(0)} s | total $${meter.spent.toFixed(3)} | notes: ${report.notes.join(" | ") || "-"} | issues: ${report.issues.join("; ") || "none"}`);
      } catch (err) {
        console.error(err instanceof BudgetExceededError ? `  ${err.message}` : `  ${s.prefix}/${arm} failed: ${err instanceof Error ? err.message : String(err)} (spent $${meter.spent.toFixed(3)})`);
        stopped = true;
        break;
      }
    }
  }
  delete process.env.KNOWLEDGE_ENGINE_V2;
  delete process.env.KNOWLEDGE_ANCHOR_PICKS;
  console.log(`\nSpent $${meter.spent.toFixed(3)} of the $${cap.toFixed(2)} cap over ${meter.calls} API calls.`);

  // Only profiles where both sides exist go into the sheet.
  const both = profiles.without.filter((p) => profiles.with.some((q) => q.id === p.id)).map((p) => p.id);
  if (both.length === 0) {
    console.error("No complete pair, no sheet.");
    process.exit(1);
  }
  const file = (engine: "without" | "with"): EvalResultFile =>
    ({ engine: (engine === "with" ? "anchor" : "v2") as EvalResultFile["engine"], mode: "full", source: `anchor-ab ${date}`, generatedAt: new Date().toISOString(), metrics: {} as EvalResultFile["metrics"], profiles: profiles[engine].filter((p) => both.includes(p.id)) });
  const first = file("without");
  const second = file("with");
  const seed = value("seed") ?? "anchor-ronde-1";
  const sheet = buildBlindSheet(first, second, { seed });
  writeFileSync(path.join(outDir, `blind-${seed}.html`), sheet.html);
  writeFileSync(path.join(outDir, `blind-${seed}.key.json`), JSON.stringify(sheet.key, null, 1) + "\n");
  for (const id of both) {
    const side = sheet.key.sides[id];
    for (const letter of ["A", "B"] as const) {
      const which = side[letter] === "first" ? "without" : "with";
      writeFileSync(path.join(outDir, "books-blind", `${id}-${letter}.pdf`), pdfs[id][which]!);
    }
  }
  // The measured numbers per pair, for the report to Jan (not shown to the rater).
  writeFileSync(path.join(outDir, `${date}-anchor-ab-runs.json`), JSON.stringify({ without: first.profiles.map((p) => ({ id: p.id, run: p.run, seeds: p.seeds.map((s) => s.activityId), notes: p.notes })), with: second.profiles.map((p) => ({ id: p.id, run: p.run, seeds: p.seeds.map((s) => s.activityId), notes: p.notes })) }, null, 1) + "\n");
  console.log(`sheet: docs/eval/blind-${seed}.html | key (do not open yet): docs/eval/blind-${seed}.key.json | PDFs: docs/eval/books-blind/<id>-A.pdf / -B.pdf`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
