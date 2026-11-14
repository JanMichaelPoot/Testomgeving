// The numbers behind the admin pages (/admin, /admin/inhoud, /admin/feedback). Pure functions over
// plain rows, so they can be tested without a database; the pages only fetch and render.
//
// Everything here is aggregate. Nothing in it identifies a person: the rows come from tables that are
// already anonymous apart from the e-mail address, and that address is not read here.

import { explainEmailError } from "@/lib/emailErrors";
import type { BookCostMeta } from "@/types/database";

export interface PlanRow {
  id: string;
  created_at: string;
  generated_at: string | null;
  status: "pending" | "ready" | "failed";
  language: string;
  email_sent_at: string | null;
  payment_id: string | null;
  pdf_version: number | null;
  progress_meta: { email_error?: string; cost?: BookCostMeta } | null;
  ideas_json: unknown;
  wildcard_json: unknown;
  feedback_json: unknown;
  committed_idea_key: string | null;
}

export interface PaymentRow {
  id: string;
  status: "pending" | "succeeded" | "failed" | "refunded";
  amount: number;
  currency: string;
  created_at: string;
}

export interface FeedbackRow {
  id: string;
  flow_score: number | null;
  profile_score: number | null;
  doors_score: number | null;
  door_pick: number | null;
  door_kind: string | null;
  would_pay: "yes" | "maybe" | "no" | null;
  /** Both come from migration 0024; absent on rows (and databases) from before it. */
  places_score?: number | null;
  mail_status?: "inbox" | "spam" | "missing" | null;
  doubt: string | null;
  locale: string | null;
  created_at: string;
}

const DAY = 86_400_000;

/** A pending book older than this is stuck (the platform stops a generation after 120 s; the row is retired after 150 s). */
export const STUCK_AFTER_MS = 5 * 60_000;

export function ratio(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}

export function percent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function average(values: readonly (number | null | undefined)[]): number | null {
  const v = values.filter((x): x is number => typeof x === "number");
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * What the books of the last `days` days cost to make, from the cost each one kept (progress_meta.cost, Stap 195). Model calls only: the Google lookups are
 * counted apart and the classic generation's own cost is not measured (a book it made counts for what the failed seed attempt spent, if anything).
 * Books from before the measurement have no cost and are not in it. Compare the total with the month's Anthropic invoice (M2 of docs/kostenonderzoek-boekgeneratie.md).
 */
export interface CostOverview {
  /** Books with a measured cost in the period. */
  books: number;
  totalUsd: number;
  averageUsd: number | null;
  medianUsd: number | null;
  maxUsd: number | null;
  /** Books where an optional research round was skipped to stay under the cap. */
  cappedBooks: number;
  /** Books made by the classic generation (the older intake, or after a failed seed attempt). */
  classicBooks: number;
  /** Share of the research answers that came from the cache, over these books. */
  cacheShare: number | null;
  placesLookups: number;
  /** Per kind (standard, own, broad, online, writing, qa): the average per book, most expensive first. */
  perKind: [string, number][];
}

export function costOverview(plans: readonly PlanRow[], now: Date, days = 30): CostOverview {
  const since = now.getTime() - days * DAY;
  const measured = plans.filter((p) => p.status === "ready" && p.progress_meta?.cost && typeof p.progress_meta.cost.usd === "number" && Date.parse(p.created_at) >= since);
  const costs = measured.map((p) => p.progress_meta!.cost!);
  const usd = costs.map((c) => c.usd);
  const kinds = new Map<string, number>();
  for (const c of costs) for (const [k, v] of Object.entries(c.breakdown ?? {})) kinds.set(k, (kinds.get(k) ?? 0) + v);
  const cached = costs.reduce((a, c) => a + (c.research?.cached ?? 0), 0);
  const searched = costs.reduce((a, c) => a + (c.research?.searched ?? 0), 0);
  return {
    books: costs.length,
    totalUsd: usd.reduce((a, b) => a + b, 0),
    averageUsd: average(usd),
    medianUsd: median(usd),
    maxUsd: usd.length ? Math.max(...usd) : null,
    cappedBooks: costs.filter((c) => (c.skipped ?? []).length > 0).length,
    classicBooks: costs.filter((c) => c.pipeline).length,
    cacheShare: ratio(cached, cached + searched),
    placesLookups: costs.reduce((a, c) => a + (c.placesLookups ?? 0), 0),
    perKind: [...kinds.entries()].map(([k, v]): [string, number] => [k, v / Math.max(1, costs.length)]).sort((a, b) => b[1] - a[1]),
  };
}

/** The cost one book kept, in a line for the order page: the total, per kind, and what stayed out for the cost cap or ran through the classic generation. */
export function describeBookCost(cost: BookCostMeta): string {
  const kinds = Object.entries(cost.breakdown ?? {}).map(([kind, usd]) => `${kind} ${usd.toFixed(3)}`).join(", ");
  const parts = [`$${cost.usd.toFixed(3)} aan modelaanroepen${kinds ? ` (${kinds})` : ""}`];
  if (cost.skipped?.length) parts.push(`overgeslagen voor de kostengrens: ${cost.skipped.join(", ")}`);
  if (cost.pipeline === "classic") parts.push("gemaakt met de klassieke generatie (oudere intake; de kosten daarvan zijn niet gemeten)");
  if (cost.pipeline === "classic_after_failure") parts.push("de seed-pijplijn faalde; de klassieke generatie maakte het boek (de kosten daarvan zijn niet gemeten)");
  if (cost.placesLookups !== undefined) parts.push(`${cost.placesLookups} Google-opzoekingen`);
  if (cost.research) parts.push(`onderzoek: ${cost.research.cached} uit de cache, ${cost.research.searched} gezocht`);
  if (cost.quiet && cost.quiet.known > 0) parts.push(`aanbodindex: ${cost.quiet.known} stille activiteiten bekend, ${cost.quiet.inBook} toch in het boek`);
  return parts.join("; ");
}

/** The [label, count] pairs of a list of values, most frequent first. */
export function topCounts<T extends string>(values: readonly (T | null | undefined)[], limit = 10): [T, number][] {
  const counts = new Map<T, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).slice(0, limit);
}

