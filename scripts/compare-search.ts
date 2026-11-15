// The comparison behind Search Engine 2.0 (Stap 200): the same persona, the same intake, the same moment, searched once with the old search (the five ideas, then one
// round at a time for every idea without a place) and once with the new one (the five ideas and a reserve in one go, a swap for what has no place, the old rounds only for
// what is left). Both start from a cold research cache and with the supply index off, so neither profits from the other's answers; the shared cache is not read or written.
// Only the research is run (the writing is the same in both and costs ~USD 0.10), with the Google score off in both: the model cost and the options are what is compared.
//
//   npx tsx scripts/compare-search.ts --dry-run P12 P13          free: what would run, and the worst case in dollars
//   npx tsx scripts/compare-search.ts --budget 2.00 P12 P13 P04   real runs (each persona twice), stopping before the budget could be passed
//   add --reserve 0.35 to assume another worst case per run (a research-only run stays under the book's hard cap, USD 0.50)
//
// The web is not deterministic: the same search run twice returns somewhat different results, so one pair is an indication, not a proof; the table says so and several
// personas are meant to be read together. Results go to scratch/compare-search/ (one JSON per run and summary.md), which is not committed.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

if (!process.env.ANTHROPIC_API_KEY && existsSync(".env.local")) process.loadEnvFile(".env.local");

const RESERVE = process.argv.includes("--reserve") ? Number(process.argv[process.argv.indexOf("--reserve") + 1]) : 0.35;

interface RunResult {
  persona: string;
  engine: "v1" | "v2";
  ms: number;
  usd: number;
  searches: number;
  calls: number;
  fallbackRounds: number;
  candidates: number;
  candidatesWithOption: number;
  reserveUsed: number;
  sitesChecked: number;
  optionsPerIdea: number[];
  presented: number;
  usdPerOption: number | null;
  ideasWithoutPlace: number;
  notes: string[];
  seeds: string[];
  placesPerIdea: { activityId: string; options: { name: string; city: string; url: string | null; rating: number | null }[] }[];
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry-run");
  const budget = args.includes("--budget") ? Number(args[args.indexOf("--budget") + 1]) : 2;
  const ids = args.filter((a) => /^P\d\d$/.test(a));

  const { PERSONAS, runSession, MONTH } = await import("../src/lib/discovery/eval/audience");
  const { associationsToEngineInput } = await import("../src/lib/discovery/associations");
  const { effortForPicks } = await import("../src/lib/discovery/imageIntake");
  const { computeCharacterProfile } = await import("../src/lib/characterProfile");
  type Intake = import("../src/app/intake/actions").IntakeAnswers;

  const chosen = (ids.length ? ids : ["P12", "P13"]).map((id) => PERSONAS.find((p) => p.id === id)!).filter(Boolean);
  const build = (p: (typeof PERSONAS)[number]): { intake: Intake; locale: "nl" | "en" } => {
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
    return { intake, locale: p.id === "P12" ? "en" : "nl" };
  };

  const runs = chosen.length * 2;
  if (dry) {
    console.log(`DRY RUN (free). ${chosen.length} persona(s), each twice (old and new search) = ${runs} research-only runs. Worst case ${RESERVE.toFixed(2)} USD per run = ${(runs * RESERVE).toFixed(2)} USD; budget ${budget.toFixed(2)} USD.\n`);
    for (const p of chosen) {
      const b = build(p);
      console.log(`## ${p.id} ${p.label}  [${b.locale}; ${p.context}; "${p.mustHaves}"; budget ${p.budget}; ${p.time}]`);
      console.log(`  picks p1: ${b.intake.associations!.join(", ")}`);
      console.log(`  picks p2: ${b.intake.interests!.join(", ")}`);
    }
    console.log(`\nBoth engines start from a cold research cache (WINDOW_RESEARCH_CACHE=0), the supply index off (WINDOW_SUPPLY_INDEX=0) and the Google score off.`);
    return;
  }

  // The same conditions for both: no shared cache, no supply index, no Google score, and the coverage stage as in production.
  process.env.WINDOW_RESEARCH_CACHE = "0";
  process.env.WINDOW_SUPPLY_INDEX = "0";
  delete process.env.GOOGLE_PLACES_API_KEY;
  delete process.env.GOOGLE_PLACES_ENABLED;

