// A real Idea Book per audience persona, within a hard budget (the last link of docs/doelgroeponderzoek.md: the text, the places, the tone).
// The persona's visit (images, activities, the start page's chips) is simulated for free (src/lib/discovery/eval/audience.ts); only the writing
// and the local research cost money (the real pipeline: about USD 0.10-0.50 per book).
//
//   npx tsx scripts/persona-books.ts --dry-run                  free: the intake, the seeds and the rules the writer will get, per persona
//   npx tsx scripts/persona-books.ts --budget 1.00 P04 P12 P10   real books, in this order, stopping before the budget could be passed
//
// The budget is checked BEFORE each book against the worst cost seen so far (RESERVE until two books are measured, then 1.25 x the dearest): a book cannot be stopped halfway, so the
// total can only pass the budget if a single book costs more than the reserve. Books go to scratch/persona-books/<id>.json with a compact review.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

if (!process.env.ANTHROPIC_API_KEY && existsSync(".env.local")) process.loadEnvFile(".env.local");

const MODEL_PRICE: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
};
const SEARCH = 0.01;
/** Worst case assumed for the next book until a more expensive one has been seen (USD). */
const RESERVE = 0.3;

interface Usage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  server_tool_use?: { web_search_requests?: number };
}
function price(u: Usage, model = "claude-sonnet-5") {
  const p = MODEL_PRICE[model] ?? MODEL_PRICE["claude-sonnet-5"];
  return (
    ((u.input_tokens ?? 0) / 1e6) * p.input +
    ((u.output_tokens ?? 0) / 1e6) * p.output +
    ((u.cache_creation_input_tokens ?? 0) / 1e6) * p.input * 1.25 +
    ((u.cache_read_input_tokens ?? 0) / 1e6) * p.input * 0.1 +
    (u.server_tool_use?.web_search_requests ?? 0) * SEARCH
  );
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry-run");
  const budget = args.includes("--budget") ? Number(args[args.indexOf("--budget") + 1]) : 1;
  const ids = args.filter((a) => /^P\d\d$/.test(a));

  const { PERSONAS, runSession, MONTH } = await import("../src/lib/discovery/eval/audience");
  const { associationsToEngineInput } = await import("../src/lib/discovery/associations");
  const { effortForPicks } = await import("../src/lib/discovery/imageIntake");
  const { computeCharacterProfile } = await import("../src/lib/characterProfile");
  const { practicalNeedsPrompt } = await import("../src/lib/claude/generateFromSeeds");
  const { researchNeedsFrom } = await import("../src/lib/claude/localResearch");
  const { parseMustHaves } = await import("../src/lib/discovery/engine/constraints");
  type Intake = import("../src/app/intake/actions").IntakeAnswers;

  const chosen = (ids.length ? ids : PERSONAS.map((p) => p.id)).map((id) => PERSONAS.find((p) => p.id === id)!).filter(Boolean);

  const build = (p: (typeof PERSONAS)[number]): { intake: Intake; locale: "nl" | "en"; seeds: string[] } => {
    const sid = `book-${p.id}`;
    const s = runSession(p, sid);
    const derived = associationsToEngineInput({
      associationIds: s.imagePicks, interestDomains: [], explicitInterests: s.concretePicks,
      constraints: { budget: p.budget, timeAvailable: p.time, mustHaves: p.mustHaves, socialFormats: [], ageCategory: "", searchContext: p.context },
      seed: sid, month: MONTH,
    });
    const intake: Intake = {
      situation: "", purpose: p.context === "self" ? "self" : "other", purposeFollowUp: "", ageCategory: "", location: "Utrecht", country: "NL",
      searchDistance: "hour", searchDistanceKm: 25, freeTimePattern: "search", practicalToWild: derived.practicalToWild, timeAvailable: p.time,
      budget: p.budget, effort: effortForPicks(derived.effort, derived.interests, false), solutionTypes: ["activity"], mustHaves: p.mustHaves, preferences: "",
      company: [], personalReflection: "", interests: s.concretePicks, interestDomains: [], socialFormats: [], intakeVariant: "associations",
      intakeFlow: "images2", associations: s.imagePicks, searchContext: p.context,
    };
    // Priya lives here but does not speak Dutch: her site is in English, so her book is too. Everyone else reads Dutch.
    return { intake, locale: p.id === "P12" ? "en" : "nl", seeds: s.seeds.map((x) => x.id) };
  };

  if (dry) {
    console.log(`DRY RUN (free). Budget ${budget.toFixed(2)} USD, reserve ${RESERVE.toFixed(2)} USD per book => at most ${Math.floor(budget / RESERVE)} books on the worst case.\n`);
    for (const p of chosen) {
      const b = build(p);
      const needs = researchNeedsFrom(parseMustHaves(p.mustHaves).verify);
      console.log(`## ${p.id} ${p.label}  [${b.locale}; ${p.context}; "${p.mustHaves}"; budget ${p.budget}; ${p.time}]`);
      console.log(`  picks p1: ${b.intake.associations!.join(", ")}`);
      console.log(`  picks p2: ${b.intake.interests!.join(", ")}`);
      console.log(`  engine seeds (what the book is about): ${b.seeds.join(", ")}`);
      console.log(`  writer needs: ${needs.join(", ") || "-"}`);
      console.log(practicalNeedsPrompt(needs).trim().split("\n").map((l) => "    " + l).join("\n") || "    -");
    }
    return;
  }

  mkdirSync("scratch/persona-books", { recursive: true });
  const { generateIdeaBookFromSeeds } = await import("../src/lib/claude/generateFromSeeds");
  let spent = 0;
  let worst = RESERVE;
  const observed: number[] = [];
  const original = console.log;
  for (const p of chosen) {
    if (spent + worst > budget + 1e-9) {
      original(`STOP before ${p.id}: spent ${spent.toFixed(3)} + worst case ${worst.toFixed(3)} would pass the budget of ${budget.toFixed(2)}.`);
      break;
    }
    const b = build(p);
    let cost = 0;
    const calls: string[] = [];
    console.log = (...a: unknown[]) => {
      const line = a.map(String).join(" ");
      const m = line.match(/WINDOW: ([\w -]+?) took (\d+)ms.*usage=(\{.*\})/);
      if (m) {
        const model = line.match(/\((claude-[\w.-]+)\)/)?.[1];
        const c = price(JSON.parse(m[3]) as Usage, model);
        cost += c;
        calls.push(`${m[1]} $${c.toFixed(3)}`);
      } else original(line);
    };
    try {
      const { book, report } = await generateIdeaBookFromSeeds(b.intake, b.locale, computeCharacterProfile(b.intake), { sessionId: `persona-${p.id}` });
      console.log = original;
      spent += cost;
      observed.push(cost);
      worst = observed.length >= 2 ? Math.max(...observed) * 1.25 : RESERVE;
      writeFileSync(`scratch/persona-books/${p.id}.json`, JSON.stringify({ persona: p.id, label: p.label, locale: b.locale, intake: b.intake, cost, calls, report, book }, null, 1));
      original(`${p.id} ${p.label}: $${cost.toFixed(3)} (${calls.join("; ")}) | total so far $${spent.toFixed(3)} of ${budget.toFixed(2)}`);
      original(`  issues: ${report.issues.length ? report.issues.join("; ") : "none"}; notes: ${report.notes.join(",") || "-"}`);
    } catch (err) {
      console.log = original;
      spent += cost;
      original(`${p.id} FAILED after $${cost.toFixed(3)}: ${err instanceof Error ? err.message : String(err)} | total so far $${spent.toFixed(3)}`);
      observed.push(cost);
      worst = observed.length >= 2 ? Math.max(...observed) * 1.25 : RESERVE;
    } finally {
      console.log = original;
    }
  }
  original(`\nDONE. Spent about $${spent.toFixed(3)} of $${budget.toFixed(2)}.`);
}

main();
