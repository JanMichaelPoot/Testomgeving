import { getStripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { generateWindowPlan } from "@/lib/claude/plan";
import { renderWindowPlanPdf } from "@/lib/pdf/windowPlan";
import { sendWindowPlanEmail } from "@/lib/email/windowPlan";
import type { Database } from "@/types/database";

type WindowPlanRow = Database["public"]["Tables"]["window_plans"]["Row"];

export class PlanNotReadyError extends Error {}

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
  const ideaId = checkoutSession.metadata?.idea_id;

  if (!sessionId || !ideaId) {
    throw new Error("This checkout session is missing expected metadata.");
  }

  const supabase = createServiceRoleClient();

  const { data: existingPlan } = await supabase
    .from("window_plans")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingPlan) return existingPlan;

  const [{ data: idea }, { data: intake }] = await Promise.all([
    supabase.from("ideas").select("*").eq("id", ideaId).single(),
    supabase
      .from("intake_answers")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!idea) {
    throw new Error("The chosen idea could not be found.");
  }

  const generated = await generateWindowPlan(
    { lens: idea.lens, title: idea.title, description: idea.description },
    {
      topic: intake?.topic ?? "",
      time_available: intake?.time_available ?? "",
      budget: intake?.budget ?? "",
      desired_surprise: intake?.desired_surprise ?? "",
      company: intake?.company ?? "",
    }
  );

  const pdfBytes = await renderWindowPlanPdf(generated);
  const pdfPath = `${sessionId}/window-plan.pdf`;

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

  const { data: inserted, error: insertError } = await supabase
    .from("window_plans")
    .insert({
      session_id: sessionId,
      chosen_idea_id: ideaId,
      title: generated.title,
      why_it_fits: generated.why_it_fits,
      steps_json: generated.steps,
      first_action: generated.first_action,
      cost_estimate: generated.cost_estimate,
      time_estimate: generated.time_estimate,
      pdf_url: pdfUrl,
    })
    .select("*")
    .single();

  if (insertError || !inserted) {
    throw new Error(insertError?.message ?? "Could not save the Window Plan.");
  }

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
      await sendWindowPlanEmail({
        to: customerEmail,
        plan: generated,
        pdfBytes,
        planUrl: `${siteUrl}/plan?checkout_session_id=${checkoutSessionId}`,
      });
    } catch {
      // Best-effort — the plan is already saved and viewable on this page
      // even if Resend is unreachable.
    }
  }

  return inserted;
}
