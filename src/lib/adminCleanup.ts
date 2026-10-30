import type { createServiceRoleClient } from "@/lib/supabase/server";

// Removing test data from the admin ("Opruimen"), so the numbers on the overview are about real use.
//
// Safety, in order of importance:
//   1. A real order is never touched. An order is real unless Stripe's own id says it was a test
//      session (`cs_test_...`). Paying customers' legal records (terms, consent, withdrawal waiver)
//      must stay, whatever date is chosen, and this tool has no switch to override that.
//   2. Only what is dated up to the chosen day is selected, and the selection is made again on the
//      server when the delete runs (the form only carries the scope, never a list of ids).
//   3. The page shows exactly what will go before anything is deleted, and the delete needs the word
//      VERWIJDER typed.
// Nothing is deleted from the library or from the research cache; those are not data about people.

export type ServiceRoleClient = ReturnType<typeof createServiceRoleClient>;

export interface CleanupScope {
  /** Up to and including this day (YYYY-MM-DD, UTC). */
  before: string;
  /** Books and orders that were tests: no payment, or a Stripe test payment. */
  books: boolean;
  /** Sessions where somebody filled in the intake but never got a book. */
  unfinished: boolean;
  /** The tester questionnaire answers. */
  feedback: boolean;
  /** The anonymous log of generated books. */
  log: boolean;
  /** The counters of the test limit per connection (a fresh start for everyone). */
  quota: boolean;
}

export interface CleanupSelection {
  sessionIds: string[];
  planIds: string[];
  paymentIds: string[];
  pdfPaths: string[];
  /** Sessions in the period that stay because a real order hangs on them. */
  keptReal: number;
}

export interface CleanupCounts {
  sessions: number;
  intakes: number;
  books: number;
  orders: number;
  pdfs: number;
  feedback: number;
  log: number;
  quota: number;
  users: number;
  keptReal: number;
}

export const CONFIRM_WORD = "VERWIJDER";

export function parseScope(input: { get(name: string): string | null }): CleanupScope | null {
  const before = input.get("before") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(before) || Number.isNaN(Date.parse(`${before}T00:00:00Z`))) return null;
  const on = (name: string) => input.get(name) === "1" || input.get(name) === "on";
  const scope: CleanupScope = { before, books: on("books"), unfinished: on("unfinished"), feedback: on("feedback"), log: on("log"), quota: on("quota") };
  return scope.books || scope.unfinished || scope.feedback || scope.log || scope.quota ? scope : null;
}

export function cutoffOf(scope: CleanupScope): string {
  return `${scope.before}T23:59:59.999Z`;
}

/** A real order: anything that is not marked as a Stripe test session. */
export function isRealPayment(stripePaymentId: string): boolean {
  // A voucher redemption is keyed "voucher:<the purchase's Stripe id>": it is a test order exactly when the purchase was one.
  return !stripePaymentId.replace(/^voucher:/, "").startsWith("cs_test_");
}

interface SessionRow {
  id: string;
  created_at: string;
}
interface PlanRow {
  id: string;
  session_id: string;
  pdf_url: string | null;
}
interface PaymentRow {
  id: string;
  session_id: string;
  stripe_payment_id: string;
}

/**
 * Which sessions, books and orders go. Pure: the rows are what the database holds, already limited
 * to sessions up to the cutoff.
 */
export function selectForDeletion(input: { scope: CleanupScope; sessions: SessionRow[]; plans: PlanRow[]; payments: PaymentRow[] }): CleanupSelection {
  const { scope } = input;
  const plansBySession = new Map<string, PlanRow[]>();
  for (const p of input.plans) plansBySession.set(p.session_id, [...(plansBySession.get(p.session_id) ?? []), p]);
  const paymentsBySession = new Map<string, PaymentRow[]>();
  for (const p of input.payments) paymentsBySession.set(p.session_id, [...(paymentsBySession.get(p.session_id) ?? []), p]);

  const sessionIds: string[] = [];
  const planIds: string[] = [];
  const paymentIds: string[] = [];
  const pdfPaths: string[] = [];
  let keptReal = 0;

  for (const s of input.sessions) {
    const plans = plansBySession.get(s.id) ?? [];
    const payments = paymentsBySession.get(s.id) ?? [];
    if (payments.some((p) => isRealPayment(p.stripe_payment_id))) {
      keptReal++;
      continue;
    }
    const hasBook = plans.length > 0 || payments.length > 0;
    if (hasBook ? !scope.books : !scope.unfinished) continue;
    sessionIds.push(s.id);
    for (const p of plans) {
      planIds.push(p.id);
      if (p.pdf_url) pdfPaths.push(p.pdf_url);
    }
    for (const p of payments) paymentIds.push(p.id);
  }
  return { sessionIds, planIds, paymentIds, pdfPaths, keptReal };
}

