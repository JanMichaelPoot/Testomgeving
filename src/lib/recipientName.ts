// Filling "{name}" in the gift copy. With a first name the text reads "Wat zou Anna aantrekken?"; without one the stand-in is a plain
// noun ("de ontvanger" / "the recipient"), never a pronoun placeholder like "diegene" or "them". A name at the start of a sentence gets a
// capital ("De ontvanger zoekt rust."). Pure, so the wizard, the profile portrait and the tests all use the same rule.

/** True when `index` is the first letter of a sentence in `text`. */
function atSentenceStart(text: string, index: number): boolean {
  return index === 0 || /[.!?…]\s+$/.test(text.slice(0, index));
}

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

/** The separator between the variants of one text: "with a name ‖ without a name ‖ for a group" (the last part is optional). */
export const VARIANT_SEPARATOR = "‖";

/**
 * Picks the variant of a text that has them. With a first name: the first part. Without one: the second, which never names the person
 * ("Welke beelden zouden aanspreken?"), and for a group the third ("jullie"), falling back to the second. A text without the separator is
 * returned as it is.
 */
export function resolveVariant(text: string, who: { name?: string; group?: boolean } = {}): string {
  if (!text.includes(VARIANT_SEPARATOR)) return text;
  const parts = text.split(VARIANT_SEPARATOR).map((p) => p.trim());
  if ((who.name ?? "").trim()) return parts[0];
  return who.group && parts[2] ? parts[2] : parts[1] ?? parts[0];
}

/**
 * Replaces every "{name}" in `text` with `name`, capitalised where a sentence begins. A text with variants first resolves to the one
 * that fits: pass the name as typed (empty when there is none) and, for a text without variants, the plain noun to use instead.
 */
export function fillName(text: string, name: string, opts: { group?: boolean; fallback?: string } = {}): string {
  const resolved = resolveVariant(text, { name, group: opts.group });
  const shown = name.trim() || opts.fallback || name;
  return resolved.replace(/\{name\}/g, (match, offset: number) => (atSentenceStart(resolved, offset) ? capitalize(shown) : shown));
}

/** The same sentence-start rule for a template engine that fills several keys: only "name" is capitalised. */
export function fillValue(text: string, key: string, value: string, offset: number): string {
  return key === "name" && atSentenceStart(text, offset) ? capitalize(value) : value;
}
