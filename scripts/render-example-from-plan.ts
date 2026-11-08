// Renders a REAL, already generated Idea Book (a row of window_plans, written by the current pipeline) with the current PDF renderer and
// saves it as the example book of the site, so "Zo ziet een boek eruit" shows exactly what a buyer gets: the same pages, the same layers,
// the same real places. No model call, no cost: it only reads the stored book.
//
//   npx tsx --env-file=.env.local scripts/render-example-from-plan.ts <plan id or its first 8 characters> [nl|en]
//   python scripts/make-sample-spreads.py          (then: cut the pages shown on the site)
//
// The stored book is the one Jan generated while testing: its ideas, places and texts are what the pipeline really wrote. The script
// refuses a book for someone else (search for somebody else) and a book with a first name, and prints what it used so it can be checked by eye.
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { renderIdeaBookPdf, type IdeaBookPdfContext } from "../src/lib/pdf/ideaBook";
import type { GeneratedIdeaBook } from "../src/lib/claude/ideaBookTypes";
import { buildSill, buildWindowItems } from "../src/lib/vensterPanes";
import { buildAssociationLibrary, parseAssociationSources } from "../src/lib/discovery/associations";
import { DOMAINS } from "../src/lib/discovery/library";
import { paneActivities } from "../src/lib/discovery/concretePool";
import { getDictionary } from "../src/lib/i18n/dictionaries";
import { buildIdeaThreads, threadSentence } from "../src/lib/ideaThread";
import { WILDCARD_KEY, ideaKey } from "../src/lib/ideaKeys";
import { knowledgeWritingV2Enabled } from "../src/lib/knowledgeFlags";
import { isForOther } from "../src/lib/discovery/audience";
import type { StoredIntake } from "../src/app/intake/actions";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!);

async function main() {
  const wanted = process.argv[2];
  const locale = (process.argv[3] === "en" ? "en" : "nl") as "nl" | "en";
  if (!wanted) throw new Error("Usage: render-example-from-plan.ts <plan id or prefix> [nl|en]");
  const { data: rows, error } = await supabase
    .from("window_plans")
    .select("id, session_id, title, language, status, profile_summary, must_haves, preferences, ideas_json, wildcard_json, labels_json, association_sources")
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  const row = (rows ?? []).find((r) => r.id.startsWith(wanted));
  if (!row) throw new Error(`No ready plan starts with ${wanted}`);
  if (row.language !== locale) console.warn(`NOTE: the book is written in ${row.language}, not ${locale}; its text stays as written.`);

  const { data: intake } = await supabase.from("intake_answers").select("raw_json").eq("session_id", row.session_id).maybeSingle();
  const profile = (intake?.raw_json ?? {}) as StoredIntake;
  if (isForOther(profile) || profile.recipientName) throw new Error("This book is for someone else: not suitable as the public example.");

  const book: GeneratedIdeaBook = {
    profile_summary: row.profile_summary ?? "",
    must_haves: (row.must_haves ?? []) as string[],
    preferences: (row.preferences ?? []) as string[],
    ideas: (row.ideas_json ?? []) as GeneratedIdeaBook["ideas"],
    wildcard: row.wildcard_json as unknown as GeneratedIdeaBook["wildcard"],
    labels: (row.labels_json ?? {}) as GeneratedIdeaBook["labels"],
  } as GeneratedIdeaBook;

  const dict = getDictionary(locale);
  // The thread per door, as on /plan and in the PDF of a real purchase.
  const threadLines: Record<string, string> = {};
  const sources = parseAssociationSources(row.association_sources);
  if (sources) {
    const threads = buildIdeaThreads(book.ideas, book.wildcard, sources, locale, { showPath: knowledgeWritingV2Enabled() });
    [...book.ideas, book.wildcard].forEach((idea, i) => {
      const key = i < book.ideas.length ? ideaKey(i) : WILDCARD_KEY;
      const line = threadSentence(threads[key], dict.venster.thread, dict.venster.profile.and);
      if (line && idea.activity_id) threadLines[idea.activity_id] = line;
    });
  }

  const context: IdeaBookPdfContext = {
    company: profile.company ?? [],
    budget: profile.budget,
    timeAvailable: profile.timeAvailable,
    threadLines,
  };
  if (profile.intakeVariant === "associations") {
    context.window = {
      items: buildWindowItems(
        profile,
        { cards: buildAssociationLibrary(locale).cards, domains: DOMAINS.map((d) => ({ id: d.id, label: d.short[locale] })), activities: paneActivities(locale) },
        dict.venster,
      ),
      sill: buildSill(profile, dict.intake, dict.venster),
      recipientName: undefined,
      forGroup: false,
      dateLabel: new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Amsterdam" }).format(new Date()),
    };
  }

  const bytes = await renderIdeaBookPdf(book, dict.plan.eyebrow, locale, context);
  const out = path.join(process.cwd(), "public", "examples", `idea-book-${locale}.pdf`);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, bytes);
  console.log(`Wrote ${out} (${Math.round(bytes.length / 1024)} KB) from plan ${row.id}`);
  console.log(`Ideas: ${book.ideas.map((i) => i.title).join(" | ")} | wildcard: ${book.wildcard.title}`);
  console.log(`Places: ${[...book.ideas, book.wildcard].map((i) => (i.places ?? []).map((p) => p.name).join(", ")).filter(Boolean).join(" || ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
