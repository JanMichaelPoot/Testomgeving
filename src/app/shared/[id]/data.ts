import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

// Only the fields safe to show a stranger: the ideas themselves (the
// shareable, impressive part) but never profile_summary/must_haves/
// preferences, which reveal the buyer's personal situation and
// constraints — see the improvement plan's referral section ("toont
// ideeën zonder persoonlijke intake-details").
export type SharedIdeaBook = Pick<
  Database["public"]["Tables"]["window_plans"]["Row"],
  "id" | "title" | "language" | "ideas_json" | "wildcard_json" | "labels_json"
>;

export async function getSharedIdeaBook(id: string): Promise<SharedIdeaBook | null> {
  const supabase = createServiceRoleClient();

  const { data } = await supabase
    .from("window_plans")
    .select("id, title, language, ideas_json, wildcard_json, labels_json")
    .eq("id", id)
    .eq("status", "ready")
    .maybeSingle();

  return data;
}

// What the preview card of a shared book may know about the person's window: only WHICH images
// were chosen, never any other answer (no open answer, place, age or company). Narrow on purpose:
// nothing else leaves this function. Null for books made with the other intakes.
export type SharedWindowSource = { associations: string[]; interestDomains: string[]; surpriseMe: boolean; intakeFlow?: "images2"; interests?: string[] };

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export async function getSharedWindowSource(planId: string): Promise<SharedWindowSource | null> {
  try {
    const supabase = createServiceRoleClient();
    const { data: plan } = await supabase.from("window_plans").select("session_id").eq("id", planId).eq("status", "ready").maybeSingle();
    if (!plan) return null;
    const { data: intake } = await supabase
      .from("intake_answers")
      .select("raw_json")
      .eq("session_id", plan.session_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const raw = intake?.raw_json as Record<string, unknown> | null | undefined;
    if (!raw || raw.intakeVariant !== "associations") return null;
    // The two-page intake also shows the activities the person chose (photos only, no text).
    if (raw.intakeFlow === "images2") return { associations: strings(raw.associations), interestDomains: [], surpriseMe: false, intakeFlow: "images2", interests: strings(raw.interests) };
    return { associations: strings(raw.associations), interestDomains: strings(raw.interestDomains), surpriseMe: raw.surpriseMe === true };
  } catch {
    // Decoration: a failed read just means the card falls back to the cover photo.
    return null;
  }
}
