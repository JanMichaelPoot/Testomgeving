import type { GeneratedIdeaBook, IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import { getActivity } from "@/lib/discovery/library";
import { passesConstraints } from "@/lib/discovery/engine/constraints";
import type { ResolvedConstraints } from "@/lib/discovery/engine/types";
import { BUDGET_CAP, parseMaxCost } from "@/lib/pdf/ideaContent";
import { HOURS_RE, PHONE_RE, entriesOf, hasPhysicalPlace, proseFields, relatedIsPlausible, thinParts } from "@/lib/claude/qualityGate";
import { modeOfActivity } from "@/lib/discovery/activityKind";

// C1 (docs/plan-activiteitenselectie.md, the reference's 4.4): the six criteria every suggested activity must meet, checked on the finished book.
//   exists            it exists as something you can do: it is in the library, and the idea has a way in (a verified place, an online route, or it is
//                     something you do by yourself)
//   audience          it suits the people the book is for (the same hard limits the selection uses, asked again on the final book, so a replacement
//                     or a fill that went around the selection is caught too)
//   concrete          it is described concretely enough to act on (a first step, steps, what it costs and how long it takes)
//   feasible          it can be done in the context: this month, within the budget, and the book is not mostly things that need organising first
//   relation          it has a logical relation to what the person chose, or it is framed as a surprise on purpose
//   nothing_invented  the text names no provider, address, price, hours or number that is not in the research or in the library
// Pure functions, no network and no model. What cannot be settled here (a text that is too thin, a sentence that invents hours) goes to the
// quality gate's repair; an activity that fails a structural criterion is replaced where the book is assembled (generateFromSeeds.ts).

export const CRITERIA = ["exists", "audience", "concrete", "feasible", "relation", "nothing_invented"] as const;
export type Criterion = (typeof CRITERIA)[number];

export interface CriteriaContext {
  constraints: ResolvedConstraints;
  /** The wizard's budget value, if given: an estimate above it fails "feasible". */
  budget?: string;
  /** Activities the person chose themselves: they keep their supervised way in and need no theme to be related. */
  ownPicks?: ReadonlySet<string>;
  /** The hosts of the verified research options: a link to any other host in the text is not ours to give. */
  knownHosts?: ReadonlySet<string>;
}

export interface CriterionFailure {
  /** "idea1" ... "wildcard". */
  where: string;
  /** The activity it is about (an idea's own, or one of its companions). */
  activityId: string;
  criterion: Criterion;
  detail: string;
}

export interface CriteriaReport {
  /** How many (activity, criterion) checks applied, and how many passed. */
  checked: number;
  passed: number;
  failures: CriterionFailure[];
  /** Per criterion: how many checks applied and how many failed (for the log). */
  perCriterion: Record<Criterion, { checked: number; failed: number }>;
  /** The mode balance of the book: ideas you can do by yourself, and ideas that have to be organised first. */
  modes: { self: number; organise: number };
}

// --- criterion 6: what the text may not invent ------------------------------------------------------------------------

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s)<>"']+/gi;
/** The sentence-level problems of an idea's text that come from inventing a fact. The links are judged against `knownHosts` when it is given. */
export function inventedFacts(entry: Pick<IdeaBookEntry, "title" | "intro" | "why_it_fits" | "details" | "first_action" | "requirements" | "practical" | "sizes" | "places">, knownHosts?: ReadonlySet<string>): string[] {
  const out: string[] = [];
  const texts = proseFields(entry as IdeaBookEntry);
  const allowedAmounts = [entry.practical?.estimated_cost, ...(entry.sizes ?? []).map((s) => s.estimated_cost), ...(entry.places ?? []).map((p) => p.note), ...(entry.places ?? []).map((p) => p.price?.text)]
    .flatMap((t) => (t ? (t.match(/\d+(?:[.,]\d+)?/g) ?? []) : []))
    .map((n) => parseFloat(n.replace(",", ".")));
  const ceiling = allowedAmounts.length ? Math.max(...allowedAmounts) : null;
  for (const [field, text] of texts) {
    if (PHONE_RE.test(text)) out.push(`${field}: a phone number`);
    if (HOURS_RE.test(text)) out.push(`${field}: opening hours`);
    if (knownHosts) {
      for (const url of text.match(URL_RE) ?? []) {
        const host = url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0].toLowerCase();
        if (![...knownHosts].some((h) => h === host || h.endsWith(`.${host}`) || host.endsWith(`.${h}`)) && !/(google|maps|meetup)\./.test(host)) out.push(`${field}: a link to ${host} that the research did not find`);
      }
    }
    // A price in the text that is far above everything the book itself says about the cost: an amount we did not get from the research.
    for (const m of text.matchAll(/€\s?(\d+(?:[.,]\d+)?)/g)) {
      const amount = parseFloat(m[1].replace(",", "."));
      if (ceiling !== null && amount > Math.max(ceiling * 2, ceiling + 25)) out.push(`${field}: a price of €${amount} against a cost of €${ceiling}`);
    }
  }
  return out;
}

