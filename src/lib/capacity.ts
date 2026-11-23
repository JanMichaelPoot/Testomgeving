import type { SupabaseClient } from "@supabase/supabase-js";

// The capacity brake (Step 237): never take money for a book that cannot be made. Every paid book costs real model money (at most USD 0.50, src/lib/claude/costLedger.ts)
// and the Anthropic account has limits of its own (a balance, a rate limit), so the pay button closes BEFORE the payment, not after it, in three cases:
//   1. the daily maximum of books is reached (WINDOW_DAILY_BOOK_LIMIT, default 40; "0" or "off" = no maximum),
//   2. the owner switched sales off by hand (WINDOW_CHECKOUT_PAUSED=1, for example when the Anthropic balance is nearly empty),
//   3. the last books failed one after another (the circuit breaker: the newest three books of the last half hour all failed, for at least two different visitors),
//      so something is wrong with the model account or the pipeline. It reopens by itself when those failures are half an hour old.
// A book that is being paid for right now holds its place for half an hour, so the last place is not sold twice by two people paying at the same time.
// It is a soft limit: two payments started in the same second may both get through. A broken count never closes the shop (it fails open, and says so in the log).
// The owner (logged in at /admin in this browser) is never stopped, so a test is always possible. Pure decision in decideCapacity, the reading in loadCapacity.

type Env = Record<string, string | undefined>;

export const DEFAULT_DAILY_BOOK_LIMIT = 40;
/** How long an order that has been started but not paid yet keeps its place. */
export const PENDING_HOLD_MS = 30 * 60 * 1000;
/** The circuit breaker looks at the books of this long ago. */
export const FAILURE_WINDOW_MS = 30 * 60 * 1000;
export const BREAKER_FAILURES = 3;

export type ClosedReason = "daily" | "paused" | "failing";
export interface CapacityStatus {
  open: boolean;
  reason: ClosedReason | null;
  /** Books started today (paid, or being paid for right now). */
  startedToday: number;
  /** The daily maximum, null when there is none. */
  limit: number | null;
}

function clean(raw: string | undefined): string {
  return (raw ?? "").trim().toLowerCase().replace(/^"|"$/g, "");
}

/** WINDOW_DAILY_BOOK_LIMIT: a whole number above 0, or "0" / "off" for no maximum. Unset or unreadable: the default. */
export function dailyBookLimit(env: Env = process.env): number | null {
  const raw = clean(env.WINDOW_DAILY_BOOK_LIMIT);
  if (raw === "") return DEFAULT_DAILY_BOOK_LIMIT;
  if (raw === "0" || raw === "off") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_DAILY_BOOK_LIMIT;
}

/** WINDOW_CHECKOUT_PAUSED=1 (or true, on, yes): no new orders, whatever else is true. */
export function checkoutPaused(env: Env = process.env): boolean {
  return ["1", "true", "on", "yes"].includes(clean(env.WINDOW_CHECKOUT_PAUSED));
}

const TIME_ZONE = "Europe/Amsterdam";

/** Midnight in the Netherlands, as an instant: "today" for the daily maximum is a Dutch day, not a UTC day. */
export function startOfDutchDay(now: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now); // 2026-11-23
  const [y, m, d] = parts.split("-").map(Number);
  const utcMidnight = Date.UTC(y, m - 1, d);
  // The offset of the Netherlands at that moment: what the clock there shows, read as UTC, minus the instant itself.
  const shown = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(utcMidnight));
  const get = (t: string) => Number(shown.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return new Date(utcMidnight - (asUtc - utcMidnight));
}

export interface CapacityFacts {
  startedToday: number;
  limit: number | null;
  paused: boolean;
  /** The books of the failure window, newest first. */
  recentPlans: { status: string; session_id: string }[];
}

/** The three-in-a-row rule: the newest books all failed, and not for one visitor alone (one person with an odd profile must not close the shop for everybody). */
export function isBreakerOpen(recentPlans: CapacityFacts["recentPlans"]): boolean {
  const newest = recentPlans.slice(0, BREAKER_FAILURES);
  if (newest.length < BREAKER_FAILURES || newest.some((p) => p.status !== "failed")) return false;
  return new Set(newest.map((p) => p.session_id)).size >= 2;
}

export function decideCapacity(f: CapacityFacts): CapacityStatus {
  const base = { startedToday: f.startedToday, limit: f.limit };
  if (f.paused) return { open: false, reason: "paused", ...base };
  if (isBreakerOpen(f.recentPlans)) return { open: false, reason: "failing", ...base };
  if (f.limit !== null && f.startedToday >= f.limit) return { open: false, reason: "daily", ...base };
  return { open: true, reason: null, ...base };
}

let cached: { at: number; status: CapacityStatus } | null = null;
const CACHE_MS = 20_000;

/** Reads the facts and decides. `maxAgeMs` > 0 allows a recent answer to be reused (the page asks often; the order itself always asks fresh). */
export async function loadCapacity(supabase: SupabaseClient, opts: { now?: Date; env?: Env; maxAgeMs?: number } = {}): Promise<CapacityStatus> {
  const now = opts.now ?? new Date();
  const env = opts.env ?? process.env;
  const limit = dailyBookLimit(env);
  const paused = checkoutPaused(env);
  const maxAge = opts.maxAgeMs ?? 0;
  if (maxAge > 0 && cached && now.getTime() - cached.at < Math.min(maxAge, CACHE_MS)) return cached.status;

  // Switched off by hand, or no maximum and nothing to watch: the first needs no reading at all.
  if (paused) return decideCapacity({ startedToday: 0, limit, paused, recentPlans: [] });

  try {
    const dayStart = startOfDutchDay(now);
    const pendingSince = new Date(Math.max(dayStart.getTime(), now.getTime() - PENDING_HOLD_MS));
    const failureSince = new Date(now.getTime() - FAILURE_WINDOW_MS);
    const [paid, pending, plans] = await Promise.all([
      supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "succeeded").gte("created_at", dayStart.toISOString()),
      supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "pending").gte("created_at", pendingSince.toISOString()),
      supabase.from("window_plans").select("status, session_id").gte("created_at", failureSince.toISOString()).order("created_at", { ascending: false }).limit(BREAKER_FAILURES),
    ]);
    const failed = paid.error ?? pending.error ?? plans.error;
    if (failed) throw new Error(failed.message);
    const status = decideCapacity({ startedToday: (paid.count ?? 0) + (pending.count ?? 0), limit, paused, recentPlans: plans.data ?? [] });
    cached = { at: now.getTime(), status };
    return status;
  } catch (err) {
    // Fail open: a count that cannot be read must not close the shop. The owner sees it in the log.
    console.error(JSON.stringify({ level: "error", event: "capacity_check_failed", message: String((err as Error)?.message ?? err).slice(0, 200) }));
    return { open: true, reason: null, startedToday: 0, limit };
  }
}

/** Forgets the last answer (for tests). */
export function resetCapacityCache(): void {
  cached = null;
}
