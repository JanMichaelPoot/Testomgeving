import type { createServiceRoleClient } from "@/lib/supabase/server";
import type { StoredIntake } from "@/app/intake/actions";

type ServiceRoleClient = ReturnType<typeof createServiceRoleClient>;

// Changing the answers before paying (fase 5). The answers stay on the SAME session, in
// place, so editing never leaves an orphan session behind, and the checkout, Stripe
// metadata and (opt-in) history all keep pointing at one session.

/**
 * Answers can be changed until the book exists or is paid for: a book that is being
 * generated (or is ready) must not have its input rewritten underneath it, and a paid
 * order is what the buyer saw when they paid.
 */
export async function isSessionLocked(supabase: ServiceRoleClient, sessionId: string): Promise<boolean> {
  const [{ data: plan }, { data: paid }] = await Promise.all([
    supabase.from("window_plans").select("id").eq("session_id", sessionId).in("status", ["pending", "ready"]).limit(1).maybeSingle(),
    supabase.from("payments").select("id").eq("session_id", sessionId).eq("status", "succeeded").limit(1).maybeSingle(),
  ]);
  return !!plan || !!paid;
}

/** The stored answers of a session that can still be changed, or null. */
export async function loadEditableIntake(supabase: ServiceRoleClient, sessionId: string): Promise<StoredIntake | null> {
  const { data: intake } = await supabase
    .from("intake_answers")
    .select("raw_json")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!intake) return null;
  if (await isSessionLocked(supabase, sessionId)) return null;
  return intake.raw_json as unknown as StoredIntake;
}

/** Replaces the answers in place. Returns false when there is nothing (left) to change. */
export async function replaceIntake(supabase: ServiceRoleClient, sessionId: string, stored: StoredIntake): Promise<boolean> {
  if (await isSessionLocked(supabase, sessionId)) return false;
  const { data: intake } = await supabase
    .from("intake_answers")
    .select("id")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!intake) return false;
  const { error } = await supabase.from("intake_answers").update({ raw_json: { ...stored } }).eq("id", intake.id);
  if (error) throw new Error(error.message);
  return true;
}
