// Next.js's redirect() throws a special error to signal navigation; a
// plain try/catch around a server action call (invoked directly, not via
// a <form action>) intercepts that throw before Next's own router gets a
// chance to act on it, which both swallows the navigation and surfaces
// "NEXT_REDIRECT" as if it were a real error. Re-throwing it here lets it
// continue up to Next's handling instead.
//
// isRedirectError isn't part of the public next/navigation API in this
// version, so this checks the documented digest format directly
// (`NEXT_REDIRECT;<type>;<url>;<statusCode>;`) rather than importing from
// next/dist/*.
export function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}
