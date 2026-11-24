// What a friend code needs outside the database (Step 238): the link that carries it, the WhatsApp message that sends it, and reading it back from a link in the browser.
// Pure and safe for the browser: it must not import src/lib/discountCode.ts (that file uses node:crypto).

/** Where the code waits while a friend walks through the intake, until the order block picks it up. sessionStorage: it goes when the tab does. */
export const FRIEND_CODE_STORAGE_KEY = "window-friend-code";

// The same signs as generateCode in src/lib/discountCode.ts (no 0, O, 1 or I); a test keeps the two in step.
const CODE = /^WI-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/;

/** The code in a link's ?code=, as it is stored ("WI-ABCD-EFGH"), or null when it cannot be one. Typed loosely is fine: "wi abcd efgh", "WIABCDEFGH". */
export function friendCodeFromQuery(raw: string | null | undefined): string | null {
  const flat = (raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (flat.length !== 10) return null;
  const code = `${flat.slice(0, 2)}-${flat.slice(2, 6)}-${flat.slice(6)}`;
  return CODE.test(code) ? code : null;
}

/** The link a friend opens: the start of the intake in the language of the mail, with the code and where the visit came from (for the measurements). */
export function friendLink(siteUrl: string, locale: "nl" | "en", code: string): string {
  return `${siteUrl}/intake?lang=${locale}&code=${encodeURIComponent(code)}&utm_source=friend_code&utm_medium=email`;
}

/** WhatsApp with the message ready to send, to whoever the buyer picks. The message and the link are one text. */
export function friendWhatsAppUrl(message: string, link: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${message} ${link}`)}`;
}
