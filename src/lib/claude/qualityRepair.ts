// The model-backed half of the quality gate (Fase 3): rewrites only the ideas that failed a check, and one cheap grammar pass over the
// whole book. Everything here fails soft: a call that errors, an answer that does not parse or an answer that adds a fact leaves the
// book as it was; the gate never makes a paid book fail. Checks and deterministic repairs live in qualityGate.ts.

import { anthropic, CLAUDE_MODEL } from "@/lib/anthropic";
import { extractToolInput } from "@/lib/claude/shared";
import type { GeneratedIdeaBook, IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import { autoFix, entriesOf, proseFields, qaBook, rewriteTargets, type QaContext, type QaIssue } from "@/lib/claude/qualityGate";

/** The cheap model for the grammar pass; the dearer writing model rewrites the ideas that failed. */
export const GRAMMAR_MODEL = process.env.WINDOW_QA_MODEL || "claude-haiku-4-5-20251001";

/** At most this many rewrite rounds for an idea (the brief: max 2 regeneration attempts per idea). */
export const MAX_REWRITE_ATTEMPTS = 2;

export interface ModelCall {
  (args: { model: string; system: string; user: string; tool: { name: string; description: string; schema: Record<string, unknown> }; maxTokens: number }): Promise<unknown | null>;
}

/** Calls the model with one forced tool; null on any failure. */
export const callModel: ModelCall = async ({ model, system, user, tool, maxTokens }) => {
  try {
    const message = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
      tools: [{ name: tool.name, description: tool.description, input_schema: tool.schema as never }],
      tool_choice: { type: "tool", name: tool.name },
    });
    return extractToolInput<unknown>(message, tool.name);
  } catch (err) {
    console.warn(`WINDOW: quality gate call (${tool.name}) failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
};

// --- "no new facts" guard -----------------------------------------------------------------------------------

const FACT = /https?:\/\/\S+|\b[a-z0-9-]+\.(?:nl|com|org|eu|be|de|net|io)\b|€\s?\d[\d.,]*|\d+(?:[.,]\d+)?/gi;

/** Every URL, domain, price and number in `text`. A rewrite may drop facts but never add one. */
export function factsIn(text: string): Set<string> {
  return new Set((text.match(FACT) ?? []).map((f) => f.toLowerCase().replace(/[.,]+$/, "")));
}

export function addsNoFacts(before: string, after: string): boolean {
  const allowed = factsIn(before);
  for (const fact of factsIn(after)) if (!allowed.has(fact)) return false;
  return true;
}

// --- rewrite the ideas that failed -----------------------------------------------------------------------------

interface RewriteRow {
  where: string;
  intro: string;
  why_it_fits: string;
  details: string[];
  first_action: string;
}

const REWRITE_SCHEMA = {
  type: "object",
  properties: {
    ideas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          where: { type: "string" },
          intro: { type: "string" },
          why_it_fits: { type: "string" },
          details: { type: "array", items: { type: "string" } },
          first_action: { type: "string" },
        },
        required: ["where", "intro", "why_it_fits", "details", "first_action"],
      },
    },
  },
  required: ["ideas"],
};

function languageOf(locale: QaContext["locale"]) {
  return locale === "nl" ? "Dutch (natural, informal 'je')" : "English";
}

const REWRITE_SYSTEM = (locale: QaContext["locale"]) => `You fix a few ideas of a personal Idea Book. You get ideas that failed a quality check, with the problems. Rewrite ONLY the fields given, in ${languageOf(locale)}.
Rules:
- Keep every name, website, price, number and place exactly as it is. Never add a new one.
- Fix exactly what the problems say. A repeated sentence must be replaced by a sentence specific to THIS idea (what it is, why it suits this person); do not reuse wording from the other ideas shown under "Do not repeat".
- A seasonal problem means the idea names something that cannot be done in this month: rewrite it so it only describes what is possible now, without inventing a replacement activity.
- Plain, concrete sentences. No arrows, no talk about images, choices or how the idea was found.
- Keep the same number of details as before, and keep first_action doable in under a minute.`;

function rewritePrompt(book: GeneratedIdeaBook, targets: Map<string, QaIssue[]>, ctx: QaContext): string {
  const all = entriesOf(book);
  const blocks = [...targets.entries()].map(([where, issues]) => {
    const entry = all.find(([, w]) => w === where)?.[0];
    if (!entry) return "";
    const repeated = issues.filter((i) => i.code === "repeated_sentence").map((i) => i.detail);
    const others = all
      .filter(([, w]) => w !== where)
      .flatMap(([e]) => [e.intro, e.why_it_fits])
      .filter(Boolean)
      .slice(0, 12);
    return `## ${where} — "${entry.title}"
Problems: ${issues.map((i) => `${i.code} (${i.detail})`).join("; ")}
intro: ${entry.intro}
why_it_fits: ${entry.why_it_fits}
details:
${entry.details.map((d, i) => `${i + 1}. ${d}`).join("\n")}
first_action: ${entry.first_action}
${repeated.length ? `Do not repeat these sentences from other ideas: ${repeated.join(" | ")}\n` : ""}Other ideas, for contrast (do not copy their wording):
${others.map((o) => `- ${o}`).join("\n")}`;
  });
  return `This month is month ${ctx.month} of the year (the Netherlands).\n\n${blocks.filter(Boolean).join("\n\n")}\n\nCall rewrite_ideas once, with one entry per idea above (where = the label such as idea3 or wildcard).`;
}

function applyRewrite(entry: IdeaBookEntry, row: RewriteRow): IdeaBookEntry {
  const before = [entry.intro, entry.why_it_fits, entry.first_action, ...entry.details].join(" ");
  const after = [row.intro, row.why_it_fits, row.first_action, ...row.details].join(" ");
  if (!row.intro?.trim() || !row.why_it_fits?.trim() || !row.first_action?.trim()) return entry;
  if (!Array.isArray(row.details) || row.details.length !== entry.details.length) return entry;
  if (!addsNoFacts(before, after)) return entry;
  return { ...entry, intro: row.intro.trim(), why_it_fits: row.why_it_fits.trim(), first_action: row.first_action.trim(), details: row.details.map((d) => String(d).trim()) };
}

export async function rewriteFailedIdeas(
  book: GeneratedIdeaBook,
  targets: Map<string, QaIssue[]>,
  ctx: QaContext,
  call: ModelCall = callModel,
): Promise<GeneratedIdeaBook> {
  if (targets.size === 0) return book;
  const answer = (await call({
    model: CLAUDE_MODEL,
    system: REWRITE_SYSTEM(ctx.locale),
    user: rewritePrompt(book, targets, ctx),
    tool: { name: "rewrite_ideas", description: "Return the rewritten fields of the failed ideas.", schema: REWRITE_SCHEMA },
    maxTokens: 3500,
  })) as { ideas?: RewriteRow[] } | null;
  if (!answer || !Array.isArray(answer.ideas)) return book;
  const byWhere = new Map(answer.ideas.map((r) => [r.where, r]));
  const ideas = book.ideas.map((e, i) => (byWhere.has(`idea${i + 1}`) ? applyRewrite(e, byWhere.get(`idea${i + 1}`)!) : e));
  const wildcard = byWhere.has("wildcard") ? applyRewrite(book.wildcard, byWhere.get("wildcard")!) : book.wildcard;
  return { ...book, ideas, wildcard };
}

// --- the grammar pass --------------------------------------------------------------------------------------------

const GRAMMAR_SCHEMA = {
  type: "object",
  properties: {
    fixes: {
      type: "array",
      items: { type: "object", properties: { path: { type: "string" }, text: { type: "string" } }, required: ["path", "text"] },
    },
  },
  required: ["fixes"],
};

const GRAMMAR_SYSTEM = (locale: QaContext["locale"]) => `You proofread the text of a personal Idea Book written in ${languageOf(locale)}. Return ONLY the fields that need a fix.
Checklist (fix only real problems; leave good text untouched):
1. Spelling, grammar, agreement (de/het, verb forms), punctuation.
2. One form of address: informal "je/jouw" throughout, never "u".
3. No chained colons or lists crammed into one sentence; split it.
4. No English words in Dutch text (except names and fixed terms), no raw labels pasted in ("Kies pottenbakken" is fine; "Activity: pottery" is not).
5. No arrows, no talk about images or how the idea was found.
6. Keep every name, website, price and number exactly; never add or change a fact. Keep the length about the same.`;

function grammarPrompt(book: GeneratedIdeaBook): string {
  const lines: string[] = [`profile_summary: ${book.profile_summary}`];
  for (const [entry, where] of entriesOf(book)) {
    for (const [field, text] of proseFields(entry).filter(([f]) => f === "intro" || f === "why_it_fits" || f === "first_action" || f.startsWith("details["))) {
      lines.push(`${where}.${field}: ${text}`);
    }
  }
  return `${lines.join("\n")}\n\nCall fix_text once with the fields that need a fix (path = the label before the colon).`;
}

export async function grammarPass(book: GeneratedIdeaBook, ctx: QaContext, call: ModelCall = callModel): Promise<{ book: GeneratedIdeaBook; changed: number }> {
  const answer = (await call({
    model: GRAMMAR_MODEL,
    system: GRAMMAR_SYSTEM(ctx.locale),
    user: grammarPrompt(book),
    tool: { name: "fix_text", description: "Return corrected text for the fields that need a fix.", schema: GRAMMAR_SCHEMA },
    maxTokens: 3000,
  })) as { fixes?: { path: string; text: string }[] } | null;
  if (!answer || !Array.isArray(answer.fixes) || answer.fixes.length === 0) return { book, changed: 0 };

  let changed = 0;
  const accept = (before: string, after: unknown): string => {
    if (typeof after !== "string" || !after.trim() || after === before) return before;
    const ratio = after.length / Math.max(1, before.length);
    if (ratio < 0.6 || ratio > 1.5 || !addsNoFacts(before, after)) return before;
    changed++;
    return after.trim();
  };
  const fixes = new Map(answer.fixes.map((f) => [f.path, f.text]));
  const patch = (entry: IdeaBookEntry, where: string): IdeaBookEntry => ({
    ...entry,
    intro: accept(entry.intro, fixes.get(`${where}.intro`)),
    why_it_fits: accept(entry.why_it_fits, fixes.get(`${where}.why_it_fits`)),
    first_action: accept(entry.first_action, fixes.get(`${where}.first_action`)),
    details: entry.details.map((d, i) => accept(d, fixes.get(`${where}.details[${i}]`))),
  });
  return {
    book: {
      ...book,
      profile_summary: accept(book.profile_summary, fixes.get("profile_summary")),
      ideas: book.ideas.map((e, i) => patch(e, `idea${i + 1}`)),
      wildcard: patch(book.wildcard, "wildcard"),
    },
    changed,
  };
}

// --- the gate -------------------------------------------------------------------------------------------------------

export interface GateResult {
  book: GeneratedIdeaBook;
  /** What the gate did, in the same style as the pipeline's issues: "idea2:exposed_reasoning_removed", "rewrite_round_1 (idea3)" ... */
  log: string[];
  /** What was still wrong after the repairs (reported, never a reason to fail the book). */
  remaining: QaIssue[];
  /** Everything found before any repair, per code, for the evaluation report. */
  foundBefore: QaIssue[];
}

export interface GateOptions {
  call?: ModelCall;
  /** Switch the grammar pass off (default on; WINDOW_QA_GRAMMAR=0 also switches it off). */
  grammar?: boolean;
  maxRewriteAttempts?: number;
}

export async function runQualityGate(input: GeneratedIdeaBook, ctx: QaContext, opts: GateOptions = {}): Promise<GateResult> {
  const call = opts.call ?? callModel;
  const log: string[] = [];
  const foundBefore = qaBook(input, ctx);
  try {
    const fixed = autoFix(input, ctx.locale);
    let book = fixed.book;
    log.push(...fixed.fixes);

    const attempts = opts.maxRewriteAttempts ?? MAX_REWRITE_ATTEMPTS;
    for (let round = 1; round <= attempts; round++) {
      const targets = rewriteTargets(qaBook(book, ctx));
      if (targets.size === 0) break;
      log.push(`rewrite_round_${round} (${[...targets.keys()].join(", ")})`);
      book = await rewriteFailedIdeas(book, targets, ctx, call);
      book = autoFix(book, ctx.locale).book;
    }

    const grammarOn = opts.grammar ?? process.env.WINDOW_QA_GRAMMAR !== "0";
    if (grammarOn) {
      const g = await grammarPass(book, ctx, call);
      book = g.book;
      if (g.changed > 0) log.push(`grammar_fixed (${g.changed})`);
    }
    return { book, log, remaining: qaBook(book, ctx), foundBefore };
  } catch (err) {
    // Never let the gate fail a paid book: hand the original back and say so.
    console.warn(`WINDOW: quality gate failed, book left as written: ${err instanceof Error ? err.message : String(err)}`);
    return { book: input, log: ["gate_failed"], remaining: foundBefore, foundBefore };
  }
}
