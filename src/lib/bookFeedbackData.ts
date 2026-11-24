import type { SupabaseClient } from "@supabase/supabase-js";

// What the book page reads for the rating block (Step 241). Both reads are for the owner of the book only (the page calls them when canInteract) and both
// give "nothing" instead of failing: the page must open whether or not migrations 0029 (friend codes) and 0031 (book_feedback) have been run.

export interface StoredBookFeedback {
  rating: number;
  comment: string;
  quoteConsent: boolean;
}

export async function loadBookFeedback(supabase: SupabaseClient, planId: string): Promise<StoredBookFeedback | null> {
  try {
    const { data, error } = await supabase.from("book_feedback").select("rating, comment, quote_consent").eq("plan_id", planId).maybeSingle();
    if (error || !data) return null;
    const row = data as { rating: number; comment: string | null; quote_consent: boolean | null };
    return { rating: row.rating, comment: row.comment ?? "", quoteConsent: row.quote_consent === true };
  } catch {
    return null;
  }
}

export interface FriendCodeToShare {
  code: string;
  amountCents: number;
  expiresAt: Date;
}

/**
 * The friend codes of this buyer's paid order that a friend can still use (not used up, not expired), oldest first. The buyer has them in the delivery mail already; showing
 * them next to the rating makes passing one on one tap away at the moment the buyer is happiest. Empty for an order without codes (a free test order, or before migration 0029).
 */
export async function loadFriendCodesToShare(supabase: SupabaseClient, sessionId: string, now: Date = new Date()): Promise<FriendCodeToShare[]> {
  try {
    const { data: payment } = await supabase.from("payments").select("id").eq("session_id", sessionId).eq("status", "succeeded").order("created_at", { ascending: false }).limit(1).maybeSingle();
    const paymentId = (payment as { id?: string } | null)?.id;
    if (!paymentId) return [];
    const { data, error } = await supabase
      .from("discount_codes")
      .select("code, amount_cents, expires_at, redeemed_at")
      .eq("issued_for_payment_id", paymentId)
      .eq("kind", "friend")
      .is("redeemed_at", null)
      .gt("expires_at", now.toISOString())
      .order("created_at", { ascending: true });
    if (error) return [];
    return (data ?? []).map((r) => ({ code: (r as { code: string }).code, amountCents: (r as { amount_cents: number }).amount_cents, expiresAt: new Date((r as { expires_at: string }).expires_at) }));
  } catch {
    return [];
  }
}
