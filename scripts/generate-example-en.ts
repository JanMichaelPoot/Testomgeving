// Writes the ENGLISH example book of the site: the intake of an existing real book (a window_plans row, as for the Dutch example) is
// written again in English by the current pipeline and rendered with the current PDF renderer. One real generation (about $0.25).
//
//   npx tsx --env-file=.env.local scripts/generate-example-en.ts <plan id or prefix>
//   python scripts/make-sample-spreads.py
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { generateIdeaBookFromSeeds } from "../src/lib/claude/generateFromSeeds";
import { computeCharacterProfile } from "../src/lib/characterProfile";
import { renderIdeaBookPdf, type IdeaBookPdfContext } from "../src/lib/pdf/ideaBook";
import { buildSill, buildWindowItems } from "../src/lib/vensterPanes";
import { buildAssociationLibrary, buildAssociationSources } from "../src/lib/discovery/associations";
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
  if (!wanted) throw new Error("Usage: generate-example-en.ts <plan id or prefix>");
  const { data: rows, error } = await supabase.from("window_plans").select("id, session_id").eq("status", "ready").order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  const row = (rows ?? []).find((r) => r.id.startsWith(wanted));
  if (!row) throw new Error(`No ready plan starts with ${wanted}`);
  const { data: intake } = await supabase.from("intake_answers").select("raw_json").eq("session_id", row.session_id).maybeSingle();
  const stored = { ...(intake?.raw_json as StoredIntake), locale: "en" as const };
  if (stored.purpose === "gift" || isForOther(stored) || stored.recipientName) throw new Error("This book is for someone else: not suitable as the public example.");

  const { book, report } = await generateIdeaBookFromSeeds(stored, "en", computeCharacterProfile(stored), { sessionId: row.session_id });
  console.log(`Written: ${book.ideas.map((i) => i.title).join(" | ")} | wildcard: ${book.wildcard.title}`);
  console.log(`Issues: ${report.issues.join("; ") || "none"}`);

  const dict = getDictionary("en");
  const all = [...book.ideas, book.wildcard];
  const threadLines: Record<string, string> = {};
  const built = buildAssociationSources(all, stored.associations ?? [], stored.intakeFlow === "images2" ? stored.interests ?? [] : []);
  const threads = buildIdeaThreads(book.ideas, book.wildcard, built, "en", { showPath: knowledgeWritingV2Enabled() });
  all.forEach((idea, i) => {
    const line = threadSentence(threads[i < book.ideas.length ? ideaKey(i) : WILDCARD_KEY], dict.venster.thread, dict.venster.profile.and);
    if (line && idea.activity_id) threadLines[idea.activity_id] = line;
  });
  const context: IdeaBookPdfContext = {
    company: stored.company ?? [],
    budget: stored.budget,
    timeAvailable: stored.timeAvailable,
    threadLines,
    window: {
      items: buildWindowItems(stored, { cards: buildAssociationLibrary("en").cards, domains: DOMAINS.map((d) => ({ id: d.id, label: d.short.en })), activities: paneActivities("en") }, dict.venster),
      sill: buildSill(stored, dict.intake, dict.venster),
      recipientName: undefined,
      forGroup: false,
      dateLabel: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Amsterdam" }).format(new Date()),
    },
  };
  const bytes = await renderIdeaBookPdf(book, dict.plan.eyebrow, "en", context);
  const out = path.join(process.cwd(), "public", "examples", "idea-book-en.pdf");
  await writeFile(out, bytes);
  console.log(`Wrote ${out} (${Math.round(bytes.length / 1024)} KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