export interface Overview {
  totalPlans: number;
  ready: number;
  failed: number;
  stuck: number;
  paidReady: number;
  testReady: number;
  last24h: number;
  last7d: number;
  perDay: { day: string; count: number }[];
  medianSeconds: number | null;
  slowest: number | null;
  languages: { nl: number; en: number };
  email: { sent: number; expected: number; errors: { at: string; message: string; planId: string }[] };
  payments: { total: number; succeeded: number; pending: number; failed: number; revenueCents: number };
  engagement: { liked: number; committed: number; ready: number };
  attention: { level: "red" | "amber"; text: string; planId?: string }[];
}

export function overview(plans: readonly PlanRow[], payments: readonly PaymentRow[], now: Date, days = 14): Overview {
  const t = now.getTime();
  const ready = plans.filter((p) => p.status === "ready");
  const failed = plans.filter((p) => p.status === "failed");
  const stuck = plans.filter((p) => p.status === "pending" && t - Date.parse(p.created_at) > STUCK_AFTER_MS);
  const paidReady = ready.filter((p) => p.payment_id);

  const perDay: { day: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(t - i * DAY).toISOString().slice(0, 10);
    perDay.push({ day: d, count: ready.filter((p) => p.created_at.slice(0, 10) === d).length });
  }

  const seconds = ready
    .filter((p) => p.generated_at)
    .map((p) => (Date.parse(p.generated_at!) - Date.parse(p.created_at)) / 1000)
    .filter((s) => s >= 0 && s < 900);

  const emailErrors = plans
    .filter((p) => p.progress_meta?.email_error)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5)
    .map((p) => ({ at: p.created_at, message: p.progress_meta!.email_error!, planId: p.id }));

  const likedKeys = (p: PlanRow) => Object.values(p.feedback_json && typeof p.feedback_json === "object" ? (p.feedback_json as Record<string, unknown>) : {}).includes("up");

  const attention: Overview["attention"] = [];
  for (const p of stuck.slice(0, 5)) attention.push({ level: "red", text: `Een Idea Book is blijven hangen (${p.created_at.slice(0, 16).replace("T", " ")} UTC).`, planId: p.id });
  for (const p of failed.filter((x) => t - Date.parse(x.created_at) < 7 * DAY).slice(0, 5)) attention.push({ level: "red", text: `Generatie mislukt (${p.created_at.slice(0, 16).replace("T", " ")} UTC).`, planId: p.id });
  const unsent = paidReady.filter((p) => !p.email_sent_at && t - Date.parse(p.created_at) < 14 * DAY);
  if (unsent.length) {
    // Say what to do when the stored reason is one we know (the Resend sandbox refusal is the usual one).
    const help = explainEmailError(unsent.map((p) => p.progress_meta?.email_error).find((m) => explainEmailError(m)));
    attention.push({
      level: "red",
      text: `${unsent.length} betaald boek${unsent.length === 1 ? "" : "en"} zonder verstuurde e-mail (laatste 14 dagen).${help ? ` ${help.cause} ${help.fix}` : ' Zie de reden onder "E-mail".'}`,
    });
  }
  const pendingPayments = payments.filter((p) => p.status === "pending" && t - Date.parse(p.created_at) > DAY);
  if (pendingPayments.length > 0) attention.push({ level: "amber", text: `${pendingPayments.length} betaling${pendingPayments.length === 1 ? "" : "en"} staat nog op "pending" na een dag: controleer of de Stripe-webhook naar /api/stripe/webhook wijst.` });

  return {
    totalPlans: plans.length,
    ready: ready.length,
    failed: failed.length,
    stuck: stuck.length,
    paidReady: paidReady.length,
    testReady: ready.length - paidReady.length,
    last24h: ready.filter((p) => t - Date.parse(p.created_at) < DAY).length,
    last7d: ready.filter((p) => t - Date.parse(p.created_at) < 7 * DAY).length,
    perDay,
    medianSeconds: median(seconds),
    slowest: seconds.length ? Math.max(...seconds) : null,
    languages: { nl: ready.filter((p) => p.language !== "en").length, en: ready.filter((p) => p.language === "en").length },
    email: { sent: paidReady.filter((p) => p.email_sent_at).length, expected: paidReady.length, errors: emailErrors },
    payments: {
      total: payments.length,
      succeeded: payments.filter((p) => p.status === "succeeded").length,
      pending: payments.filter((p) => p.status === "pending").length,
      failed: payments.filter((p) => p.status === "failed").length,
      revenueCents: payments.filter((p) => p.status === "succeeded").reduce((s, p) => s + p.amount, 0),
    },
    engagement: { liked: ready.filter(likedKeys).length, committed: ready.filter((p) => p.committed_idea_key).length, ready: ready.length },
    attention,
  };
}

