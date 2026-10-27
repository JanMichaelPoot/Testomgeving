import type { Activity, SocialFormat } from "@/lib/discovery/types";

// B5 / V1 "activity-specific fill" of the PDF's idea page: the four lines of "a possible way to spend it",
// the three "what you take away" lines and the three "make it yours" lines. Until now these came from ten
// fixed templates per kind of activity (src/lib/pdf/ideaContent.ts) and sometimes contradicted the idea:
// "bring someone you enjoy" for a solo idea, "bring a bank card" for an online course. With
// KNOWLEDGE_ENGINE_V2 on, the second (layers) call writes them for the idea itself, and this file is the
// deterministic guard: a line that contradicts what is known about the idea is never printed, whether the
// model wrote it or it comes from a template.
//
// Pure and free of server-only imports, so the generation, the PDF and the tests share it.

export interface IdeaFill {
  /** Start, during, finish, afterwards. The PDF shows the first three for an idea of 1.5 hours or less. */
  timeline: string[];
  takeaways: string[];
  suggestions: string[];
}

export const FILL_COUNTS = { timeline: 4, takeaways: 3, suggestions: 3 } as const;
/** Characters per line. The prompt asks for far less; this only catches a runaway answer (dropped, never cut). */
export const FILL_LINE_MAX = 110;

const clean = (v: unknown): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

/** All three lists with the exact number of lines, or none: half a block would read as a mistake. */
export function checkFill(value: unknown): { fill?: IdeaFill; problem?: string } {
  if (value === undefined || value === null) return { problem: "missing" };
  if (typeof value !== "object" || Array.isArray(value)) return { problem: "not an object" };
  const r = value as Record<string, unknown>;
  const out: Record<string, string[]> = {};
  for (const key of ["timeline", "takeaways", "suggestions"] as const) {
    const list = r[key];
    if (!Array.isArray(list)) return { problem: `${key} is not a list` };
    if (list.length !== FILL_COUNTS[key]) return { problem: `${key} has ${list.length} lines instead of ${FILL_COUNTS[key]}` };
    const lines = list.map(clean);
    const bad = lines.findIndex((l) => !l || l.length > FILL_LINE_MAX);
    if (bad >= 0) return { problem: `${key} line ${bad + 1} is ${lines[bad] ? `${lines[bad].length} characters` : "empty"}` };
    out[key] = lines;
  }
  return { fill: out as unknown as IdeaFill };
}

export function normalizeFill(value: unknown): IdeaFill | undefined {
  return checkFill(value).fill;
}

// --- contradictions ----------------------------------------------------------------------------------

/** What is known about how this person does this idea. Unknown is false: a rule only fires on a known fact. */
export interface FillContext {
  /** They chose to do it on their own (not "come alone and meet others"). */
  solo: boolean;
  /** The activity can only be done online. */
  onlineOnly: boolean;
  /** The activity happens indoors. */
  indoor: boolean;
}

export function fillContext(
  activity: Pick<Activity, "formats" | "setting">,
  lead: SocialFormat | null,
  company?: readonly string[],
): FillContext {
  const aloneOnly = !!company && company.length > 0 && company.every((c) => c === "alone");
  return {
    // Their own explicit choice of form wins; "I am by myself" only decides when they chose no form.
    solo: lead === "solo" || (aloneOnly && lead === null),
    onlineOnly: !!activity.formats && activity.formats.length === 1 && activity.formats[0] === "online",
    indoor: activity.setting === "indoor",
  };
}

// Dutch and English in one table: a line is checked in whichever language it is written.
const RULES: { name: keyof FillContext; test: RegExp }[] = [
  {
    name: "solo",
    test: /\b(neem|breng|vraag|nodig)\b[^.;]{0,30}\b(iemand|vriend|vriendin|vrienden|partner|kennis|collega|familie|gezelschap|anderen)\b|nieuwe gezichten|nieuw gesprek|maak kennis|\bbring\b[^.;]{0,25}\b(someone|a friend|your partner|friends|company|a companion)\b|new faces|new conversation|meet (new|other) people|chat with (the )?others|\binvite\b[^.;]{0,20}\b(someone|a friend|friends)\b/i,
  },
  {
    name: "onlineOnly",
    test: /\b(cash|pinpas|bankpas|contant geld|parkeer\w*|reistijd|ov-chip\w*|bank card|parking|travel time|commute)\b|\b(rij|reis|fiets|loop)\s+(er)?naartoe\b|\bon your way there\b/i,
  },
  {
    name: "indoor",
    test: /\b(regenjas|regenkleding|laarzen|zonnebrand\w*|zonnebril|paraplu|weerbericht|raincoat|rain gear|boots|sunscreen|sunglasses|umbrella|weather forecast)\b/i,
  },
];

/** The first rule a line breaks for this context, or null. */
export function lineConflict(line: string, ctx: FillContext): keyof FillContext | null {
  for (const rule of RULES) if (ctx[rule.name] && rule.test.test(line)) return rule.name;
  return null;
}

/** Problems of a whole fill (empty when it is fine), as `block:rule` for the generation log. */
export function fillConflicts(fill: IdeaFill, ctx: FillContext): string[] {
  const problems: string[] = [];
  for (const key of ["timeline", "takeaways", "suggestions"] as const) {
    for (const line of fill[key]) {
      const rule = lineConflict(line, ctx);
      if (rule) problems.push(`${key}:${rule}`);
    }
  }
  return problems;
}

/**
 * Lines of a template, without those that contradict the idea. Never returns an empty list for a non-empty one:
 * if every line conflicted the original is kept, because no block at all would be worse than one dull line
 * (templates are written to be neutral, so this practically does not happen).
 */
export function withoutConflicts(lines: readonly string[], ctx: FillContext): string[] {
  const kept = lines.filter((l) => !lineConflict(l, ctx));
  return kept.length > 0 ? kept : [...lines];
}