const CHUNK = 100;
const chunks = <T,>(list: readonly T[], size = CHUNK): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

// PostgREST returns at most 1000 rows per request, so a table is read in pages.
async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function loadSelection(supabase: ServiceRoleClient, scope: CleanupScope): Promise<CleanupSelection> {
  const cutoff = cutoffOf(scope);
  const sessions = await readAll<SessionRow>((a, b) => supabase.from("sessions").select("id, created_at").lte("created_at", cutoff).order("created_at").range(a, b));
  const ids = sessions.map((s) => s.id);
  const plans: PlanRow[] = [];
  const payments: PaymentRow[] = [];
  for (const part of chunks(ids)) {
    const [p, pay] = await Promise.all([
      supabase.from("window_plans").select("id, session_id, pdf_url").in("session_id", part),
      supabase.from("payments").select("id, session_id, stripe_payment_id").in("session_id", part),
    ]);
    if (p.error) throw new Error(p.error.message);
    if (pay.error) throw new Error(pay.error.message);
    plans.push(...((p.data ?? []) as PlanRow[]));
    payments.push(...((pay.data ?? []) as PaymentRow[]));
  }
  return selectForDeletion({ scope, sessions, plans, payments });
}

async function countWhere(supabase: ServiceRoleClient, table: "test_feedback" | "audit_log" | "test_quota", cutoff: string): Promise<number> {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true }).lte("created_at", cutoff);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Users (e-mail addresses of testers) that no session refers to any more once these sessions are gone. */
async function orphanUsers(supabase: ServiceRoleClient, cutoff: string, goneSessions: Set<string>): Promise<string[]> {
  const users = await readAll<{ id: string }>((a, b) => supabase.from("users").select("id").lte("created_at", cutoff).order("created_at").range(a, b));
  if (users.length === 0) return [];
  const sessions = await readAll<{ id: string; user_id: string | null }>((a, b) => supabase.from("sessions").select("id, user_id").not("user_id", "is", null).order("created_at").range(a, b));
  const stillUsed = new Set(sessions.filter((s) => !goneSessions.has(s.id)).map((s) => s.user_id as string));
  return users.filter((u) => !stillUsed.has(u.id)).map((u) => u.id);
}

/** What a delete with this scope would remove. Reads only. */
export async function previewCleanup(supabase: ServiceRoleClient, scope: CleanupScope): Promise<CleanupCounts> {
  const cutoff = cutoffOf(scope);
  const sel = await loadSelection(supabase, scope);
  let intakes = 0;
  let linkedFeedback = 0;
  for (const part of chunks(sel.sessionIds)) {
    const { count } = await supabase.from("intake_answers").select("id", { count: "exact", head: true }).in("session_id", part);
    intakes += count ?? 0;
  }
  for (const part of chunks(sel.planIds)) {
    const { count } = await supabase.from("test_feedback").select("id", { count: "exact", head: true }).in("plan_id", part);
    linkedFeedback += count ?? 0;
  }
  const feedbackByDate = scope.feedback ? await countWhere(supabase, "test_feedback", cutoff) : 0;
  const log = scope.log ? await countWhere(supabase, "audit_log", cutoff) : 0;
  const quota = scope.quota ? await countWhere(supabase, "test_quota", cutoff).catch(() => 0) : 0;
  const users = scope.books || scope.unfinished ? (await orphanUsers(supabase, cutoff, new Set(sel.sessionIds))).length : 0;
  return {
    sessions: sel.sessionIds.length,
    intakes,
    books: sel.planIds.length,
    orders: sel.paymentIds.length,
    pdfs: sel.pdfPaths.length,
    // feedback of deleted books goes with them; the by-date count may overlap with it, so this is an upper bound
    feedback: Math.max(feedbackByDate, linkedFeedback),
    log,
    quota,
    users,
    keptReal: sel.keptReal,
  };
}