// --- feedback ----------------------------------------------------------------------------------------

export interface ScoreSummary {
  n: number;
  mean: number | null;
  /** counts for 1..5 */
  distribution: [number, number, number, number, number];
}

export function scoreSummary(values: readonly (number | null)[]): ScoreSummary {
  const distribution: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  let n = 0;
  let sum = 0;
  for (const v of values) {
    if (typeof v === "number" && v >= 1 && v <= 5) {
      distribution[v - 1]++;
      n++;
      sum += v;
    }
  }
  return { n, mean: n ? sum / n : null, distribution };
}

export interface FeedbackSummary {
  responses: number;
  flow: ScoreSummary;
  profile: ScoreSummary;
  doors: ScoreSummary;
  /** Did the places and providers fit the tester's surroundings (empty before migration 0024). */
  places: ScoreSummary;
  /** Did the e-mail with the book arrive. */
  mail: { inbox: number; spam: number; missing: number; answered: number };
  wouldPay: { yes: number; maybe: number; no: number; answered: number };
  /** Of the people who said yes or maybe or no: yes + half of maybe, as a share (a cautious reading). */
  payScore: number | null;
  doorKinds: [string, number][];
  doubts: { at: string; text: string; locale: string | null }[];
  /** The scored question with the lowest mean, to read first. */
  weakest: string | null;
}

