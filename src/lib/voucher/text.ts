// What a giver may type on the voucher form, cleaned up. Pure and shared by the server action, the card and the e-mail.

export const NAME_MAX = 40;
export const MESSAGE_MAX = 280;

// Control characters, zero-width characters and line separators have no place in a name or a message that is printed on a card.
// Built from a string so the source file itself holds no invisible characters.
const INVISIBLE = new RegExp("[\u0000-\u001f\u007f\u200b-\u200f\u2028\u2029\u2060\ufeff]", "g");

/** One line of text: invisible characters out, whitespace collapsed, cut to `max` characters (never in the middle of a character). */
export function cleanLine(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return [...value.replace(INVISIBLE, " ").replace(/\s+/g, " ").trim()].slice(0, max).join("").trim();
}

/** A short message: line breaks kept (as single newlines), everything else as `cleanLine`. */
export function cleanMessage(value: unknown, max: number = MESSAGE_MAX): string {
  if (typeof value !== "string") return "";
  const lines = value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(INVISIBLE, " ").replace(/[ \t]+/g, " ").trim())
    .filter((line, i, all) => line || (i > 0 && all[i - 1]));
  return [...lines.join("\n").trim()].slice(0, max).join("").trim();
}

export const cleanName = (value: unknown) => cleanLine(value, NAME_MAX);

export function isValidEmail(value: string | null | undefined): value is string {
  return !!value && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
