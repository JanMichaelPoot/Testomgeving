"use server";

import { getSessionId } from "@/lib/session";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type IdeaFeedbackValue = "up" | "down";

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
