import { getStripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { generateIdeaBook, type GeneratedIdeaBook } from "@/lib/claude/generateIdeaBook";
import { renderIdeaBookPdf } from "@/lib/pdf/ideaBook";
import { sendIdeaBookEmail } from "@/lib/email/windowPlan";
import { recordAuditLogEntry } from "@/lib/auditLog";
import { computeCharacterProfile, type CharacterProfile } from "@/lib/characterProfile";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { StoredIntake } from "@/app/intake/actions";
import type { Database } from "@/types/database";

type WindowPlanRow = Database["public"]["Tables"]["window_plans"]["Row"];
type ServiceRoleClient = ReturnType<typeof createServiceRoleClient>;

export class PlanNotReadyError extends Error {
  constructor(message: string, public reason: "unpaid" | "generating") {
    super(message);
  }
}

// A "pending" row older than this is assumed to belong to a crashed/failed
// attempt (e.g. the server process died mid-generation) rather than one
// that's still genuinely in flight — regenerate instead of waiting forever.
const PENDING_TIMEOUT_MS = 90_000;

async function findExistingPlan(
  supabase: ServiceRoleClient,
  sessionId: string
): Promise<WindowPlanRow | null> {
  const { data } = await supabase
    .from("window_plans")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

// Resolves what to do with whatever row (if any) already exists for this
// session: a "ready" row is returned as-is, a fresh "pending" row means a
// generation is already in flight (surfaced as a friendly wait-and-refresh
// message instead of starting a second, fully redundant Claude call + PDF
// render + upload), and a stale "pending" or a "failed" row is treated as
// nothing — safe to regenerate.
function resolveExistingPlan(existing: WindowPlanRow | null): WindowPlanRow | "generating" | null {
  if (!existing) return null;
  if (existing.status === "ready") return existing;
  if (existing.status === "pending") {
    const age = Date.now() - new Date(existing.created_at).getTime();
    if (age < PENDING_TIMEOUT_MS) return "generating";
  }
  return null;
}

// Shared by generateAndSavePlan and getCharacterProfileForSession (Fase 4)
// — both need the same raw stored answers for a session, just for
// different purposes (generation vs. re-deriving the character profile for
// display after the fact).
async function fetchStoredIntake(
  supabase: ServiceRoleClient,
  sessionId: string
): Promise<StoredIntake | null> {
  const { data: intake } = await supabase
    .from("intake_answers")
    .select("raw_json")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return intake ? (intake.raw_json as unknown as StoredIntake) : null;
}

// Fase 4 (New Result Experience) — the /plan page's Discovery Profile
// screen needs the character profile too, but only for display, well after
// generateAndSavePlan has already run and returned. Rather than adding a
// new column to persist it (window_plans has no character_profile_json
// today), this just re-derives it from the same stored intake answers —
// computeCharacterProfile is pure and cheap, so recomputing it on read is
// simpler and safer than keeping a second, easy-to-drift copy in storage.
export async function getCharacterProfileForSession(
  sessionId: string
): Promise<CharacterProfile | null> {
  const supabase = createServiceRoleClient();
  const profile = await fetchStoredIntake(supabase, sessionId);
  return profile ? computeCharacterProfile(profile) : null;
}

async function generateAndSavePlan(
  supabase: ServiceRoleClient,
  sessionId: string
): Promise<{
  plan: WindowPlanRow;
  generated: GeneratedIdeaBook;
  pdfBytes: Uint8Array;
  profile: StoredIntake;
  characterProfile: CharacterProfile;
}> {
  const profile = await fetchStoredIntake(supabase, sessionId);

  if (!profile) {
    throw new Error("The intake profile for this session could not be found.");
  }

  // The locale was captured server-side at intake time (see
  // src/app/intake/actions.ts) rather than answered in the wizard, so the
  // book always matches what the user actually saw, even if they toggle
  // the site language afterwards.
  const locale = profile.locale ?? "nl";
  const dict = getDictionary(locale);
  const bookTitle = dict.plan.eyebrow;

  // Fase 3 (Possibility/Door Engine): computed once here and threaded into
  // both the generation call below (drives door balance/tone) and the
  // return value, so callers reuse it for audit logging instead of
  // recomputing it from the same profile a second time.
  const characterProfile = computeCharacterProfile(profile);

  // Marks generation as in-flight *before* the slow Claude/PDF work starts,
  // so a page reload in the next ~90s finds this row and waits instead of
  // kicking off a second, fully redundant generation.
  const { data: pendingRow, error: pendingError } = await supabase
    .from("window_plans")
    .insert({ session_id: sessionId, title: bookTitle, language: locale, status: "pending" })
    .select("*")
    .single();

  if (pendingError || !pendingRow) {
    throw new Error(pendingError?.message ?? "Could not start generating the Idea Book.");
  }

  try {
    const generated = await generateIdeaBook(profile, locale, characterProfile);
    const pdfBytes = await renderIdeaBookPdf(generated, bookTitle, locale);
    const pdfPath = `${sessionId}/idea-book.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("window-plans")
      .upload(pdfPath, Buffer.from(pdfBytes), {
        contentType: "application/pdf",
        upsert: true,
      });

    const pdfUrl = uploadError
      ? null
      : supabase.storage.from("window-plans").getPublicUrl(pdfPath).data
          .publicUrl;

    const { data: updated, error: updateError } = await supabase
      .from("window_plans")
      .update({
        status: "ready",
        profile_summary: generated.profile_summary,
        must_haves: generated.must_haves,
        preferences: generated.preferences,
        ideas_json: generated.ideas,
        wildcard_json: generated.wildcard as unknown as Record<string, unknown>,
        labels_json: generated.labels,
        pdf_url: pdfUrl,
      })
      .eq("id", pendingRow.id)
      .select("*")
      .single();

    if (updateError || !updated) {
      throw new Error(updateError?.message ?? "Could not save the Idea Book.");
    }

    return { plan: updated, generated, pdfBytes, profile, characterProfile };
  } catch (err) {
    await supabase.from("window_plans").update({ status: "failed" }).eq("id", pendingRow.id);
    throw err;
  }
}

// Called from the /plan Server Component on every visit. Generation only
// happens once per session — subsequent visits (page refresh, the emailed
// link) just read back the saved row.
export async function getOrCreateWindowPlan(
  checkoutSessionId: string
): Promise<WindowPlanRow> {
  const checkoutSession = await getStripe().checkout.sessions.retrieve(
    checkoutSessionId
  );

  if (checkoutSession.payment_status !== "paid") {
    throw new PlanNotReadyError(
      "We haven't confirmed your payment yet. If you just completed checkout, refresh in a moment.",
      "unpaid"
    );
  }

  const sessionId = checkoutSession.metadata?.session_id;

  if (!sessionId) {
    throw new Error("This checkout session is missing expected metadata.");
  }

  const supabase = createServiceRoleClient();

  const existingPlan = resolveExistingPlan(await findExistingPlan(supabase, sessionId));
  if (existingPlan === "generating") {
    throw new PlanNotReadyError(
      "We're still putting your Idea Book together — refresh in a moment.",
      "generating"
    );
  }
  if (existingPlan) return existingPlan;

  const { plan, generated, pdfBytes, profile, characterProfile } = await generateAndSavePlan(
    supabase,
    sessionId
  );

  let emailDelivered = false;

  const customerEmail = checkoutSession.customer_details?.email;
  if (customerEmail) {
    const { data: user } = await supabase
      .from("users")
      .upsert({ email: customerEmail }, { onConflict: "email" })
      .select("id")
      .single();

    if (user) {
      await supabase
        .from("sessions")
        .update({ user_id: user.id })
        .eq("id", sessionId);
    }

    // A gift redirects only where the Idea Book itself is delivered — the
    // buyer still pays with their own card and gets Stripe's own receipt
    // at their own email regardless, and stays the account on file above.
    const giftRecipientEmail = checkoutSession.metadata?.gift_recipient_email;
    const deliveryEmail = giftRecipientEmail || customerEmail;

    // Captured once here rather than re-derived from Stripe later — the
    // scheduled first-action reminder (see api/cron/first-action-reminder)
    // needs a delivery address days after this checkout session is created,
    // and re-fetching every plan's Stripe session on a cron run would be
    // both slower and a needless dependency on Stripe staying reachable.
    await supabase
      .from("window_plans")
      .update({ recipient_email: deliveryEmail })
      .eq("id", plan.id);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
    try {
      await sendIdeaBookEmail({
        to: deliveryEmail,
        title: plan.title,
        book: generated,
        pdfBytes,
        planUrl: `${siteUrl}/plan?checkout_session_id=${checkoutSessionId}`,
        locale: plan.language as "nl" | "en",
      });
      emailDelivered = true;
    } catch {
      // Best-effort — the plan is already saved and viewable on this page
      // even if Resend is unreachable. Recorded as not-delivered below so
      // the admin audit log reflects reality.
    }
  }

  // Fire-and-forget-adjacent: awaited so a logging failure can be caught
  // and swallowed by recordAuditLogEntry itself, but never allowed to
  // throw and break the (already-successful) plan generation above.
  await recordAuditLogEntry(supabase, { profile, generated, emailDelivered, characterProfile });

  return plan;
}

// Bypass so the Idea Book can be reviewed without a real Stripe payment.
export async function getOrCreateTestWindowPlan(
  sessionId: string
): Promise<WindowPlanRow> {
  const supabase = createServiceRoleClient();

  const existingPlan = resolveExistingPlan(await findExistingPlan(supabase, sessionId));
  if (existingPlan === "generating") {
    throw new PlanNotReadyError(
      "We're still putting your Idea Book together — refresh in a moment.",
      "generating"
    );
  }
  if (existingPlan) return existingPlan;

  const { plan, generated, profile, characterProfile } = await generateAndSavePlan(
    supabase,
    sessionId
  );
  // No payment, so no Stripe-collected email exists to mail a copy to —
  // still logged (with emailDelivered: false) so the audit trail reflects
  // every generation, not only paid ones.
  await recordAuditLogEntry(supabase, { profile, generated, emailDelivered: false, characterProfile });
  return plan;
}
