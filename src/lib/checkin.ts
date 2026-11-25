// The check-in a week after a book (Step 243): the pure rules, shared by the cron, the answer page, the server action and the admin page. Browser-safe.

export const CHECKIN_ANSWERS = ["done", "planned", "not"] as const;
export type CheckinAnswer = (typeof CHECKIN_ANSWERS)[number];

export const CHECKIN_COMMENT_MAX = 600;

const DAY = 24 * 60 * 60 * 1000;
/** The mail goes out when the book is at least this old... */
export const CHECKIN_MIN_AGE_MS = 8 * DAY;
/** ...and at most this old: a job that was down for a while does not dredge up old orders. */
export const CHECKIN_MAX_AGE_MS = 22 * DAY;
/** The first-action reminder (api/cron/first-action-reminder) still considers a book up to this age. The check-in waits for it, so nobody gets both mails on one day. */
export const REMINDER_MAX_AGE_MS = 9 * DAY;
/** After a first-action reminder the check-in waits at least this long. */
export const REMINDER_GAP_MS = 3 * DAY;

export const parseCheckinAnswer = (raw: unknown): CheckinAnswer | null => (typeof raw === "string" && (CHECKIN_ANSWERS as readonly string[]).includes(raw) ? (raw as CheckinAnswer) : null);

/**
 * Whether the check-in mail of one book is due. Only the timing and the "once" rule live here (the cron checks the rest: a paid order, an address, an opt-out):
 * the book is between 8 and 22 days old, no check-in was sent, and the first-action reminder is out of the way (sent at least 3 days ago, or never sent and
 * no longer going to be, because the book is past the reminder's own window).
 */
export function checkinDue(plan: { createdAt: Date; checkinSentAt: Date | null; reminderSentAt: Date | null }, now: Date): boolean {
  if (plan.checkinSentAt) return false;
  const age = now.getTime() - plan.createdAt.getTime();
  if (age < CHECKIN_MIN_AGE_MS || age > CHECKIN_MAX_AGE_MS) return false;
  if (plan.reminderSentAt) return now.getTime() - plan.reminderSentAt.getTime() >= REMINDER_GAP_MS;
  return age > REMINDER_MAX_AGE_MS;
}

export interface CleanCheckin {
  answer: CheckinAnswer;
  /** undefined = do not touch the stored sentence. */
  comment?: string | null;
  /** undefined = do not touch the stored consent. */
  quoteConsent?: boolean;
}

/**
 * Cleaned input, or null when it is not an answer. Consent is only possible for "done" together with a sentence in the same call, and any other answer (or a cleared
 * sentence) withdraws it, even when the caller says nothing about it: a buyer who changes "done" to "not" must not leave a sentence on the site's shortlist.
 */
export function cleanCheckin(input: { answer?: unknown; comment?: unknown; quoteConsent?: unknown } | null | undefined): CleanCheckin | null {
  const answer = parseCheckinAnswer(input?.answer);
  if (!answer) return null;
  const out: CleanCheckin = { answer };
  if (typeof input?.comment === "string") {
    const text = input.comment.trim().slice(0, CHECKIN_COMMENT_MAX);
    out.comment = text === "" ? null : text;
  }
  if (answer !== "done" || out.comment === null) out.quoteConsent = false;
  else if (input?.quoteConsent !== undefined) out.quoteConsent = input.quoteConsent === true && typeof out.comment === "string";
  return out;
}

export interface CheckinRow {
  answer: string;
  comment: string | null;
  quote_consent: boolean;
  locale: string | null;
  created_at: string;
}

export interface CheckinSummary {
  /** Mails sent, as given by the caller. */
  sent: number;
  /** Answers received, per answer. */
  counts: Record<CheckinAnswer, number>;
  answered: number;
  /** Share of the mails that got an answer, null when none were sent. */
  responseRate: number | null;
  /** Share of "done" among the answers, null without answers. */
  doneShare: number | null;
  /** Rows with a sentence, newest first. `usable` = answer "done" with consent: the ones that may be shown on the site. */
  comments: { text: string; answer: CheckinAnswer; usable: boolean; locale: string | null; at: string }[];
}

export function summarizeCheckins(rows: readonly CheckinRow[], sent: number): CheckinSummary {
  const counts: Record<CheckinAnswer, number> = { done: 0, planned: 0, not: 0 };
  const comments: CheckinSummary["comments"] = [];
  for (const r of rows) {
    const answer = parseCheckinAnswer(r.answer);
    if (!answer) continue;
    counts[answer]++;
    if (typeof r.comment === "string" && r.comment.trim() !== "") comments.push({ text: r.comment, answer, usable: answer === "done" && r.quote_consent === true, locale: r.locale, at: r.created_at });
  }
  const answered = counts.done + counts.planned + counts.not;
  comments.sort((a, b) => b.at.localeCompare(a.at));
  return { sent, counts, answered, responseRate: sent > 0 ? answered / sent : null, doneShare: answered > 0 ? counts.done / answered : null, comments };
}
