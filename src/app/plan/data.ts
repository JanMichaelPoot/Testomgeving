import { after } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { generateIdeaBook, type GeneratedIdeaBook } from "@/lib/claude/generateIdeaBook";
import { renderIdeaBookPdf } from "@/lib/pdf/ideaBook";
import { sendIdeaBookEmail } from "@/lib/email/windowPlan";
import { recordAuditLogEntry } from "@/lib/auditLog";
import { computeCharacterProfile, type CharacterProfile } from "@/lib/characterProfile";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { LEGAL_VERSIONS } from "@/lib/legal/versions";
import { WINDOW_PLAN_PRICE } from "@/lib/pricing";
import { getSignedPdfUrl } from "@/lib/pdfAccess";
import type { Locale } from "@/lib/language";
import type { StoredIntake } from "@/app/intake/actions";
import type { Database } from "@/types/database";

// Re-exported so existing callers (src/app/plan/page.tsx) can keep
// importing every plan-related helper from this one module; the
// implementation itself lives in src/lib/pdfAccess.ts so it can be unit
// tested without pulling in this file's much heavier import graph
// (Claude/PDF generation, Resend, audit logging).
export { getSignedPdfUrl };

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

// Bumped whenever renderIdeaBookPdf's output changes in a way worth being
// able to tell apart later (layout, legal footer text, included sections) —
// stored per plan in window_plans.pdf_version so a support/admin lookup can
// tell which template generation a given customer's PDF actually reflects.
// Not tied to LEGAL_VERSIONS — this versions the *document*, not the
// consent copy.
const PDF_VERSION = 1;

// Explicit request: every test-mode generation (the "Betaling overslaan"
// bypass, never a real purchase) also sends the real order-confirmation
// e-mail template to this fixed personal inbox, so what a real buyer
// receives can be reviewed without needing an actual payment. Not an
// environment variable — this is a developer convenience for this one
// project, not configuration that should vary per deployment.
const TEST_MODE_EMAIL_RECIPIENT = "pootjm@hotmail.com";

interface PlanGenerationContext {
  pendingRow: WindowPlanRow;
  profile: StoredIntake;
  characterProfile: CharacterProfile;
  locale: Locale;
  bookTitle: string;
}

// Inserts the "pending" row and returns everything the slow work below
// needs — split out from that slow work itself (finishPlanGeneration) so
// the two getOrCreate* functions below can do this fast part inline (so a
// concurrent request immediately sees a real "pending" row) and hand the
// slow part to `after()` instead of awaiting it in the same request. A
// page reload in the next ~90s finds this row and waits (see
// resolveExistingPlan) instead of kicking off a second, fully redundant
// generation.
async function startPlanGeneration(
  supabase: ServiceRoleClient,
  sessionId: string,
  // The order (payments.id) this generation belongs to, when there is one.
  // null for the no-payment test-mode bypass (getOrCreateTestWindowPlan) —
  // there is no order to link. Recorded on this very first "pending"
  // insert, not only the final "ready" update, so even a row that ends up
  // "failed" stays traceable to the order that triggered it for admin
  // debugging (Fase 3 Task: Admin order-detail).
  paymentId: string | null
): Promise<PlanGenerationContext> {
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

  const { data: pendingRow, error: pendingError } = await supabase
    .from("window_plans")
    .insert({
      session_id: sessionId,
      title: bookTitle,
      language: locale,
      status: "pending",
      payment_id: paymentId,
    })
    .select("*")
    .single();

  if (pendingError || !pendingRow) {
    throw new Error(pendingError?.message ?? "Could not start generating the Idea Book.");
  }

  return { pendingRow, profile, characterProfile, locale, bookTitle };
}

