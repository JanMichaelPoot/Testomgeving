// Client-safe logic of the image intake ("Het venster"): from the association images a
// person chose to a tag profile, the four axes, the derived dials and the words of the
// "this is what we read in your images" reflection. Pure and deterministic, no AI and no
// JSON import, so the wizard can run it in the browser and the server can run exactly the
// same code. The data lives in associations.json (see associations.ts).

export const ASSOCIATION_ROUNDS = ["places", "moments", "senses"] as const;
export type AssociationRound = (typeof ASSOCIATION_ROUNDS)[number];

/** Social (alone -1 .. together 1), energy (calm -1 .. active 1), setting (inside -1 .. outside 1), novelty (familiar -1 .. new 1). */
export interface AssociationAxes {
  social: number;
  energy: number;
  setting: number;
  novelty: number;
}

/** What the wizard and the scoring need of one card. */
export interface AssociationCardData {
  id: string;
  round: AssociationRound;
  tagWeights: Record<string, number>;
  axes: AssociationAxes;
}

/** Slim card for the browser: one language, no art direction. */
export interface AssociationCard extends AssociationCardData {
  label: string;
  image: string;
}

export interface AssociationLibrary {
  cards: AssociationCard[];
  /** Tag id -> label in the visitor's language. */
  tagLabels: Record<string, string>;
  /** Tags offered as corrections under "Niet helemaal": the ones that can be read from images. */
  correctionTags: string[];
}

/** Weight of a tag the person added themselves under "Niet helemaal". */
export const CORRECTION_WEIGHT = 2.5;

/** Sum of the tag weights of the chosen cards, plus any corrections. */
export function tagProfile(
  cards: readonly AssociationCardData[],
  chosen: readonly string[],
  corrections: readonly string[] = [],
): Record<string, number> {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const profile: Record<string, number> = {};
  for (const id of chosen) {
    const card = byId.get(id);
    if (!card) continue;
    for (const [tag, w] of Object.entries(card.tagWeights)) profile[tag] = (profile[tag] ?? 0) + w;
  }
  for (const tag of corrections) profile[tag] = (profile[tag] ?? 0) + CORRECTION_WEIGHT;
  return profile;
}

/** Average of the axes of the chosen cards; all zero (neutral) when nothing was chosen. */
export function averageAxes(cards: readonly AssociationCardData[], chosen: readonly string[]): AssociationAxes {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const picked = chosen.map((id) => byId.get(id)).filter((c): c is AssociationCardData => !!c);
  const sum: AssociationAxes = { social: 0, energy: 0, setting: 0, novelty: 0 };
  for (const c of picked) {
    sum.social += c.axes.social;
    sum.energy += c.axes.energy;
    sum.setting += c.axes.setting;
    sum.novelty += c.axes.novelty;
  }
  const n = picked.length || 1;
  return { social: sum.social / n, energy: sum.energy / n, setting: sum.setting / n, novelty: sum.novelty / n };
}

/** The tags that weigh most, strongest first; ties broken by id so the result is stable. */
export function topTags(profile: Record<string, number>, n: number): string[] {
  return Object.entries(profile)
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([t]) => t);
}

/**
 * The two dials the image intake no longer asks for, read from the images instead
 * (vraag-audit 4 Oct 2026). Both steer the engine hard, so they must not stay on a default:
 *   practicalToWild from the novelty axis (grounded .. wild)
 *   effort          from the energy axis   (minimal .. committed)
 * Nothing chosen gives the neutral middle ("either", "some").
 */
export function deriveDials(axes: AssociationAxes, anyChosen: boolean): { practicalToWild: string; effort: string } {
  if (!anyChosen) return { practicalToWild: "either", effort: "some" };
  const n = axes.novelty;
  const practicalToWild = n < -0.45 ? "grounded" : n < -0.15 ? "practical" : n < 0.2 ? "either" : n < 0.5 ? "unexpected" : "wild";
  const e = axes.energy;
  const effort = e < -0.4 ? "minimal" : e > 0.35 ? "committed" : "some";
  return { practicalToWild, effort };
}

/** Which way each axis leans clearly enough to say out loud (|value| >= 0.35). */
export function axisLeanings(axes: AssociationAxes): { social?: "alone" | "together"; energy?: "calm" | "active"; setting?: "inside" | "outside" } {
  const lean = (v: number) => (v <= -0.35 ? -1 : v >= 0.35 ? 1 : 0);
  return {
    ...(lean(axes.social) !== 0 ? { social: lean(axes.social) < 0 ? "alone" : "together" } : {}),
    ...(lean(axes.energy) !== 0 ? { energy: lean(axes.energy) < 0 ? "calm" : "active" } : {}),
    ...(lean(axes.setting) !== 0 ? { setting: lean(axes.setting) < 0 ? "inside" : "outside" } : {}),
  };
}

/**
 * The reflection shown when the window is full: "Dit lezen we in je beelden: {words}{tail}.
 * Klopt dat?". Fixed sentence parts only, so it can never say something strange.
 */
export function reflectionSentence(
  library: Pick<AssociationLibrary, "cards" | "tagLabels">,
  chosen: readonly string[],
  corrections: readonly string[],
  copy: {
    prefix: string;
    and: string;
    nothing: string;
    leanings: { alone: string; together: string; calm: string; active: string; inside: string; outside: string };
  },
): { sentence: string; words: string[] } {
  const profile = tagProfile(library.cards, chosen, corrections);
  // What they added under "Niet helemaal" comes first: it is what they just told us.
  const ordered = [...corrections, ...topTags(profile, 6).filter((t) => !corrections.includes(t))].slice(0, 3);
  const words = ordered.map((t) => (library.tagLabels[t] ?? t).toLowerCase());
  if (words.length === 0) return { sentence: copy.nothing, words: [] };
  const list = words.length === 1 ? words[0] : `${words.slice(0, -1).join(", ")} ${copy.and} ${words[words.length - 1]}`;
  const lean = axisLeanings(averageAxes(library.cards, chosen));
  const tail = [lean.setting && copy.leanings[lean.setting], lean.energy && copy.leanings[lean.energy], lean.social && copy.leanings[lean.social]]
    .filter((x): x is string => !!x)
    .slice(0, 2);
  return { sentence: `${copy.prefix} ${list}${tail.length ? `, ${tail.join(", ")}` : ""}.`, words };
}
