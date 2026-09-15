import { createHash } from "crypto";
import { cookies } from "next/headers";

// A single shared admin password (ADMIN_PASSWORD), not a per-person login —
// this internal /admin area is a one-owner audit panel, not a multi-user
// account system, so a full Supabase Auth setup would be more machinery
// than the actual need. The cookie stores a hash of the password rather
// than the password itself, so it never appears in plaintext in the
// browser, logs, or a shared machine's cookie jar.
const ADMIN_COOKIE_NAME = "window_admin_session";

function adminPassword(): string {
  return (process.env.ADMIN_PASSWORD ?? "").trim();
}

function expectedToken(): string {
  return createHash("sha256").update(adminPassword()).digest("hex");
}

export function checkAdminPassword(candidate: string): boolean {
  const expected = adminPassword();
  // No password configured means the admin area is unreachable rather
  // than open — never fall back to an "empty password" login.
  return expected.length > 0 && candidate === expected;
}

export async function isAdminAuthenticated(): Promise<boolean> {
  if (!adminPassword()) return false;
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return token === expectedToken();
}

export async function setAdminSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, expectedToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8, // 8 hours
    // Not scoped to /admin: the .xlsx export lives at
    // /api/admin/audit-log/export (route handlers can't be nested under a
    // page path that also needs its own layout gate), so the cookie needs
    // to reach both.
    path: "/",
  });
}

export async function clearAdminSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
}