/** Removes it. The selection is made again here from the scope, so a forged form cannot name other rows. */
export async function runCleanup(supabase: ServiceRoleClient, scope: CleanupScope): Promise<CleanupCounts> {
  const cutoff = cutoffOf(scope);
  const sel = await loadSelection(supabase, scope);
  const counts: CleanupCounts = { sessions: 0, intakes: 0, books: 0, orders: 0, pdfs: 0, feedback: 0, log: 0, quota: 0, users: 0, keptReal: sel.keptReal };

  // The files first: a row without a file is harmless, a file without a row is clutter nobody can find.
  for (const part of chunks(sel.pdfPaths)) {
    const { data } = await supabase.storage.from("window-plans").remove(part);
    counts.pdfs += data?.length ?? 0;
  }
  for (const part of chunks(sel.planIds)) {
    const { count } = await supabase.from("test_feedback").delete({ count: "exact" }).in("plan_id", part);
    counts.feedback += count ?? 0;
  }
  if (scope.feedback) {
    const { count } = await supabase.from("test_feedback").delete({ count: "exact" }).lte("created_at", cutoff);
    counts.feedback += count ?? 0;
  }
  for (const part of chunks(sel.planIds)) {
    const { count, error } = await supabase.from("window_plans").delete({ count: "exact" }).in("id", part);
    if (error) throw new Error(`Boeken verwijderen mislukte: ${error.message}`);
    counts.books += count ?? 0;
  }
  // Orders go after their books (a book points at its order); terms and consent records follow the order.
  for (const part of chunks(sel.paymentIds)) {
    const { count, error } = await supabase.from("payments").delete({ count: "exact" }).in("id", part);
    if (error) throw new Error(`Orders verwijderen mislukte: ${error.message}`);
    counts.orders += count ?? 0;
  }
  for (const part of chunks(sel.sessionIds)) {
    const { count: intakeCount } = await supabase.from("intake_answers").select("id", { count: "exact", head: true }).in("session_id", part);
    const { count, error } = await supabase.from("sessions").delete({ count: "exact" }).in("id", part);
    if (error) throw new Error(`Sessies verwijderen mislukte: ${error.message}`);
    counts.sessions += count ?? 0;
    counts.intakes += intakeCount ?? 0;
  }
  // Test gift vouchers (bought with a Stripe test session) and vouchers whose purchase never reached Stripe go with the test books. A voucher
  // bought for real is never touched. Best effort: the table only exists from migration 0022 on.
  if (scope.books) {
    try {
      await supabase.from("gift_vouchers").delete().like("stripe_checkout_id", "cs_test_%").lte("created_at", cutoff);
      await supabase.from("gift_vouchers").delete().is("stripe_checkout_id", null).eq("status", "pending").lte("created_at", cutoff);
    } catch (err) {
      console.warn("WINDOW admin cleanup: could not clean gift vouchers:", err instanceof Error ? err.message : err);
    }
  }
  if (scope.log) {
    const { count } = await supabase.from("audit_log").delete({ count: "exact" }).lte("created_at", cutoff);
    counts.log = count ?? 0;
  }
  if (scope.quota) {
    const { count } = await supabase.from("test_quota").delete({ count: "exact" }).lte("created_at", cutoff);
    counts.quota = count ?? 0;
  }
  if (scope.books || scope.unfinished) {
    for (const part of chunks(await orphanUsers(supabase, cutoff, new Set()))) {
      const { count } = await supabase.from("users").delete({ count: "exact" }).in("id", part);
      counts.users += count ?? 0;
    }
  }
  console.log(`WINDOW admin cleanup up to ${scope.before}:`, JSON.stringify(counts));
  return counts;
}