// --- the checks --------------------------------------------------------------------------------------------------------

const REASON_SIGNALS = /^(picked|bridge:|chain:|hybrid:|themes:)/;

function activityFailures(activityId: string, where: string, ctx: CriteriaContext, own: boolean): CriterionFailure[] {
  const fail = (criterion: Criterion, detail: string): CriterionFailure => ({ where, activityId, criterion, detail });
  const a = getActivity(activityId);
  if (!a) return [fail("exists", "not in the library")];
  if (a.status === "retired") return [fail("exists", "retired")];
  const out: CriterionFailure[] = [];
  const c = own ? { ...ctx.constraints, hideSupervised: false } : ctx.constraints;
  if (!passesConstraints(a, c).ok) out.push(fail("audience", "breaks a hard limit of this person or this month"));
  return out;
}

/** The criteria of one idea of the book: the idea itself (all six) and its companions (exists, audience, relation). */
export function entryFailures(entry: IdeaBookEntry, where: string, ctx: CriteriaContext): CriterionFailure[] {
  const id = entry.activity_id;
  if (!id) return [];
  const own = ctx.ownPicks?.has(id) ?? false;
  const out = activityFailures(id, where, ctx, own);
  const fail = (criterion: Criterion, detail: string, activityId = id): CriterionFailure => ({ where, activityId, criterion, detail });
  const a = getActivity(id);

  // exists: a way in. A place we verified, a place on the idea, an online route, something you do yourself, or the person's own choice (kept with an honest note).
  if (a && !own && modeOfActivity(a) !== "self" && !hasPhysicalPlace(entry) && !(entry.places ?? []).length) out.push(fail("exists", "no verified place and not something to do by yourself"));

  // concrete: a first step, steps and the practical facts.
  const thin = thinParts(entry);
  if (thin.length) out.push(fail("concrete", `too thin: ${thin.join(", ")}`));

  // feasible: within the budget they gave (the library says the activity class; the text says the estimate).
  const cap = ctx.budget ? BUDGET_CAP[ctx.budget] : undefined;
  const estimate = entry.practical?.estimated_cost ? parseMaxCost(entry.practical.estimated_cost) : null;
  if (cap !== undefined && Number.isFinite(cap) && estimate !== null && estimate > cap * 1.5) out.push(fail("feasible", `estimate €${estimate} against a budget of €${cap}`));

  // relation: it came from what the person chose, or it is a surprise on purpose (the wildcard, or an unexpected idea with a combination or chain).
  const reasons = entry.reasons ?? [];
  const surprise = entry.door === "wildcard" || entry.door === "unexpected";
  if (reasons.length > 0 && !own && !surprise && !reasons.some((r) => REASON_SIGNALS.test(r)) && !entry.direction) out.push(fail("relation", "no recorded relation to what they chose"));

  // nothing invented.
  for (const problem of inventedFacts(entry, ctx.knownHosts)) out.push(fail("nothing_invented", problem));

  // companions: they exist, suit the people, and belong to the direction.
  for (const r of entry.related ?? []) {
    out.push(...activityFailures(r.id, where, ctx, false));
    const companion = getActivity(r.id);
    if (companion && r.facts && !entry.direction && !relatedIsPlausible(a, r.id)) out.push(fail("relation", "an unrelated companion", r.id));
  }
  return out;
}

/** All six criteria on the finished book. */
export function bookCriteria(book: GeneratedIdeaBook, ctx: CriteriaContext): CriteriaReport {
  const perCriterion = Object.fromEntries(CRITERIA.map((c) => [c, { checked: 0, failed: 0 }])) as CriteriaReport["perCriterion"];
  const failures: CriterionFailure[] = [];
  const modes = { self: 0, organise: 0 };
  for (const [entry, where] of entriesOf(book)) {
    if (!entry.activity_id) continue;
    // Every idea is checked on all six; every companion on three.
    for (const c of CRITERIA) perCriterion[c].checked += 1;
    for (let i = 0; i < (entry.related ?? []).length; i++) for (const c of ["exists", "audience", "relation"] as const) perCriterion[c].checked += 1;
    const a = getActivity(entry.activity_id);
    if (a) {
      const m = modeOfActivity(a);
      if (m === "self") modes.self += 1;
      if (m === "organise") modes.organise += 1;
    }
    failures.push(...entryFailures(entry, where, ctx));
  }
  for (const f of failures) perCriterion[f.criterion].failed += 1;
  const checked = CRITERIA.reduce((n, c) => n + perCriterion[c].checked, 0);
  return { checked, passed: checked - failures.length, failures, perCriterion, modes };
}

/** A one-line summary for the logs: "criteria: 54/55 (audience 1)". */
export function criteriaSummary(report: CriteriaReport): string {
  const bad = CRITERIA.filter((c) => report.perCriterion[c].failed > 0).map((c) => `${c} ${report.perCriterion[c].failed}`);
  return `criteria:${report.passed}/${report.checked}${bad.length ? ` (${bad.join(", ")})` : ""}`;
}
