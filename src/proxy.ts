import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// A per-request nonce for the CSP's script-src, following Next.js's own
// documented recipe: https://nextjs.org/docs/app/guides/content-security-policy
// A static `'unsafe-inline'` (the simpler alternative) would defeat the
// point of a CSP, since it's exactly what lets an injected <script> run —
// but Next.js's App Router injects its own small inline scripts for
// hydration, which a bare `script-src 'self'` blocks outright (confirmed
// live: it broke intake page hydration entirely). Setting a nonce here and
// echoing it back on the response is enough — Next automatically applies
// the same nonce to its own inline scripts once it sees one on the CSP
// header, no manual <Script nonce=...> wiring needed anywhere else.
// Two specific, fixed-content inline scripts Next.js 16's App Router
// emits very early in the document (before its own nonce-aware streaming
// kicks in) — confirmed by inspecting the live DOM: their content, and
// therefore these hashes, is stable across reloads and unrelated to page
// content. A CSP hash-source only trusts this *exact* byte-for-byte
// script, so this is not a broad 'unsafe-inline' escape hatch.
const FRAMEWORK_SCRIPT_HASHES = [
  "'sha256-OBTN3RiyCV4Bq7dFqZ5a2pAXjnCcCYeTJMO2I/LYKeo='",
  "'sha256-aZcAO72iEn2WWCPSnlOW3mdvN3STDw3MnL5vMoxnGQc='",
];

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${FRAMEWORK_SCRIPT_HASHES.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self' https://eu.i.posthog.com https://eu-assets.i.posthog.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  // updateSession builds its own NextResponse.next(...) internally to
  // carry Supabase's refreshed session cookies — that response object's
  // Set-Cookie entries are what matter from it. The request-continuation
  // itself is rebuilt below (with the nonce header attached) so Next's own
  // page rendering actually sees x-nonce and nonces its internal hydration
  // scripts with it.
  const sessionResponse = await updateSession(request);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  sessionResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
