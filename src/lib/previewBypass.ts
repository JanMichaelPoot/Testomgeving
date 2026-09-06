// Lets the site owner skip payment on a live/production deployment via a
// secret link (?preview=<TEST_PREVIEW_SECRET>), without exposing that to
// regular visitors — the payment gate must stay real for anyone else. Also
// always allowed outside production (local dev, previews) for day-to-day
// testing. Checked server-side wherever the bypass has an effect (not just
// to decide whether to show a button), since a hidden UI element is not a
// security boundary on its own.
export function isPreviewBypassAllowed(token: string | undefined): boolean {
  if (process.env.NODE_ENV !== "production") return true;

  const secret = process.env.TEST_PREVIEW_SECRET;
  return Boolean(secret && token && token === secret);
}
