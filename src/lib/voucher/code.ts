import { randomInt } from "node:crypto";

// Gift voucher codes. The code on the card is the whole secret, so it is long enough that guessing one is not a realistic attack
// (12 characters of a 31-letter alphabet is about 59 bits) and it is built to be copied by hand: no 0/O or 1/I/L, grouped in fours.
//
//   WIN-K7QM-4XRT-9PDH
//
// Pure apart from the random source, so the format and the normalisation of what a person types are tested without a database.

export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const GROUPS = 3;
const GROUP_LENGTH = 4;
export const CODE_BODY_LENGTH = GROUPS * GROUP_LENGTH;
export const CODE_PREFIX = "WIN";
/** How long a paid voucher can be redeemed, in months (the brief: 12 months). */
export const VOUCHER_VALID_MONTHS = 12;

/** `WIN-XXXX-XXXX-XXXX` from a 12-character body. */
export function formatCode(body: string): string {
  const groups: string[] = [];
  for (let i = 0; i < body.length; i += GROUP_LENGTH) groups.push(body.slice(i, i + GROUP_LENGTH));
  return [CODE_PREFIX, ...groups].join("-");
}

export function generateCode(random: (max: number) => number = (max) => randomInt(max)): string {
  let body = "";
  for (let i = 0; i < CODE_BODY_LENGTH; i++) body += CODE_ALPHABET[random(CODE_ALPHABET.length)];
  return formatCode(body);
}

/**
 * What a person typed or pasted, made into the stored form, or null when it cannot be a code. Case, spaces, dashes and a missing
 * "WIN" prefix do not matter; a character outside the alphabet (0, O, 1, I, L) means a typo and is refused, not guessed at.
 */
export function normalizeCode(input: string | null | undefined): string | null {
  if (!input) return null;
  let raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (raw.startsWith(CODE_PREFIX) && raw.length === CODE_BODY_LENGTH + CODE_PREFIX.length) raw = raw.slice(CODE_PREFIX.length);
  if (raw.length !== CODE_BODY_LENGTH) return null;
  for (const ch of raw) if (!CODE_ALPHABET.includes(ch)) return null;
  return formatCode(raw);
}

/** The moment a voucher activated today stops being valid. */
export function expiryFrom(activatedAt: Date, months = VOUCHER_VALID_MONTHS): Date {
  const d = new Date(activatedAt.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  // 31 January + 1 month is 28 February, not 3 March.
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

export type VoucherState = "pending" | "ok" | "redeemed" | "expired" | "void";

export interface VoucherLike {
  status: "pending" | "active" | "redeemed" | "void";
  expires_at: string | null;
}

/** What a visitor with this code may do. "Expired" is derived, not stored. */
export function voucherState(row: VoucherLike, now: Date = new Date()): VoucherState {
  if (row.status === "void") return "void";
  if (row.status === "redeemed") return "redeemed";
  if (row.status === "pending") return "pending";
  if (row.expires_at && new Date(row.expires_at).getTime() <= now.getTime()) return "expired";
  return "ok";
}
