import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendFirstActionReminderEmail } from "@/lib/email/reminder";
import type { IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import type { Locale } from "@/lib/locale";

// Fase 3 (WINDOW Ervaringsontwerp roadmap): a daily job — see vercel.json's
// `crons` entry — that nudges buyers who haven't come back to their Idea
// Book a few days after buying it. Deliberately narrow: no accounts, no
// per-idea tracking of what was actually done, just one email referencing
// the first idea's first_action, sent exactly once per plan.
const MIN_AGE_MS = 2 * 24 * 60 * 60 * 1000; // don't nudge same-day/next-day
const MAX_AGE_MS = 9 * 24 * 60 * 60 * 1000; // don't dredge up ancient rows
// (e.g. the first time this job ever runs against existing data)

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createServiceRoleClient();
  const now = Date.now();
  const notBefore = new Date(now - MAX_AGE_MS).toISOString();
  const notAfter = new Date(now - MIN_AGE_MS).toISOString();

  const { data: plans, error } = await supabase
    .from("window_plans")
    .select("id, session_id, language, ideas_json, recipient_email, created_at")
    .eq("status", "ready")
    .not("recipient_email", "is", null)
    .is("first_action_reminder_sent_at", null)
    .gte("created_at", notBefore)
    .lte("created_at", notAfter);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
  let sent = 0;
  let failed = 0;

  for (const plan of plans ?? []) {
    try {
      const ideas = Array.isArray(plan.ideas_json)
        ? (plan.ideas_json as unknown as IdeaBookEntry[])
        : [];
      const firstIdea = ideas[0];
      if (!firstIdea || !plan.recipient_email) continue;

      const { data: payment } = await supabase
        .from("payments")
        .select("stripe_payment_id")
        .eq("session_id", plan.session_id)
        .maybeSingle();

      // No matching payment means this plan wasn't a real paid checkout
      // (e.g. a leftover test-bypass row) — recipient_email should never be
      // set for those, but skip defensively rather than emailing a dead link.
      if (!payment) continue;

      await sendFirstActionReminderEmail({
        to: plan.recipient_email,
        ideaTitle: firstIdea.title,
        firstAction: firstIdea.first_action,
        planUrl: `${siteUrl}/plan?checkout_session_id=${payment.stripe_payment_id}`,
        locale: (plan.language as Locale) ?? "nl",
      });

      await supabase
        .from("window_plans")
        .update({ first_action_reminder_sent_at: new Date().toISOString() })
        .eq("id", plan.id);

      sent++;
    } catch (err) {
      console.error("Failed to send first-action reminder for plan", plan.id, err);
      failed++;
    }
  }

  return NextResponse.json({ total: plans?.length ?? 0, sent, failed });
}
