// A place as it is shown to a person. The PDOK display name repeats the municipality when the
// place carries the same name ("Laren, Laren, Noord-Holland"); only the display drops the
// repeats. What is stored (and what /api/location-suggest returns) stays as it is, and so does
// the research key (placeKey in claude/localResearch.ts, which only uses the first part).

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** "Laren, Laren, Noord-Holland" -> "Laren, Noord-Holland"; "Utrecht, Utrecht" -> "Utrecht". */
export function displayPlace(raw: string | null | undefined): string {
  const parts = (raw ?? "")
    .split(",")
    .map((p) => p.trim().replace(/\s+/g, " "))
    .filter(Boolean);
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const part of parts) {
    const key = norm(part);
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(part);
  }
  return kept.join(", ");
}
