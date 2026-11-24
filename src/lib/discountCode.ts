// One-time discount codes (Step 230): after an order the buyer gets a code in the e-mail; it takes DISCOUNT_CENTS off one next book.
//
//   issue    when the book is sent: one code per paid order (also when the book is sent again, the same code comes back)
//   check    the buyer types it at the order: is it good, and what would the book cost
//   reserve  the order is started at Stripe: the code is held for that order, so nobody else can spend it while it is being paid
//   redeem   Stripe confirms the payment: the code is used up
//   release  the payment failed or ran out: the code is free again
//
// The rules live here and are tested with an in-memory store; the Supabase store below is the thin layer that carries them out. Everything about a
// code that could be wrong (a typo, a used or expired code) answers with a reason, never with an exception, and a database without the table
// (migration 0027 not run) answers "unavailable": no code is issued and nothing is offered, and the order itself is never blocked by it.

import { randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/** What a code takes off the price of one book, in cents. */
export const DISCOUNT_CENTS = 250;
/** How long a code can be used after the order that earned it. */
export const VALID_DAYS = 90;
/** How long a code is held for an order that is being paid. Longer than the Checkout Session lasts (CHECKOUT_MINUTES), so a held code is never free while its session can still be paid. */
export const HOLD_MINUTES = 90;
/** How long the Stripe Checkout Session lasts when a code is used (Stripe allows 30 minutes to 24 hours). */
export const CHECKOUT_MINUTES = 60;
/** A book never costs less than this after a discount (Stripe's own minimum is 50 cents). */
export const MIN_PRICE_CENTS = 100;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 signs: no 0, O, 1 or I
const PREFIX = "WI";

/** A new code at random: "WI-ABCD-EFGH". `pick` returns a number from 0 up to (not including) n; it is crypto-random unless a test hands in its own. */
export function generateCode(pick: (n: number) => number = (n) => randomInt(n)): string {
  const sign = () => ALPHABET[pick(ALPHABET.length)];
  const group = () => Array.from({ length: 4 }, sign).join("");
  return `${PREFIX}-${group()}-${group()}`;
}

/** What a person typed, as it is stored: capitals, with or without the dashes or spaces, "wi abcd efgh" and "WIABCDEFGH" included. null when it cannot be a code. */
export function normalizeCode(raw: string | null | undefined): string | null {
  const flat = (raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (flat.length !== PREFIX.length + 8 || !flat.startsWith(PREFIX)) return null;
  const body = flat.slice(PREFIX.length);
  if ([...body].some((ch) => !ALPHABET.includes(ch))) return null;
  return `${PREFIX}-${body.slice(0, 4)}-${body.slice(4)}`;
}

/** The price after the discount, never below MIN_PRICE_CENTS (and never above the price). */
export function priceAfterDiscount(priceCents: number, discountCents: number): number {
  return Math.max(Math.min(priceCents, MIN_PRICE_CENTS), priceCents - discountCents);
}

/** Why a code exists: earned by ordering (one per order), sent as compensation (Step 235), or given to the buyer to pass on to a friend (Step 238). */
export type CodeKind = "order" | "compensation" | "friend";

export interface IssuedCode {
  code: string;
  amountCents: number;
  expiresAt: Date;
}

export type DiscountFailure = "invalid" | "used" | "expired" | "busy" | "unavailable";
export type DiscountCheck = { ok: true; id: string; code: string; amountCents: number } | { ok: false; reason: DiscountFailure };

/** What the rules need from the storage. The Supabase store below is the real one, a test hands in an in-memory one. */
export interface DiscountStore {
  /** The code this order earned by ordering (its first one: compensation codes come later), or null. */
  findByPayment(paymentId: string): Promise<(IssuedCode & { id: string }) | null>;
  /** Stores a new code for an order; null when the code is already taken by another (the caller then tries another), or an error when the storage fails. */
  insert(input: { code: string; paymentId: string; amountCents: number; expiresAt: Date; kind?: CodeKind; reason?: string }): Promise<(IssuedCode & { id: string }) | "taken">;
  /** All the codes of one kind that an order has been given, oldest first. */
  listByPaymentKind(paymentId: string, kind: CodeKind): Promise<(IssuedCode & { id: string })[]>;
  /** The row of a code, with what is needed to tell why it cannot be used. */
  findByCode(code: string): Promise<{ id: string; code: string; amountCents: number; expiresAt: Date; redeemedAt: Date | null; reservedUntil: Date | null } | null>;
  /** One atomic step: holds the code until `until` if it is not used up, not expired and not held by somebody else. Returns what was held, or null. */
  hold(code: string, now: Date, until: Date): Promise<{ id: string; amountCents: number } | null>;
  /** Gives the code of an order back (a failed or expired payment), unless it was used up. */
  releaseForOrder(stripeSessionId: string): Promise<void>;
  /** Gives a held code back by its own id: the order could not be started at all. */
  releaseById(id: string): Promise<void>;
  /** Uses the code of an order up (a confirmed payment); false when the order has none. */
  redeemForOrder(stripeSessionId: string, now: Date): Promise<boolean>;
}

const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86_400_000);
const addMinutes = (d: Date, min: number) => new Date(d.getTime() + min * 60_000);

/** Issues the code of a paid order: once. Asked again (the book is sent again, a retry) it returns the same code. null when the storage cannot be used. */
export async function issueCode(store: DiscountStore, paymentId: string, now: Date = new Date(), pick?: (n: number) => number): Promise<IssuedCode | null> {
  try {
    const existing = await store.findByPayment(paymentId);
    if (existing) return { code: existing.code, amountCents: existing.amountCents, expiresAt: existing.expiresAt };
    for (let attempt = 0; attempt < 6; attempt++) {
      const stored = await store.insert({ code: generateCode(pick), paymentId, amountCents: DISCOUNT_CENTS, expiresAt: addDays(now, VALID_DAYS) });
      if (stored !== "taken") return { code: stored.code, amountCents: stored.amountCents, expiresAt: stored.expiresAt };
      // "taken" is either a code that exists already (try another) or the same order issued at the same moment (then its code is there now).
      const raced = await store.findByPayment(paymentId);
      if (raced) return { code: raced.code, amountCents: raced.amountCents, expiresAt: raced.expiresAt };
    }
    return null;
  } catch (err) {
    console.error("WINDOW: could not issue a discount code (has migration 0027 been run?):", err instanceof Error ? err.message : err);
    return null;
  }
}

async function judge(store: DiscountStore, code: string, now: Date): Promise<DiscountCheck> {
  const row = await store.findByCode(code);
  if (!row) return { ok: false, reason: "invalid" };
  if (row.redeemedAt) return { ok: false, reason: "used" };
  if (row.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };
  if (row.reservedUntil && row.reservedUntil.getTime() > now.getTime()) return { ok: false, reason: "busy" };
  return { ok: true, id: row.id, code: row.code, amountCents: row.amountCents };
}

/** Is this code good right now? Changes nothing: the buyer sees the new price before anything is held. */
export async function checkCode(store: DiscountStore, raw: string, now: Date = new Date()): Promise<DiscountCheck> {
  const code = normalizeCode(raw);
  if (!code) return { ok: false, reason: "invalid" };
  try {
    return await judge(store, code, now);
  } catch (err) {
    console.error("WINDOW: could not check a discount code:", err instanceof Error ? err.message : err);
    return { ok: false, reason: "unavailable" };
  }
}

/** Holds the code for the order that is about to be paid. Atomic: of two orders that try at once, one gets it. */
export async function reserveCode(store: DiscountStore, raw: string, now: Date = new Date()): Promise<DiscountCheck> {
  const code = normalizeCode(raw);
  if (!code) return { ok: false, reason: "invalid" };
  try {
    const held = await store.hold(code, now, addMinutes(now, HOLD_MINUTES));
    if (held) return { ok: true, id: held.id, code, amountCents: held.amountCents };
    // Not held: say why (it is missing, used, expired, or held by another order right now).
    return await judge(store, code, now);
  } catch (err) {
    console.error("WINDOW: could not hold a discount code:", err instanceof Error ? err.message : err);
    return { ok: false, reason: "unavailable" };
  }
}

/** The most compensation codes one order can get from the admin: a brake on a slip of the finger, not a business rule. */
export const MAX_COMPENSATIONS_PER_ORDER = 3;

export type CompensationResult = { ok: true; code: IssuedCode } | { ok: false; error: "storage" | "migration" };

/**
 * A compensation code (Step 235): another code for an order, worth the same as the one it earned, for a buyer whose book had a place that was wrong. Each call makes a new one;
 * "reason" is a note for the owner (never shown to the buyer). Needs migration 0028 (it says "migration" when the columns are not there).
 */
export async function issueCompensation(store: DiscountStore, paymentId: string, reason: string, now: Date = new Date(), pick?: (n: number) => number): Promise<CompensationResult> {
  try {
    for (let attempt = 0; attempt < 6; attempt++) {
      const stored = await store.insert({ code: generateCode(pick), paymentId, amountCents: DISCOUNT_CENTS, expiresAt: addDays(now, VALID_DAYS), kind: "compensation", reason: reason.trim().slice(0, 300) });
      if (stored !== "taken") return { ok: true, code: { code: stored.code, amountCents: stored.amountCents, expiresAt: stored.expiresAt } };
    }
    return { ok: false, error: "storage" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("WINDOW: could not issue a compensation code (has migration 0028 been run?):", message);
    return { ok: false, error: /kind|reason|column/i.test(message) ? "migration" : "storage" };
  }
}

/** How many friend codes the mail with the book carries (Step 238): one per friend, so a buyer can pass them to a few. */
export const FRIEND_CODES_PER_ORDER = 3;

/**
 * The friend codes of a paid order (Step 238): up to FRIEND_CODES_PER_ORDER one-time codes worth the same as the order's own, for the buyer to pass on. Asked again (the book is
 * sent again) it returns the ones that exist and makes only what is missing, so a retry never hands out more. Never throws: without migration 0029 (the kind "friend")
 * it gives an empty list and the mail goes out without that block.
 */
export async function issueFriendCodes(store: DiscountStore, paymentId: string, now: Date = new Date(), pick?: (n: number) => number): Promise<IssuedCode[]> {
  const codes: IssuedCode[] = [];
  try {
    const have = await store.listByPaymentKind(paymentId, "friend");
    for (const c of have.slice(0, FRIEND_CODES_PER_ORDER)) codes.push({ code: c.code, amountCents: c.amountCents, expiresAt: c.expiresAt });
    for (let attempt = 0; codes.length < FRIEND_CODES_PER_ORDER && attempt < FRIEND_CODES_PER_ORDER * 6; attempt++) {
      const stored = await store.insert({ code: generateCode(pick), paymentId, amountCents: DISCOUNT_CENTS, expiresAt: addDays(now, VALID_DAYS), kind: "friend" });
      if (stored !== "taken") codes.push({ code: stored.code, amountCents: stored.amountCents, expiresAt: stored.expiresAt });
    }
    return codes;
  } catch (err) {
    // What was made before the failure is kept: the mail carries those, and the next attempt makes the rest.
    console.error("WINDOW: could not issue friend codes (has migration 0029 been run?):", err instanceof Error ? err.message : err);
    return codes;
  }
}

/** Lets a held code go when the order could not be started. Never throws: a code that stays held frees itself when the hold runs out. */
export async function releaseCode(store: DiscountStore, id: string): Promise<void> {
  try {
    await store.releaseById(id);
  } catch (err) {
    console.error("WINDOW: could not release a discount code:", err instanceof Error ? err.message : err);
  }
}

/** Calls at most this many attempts per key (a session) within the window: a code cannot be guessed by trying. Kept in memory per server instance: a brake, not a vault (the code space is about 10^12). */
export function createAttemptLimiter(max = 10, windowMs = 10 * 60_000, now: () => number = Date.now) {
  const seen = new Map<string, number[]>();
  return (key: string): boolean => {
    const t = now();
    const recent = (seen.get(key) ?? []).filter((x) => t - x < windowMs);
    if (recent.length >= max) {
      seen.set(key, recent);
      return false;
    }
    recent.push(t);
    seen.set(key, recent);
    if (seen.size > 5000) for (const [k, v] of seen) if (v.every((x) => t - x >= windowMs)) seen.delete(k);
    return true;
  };
}

// --- the Supabase store ------------------------------------------------------------------------------------------------------------------------

type Row = { id: string; code: string; amount_cents: number; expires_at: string; redeemed_at: string | null; reserved_until: string | null };

/** The real storage: the table of migration 0027. One UPDATE statement is one atomic step in Postgres, which is what hold() relies on. */
export function supabaseStore(supabase: SupabaseClient): DiscountStore {
  const issued = (r: Row) => ({ id: r.id, code: r.code, amountCents: r.amount_cents, expiresAt: new Date(r.expires_at) });
  return {
    async findByPayment(paymentId) {
      // The first code of the order is the one it earned by ordering (a compensation code is made later); asked this way it also works before migration 0028.
      const { data, error } = await supabase.from("discount_codes").select("id, code, amount_cents, expires_at").eq("issued_for_payment_id", paymentId).order("created_at", { ascending: true }).limit(1);
      if (error) throw new Error(error.message);
      const first = (data ?? [])[0];
      return first ? issued(first as Row) : null;
    },
    async insert({ code, paymentId, amountCents, expiresAt, kind, reason }) {
      // The columns of migrations 0028 and 0029 are only written for a compensation or friend code: the code of an order works without them.
      const { data, error } = await supabase
        .from("discount_codes")
        .insert({ code, issued_for_payment_id: paymentId, amount_cents: amountCents, expires_at: expiresAt.toISOString(), ...(kind && kind !== "order" ? { kind, reason: reason ?? null } : {}) })
        .select("id, code, amount_cents, expires_at")
        .single();
      if (error) {
        if (error.code === "23505") return "taken";
        throw new Error(error.message);
      }
      return issued(data as Row);
    },
    async listByPaymentKind(paymentId, kind) {
      const { data, error } = await supabase.from("discount_codes").select("id, code, amount_cents, expires_at").eq("issued_for_payment_id", paymentId).eq("kind", kind).order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => issued(r as Row));
    },
    async findByCode(code) {
      const { data, error } = await supabase.from("discount_codes").select("id, code, amount_cents, expires_at, redeemed_at, reserved_until").eq("code", code).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      const r = data as Row;
      return { id: r.id, code: r.code, amountCents: r.amount_cents, expiresAt: new Date(r.expires_at), redeemedAt: r.redeemed_at ? new Date(r.redeemed_at) : null, reservedUntil: r.reserved_until ? new Date(r.reserved_until) : null };
    },
    async hold(code, now, until) {
      const nowIso = now.toISOString();
      const { data, error } = await supabase
        .from("discount_codes")
        .update({ reserved_until: until.toISOString() })
        .eq("code", code)
        .is("redeemed_at", null)
        .gt("expires_at", nowIso)
        .or(`reserved_until.is.null,reserved_until.lt.${nowIso}`)
        .select("id, amount_cents");
      if (error) throw new Error(error.message);
      const row = (data ?? [])[0] as { id: string; amount_cents: number } | undefined;
      return row ? { id: row.id, amountCents: row.amount_cents } : null;
    },
    async releaseForOrder(stripeSessionId) {
      const { data: pay } = await supabase.from("payments").select("discount_code_id").eq("stripe_payment_id", stripeSessionId).maybeSingle();
      const id = (pay as { discount_code_id?: string | null } | null)?.discount_code_id;
      if (!id) return;
      const { error } = await supabase.from("discount_codes").update({ reserved_until: null }).eq("id", id).is("redeemed_at", null);
      if (error) throw new Error(error.message);
    },
    async releaseById(id) {
      const { error } = await supabase.from("discount_codes").update({ reserved_until: null }).eq("id", id).is("redeemed_at", null);
      if (error) throw new Error(error.message);
    },
    async redeemForOrder(stripeSessionId, now) {
      const { data: pay } = await supabase.from("payments").select("id, discount_code_id").eq("stripe_payment_id", stripeSessionId).maybeSingle();
      const p = pay as { id?: string; discount_code_id?: string | null } | null;
      if (!p?.id || !p.discount_code_id) return false;
      const { error } = await supabase.from("discount_codes").update({ redeemed_at: now.toISOString(), redeemed_by_payment_id: p.id, reserved_until: null }).eq("id", p.discount_code_id).is("redeemed_at", null);
      if (error) throw new Error(error.message);
      return true;
    },
  };
}
