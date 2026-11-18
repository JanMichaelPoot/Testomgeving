// How close an activity is to a theme tile (docs/voorstel-associatie-engine.md). One definition, used by page 2 (twoPages.ts), the selection
// engine (engine/select.ts, E4) and the book's "omdat je ... en ... koos" line (associations.ts, E5), so a combination means the same everywhere.

/** A theme as the engine and page 2 see it: its id and the tag weights of its tile. */
export interface ThemeProfile {
  id: string;
  weights: Record<string, number>;
}

/** Two themes count as far apart when the cosine of their tag weights is below this (most of the 435 pairs share no tag at all: median 0). */
export const THEME_FAR_COS = 0.15;

/** The closeness of an activity's tags to a theme: summed weights, mood-only (generic) tags count half, divided by the root of the tag count. */
export function themeRaw(weights: Readonly<Record<string, number>>, tags: readonly string[], generic: ReadonlySet<string>): number {
  return tags.reduce((sum, tag) => sum + (weights[tag] ?? 0) * (generic.has(tag) ? 0.5 : 1), 0) / Math.sqrt(Math.max(1, tags.length));
}

/** The closeness as a share of the best activity of the whole set (0..1): "belongs to this theme" means at least half of that. */
export function themeRelative(weights: Readonly<Record<string, number>>, activities: readonly { tags: readonly string[] }[], generic: ReadonlySet<string>): (tags: readonly string[]) => number {
  const best = Math.max(0.0001, ...activities.map((a) => themeRaw(weights, a.tags, generic)));
  return (tags) => themeRaw(weights, tags, generic) / best;
}

/** "natuur", "ambacht en handwerk": a theme's label without its "Iets met" / "Something with", for use inside a sentence (client-safe). */
export function themeNameInSentence(label: string): string {
  const name = label.replace(/^(Iets met |Something with )/, "");
  return name.charAt(0).toLowerCase() + name.slice(1);
}

export function themeCosine(a: Readonly<Record<string, number>>, b: Readonly<Record<string, number>>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const k of Object.keys(a)) {
    na += a[k] ** 2;
    dot += a[k] * (b[k] ?? 0);
  }
  for (const k of Object.keys(b)) nb += b[k] ** 2;
  return na > 0 && nb > 0 ? dot / Math.sqrt(na * nb) : 0;
}
