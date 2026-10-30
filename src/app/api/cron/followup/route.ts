import { NextResponse } from "next/server";
import { siteUrl as getSiteUrl } from "@/lib/siteUrl";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendFollowUpEmail } from "@/lib/email/followUp";
import { makeFollowUpToken } from "@/lib/followup/token";
import { trackServerEvent } from "@/lib/posthog/server";
import type { Locale } from "@/lib/locale";

// The one follow-up e-mail (improvement brief B5), a daily job (vercel.json). Only books whose buyer ticked the box at checkout have a
// followup_email at all, and each is sent exactly once (followup_sent_at). Six weeks after the book; a book older than the window is left
// alone (a job that was down for a while does not dredge up old orders).
const SIX_WEEKS_MS = 42 * 24 * 60 * 60 * 1000;
const WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const now = Date.now();
  const { data: plans, error } = await supabase
    .from("window_plans")
    .select("id, session_id, language, followup_email, created_at")
    .eq("status", "ready")
    .not("followup_email", "is", null)
    .is("followup_sent_at", null)
    .gte("created_at", new Date(now - SIX_WEEKS_MS - WINDOW_MS).toISOString())
    .lte("created_at", new Date(now - SIX_WEEKS_MS).toISOString());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const siteUrl = getSiteUrl();
  let sent = 0;
  let failed = 0;
  for (const plan of plans ?? []) {
    const to = plan.followup_email;
    if (!to) continue;
    // Take the right to send first (only if still unsent), so two overlapping runs cannot both send; give it back if sending fails.
    const { data: claimed } = await supabase
      .from("window_plans")
      .update({ followup_sent_at: new Date().toISOString() })
      .eq("id", plan.id)
      .is("followup_sent_at", null)
      .select("id")
      .maybeSingle();
    if (!claimed) continue;
    try {
      await sendFollowUpEmail({
        to,
        locale: (plan.language as Locale) ?? "nl",
        openUrl: `${siteUrl}/nieuw-venster?t=${makeFollowUpToken("open", plan.id)}`,
        unsubscribeUrl: `${siteUrl}/afmelden?t=${makeFollowUpToken("unsub", plan.id)}`,
      });
      void trackServerEvent("followup_email_sent", {}, plan.session_id);
      sent++;
    } catch (err) {
      console.error("WINDOW: could not send the follow-up e-mail for plan", plan.id, err);
      await supabase.from("window_plans").update({ followup_sent_at: null }).eq("id", plan.id);
      failed++;
    }
  }
  return NextResponse.json({ total: plans?.length ?? 0, sent, failed });
}
