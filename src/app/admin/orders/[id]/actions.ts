"use server";

import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { MAX_COMPENSATIONS_PER_ORDER, issueCompensation, supabaseStore } from "@/lib/discountCode";
import { sendCompensationEmail } from "@/lib/email/compensation";
import { siteUrl as getSiteUrl } from "@/lib/siteUrl";

// Sends the buyer of an order an extra one-time discount code as compensation (Step 235: a place in the book was wrong). Checked here again, as everything in
// the admin: the login, that the owner ticked the box, that the order is paid and has an address, and the limit per order. The address is read from the order, never taken from the
// form. Whatever happens, the answer is a redirect back to the order with a status word the page turns into a sentence.
export async function sendCompensationAction(formData: FormData): Promise<void> {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const orderId = String(formData.get("orderId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) redirect("/admin/orders");
  const back = (status: string): never => redirect(`/admin/orders/${orderId}?compensation=${status}`);

  if (formData.get("confirm") !== "on") return back("confirm");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300);

  const supabase = createServiceRoleClient();
  const { data: order } = await supabase.from("payments").select("id, status, order_number").eq("id", orderId).maybeSingle();
  if (!order || order.status !== "succeeded") return back("notpaid");
  const { data: plan } = await supabase.from("window_plans").select("recipient_email, language").eq("payment_id", orderId).maybeSingle();
  if (!plan?.recipient_email) return back("noemail");

  // The count also tells whether migration 0028 has been run: without its columns the query fails.
  const { count, error: countError } = await supabase.from("discount_codes").select("id", { count: "exact", head: true }).eq("issued_for_payment_id", orderId).eq("kind", "compensation");
  if (countError) return back("migration");
  if ((count ?? 0) >= MAX_COMPENSATIONS_PER_ORDER) return back("max");

  const made = await issueCompensation(supabaseStore(supabase), orderId, reason);
  if (!made.ok) return back(made.error);

  try {
    await sendCompensationEmail({
      to: plan.recipient_email,
      locale: plan.language === "en" ? "en" : "nl",
      code: made.code.code,
      amountCents: made.code.amountCents,
      expiresAt: made.code.expiresAt,
      orderNumber: order.order_number,
      siteUrl: getSiteUrl(),
    });
  } catch (err) {
    console.error("WINDOW: the compensation mail could not be sent:", err instanceof Error ? err.message : err);
    return back("mailfailed");
  }
  return back("sent");
}
