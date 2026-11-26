// Who may see a finished book's PDF (fix round "plan links"): the same two keys as the /plan page. A paid (or free-test) checkout session id, or,
// for the owner logged in at /admin, a session id. Read only: it never starts a generation. The PDF is always served through our own route
// (/plan/pdf); a storage address is never given to the browser.
//
// Server-only.

import { getStripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { isFreeOrderId } from "@/lib/freeTest";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { PDF_BUCKET, PDF_VERSION, pdfPathFor, renderStoredPlanPdf, type StoredPlanBook } from "@/lib/planPdf";
import type { StoredIntake } from "@/app/intake/actions";

type Client = ReturnType<typeof createServiceRoleClient>;

export interface PlanKey {
  checkoutSessionId: string | null;
  testSessionId: string | null;
}

export type ViewablePlan = StoredPlanBook & { pdf_url: string | null; status: string };

export function planKeyFrom(get: (name: string) => string | null | undefined): PlanKey {
  return { checkoutSessionId: get("checkout_session_id") || null, testSessionId: get("test_session_id") || null };
}

/** The query string that carries the key on (checkout_session_id or test_session_id), with any extra parameters. */
export function planQuery(key: PlanKey, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams();
  if (key.checkoutSessionId) params.set("checkout_session_id", key.checkoutSessionId);
  if (key.testSessionId) params.set("test_session_id", key.testSessionId);
  for (const [name, value] of Object.entries(extra)) params.set(name, value);
  return params.toString();
}

async function sessionOf(supabase: Client, key: PlanKey): Promise<string | null> {
  if (key.testSessionId) return (await isAdminAuthenticated()) ? key.testSessionId : null;
  const id = key.checkoutSessionId;
  if (!id) return null;
  if (isFreeOrderId(id)) {
    const { data } = await supabase.from("payments").select("session_id, amount").eq("stripe_payment_id", id).maybeSingle();
    return data && data.amount === 0 ? data.session_id : null;
  }
  const checkout = await getStripe().checkout.sessions.retrieve(id);
  return checkout.payment_status === "paid" ? (checkout.metadata?.session_id ?? null) : null;
}

/** The finished book this key opens, or null (no such key, not paid, or not ready). Never throws: a failure is logged and is "no book". */
export async function findViewablePlan(key: PlanKey, supabase: Client = createServiceRoleClient()): Promise<ViewablePlan | null> {
  try {
    const sessionId = await sessionOf(supabase, key);
    if (!sessionId) return null;
    const { data, error } = await supabase.from("window_plans").select("*").eq("session_id", sessionId).eq("status", "ready").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as unknown as ViewablePlan) ?? null;
  } catch (err) {
    console.error("WindowInto: could not look up a book for its PDF", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Renders the stored plan again and stores it. Null (and a log line with the plan id) when that is not possible. */
export async function rebuildPlanPdf(plan: ViewablePlan, supabase: Client = createServiceRoleClient()): Promise<Uint8Array | null> {
  try {
    const { data: intake } = await supabase.from("intake_answers").select("raw_json").eq("session_id", plan.session_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!intake) throw new Error("the intake answers of this plan are gone");
    const bytes = await renderStoredPlanPdf(plan, intake.raw_json as unknown as StoredIntake);
    if (!bytes) throw new Error("the stored plan holds no complete book");
    const path = pdfPathFor(plan.session_id);
    const { error } = await supabase.storage.from(PDF_BUCKET).upload(path, Buffer.from(bytes), { contentType: "application/pdf", upsert: true });
    // The reader gets the new file even when storing it fails; the next request makes it again.
    if (error) console.error(`WindowInto: the rebuilt PDF of plan ${plan.id} could not be stored: ${error.message}`);
    else await supabase.from("window_plans").update({ pdf_url: path, pdf_version: PDF_VERSION }).eq("id", plan.id);
    return bytes;
  } catch (err) {
    console.error(`WindowInto: the PDF of plan ${plan.id} could not be rebuilt:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/** The PDF of a plan: the stored file, or a freshly rendered one when it is missing (or when a new one is asked for). */
export async function planPdfBytes(plan: ViewablePlan, rebuild = false, supabase: Client = createServiceRoleClient()): Promise<Uint8Array | null> {
  if (!rebuild && plan.pdf_url) {
    const { data, error } = await supabase.storage.from(PDF_BUCKET).download(plan.pdf_url);
    if (data) return new Uint8Array(await data.arrayBuffer());
    console.error(`WindowInto: the stored PDF of plan ${plan.id} could not be read (${error?.message ?? "no data"}), making it again`);
  }
  return rebuildPlanPdf(plan, supabase);
}
