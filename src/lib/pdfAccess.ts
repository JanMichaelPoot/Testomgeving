import { createServiceRoleClient } from "@/lib/supabase/server";

// Long enough that a buyer who leaves the /plan tab open for a while can
// still click "download" without the link going stale, short enough that a
// signed URL glimpsed once (browser history, a proxy log) isn't useful for
// long. Re-minted fresh on every page render, so there's no reason to make
// this any longer than "comfortably outlives one sitting at the page".
const PDF_SIGNED_URL_TTL_SECONDS = 60 * 60;

// PDF-downloadbeveiliging (Fase 3): window_plans.pdf_url stores the bare
// storage object path now that the `window-plans` bucket is private (see
// supabase/migrations/0011_private_pdf_storage.sql), not a fetchable URL.
// This turns that path into a short-lived signed URL, called from
// src/app/plan/page.tsx on every render — after that page has already
// verified the caller holds a paid Stripe checkout_session_id (or an admin
// test_session_id) for this plan, the same authorization the emailed
// /plan link has always relied on. No dedicated download route needed:
// this reuses that existing, already-verified gate.
export async function getSignedPdfUrl(pdfPath: string | null): Promise<string | null> {
  if (!pdfPath) return null;
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.storage
    .from("window-plans")
    .createSignedUrl(pdfPath, PDF_SIGNED_URL_TTL_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}
