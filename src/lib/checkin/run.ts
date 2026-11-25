import type { SupabaseClient } from "@supabase/supabase-js";
import type { IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import { CHECKIN_ANSWERS, CHECKIN_MAX_AGE_MS, CHECKIN_MIN_AGE_MS, checkinDue, type CheckinAnswer } from "@/lib/checkin";
import { isOptedOut as readOptOut } from "@/lib/checkin/optout";
import { isFreeOrderId } from "@/lib/freeTest";
import { resolveIdeaByKey } from "@/lib/ideaKeys";
import { makeFollowUpToken, type FollowUpPurpose } from "@/lib/followup/token";

// The daily job behind the check-in mail (Step 243), called from the follow-up cron (src/app/api/cron/followup/route.ts) so no third cron is needed
// (a Hobby plan has two). Rules, in order: a ready book with an address, no check-in sent yet, between 8 and 22 days old and out of the way of the first-action
// reminder (checkinDue); a real paid order (not a free test order); the buyer has not opted out. The right to send is claimed first, so two overlapping runs
// cannot both send, and given back when sending fails. Storage and mail are handed in, so the rules are tested without either.

export interface CheckinCandidate {
  id: string;
  sessionId: string;
  language: "nl" | "en";
  email: string;
  createdAt: Date;
  reminderSentAt: Date | null;
  /** The title of the idea the buyer chose with "Dit ga ik doen", or null. Never a stand-in: the mail asks in general without one. */
  chosenIdeaTitle: string | null;
}

export interface CheckinStore {
  /** Ready books with an address and no check-in yet, created in the given range. */
  listCandidates(from: Date, to: Date): Promise<CheckinCandidate[]>;
  /** Whether the book's session has a succeeded order that is not a free test order. */
  hasRealOrder(sessionId: string): Promise<boolean>;
  /** true / false, or null when it could not be read (then nothing is sent). */
  isOptedOut(email: string): Promise<boolean | null>;
  /** Takes the right to send, once. False when somebody else got it. */
  claim(planId: string, now: Date): Promise<boolean>;
  release(planId: string): Promise<void>;
}

export interface CheckinRunResult {
  considered: number;
  sent: number;
  failed: number;
  skipped: number;
}

export async function runCheckins(
  store: CheckinStore,
  deps: {
    send: (p: { to: string; locale: "nl" | "en"; ideaTitle: string | null; answerUrls: Record<CheckinAnswer, string>; optoutUrl: string }) => Promise<void>;
    siteUrl: string;
    now?: Date;
    token?: (purpose: FollowUpPurpose, planId: string) => string;
    onSent?: (c: CheckinCandidate) => void;
  },
): Promise<CheckinRunResult> {
  const now = deps.now ?? new Date();
  const token = deps.token ?? ((purpose, planId) => makeFollowUpToken(purpose, planId));
  const candidates = await store.listCandidates(new Date(now.getTime() - CHECKIN_MAX_AGE_MS), new Date(now.getTime() - CHECKIN_MIN_AGE_MS));
  const result: CheckinRunResult = { considered: candidates.length, sent: 0, failed: 0, skipped: 0 };

  for (const c of candidates) {
    if (!checkinDue({ createdAt: c.createdAt, checkinSentAt: null, reminderSentAt: c.reminderSentAt }, now)) {
      result.skipped++;
      continue;
    }
    if (!(await store.hasRealOrder(c.sessionId)) || (await store.isOptedOut(c.email)) !== false) {
      result.skipped++;
      continue;
    }
    if (!(await store.claim(c.id, now))) {
      result.skipped++;
      continue;
    }
    try {
      const answerUrls = Object.fromEntries(CHECKIN_ANSWERS.map((a) => [a, `${deps.siteUrl}/terugkoppeling?t=${token("checkin", c.id)}&a=${a}`])) as Record<CheckinAnswer, string>;
      await deps.send({ to: c.email, locale: c.language, ideaTitle: c.chosenIdeaTitle, answerUrls, optoutUrl: `${deps.siteUrl}/afmelden?c=${token("checkin-out", c.id)}` });
      deps.onSent?.(c);
      result.sent++;
    } catch (err) {
      console.error("WINDOW: could not send the check-in e-mail for plan", c.id, err);
      await store.release(c.id);
      result.failed++;
    }
  }
  return result;
}

type Row = {
  id: string;
  session_id: string;
  language: string | null;
  recipient_email: string | null;
  created_at: string;
  first_action_reminder_sent_at: string | null;
  ideas_json: unknown;
  wildcard_json: unknown;
  committed_idea_key: string | null;
};

export function supabaseCheckinStore(supabase: SupabaseClient): CheckinStore {
  return {
    async listCandidates(from, to) {
      const { data, error } = await supabase
        .from("window_plans")
        .select("id, session_id, language, recipient_email, created_at, first_action_reminder_sent_at, ideas_json, wildcard_json, committed_idea_key")
        .eq("status", "ready")
        .not("recipient_email", "is", null)
        .is("checkin_sent_at", null)
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString());
      // Without migration 0032 the column is missing: say so instead of sending nothing in silence (the caller logs it and the admin overview shows it).
      if (error) throw new Error(`check-in candidates could not be read (has migration 0032 been run?): ${error.message}`);
      return ((data ?? []) as Row[])
        .filter((r) => !!r.recipient_email)
        .map((r) => {
          const ideas = Array.isArray(r.ideas_json) ? (r.ideas_json as IdeaBookEntry[]) : [];
          const wildcard = r.wildcard_json && typeof r.wildcard_json === "object" ? (r.wildcard_json as IdeaBookEntry) : null;
          return {
            id: r.id,
            sessionId: r.session_id,
            language: r.language === "en" ? ("en" as const) : ("nl" as const),
            email: r.recipient_email as string,
            createdAt: new Date(r.created_at),
            reminderSentAt: r.first_action_reminder_sent_at ? new Date(r.first_action_reminder_sent_at) : null,
            chosenIdeaTitle: resolveIdeaByKey(r.committed_idea_key, ideas, wildcard)?.title ?? null,
          };
        });
    },
    async hasRealOrder(sessionId) {
      const { data } = await supabase.from("payments").select("stripe_payment_id").eq("session_id", sessionId).eq("status", "succeeded");
      return (data ?? []).some((p) => !isFreeOrderId((p as { stripe_payment_id: string | null }).stripe_payment_id));
    },
    isOptedOut: (email) => readOptOut(supabase, email),
    async claim(planId, now) {
      const { data } = await supabase.from("window_plans").update({ checkin_sent_at: now.toISOString() }).eq("id", planId).is("checkin_sent_at", null).select("id").maybeSingle();
      return !!data;
    },
    async release(planId) {
      await supabase.from("window_plans").update({ checkin_sent_at: null }).eq("id", planId);
    },
  };
}
