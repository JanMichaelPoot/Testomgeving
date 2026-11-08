"use server";

import { redirect } from "next/navigation";
import { getSessionId } from "@/lib/session";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { resolveIdeaByKey } from "@/lib/ideaKeys";
import type { IdeaBookEntry } from "@/lib/claude/ideaBookTypes";

export type IdeaFeedbackValue = "up" | "down";

// The explicit, user-triggered way to retry after a hard generation
// failure (e.g. the Anthropic account running out of credits) — see
// resolveExistingPlan's "failed" handling in data.ts. Previously a
// "failed" row was silently treated as "safe to regenerate" on every
// GeneratingScreen poll, which meant a persistent failure just kept
// retrying forever with no visible error. Now /plan surfaces a clear
// error with a "try again" button that posts here.
//
// Only deletes a row that is still "failed" at the moment of deletion (not
// just "the failed row this page saw"), so a concurrent successful
// generation can never be wiped out by a stale retry click.
export async function retryPlanGeneration(formData: FormData) {
  const checkoutSessionId = formData.get("checkout_session_id");
  const testSessionId = formData.get("test_session_id");

  const supabase = createServiceRoleClient();
  let sessionId: string | null = null;

  if (typeof testSessionId === "string" && testSessionId) {
    sessionId = testSessionId;
  } else if (typeof checkoutSessionId === "string" && checkoutSessionId) {
    const checkoutSession = await getStripe().checkout.sessions.retrieve(checkoutSessionId);
    sessionId = checkoutSession.metadata?.session_id ?? null;
  }

  if (sessionId) {
    await supabase.from("window_plans").delete().eq("session_id", sessionId).eq("status", "failed");
  }

  const params = new URLSearchParams();
  if (typeof checkoutSessionId === "string" && checkoutSessionId) {
    params.set("checkout_session_id", checkoutSessionId);
  }
  if (typeof testSessionId === "string" && testSessionId) {
    params.set("test_session_id", testSessionId);
  }
  redirect(`/plan${params.size > 0 ? `?${params}` : ""}`);
}

// Fase 6 (Interaction & Retention) — a lightweight thumbs-style reaction per
// idea, surfaced only on /plan (the buyer's own page; never on the public
// /shared/[id] preview — see IdeaFeedback.tsx). Stored in
// window_plans.feedback_json, keyed by "idea-<originalIndex>" or
// "wildcard" — see supabase/migrations/0009_idea_feedback.sql.
//
// `value: null` clears a reaction (used when the person clicks the
// already-selected thumb again).
export async function submitIdeaFeedback(
  planId: string,
  ideaKey: string,
  value: IdeaFeedbackValue | null
): Promise<void> {
  const sessionId = await getSessionId();
  if (!sessionId) {
    throw new Error("No active session.");
  }

  const supabase = createServiceRoleClient();

  const { data: plan } = await supabase
    .from("window_plans")
    .select("session_id, feedback_json")
    .eq("id", planId)
    .maybeSingle();

  // window_plans has no RLS policies (service-role-only access, same
  // pattern as the rest of this schema — see supabase/migrations
  // /0001_init.sql), so this ownership check is what stops one session from
  // writing feedback onto a plan it didn't generate.
  if (!plan || plan.session_id !== sessionId) {
    throw new Error("That Idea Book could not be found.");
  }

  const current = (plan.feedback_json ?? {}) as Record<string, string>;
  const next = { ...current };
  if (value) {
    next[ideaKey] = value;
  } else {
    delete next[ideaKey];
  }

  const { error } = await supabase
    .from("window_plans")
    .update({ feedback_json: next })
    .eq("id", planId);

  if (error) {
    throw new Error(error.message);
  }
}

// "Verleiding" Fase 2 — "Dit ga ik doen" on the /plan reveal page. Records
// which idea the buyer intends to try, so the first-action reminder e-mail
// (api/cron/first-action-reminder) nudges about that idea instead of always
// the first one. Same ownership rule as submitIdeaFeedback: only the
// session that generated the plan (session cookie <-> plan.session_id) may
// write to it. Someone arriving via the emailed link without that cookie
// gets { ok: false, reason: "forbidden" } — the UI hides the button for them
// up front (see canInteract in plan/page.tsx), this is the server-side
// backstop.
//
// Returns a result instead of throwing so the client can show a friendly
// message rather than an error boundary.
export type CommitResult = { ok: true } | { ok: false; reason: "forbidden" | "invalid" | "failed" };

export async function commitToIdea(planId: string, ideaKey: string): Promise<CommitResult> {
  const sessionId = await getSessionId();
  if (!sessionId) return { ok: false, reason: "forbidden" };

  const supabase = createServiceRoleClient();
  const { data: plan } = await supabase
    .from("window_plans")
    .select("session_id, ideas_json, wildcard_json")
    .eq("id", planId)
    .maybeSingle();

  if (!plan || plan.session_id !== sessionId) return { ok: false, reason: "forbidden" };

  const ideas = Array.isArray(plan.ideas_json) ? (plan.ideas_json as unknown as IdeaBookEntry[]) : [];
  const wildcard =
    plan.wildcard_json && typeof plan.wildcard_json === "object"
      ? (plan.wildcard_json as unknown as IdeaBookEntry)
      : null;
  if (!resolveIdeaByKey(ideaKey, ideas, wildcard)) return { ok: false, reason: "invalid" };

  const { error } = await supabase
    .from("window_plans")
    .update({ committed_idea_key: ideaKey, committed_at: new Date().toISOString() })
    .eq("id", planId);

  if (error) {
    console.error("Failed to record committed idea:", error.message);
    return { ok: false, reason: "failed" };
  }
  return { ok: true };
}
