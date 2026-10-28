// One way to compare activity names, shared by the library validator (aliases may not collide with another
// activity) and the knowledge import (src/lib/knowledge): lower case, accents and punctuation gone, one space.
// Equality of these normalised names is the only thing that may merge two records automatically; anything
// looser (shared words) is a candidate for a human to look at, never a merge.

export function normalizeName(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
