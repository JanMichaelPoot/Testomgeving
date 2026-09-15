import { createServiceRoleClient } from "@/lib/supabase/server";
import type { StoredIntake } from "@/app/intake/actions";
import type { GeneratedIdeaBook } from "@/lib/claude/generateIdeaBook";
import type { CharacterProfile } from "@/lib/characterProfile";

type ServiceRoleClient = ReturnType<typeof createServiceRoleClient>;

// Writes one row to `audit_log` — deliberately the only place in the
// codebase that persists a generated Idea Book's input/output without any
// session_id, user_id, or email attached (see
// supabase/migrations/0008_audit_log.sql), so an admin reviewing quality
// or output for internal audit can never use this table to re-identify
// whose Idea Book a given row was. Called exactly once per generation,
// from both the real (getOrCreateWindowPlan) and test
// (getOrCreateTestWindowPlan) paths in src/app/plan/data.ts.
export async function recordAuditLogEntry(
  supabase: ServiceRoleClient,
  params: {
    profile: StoredIntake;
    generated: GeneratedIdeaBook;
    emailDelivered: boolean;
    // Fase 2 (Input & Character Engine): the derived character profile is
    // logged alongside the raw answers purely so real, paid-for answer
    // combinations can be inspected via /admin — computeCharacterProfile
    // itself is not (yet) fed back into generateIdeaBook's prompt, that's
    // Fase 3's job. Optional so existing callers keep compiling untouched.
    characterProfile?: CharacterProfile;
  }
) {
  const { profile, generated, emailDelivered, characterProfile } = params;

  const { error } = await supabase.from("audit_log").insert({
    locale: profile.locale,
    input_json: {
      ...profile,
      ...(characterProfile ? { characterProfile } : {}),
    } as unknown as Record<string, unknown>,
    output_profile_summary: generated.profile_summary,
    output_must_haves: generated.must_haves,
    output_preferences: generated.preferences,
    output_ideas_json: generated.ideas as unknown as Record<string, unknown>[],
    output_wildcard_json: generated.wildcard as unknown as Record<string, unknown>,
    email_delivered: emailDelivered,
  });

  if (error) {
    // Audit logging is best-effort observability, not part of the paid
    // delivery path — never let a logging failure break the Idea Book
    // itself for a paying customer.
    console.error("audit_log insert failed:", error.message);
  }
}
