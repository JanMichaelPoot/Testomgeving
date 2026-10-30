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

export const AXIS_IDS = ["social", "energy", "setting", "novelty"] as const;
export type AxisId = (typeof AXIS_IDS)[number];

/** The axes a person moved themselves on the profile screen; absent axes keep what the images say. */
export type AxesOverride = Partial<Record<AxisId, number>>;

/** Only known axes, finite numbers, clamped to -1..1 and rounded to two decimals (the browser is not trusted). */
export function sanitizeAxesOverride(raw: unknown): AxesOverride {
  if (!raw || typeof raw !== "object") return {};
  const out: AxesOverride = {};
  for (const axis of AXIS_IDS) {
    const v = (raw as Record<string, unknown>)[axis];
    if (typeof v === "number" && Number.isFinite(v)) out[axis] = Math.round(Math.max(-1, Math.min(1, v)) * 100) / 100;
  }
  return out;
}

/** The axes that count: what the images say, except where the person moved a slider. */
export function effectiveAxes(fromImages: AssociationAxes, override: AxesOverride | undefined): AssociationAxes {
  const o = sanitizeAxesOverride(override);
  return {
    social: o.social ?? fromImages.social,
    energy: o.energy ?? fromImages.energy,
    setting: o.setting ?? fromImages.setting,
    novelty: o.novelty ?? fromImages.novelty,
  };
}

/** What the wizard and the scoring need of one card. */
export interface AssociationCardData {
  id: string;
  /** The family the card is a variant of (see associationSampling.ts); the card's own id when it stands alone. */
  family?: string;
  round: AssociationRound;
  tagWeights: Record<string, number>;
  axes: AssociationAxes;
}

/** Slim card for the browser: one language, no art direction. */
export interface AssociationCard extends AssociationCardData {
  label: string;
  image: string;
  /** The style register of the card (register.ts), for balancing the two image pages. Never shown. */
  register?: "expressive" | "nurturing" | "technical" | "nature";
}

export interface AssociationLibrary {
  cards: AssociationCard[];
  /** Tag id -> label in the visitor's language. */
  tagLabels: Record<string, string>;
  /** Tags offered as corrections under "Niet helemaal": the ones that can be read from images. */
  correctionTags: string[];
  /** Per world (domain id) the activities in it, for the changing examples on the direction cards. */
  worldExamples?: Record<string, { label: string; sub: string }[]>;
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
