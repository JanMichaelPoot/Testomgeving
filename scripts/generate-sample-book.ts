// The public example book of the site, written by the current pipeline for an INVENTED visitor, so "Zo ziet een boek eruit" shows what a
// buyer gets today and nobody's own answers are ever published. The visit (images and activities) is simulated for free; only the writing
// and the local research cost money (the per-book ceiling of src/lib/claude/costLedger.ts applies).
//
//   npx tsx scripts/generate-sample-book.ts --dry-run [--seed x]      free: the five ideas this visitor would get
//   npx tsx scripts/generate-sample-book.ts --locale nl [--seed x]    ONE PAID generation, into scratch/sample-book/ (nothing public changes)
//   npx tsx scripts/generate-sample-book.ts --locale nl --render      free: the stored book rendered again
//   npx tsx scripts/generate-sample-book.ts --locale nl --publish     free: copy the checked PDF to public/examples/
//   python scripts/make-sample-spreads.py                             then: cut the pages shown on the site
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

if (!process.env.ANTHROPIC_API_KEY && existsSync(".env.local")) process.loadEnvFile(".env.local");

const OUT = path.join("scratch", "sample-book");

async function main() {
  const args = process.argv.slice(2);
  const value = (name: string, fallback: string) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
  const locale = value("locale", "nl") === "en" ? ("en" as const) : ("nl" as const);
  const seed = value("seed", "sample");
  const json = path.join(OUT, `${locale}.json`);
  const pdf = path.join(OUT, `idea-book-${locale}.pdf`);

  if (args.includes("--publish")) {
    copyFileSync(pdf, path.join("public", "examples", `idea-book-${locale}.pdf`));
    console.log(`Published ${pdf}`);
    return;
  }

  const { runSession, MONTH } = await import("../src/lib/discovery/eval/audience");
  const { associationsToEngineInput, buildAssociationLibrary, buildAssociationSources } = await import("../src/lib/discovery/associations");
  const { effortForPicks } = await import("../src/lib/discovery/imageIntake");
  const { DOMAINS, getActivity } = await import("../src/lib/discovery/library");
  type Intake = import("../src/app/intake/actions").StoredIntake;
  type Book = import("../src/lib/claude/ideaBookTypes").GeneratedIdeaBook;

  // An invented adult who searches for themselves: curious, likes making things, old places and being outside.
  const persona = {
    id: "SAMPLE", label: "Sample visitor", who: "Invented visitor of the public example book", context: "self" as const,
    tags: ["making", "history", "nature", "story", "discovery", "food"], domains: ["creative", "history", "nature"],
    budget: "50", time: "halfday", mustHaves: "", needs: "", stage: () => true, social: () => true, feasible: () => true,
  };
  const visit = runSession(persona, seed);
  const derived = associationsToEngineInput({
    associationIds: visit.imagePicks, interestDomains: [], explicitInterests: visit.concretePicks,
    constraints: { budget: persona.budget, timeAvailable: persona.time, mustHaves: "", socialFormats: [], ageCategory: "", searchContext: "self" },
    seed, month: MONTH,
  });
  const intake: Intake = {
    situation: "", purpose: "self", purposeFollowUp: "", ageCategory: "", location: "Utrecht", country: "NL",
    searchDistance: "hour", searchDistanceKm: 25, freeTimePattern: "search", practicalToWild: derived.practicalToWild, timeAvailable: persona.time,
    budget: persona.budget, effort: effortForPicks(derived.effort, derived.interests, false), solutionTypes: ["activity"], mustHaves: "", preferences: "",
    company: [], personalReflection: "", interests: visit.concretePicks, interestDomains: [], socialFormats: [], intakeVariant: "associations",
    intakeFlow: "images2", associations: visit.imagePicks, searchContext: "self", locale,
  };

  if (args.includes("--dry-run")) {
    console.log(`DRY RUN (free), seed "${seed}"`);
    console.log(`  images: ${visit.imagePicks.join(", ")}`);
    console.log(`  activities picked: ${visit.concretePicks.join(", ")}`);
    for (const s of visit.seeds) console.log(`  idea: ${s.id} (${getActivity(s.id)!.label[locale]}; ${s.door})`);
    return;
  }

  mkdirSync(OUT, { recursive: true });
  let book: Book;
  if (args.includes("--render")) {
    book = (JSON.parse(readFileSync(json, "utf8")) as { book: Book }).book;
  } else {
    if (existsSync(json)) throw new Error(`${json} exists: use --render, or remove it to pay for a new book.`);
    const { generateIdeaBookFromSeeds } = await import("../src/lib/claude/generateFromSeeds");
    const { computeCharacterProfile } = await import("../src/lib/characterProfile");
    const result = await generateIdeaBookFromSeeds(intake, locale, computeCharacterProfile(intake), { sessionId: `sample-${seed}-${locale}` });
    // The same last steps as for a buyer's book (app/plan/data.ts): links and prices are checked before it is kept.
    const { localizeBook } = await import("../src/lib/claude/localizeBook");
    const { verifyBook } = await import("../src/lib/links/verifyBook");
    book = (await verifyBook(localizeBook(result.book, locale), { language: locale, country: "NL", adultsOnly: true, place: "Utrecht" })).book;
    writeFileSync(json, JSON.stringify({ seed, locale, intake, report: result.report, book }, null, 1));
    console.log(`Issues: ${result.report.issues.join("; ") || "none"}; notes: ${result.report.notes.join(",") || "-"}`);
    // The model cost of this book (Google lookups are counted separately in the same record).
    const cost = result.report.cost;
    console.log(`Cost: $${cost?.usd.toFixed(3) ?? "?"} ${JSON.stringify(cost?.breakdown ?? {})}; google lookups: ${cost?.placesLookups ?? 0}`);
  }

  const { renderIdeaBookPdf } = await import("../src/lib/pdf/ideaBook");
  const { buildSill, buildWindowItems } = await import("../src/lib/vensterPanes");
  const { paneActivities } = await import("../src/lib/discovery/concretePool");
  const { getDictionary } = await import("../src/lib/i18n/dictionaries");
  const { buildIdeaThreads, threadSentence } = await import("../src/lib/ideaThread");
  const { WILDCARD_KEY, ideaKey } = await import("../src/lib/ideaKeys");
  const { knowledgeWritingV2Enabled } = await import("../src/lib/knowledgeFlags");

  const dict = getDictionary(locale);
  const all = [...book.ideas, book.wildcard];
  const threads = buildIdeaThreads(book.ideas, book.wildcard, buildAssociationSources(all, visit.imagePicks, visit.concretePicks), locale, { showPath: knowledgeWritingV2Enabled() });
  const threadLines: Record<string, string> = {};
  all.forEach((idea, i) => {
    const line = threadSentence(threads[i < book.ideas.length ? ideaKey(i) : WILDCARD_KEY], dict.venster.thread, dict.venster.profile.and);
    if (line && idea.activity_id) threadLines[idea.activity_id] = line;
  });
  const bytes = await renderIdeaBookPdf(book, dict.plan.eyebrow, locale, {
    company: intake.company ?? [],
    budget: intake.budget,
    timeAvailable: intake.timeAvailable,
    threadLines,
    window: {
      items: buildWindowItems(intake, { cards: buildAssociationLibrary(locale).cards, domains: DOMAINS.map((d) => ({ id: d.id, label: d.short[locale] })), activities: paneActivities(locale) }, dict.venster),
      sill: buildSill(intake, dict.intake, dict.venster),
      recipientName: undefined,
      forGroup: false,
      dateLabel: new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Amsterdam" }).format(new Date()),
    },
  });
  writeFileSync(pdf, bytes);
  console.log(`Wrote ${pdf} (${Math.round(bytes.length / 1024)} KB)`);
  for (const entry of all) console.log(`  ${entry.activity_id}: ${entry.title} | ${entry.practical.estimated_cost} | places: ${(entry.places ?? []).map((p) => p.name).join(", ") || "-"}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
