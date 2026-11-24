"use server";

import { getSessionId } from "@/lib/session";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { cleanBookFeedback, type BookFeedbackInput } from "@/lib/bookFeedback";

const UUID = /^[0-9a-f-]{36}$/i;

// The buyer's rating of a finished book (Step 241), written from the book page. Same ownership rule as the heart and "Dit ga ik doen": only the session that
// generated the book may write to it (window_plans has no RLS policies, so this check is the lock). One row per book: a second call changes it, and a call that
// leaves the sentence out (a plain tap on a score) keeps the sentence that is already there. Returns a result instead of throwing, so the page can say
// "could not save" without an error screen; without migration 0031 the answer is { ok: false } and the buyer still sees the sharing block.
export async function saveBookFeedback(planId: string, locale: string, input: Partial<BookFeedbackInput>): Promise<{ ok: boolean }> {
  const clean = cleanBookFeedback(input);
  if (!clean || !UUID.test(planId)) return { ok: false };
  const sessionId = await getSessionId();
  if (!sessionId) return { ok: false };

  const supabase = createServiceRoleClient();
  const { data: plan } = await supabase.from("window_plans").select("session_id").eq("id", planId).maybeSingle();
  if (!plan || plan.session_id !== sessionId) return { ok: false };

  const row: Record<string, unknown> = {
    plan_id: planId,
    rating: clean.rating,
    locale: locale === "en" ? "en" : "nl",
    updated_at: new Date().toISOString(),
  };
  if (clean.comment !== undefined) row.comment = clean.comment;
  if (clean.quoteConsent !== undefined) row.quote_consent = clean.quoteConsent;

  // The table is not in the generated types (migration 0031), hence the loose client.
  const loose = supabase as unknown as { from: (t: string) => { upsert: (r: unknown, o: { onConflict: string }) => Promise<{ error: { message: string } | null }> } };
  const { error } = await loose.from("book_feedback").upsert(row, { onConflict: "plan_id" });
  if (error) {
    console.error(`WINDOW: book feedback not saved (has migration 0031 been run?): ${error.message}`);
    return { ok: false };
  }
  return { ok: true };
}