export function feedbackSummary(rows: readonly FeedbackRow[]): FeedbackSummary {
  const wouldPay = { yes: 0, maybe: 0, no: 0, answered: 0 };
  for (const r of rows) {
    if (r.would_pay) {
      wouldPay[r.would_pay]++;
      wouldPay.answered++;
    }
  }
  const mail = { inbox: 0, spam: 0, missing: 0, answered: 0 };
  for (const r of rows) {
    if (r.mail_status) {
      mail[r.mail_status]++;
      mail.answered++;
    }
  }
  const flow = scoreSummary(rows.map((r) => r.flow_score));
  const profile = scoreSummary(rows.map((r) => r.profile_score));
  const doors = scoreSummary(rows.map((r) => r.doors_score));
  const places = scoreSummary(rows.map((r) => r.places_score ?? null));
  const named: [string, ScoreSummary][] = [
    ["het invullen van het venster", flow],
    ["het profiel ('Dit zien wij in jouw keuzes')", profile],
    ["begrijpen waarom je deze deuren kreeg", doors],
    ["de plekken en aanbieders in het boek", places],
  ];
  const scored = named.filter(([, s]) => s.mean !== null);
  const weakest = scored.length >= 2 ? scored.sort((a, b) => a[1].mean! - b[1].mean!)[0][0] : null;
  return {
    responses: rows.length,
    flow,
    profile,
    doors,
    places,
    mail,
    wouldPay,
    payScore: wouldPay.answered ? (wouldPay.yes + wouldPay.maybe * 0.5) / wouldPay.answered : null,
    doorKinds: topCounts(rows.map((r) => r.door_kind), 5),
    doubts: rows
      .filter((r) => r.doubt && r.doubt.trim())
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((r) => ({ at: r.created_at, text: r.doubt!.trim(), locale: r.locale })),
    weakest,
  };
}

/** A plain-language reading of a mean score on the 1-5 scale. */
export function readScore(mean: number | null, n: number): string {
  if (mean === null || n === 0) return "nog geen antwoorden";
  if (n < 5) return "te weinig antwoorden om iets te concluderen";
  if (mean >= 4.2) return "sterk";
  if (mean >= 3.6) return "goed";
  if (mean >= 3) return "wisselend: lees de opmerkingen";
  return "zwak: hier zit een probleem";
}

// --- content -------------------------------------------------------------------------------------------

/** The activity ids of one stored book, wildcard included. */
export function activityIdsOf(plan: Pick<PlanRow, "ideas_json" | "wildcard_json">): string[] {
  const ids: string[] = [];
  const take = (e: unknown) => {
    if (e && typeof e === "object" && typeof (e as { activity_id?: unknown }).activity_id === "string") ids.push((e as { activity_id: string }).activity_id);
  };
  if (Array.isArray(plan.ideas_json)) plan.ideas_json.forEach(take);
  take(plan.wildcard_json);
  return ids;
}

export interface IntakeRow {
  raw_json: unknown;
}

export interface IntakeSummary {
  total: number;
  directions: [string, number][];
  images: [string, number][];
  budget: [string, number][];
  time: [string, number][];
  age: [string, number][];
  company: [string, number][];
  variants: [string, number][];
  forOther: number;
}

export function intakeSummary(rows: readonly IntakeRow[]): IntakeSummary {
  const objs = rows.map((r) => (r.raw_json && typeof r.raw_json === "object" ? (r.raw_json as Record<string, unknown>) : {}));
  const list = (o: Record<string, unknown>, key: string): string[] => (Array.isArray(o[key]) ? (o[key] as unknown[]).filter((x): x is string => typeof x === "string") : []);
  const str = (o: Record<string, unknown>, key: string): string | null => (typeof o[key] === "string" && o[key] ? (o[key] as string) : null);
  return {
    total: objs.length,
    directions: topCounts(objs.flatMap((o) => list(o, "interestDomains")), 25),
    images: topCounts(objs.flatMap((o) => list(o, "associations")), 15),
    budget: topCounts(objs.map((o) => str(o, "budget")), 8),
    time: topCounts(objs.map((o) => str(o, "timeAvailable")), 8),
    age: topCounts(objs.map((o) => str(o, "ageCategory")), 8),
    company: topCounts(objs.flatMap((o) => list(o, "company")), 8),
    variants: topCounts(
      objs.map((o) => (o.intakeVariant === "associations" ? (o.intakeFlow === "images2" ? "beeld-intake (2 pagina's)" : "beeld-intake") : Array.isArray(o.interests) && (o.interests as unknown[]).length ? "kaartenwizard" : "klassiek")),
      4,
    ),
    // Searches for somebody else: a child, another adult or a group.
    forOther: objs.filter((o) => o.searchContext === "child" || o.searchContext === "adult" || o.searchContext === "group").length,
  };
}
