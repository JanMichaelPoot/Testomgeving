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
