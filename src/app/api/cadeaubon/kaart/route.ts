import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { findVoucherByCode } from "@/lib/voucher/store";
import { cardPdfFor } from "@/lib/voucher/activate";

// The printable gift card as a PDF (A5 by default, ?format=a6 for half the size). The code in the address is the proof of holding the
// voucher, like the link on the card itself, so it is the only thing asked. A voucher that is not paid (pending) or was refunded (void) has no card.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const supabase = createServiceRoleClient();
  const voucher = await findVoucherByCode(supabase, url.searchParams.get("code"));
  if (!voucher || voucher.status === "pending" || voucher.status === "void" || !voucher.expires_at) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const format = url.searchParams.get("format") === "a6" ? "a6" : "a5";
  const pdf = await cardPdfFor(voucher, format);
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="WindowInto-${voucher.locale === "nl" ? "cadeaubon" : "gift-voucher"}-${format}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
