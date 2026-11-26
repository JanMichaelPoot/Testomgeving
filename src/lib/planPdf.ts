// The PDF of a book: how it is rendered from the book and the buyer's answers, where it is stored, and how it is made again from the stored plan
// (a download that finds no file, "make the link again" on the problem page, and the migration script). Rendering is free: no model call.
//
// Server-only.

import { renderIdeaBookPdf, type IdeaBookPdfContext } from "@/lib/pdf/ideaBook";
import { buildSill, buildWindowItems } from "@/lib/vensterPanes";
import { buildAssociationLibrary, parseAssociationSources, type AssociationSources } from "@/lib/discovery/associations";
import { DOMAINS } from "@/lib/discovery/library";
import { paneActivities } from "@/lib/discovery/concretePool";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildIdeaThreads, threadSentence } from "@/lib/ideaThread";
import { knowledgeWritingV2Enabled } from "@/lib/knowledgeFlags";
import { WILDCARD_KEY, ideaKey } from "@/lib/ideaKeys";
import { isForOther } from "@/lib/discovery/audience";
import { withValidLayers } from "@/lib/claude/ideaLayers";
import type { GeneratedIdeaBook, IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import type { Locale } from "@/lib/locale";
import type { StoredIntake } from "@/app/intake/actions";

// Bumped whenever renderIdeaBookPdf's output changes in a way worth being able to tell apart later (layout, legal footer text, included
// sections) — stored per plan in window_plans.pdf_version so a support/admin lookup can tell which template generation a given customer's PDF
// actually reflects. Not tied to LEGAL_VERSIONS — this versions the *document*, not the consent copy.
// 2: idea pages rebuilt as magazine spreads (experience profile, schedule, takeaways, "make it yours", investment/location cards).
// 3: "Het venster" — Newsreader + Plus Jakarta Sans instead of Noto, gold instead of orange, the person's own window on the cover.
// 7: every printed web address carries an absolute link (fix round "plan links").
export const PDF_VERSION = 7;

export const PDF_BUCKET = "window-plans";
export const pdfPathFor = (sessionId: string) => `${sessionId}/idea-book.pdf`;

// The cover window of an image-intake book (null otherwise): same panes as on the site.
function coverWindowFor(profile: StoredIntake, locale: Locale, madeAt: Date): IdeaBookPdfContext["window"] {
  if (profile.intakeVariant !== "associations") return undefined;
  const dict = getDictionary(locale);
  const items = buildWindowItems(
    profile,
    { cards: buildAssociationLibrary(locale).cards, domains: DOMAINS.map((d) => ({ id: d.id, label: d.short[locale] })), activities: paneActivities(locale) },
    dict.venster,
  );
  return {
    items,
    sill: buildSill(profile, dict.intake, dict.venster),
    recipientName: isForOther(profile) ? profile.recipientName : undefined,
    forGroup: profile.searchContext === "group",
    dateLabel: new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Amsterdam" }).format(madeAt),
  };
}

/** The one line per door on the PDF page that says which images lie behind an idea. */
export function threadLinesFor(book: GeneratedIdeaBook, sources: AssociationSources | null, locale: Locale): Record<string, string> {
  const lines: Record<string, string> = {};
  if (!sources) return lines;
  const copy = getDictionary(locale).venster;
  const all = [...book.ideas, book.wildcard];
  const threads = buildIdeaThreads(book.ideas, book.wildcard, sources, locale, { showPath: knowledgeWritingV2Enabled() });
  all.forEach((idea, i) => {
    const key = i < book.ideas.length ? ideaKey(i) : WILDCARD_KEY;
    const line = threadSentence(threads[key], copy.thread, copy.profile.and);
    if (line && idea.activity_id) lines[idea.activity_id] = line;
  });
  return lines;
}

export function renderPlanPdf(
  book: GeneratedIdeaBook,
  title: string,
  locale: Locale,
  profile: StoredIntake,
  sources: AssociationSources | null,
  madeAt: Date = new Date(),
): Promise<Uint8Array> {
  return renderIdeaBookPdf(book, title, locale, {
    company: profile.company,
    budget: profile.budget,
    timeAvailable: profile.timeAvailable,
    window: coverWindowFor(profile, locale, madeAt),
    threadLines: threadLinesFor(book, sources, locale),
  });
}

/** The fields of a stored plan the book is made of. */
export interface StoredPlanBook {
  id: string;
  session_id: string;
  title: string | null;
  language: string;
  created_at: string;
  profile_summary: string | null;
  must_haves: unknown;
  preferences: unknown;
  ideas_json: unknown;
  wildcard_json: unknown;
  labels_json: unknown;
  association_sources?: unknown;
}

export function bookFromStored(plan: StoredPlanBook): GeneratedIdeaBook | null {
  if (!Array.isArray(plan.ideas_json) || plan.ideas_json.length === 0 || !plan.wildcard_json || typeof plan.wildcard_json !== "object") return null;
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  return {
    profile_summary: plan.profile_summary ?? "",
    must_haves: list(plan.must_haves),
    preferences: list(plan.preferences),
    // Read back through the same validation as the web page: addresses are absolute https or gone.
    ideas: (plan.ideas_json as IdeaBookEntry[]).map(withValidLayers),
    wildcard: withValidLayers(plan.wildcard_json as IdeaBookEntry),
    labels: (plan.labels_json ?? {}) as GeneratedIdeaBook["labels"],
  };
}

/** Renders the stored plan again (with the date it was made). Null when the plan holds no complete book. */
export async function renderStoredPlanPdf(plan: StoredPlanBook, profile: StoredIntake): Promise<Uint8Array | null> {
  const book = bookFromStored(plan);
  if (!book) return null;
  const locale: Locale = plan.language === "en" ? "en" : "nl";
  const sources = parseAssociationSources(plan.association_sources) as AssociationSources | null;
  return renderPlanPdf(book, plan.title || getDictionary(locale).plan.eyebrow, locale, profile, sources, new Date(plan.created_at));
}
