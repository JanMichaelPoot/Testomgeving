"use server";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { readFollowUpToken } from "@/lib/followup/token";
import { cleanCheckin, type CheckinAnswer } from "@/lib/checkin";

// The answer to the check-in mail (Step 243), written from /terugkoppeling. There is no login: the signed token from the mail is the proof (it names the book and
// is valid for this purpose only). One row per book; a second call changes it, and a call without a sentence keeps the one that is there. Returns a result
// instead of throwing; without migration 0032 the answer is { ok: false }.
export async function saveCheckin(token: string, input: { answer: CheckinAnswer; comment?: string; quoteConsent?: boolean }): Promise<{ ok: boolean }> {
  const planId = readFollowUpToken("checkin", token);
  const clean = cleanCheckin(input);
  if (!planId || !clean) return { ok: false };

  const supabase = createServiceRoleClient();
  const { data: plan } = await supabase.from("window_plans").select("language").eq("id", planId).eq("status", "ready").maybeSingle();
  if (!plan) return { ok: false };

  const row: Record<string, unknown> = { plan_id: planId, answer: clean.answer, locale: plan.language === "en" ? "en" : "nl", updated_at: new Date().toISOString() };
  if (clean.comment !== undefined) row.comment = clean.comment;
  if (clean.quoteConsent !== undefined) row.quote_consent = clean.quoteConsent;

  // The table is not in the generated types (migration 0032), hence the loose client.
  const loose = supabase as unknown as { from: (t: string) => { upsert: (r: unknown, o: { onConflict: string }) => Promise<{ error: { message: string } | null }> } };
  const { error } = await loose.from("book_checkins").upsert(row, { onConflict: "plan_id" });
  if (error) {
    console.error(`WINDOW: check-in answer not saved (has migration 0032 been run?): ${error.message}`);
    return { ok: false };
  }
  return { ok: true };
}
