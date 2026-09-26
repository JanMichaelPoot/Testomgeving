import { createHash, randomUUID } from "crypto";

// Optional repetition memory (fase 5). Pure helpers only; the database and cookie
// access lives in historyStore.ts. The point of the memory: a returning visitor who
// switched it on does not get the same activities again in the next book.
//
// Privacy (docs/discovery-engine.md): a random device id in a first-party cookie, set
// only after an explicit opt-in on the checkout page; the database only ever holds
// its SHA-256 hash, never an e-mail address, and rows expire after 12 months.

export const DEVICE_COOKIE_NAME = "window_device_id";
export const HISTORY_MONTHS = 12;
/** The engine avoids what the last two books for this device showed. */
export const HISTORY_SESSIONS = 2;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function newDeviceId(): string {
  return randomUUID();
}

/** The cookie is set by us, but it comes back from the browser: only accept what we made. */
export function isValidDeviceId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** What is stored in the database instead of the id itself. A random UUID needs no salt. */
export function hashDeviceId(id: string): string {
  return createHash("sha256").update(id, "utf8").digest("hex");
}

/** Rows created before this moment are expired. */
export function historyCutoff(now: Date = new Date()): string {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - HISTORY_MONTHS);
  return cutoff.toISOString();
}

export interface HistoryRow {
  activity_ids: string[];
  created_at: string;
}

/**
 * The activities to keep out of the next book: everything the most recent
 * `keep` books showed. A row without activities is a book that was paid for but
 * has not been generated (yet), so it does not count as a session.
 */
export function recentlyShown(rows: readonly HistoryRow[], keep: number = HISTORY_SESSIONS): string[] {
  const seen = new Set<string>();
  [...rows]
    .filter((r) => r.activity_ids.length > 0)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
    .slice(0, Math.max(0, keep))
    .forEach((r) => r.activity_ids.forEach((id) => seen.add(id)));
  return [...seen];
}
