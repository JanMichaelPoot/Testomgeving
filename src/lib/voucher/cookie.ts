import { cookies } from "next/headers";
import { normalizeCode } from "@/lib/voucher/code";

// The voucher a recipient is about to redeem, kept from the moment they press "Open je venster" until the intake is done. A first-party
// cookie that the visitor asked for by that button (the code in it is theirs to use), readable by the server only. It holds the code and
// nothing else.

export const VOUCHER_COOKIE = "window_voucher";
const TWO_WEEKS = 60 * 60 * 24 * 14;

export async function getVoucherCookie(): Promise<string | null> {
  return normalizeCode((await cookies()).get(VOUCHER_COOKIE)?.value);
}

export async function setVoucherCookie(code: string): Promise<void> {
  (await cookies()).set(VOUCHER_COOKIE, code, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: TWO_WEEKS, path: "/" });
}

export async function clearVoucherCookie(): Promise<void> {
  (await cookies()).delete(VOUCHER_COOKIE);
}