  mkdirSync("scratch/compare-search", { recursive: true });
  const { generateIdeaBookFromSeeds } = await import("../src/lib/claude/generateFromSeeds");
  const results: RunResult[] = [];
  let spent = 0;
  let worst = RESERVE;
  const observed: number[] = [];
  const quiet = console.log;
  outer: for (const p of chosen) {
    for (const engine of ["v1", "v2"] as const) {
      if (spent + worst > budget + 1e-9) {
        quiet(`STOP before ${p.id} ${engine}: spent ${spent.toFixed(3)} + worst case ${worst.toFixed(3)} would pass the budget of ${budget.toFixed(2)}.`);
        break outer;
      }
      if (engine === "v2") process.env.WINDOW_SEARCH_V2 = "1";
      else delete process.env.WINDOW_SEARCH_V2;
      const b = build(p);
      const started = Date.now();
      console.log = () => {};
      try {
        const { report } = await generateIdeaBookFromSeeds(b.intake, b.locale, computeCharacterProfile(b.intake), { sessionId: `compare-${p.id}`, researchOnly: true });
        console.log = quiet;
        const cost = report.cost!;
        const s = cost.search!;
        const r: RunResult = {
          persona: p.id,
          engine,
          ms: Date.now() - started,
          usd: cost.usd,
          searches: cost.searches ?? 0,
          calls: (cost.calls ?? []).length,
          fallbackRounds: s.fallbackRounds,
          candidates: s.candidates,
          candidatesWithOption: s.candidatesWithOption,
          reserveUsed: s.reserve.used,
          sitesChecked: s.sitesChecked,
          optionsPerIdea: s.optionsPerIdea,
          presented: s.presentedOptions,
          usdPerOption: s.usdPerOption ?? null,
          ideasWithoutPlace: s.optionsPerIdea.filter((n) => n === 0).length,
          notes: report.notes,
          seeds: report.seeds.map((x) => x.activityId),
          placesPerIdea: report.placesPerIdea ?? [],
        };
        results.push(r);
        spent += cost.usd;
        observed.push(cost.usd);
        worst = observed.length >= 2 ? Math.max(...observed) * 1.25 : RESERVE;
        writeFileSync(`scratch/compare-search/${p.id}-${engine}.json`, JSON.stringify({ ...r, cost }, null, 1));
        quiet(`${p.id} ${engine}: $${cost.usd.toFixed(3)}, ${r.searches} searches, ${r.fallbackRounds} extra rounds, options per idea ${r.optionsPerIdea.join("/")}, ${(r.ms / 1000).toFixed(0)} s | total $${spent.toFixed(3)} of ${budget.toFixed(2)}`);
      } catch (err) {
        console.log = quiet;
        quiet(`${p.id} ${engine} FAILED: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  const row = (r: RunResult) =>
    `| ${r.persona} | ${r.engine} | $${r.usd.toFixed(3)} | ${r.calls} | ${r.searches} | ${r.fallbackRounds} | ${r.candidates} (${r.candidatesWithOption}) | ${r.reserveUsed} | ${r.sitesChecked} | ${r.optionsPerIdea.join("/")} | ${r.ideasWithoutPlace} | ${r.usdPerOption === null ? "-" : "$" + r.usdPerOption.toFixed(3)} | ${(r.ms / 1000).toFixed(0)} s |`;
  const mean = (list: number[]) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);
  const by = (e: "v1" | "v2") => results.filter((r) => r.engine === e);
  const md = [
    `# Search Engine 2.0 against the old search (research only, cold cache)`,
    ``,
    `Persona runs are paired; the web is not deterministic, so read the pairs together, not one alone.`,
    ``,
    `| Persona | Engine | Model cost | Calls | Searches | Extra rounds | Activities researched (with a place) | Reserve used | Sites checked | Options per idea | Ideas without a place | Cost per option | Time |`,
    `|---|---|---|---|---|---|---|---|---|---|---|---|---|`,
    ...results.map(row),
    ``,
    `Mean per engine: v1 $${mean(by("v1").map((r) => r.usd)).toFixed(3)} / ${mean(by("v1").map((r) => r.searches)).toFixed(1)} searches / ${mean(by("v1").map((r) => r.ms / 1000)).toFixed(0)} s; v2 $${mean(by("v2").map((r) => r.usd)).toFixed(3)} / ${mean(by("v2").map((r) => r.searches)).toFixed(1)} searches / ${mean(by("v2").map((r) => r.ms / 1000)).toFixed(0)} s.`,
    ``,
    ...results.flatMap((r) => [`## ${r.persona} ${r.engine}`, ...r.placesPerIdea.map((i) => `- ${i.activityId}: ${i.options.map((o) => `${o.name} (${o.city}${o.rating ? `, ${o.rating}` : ""})`).join("; ") || "no place"}`), `notes: ${r.notes.join(", ") || "-"}`, ``]),
  ].join("\n");
  writeFileSync("scratch/compare-search/summary.md", md);
  quiet(`\nSummary written to scratch/compare-search/summary.md. Total spent $${spent.toFixed(3)} of ${budget.toFixed(2)}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
