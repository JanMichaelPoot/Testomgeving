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

/** Replaces every "{name}" in `text` with `name`, capitalised where a sentence begins. */
export function fillName(text: string, name: string): string {
  return text.replace(/\{name\}/g, (match, offset: number) => (atSentenceStart(text, offset) ? capitalize(name) : name));
}

/** The same sentence-start rule for a template engine that fills several keys: only "name" is capitalised. */
export function fillValue(text: string, key: string, value: string, offset: number): string {
  return key === "name" && atSentenceStart(text, offset) ? capitalize(value) : value;
}