// The actual slow work — a Claude call (including its own live web-search
// research pass), a PDF render, and a storage upload, easily 60-100+
// seconds combined. Always called from inside an `after()` callback (see
// the two getOrCreate* functions below), never awaited directly in a
// request handler: a single request blocking that long risks the
// serverless function's own timeout on top of leaving the buyer staring at
// a blank tab with zero feedback the whole time — see GeneratingScreen.tsx
// for the polling UI this setup makes possible instead.
async function finishPlanGeneration(
  supabase: ServiceRoleClient,
  ctx: PlanGenerationContext
): Promise<{ plan: WindowPlanRow; generated: GeneratedIdeaBook; pdfBytes: Uint8Array }> {
  const { pendingRow, profile, characterProfile, locale, bookTitle } = ctx;

  try {
    const generated = await generateIdeaBook(profile, locale, characterProfile);
    const pdfBytes = await renderIdeaBookPdf(generated, bookTitle, locale);
    const pdfPath = `${pendingRow.session_id}/idea-book.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("window-plans")
      .upload(pdfPath, Buffer.from(pdfBytes), {
        contentType: "application/pdf",
        upsert: true,
      });

    // Compliance/security fix (Fase 3, PDF-downloadbeveiliging): the
    // `window-plans` bucket is private as of 0011_private_pdf_storage.sql,
    // so a public URL would just 400. `window_plans.pdf_url` now holds the
    // bare storage object path instead — never a directly-fetchable URL —
    // and getSignedPdfUrl() below turns it into a short-lived signed URL
    // on demand, freshly minted on every /plan render (see plan/page.tsx).
    const pdfUrl = uploadError ? null : pdfPath;

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
        generated_at: new Date().toISOString(),
        pdf_version: PDF_VERSION,
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
      "We haven't confirmed your payment yet. If you just completed checkout, refresh in a moment.",
      "unpaid"
    );
  }

  const sessionId = checkoutSession.metadata?.session_id;

  if (!sessionId) {
    throw new Error("This checkout session is missing expected metadata.");
  }

  const supabase = createServiceRoleClient();

  // The order this plan belongs to — looked up by the Stripe Checkout
  // Session id every payments row is keyed on (see checkout/actions.ts).
  // Best-effort: a missing order shouldn't block generation, since the
  // payment itself has already been confirmed via Stripe above; it just
  // means window_plans.payment_id stays null for that row.
  const { data: paymentRow } = await supabase
    .from("payments")
    .select("id, order_number, amount, currency, created_at")
    .eq("stripe_payment_id", checkoutSessionId)
    .maybeSingle();

  const existingPlan = resolveExistingPlan(await findExistingPlan(supabase, sessionId));
  if (existingPlan === "generating") {
    throw new PlanNotReadyError(
      "We're still putting your Idea Book together — refresh in a moment.",
      "generating"
    );
  }
  if (existingPlan) return existingPlan;

  // The "pending" insert is fast and awaited here, so a concurrent request
  // (or this same buyer hitting refresh) reliably sees it and waits rather
  // than starting a second generation. The slow part — Claude, the PDF
  // render, the upload, and the order-confirmation e-mail — runs in
  // `after()`, i.e. *after* this function throws PlanNotReadyError below
  // and the page has already responded with GeneratingScreen. See
  // startPlanGeneration/finishPlanGeneration's own comments for why this
  // can't just be awaited inline.
  const ctx = await startPlanGeneration(supabase, sessionId, paymentRow?.id ?? null);

  after(async () => {
    try {
      const { plan, generated, pdfBytes } = await finishPlanGeneration(supabase, ctx);
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

        // A gift redirects only where the Idea Book itself is delivered —
        // the buyer still pays with their own card and gets Stripe's own
        // receipt at their own email regardless, and stays the account on
        // file above.
        const giftRecipientEmail = checkoutSession.metadata?.gift_recipient_email;
        const deliveryEmail = giftRecipientEmail || customerEmail;

        // Captured once here rather than re-derived from Stripe later —
        // the scheduled first-action reminder (see
        // api/cron/first-action-reminder) needs a delivery address days
        // after this checkout session is created, and re-fetching every
        // plan's Stripe session on a cron run would be both slower and a
        // needless dependency on Stripe staying reachable.
        await supabase
          .from("window_plans")
          .update({ recipient_email: deliveryEmail })
          .eq("id", plan.id);

        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
        try {
          // A confirmation e-mail that can't state what was actually
          // ordered is worse than none — if the order record is somehow
          // missing, treat it the same as any other delivery failure
          // (caught below) rather than sending a confirmation with blank
          // order details.
          if (!paymentRow) {
            throw new Error(
              `No payments row found for checkout session ${checkoutSessionId}; cannot send an order confirmation.`
            );
          }

          await sendIdeaBookEmail({
            to: deliveryEmail,
            title: plan.title,
            book: generated,
            pdfBytes,
            planUrl: `${siteUrl}/plan?checkout_session_id=${checkoutSessionId}`,
            locale: plan.language as "nl" | "en",
            siteUrl,
            order: {
              orderNumber: paymentRow.order_number ?? "—",
              amountCents: paymentRow.amount,
              currency: paymentRow.currency,
              orderDate: new Date(paymentRow.created_at),
              termsVersion: LEGAL_VERSIONS.terms,
            },
          });
          emailDelivered = true;
          await supabase
            .from("window_plans")
            .update({ email_sent_at: new Date().toISOString() })
            .eq("id", plan.id);
        } catch (err) {
          // Best-effort — the plan is already saved and viewable on this
          // page even if Resend is unreachable. Recorded as not-delivered
          // below so the admin audit log reflects reality. email_sent_at
          // stays null, which an admin order-detail view can use to tell
          // a genuinely undelivered order confirmation apart from a
          // delivered one.
          console.error("Failed to send order confirmation e-mail:", err);
        }
      }

      await recordAuditLogEntry(supabase, {
        profile: ctx.profile,
        generated,
        emailDelivered,
        characterProfile: ctx.characterProfile,
      });
    } catch (err) {
      // finishPlanGeneration already marks the row "failed" on its own
      // error path — this is just so a background failure isn't silently
      // swallowed without at least a server log.
      console.error("Background Idea Book generation failed:", err);
    }
  });

  throw new PlanNotReadyError(
    "We're putting your Idea Book together — this usually takes under a minute.",
    "generating"
  );
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

  const ctx = await startPlanGeneration(supabase, sessionId, null);

  after(async () => {
    let emailDelivered = false;
    try {
      const { plan, generated, pdfBytes } = await finishPlanGeneration(supabase, ctx);

      // Explicit request: a test-mode generation has no real buyer or
      // Stripe session to pull a delivery address from, but sending the
      // exact same order-confirmation e-mail to a fixed personal inbox
      // lets you see precisely what a real buyer's inbox looks like
      // without a real payment. `order` below is a clearly-labeled
      // placeholder ("TEST"), not a real order — there is no payments row
      // to attach this generation to (see startPlanGeneration's `null`
      // paymentId above).
      try {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
        await sendIdeaBookEmail({
          to: TEST_MODE_EMAIL_RECIPIENT,
          title: plan.title,
          book: generated,
          pdfBytes,
          planUrl: `${siteUrl}/plan?test_session_id=${sessionId}`,
          locale: plan.language as "nl" | "en",
          siteUrl,
          order: {
            orderNumber: "TEST",
            amountCents: WINDOW_PLAN_PRICE.amountCents,
            currency: WINDOW_PLAN_PRICE.currency,
            orderDate: new Date(),
            termsVersion: LEGAL_VERSIONS.terms,
          },
        });
        emailDelivered = true;
      } catch (err) {
        console.error("Failed to send test-mode confirmation e-mail:", err);
      }

      // No real payment, so no Stripe-collected email/order either — still
      // logged (with the actual emailDelivered outcome above) so the audit
      // trail reflects every generation, not only paid ones.
      await recordAuditLogEntry(supabase, {
        profile: ctx.profile,
        generated,
        emailDelivered,
        characterProfile: ctx.characterProfile,
      });
    } catch (err) {
      console.error("Background test Idea Book generation failed:", err);
    }
  });

  throw new PlanNotReadyError(
    "We're putting your Idea Book together — this usually takes under a minute.",
    "generating"
  );
}
