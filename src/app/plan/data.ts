import { getStripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { generateIdeaBook, type GeneratedIdeaBook } from "@/lib/claude/generateIdeaBook";
import { renderIdeaBookPdf } from "@/lib/pdf/ideaBook";
import { sendIdeaBookEmail } from "@/lib/email/windowPlan";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { StoredIntake } from "@/app/intake/actions";
import type { Database } from "@/types/database";

type WindowPlanRow = Database["public"]["Tables"]["window_plans"]["Row"];
type ServiceRoleClient = ReturnType<typeof createServiceRoleClient>;

export class PlanNotReadyError extends Error {}

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

async function generateAndSavePlan(
  supabase: ServiceRoleClient,
  sessionId: string
): Promise<{
  plan: WindowPlanRow;
  generated: GeneratedIdeaBook;
  pdfBytes: Uint8Array;
}> {
  const { data: intake } = await supabase
    .from("intake_answers")
    .select("raw_json")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!intake) {
    throw new Error("The intake profile for this session could not be found.");
  }

  // The locale was captured server-side at intake time (see
  // src/app/intake/actions.ts) rather than answered in the wizard, so the
  // book always matches what the user actually saw, even if they toggle
  // the site language afterwards.
  const profile = intake.raw_json as unknown as StoredIntake;
  const locale = profile.locale ?? "nl";
  const dict = getDictionary(locale);
  const bookTitle = dict.plan.eyebrow;

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
    const generated = await generateIdeaBook(profile, locale);
    const pdfBytes = await renderIdeaBookPdf(generated, bookTitle, locale, profile.styleId);
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

    return { plan: updated, generated, pdfBytes };
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
      "We haven't confirmed your payment yet. If you just completed checkout, refresh in a moment."
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
      "We're still putting your Idea Book together — refresh in a moment."
    );
  }
  if (existingPlan) return existingPlan;

  const { plan, generated, pdfBytes } = await generateAndSavePlan(
    supabase,
    sessionId
  );

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

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
    try {
      await sendIdeaBookEmail({
        to: customerEmail,
        title: plan.title,
        book: generated,
        pdfBytes,
        planUrl: `${siteUrl}/plan?checkout_session_id=${checkoutSessionId}`,
        locale: plan.language as "nl" | "en",
      });
    } catch {
      // Best-effort — the plan is already saved and viewable on this page
      // even if Resend is unreachable.
    }
  }

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
      "We're still putting your Idea Book together — refresh in a moment."
    );
  }
  if (existingPlan) return existingPlan;

  const { plan } = await generateAndSavePlan(supabase, sessionId);
  return plan;
}
