import associationsJson from "@/lib/discovery/associations.json";
import { TAGS, getActivities } from "@/lib/discovery/library";
import { DISCOVERY_MIN_STATUS } from "@/lib/discovery/cardLibrary";
import { passesConstraints, resolveConstraints } from "@/lib/discovery/engine/constraints";
import { agePenalty } from "@/lib/discovery/engine/select";
import { hashSeed, mulberry32 } from "@/lib/discovery/rng";
import {
  ASSOCIATION_ROUNDS,
  averageAxes,
  deriveDials,
  tagProfile,
  type AssociationAxes,
  type AssociationCardData,
  type AssociationLibrary,
  type AssociationRound,
} from "@/lib/discovery/associationProfile";
import type { Activity, ActivityStatus, Localized, SocialFormat } from "@/lib/discovery/types";

// The association images of the image intake ("Het venster", fase 1). A card is not an
// activity: it shows a place, a moment or a sense, chosen to call up a feeling. This module
// turns the chosen cards into what the selection engine already understands (interests,
// worlds, the two dials it filters on) without any AI call, and can tell which chosen images
// lie behind an activity, for the "Omdat je ... koos" line on /plan and in the PDF.
// See WindowInto/WINDOW_Bouwopdracht_Venster_Fase0-8.md and docs/discovery-engine.md.

export interface AssociationCardFull extends AssociationCardData {
  label: Localized;
  /** English art direction for the image. No people, faces or hands. */
  scene: string;
  /** Public path of the image. A stand-in (an existing photo) until fase 2 made the real one. */
  image: string;
  status: Exclude<ActivityStatus, "retired">;
}

export const ASSOCIATIONS = associationsJson as unknown as AssociationCardFull[];
const byId = new Map(ASSOCIATIONS.map((c) => [c.id, c]));

export function getAssociation(id: string): AssociationCardFull | undefined {
  return byId.get(id);
}

/** Tags that can be read from an image: offered as corrections under "Niet helemaal". */
const CORRECTION_TAGS = [
  "stillness", "conviviality", "outdoors", "nature", "making", "movement", "story", "food", "water",
  "challenge", "play", "learning", "rhythm", "caring", "discovery", "balance",
];

/** The slim card data the wizard receives (one language; no scenes). */
export function buildAssociationLibrary(locale: "nl" | "en"): AssociationLibrary {
  return {
    cards: ASSOCIATIONS.map((c) => ({
      id: c.id,
      round: c.round,
      label: c.label[locale],
      image: c.image,
      tagWeights: c.tagWeights,
      axes: c.axes,
    })),
    tagLabels: Object.fromEntries(TAGS.map((t) => [t.id, t.label[locale]])),
    correctionTags: CORRECTION_TAGS.filter((t) => TAGS.some((x) => x.id === t)),
  };
}

const MAX_PER_ROUND = 5;
const MAX_CORRECTIONS = 3;

/** Keeps only real card ids (at most five per round, in the order given) and real correction tags. */
export function sanitizeAssociations(raw: { associations?: unknown; associationCorrections?: unknown }): {
  associations: string[];
  associationCorrections: string[];
} {
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const perRound = new Map<AssociationRound, number>();
  const associations: string[] = [];
  for (const id of new Set(strings(raw.associations))) {
    const card = byId.get(id);
    if (!card) continue;
    const n = perRound.get(card.round) ?? 0;
    if (n >= MAX_PER_ROUND) continue;
    perRound.set(card.round, n + 1);
    associations.push(id);
  }
  const tags = new Set(TAGS.map((t) => t.id));
  const associationCorrections = [...new Set(strings(raw.associationCorrections))].filter((t) => tags.has(t)).slice(0, MAX_CORRECTIONS);
  return { associations, associationCorrections };
}

// --- from images to engine input ---------------------------------------------------------

const ENERGY: Record<number, number> = { 0: -1, 1: -0.33, 2: 0.33, 3: 1 };
const SOCIAL: Record<SocialFormat, number> = {
  solo: -1,
  online: -0.5,
  duo: 0,
  drop_in_alone: 0.2,
  small_group: 0.6,
  with_known: 0.6,
  large_group: 1,
};

/** Where an activity sits on the three axes we know facets for (unknown facets are neutral). */
export function activityAxes(a: Activity): Omit<AssociationAxes, "novelty"> {
  const social = a.formats && a.formats.length ? a.formats.reduce((s, f) => s + SOCIAL[f], 0) / a.formats.length : 0;
  const energy = a.intensity === null ? 0 : ENERGY[a.intensity];
  const setting = a.setting === "indoor" ? -1 : a.setting === "outdoor" ? 1 : 0;
  return { social, energy, setting };
}

const GENERIC = new Set(TAGS.filter((t) => t.generic).map((t) => t.id));

export interface AssociationEngineInput {
  /** 4-6 activity ids that stand in for "what they picked" (empty: the engine's surprise path). */
  interests: string[];
  interestDomains: string[];
  practicalToWild: string;
  effort: string;
  /** Per chosen activity: the images (ids) that weighed most, strongest first. */
  sources: Record<string, string[]>;
}

/**
 * The chosen images that lie behind an activity (most tag overlap first), for "Omdat je X
 * koos". Works for any activity in a book, not only the ones derived here. Deterministic.
 */
export function imagesBehind(activityTags: readonly string[], chosenIds: readonly string[], n = 1): string[] {
  return chosenIds
    .map((id) => byId.get(id))
    .filter((c): c is AssociationCardFull => !!c)
    .map((c) => ({ id: c.id, w: activityTags.reduce((s, t) => s + (c.tagWeights[t] ?? 0), 0) }))
    .filter((x) => x.w >= 0.5)
    .sort((x, y) => y.w - x.w || x.id.localeCompare(y.id))
    .slice(0, n)
    .map((x) => x.id);
}

export function associationsToEngineInput(input: {
  associationIds: readonly string[];
  corrections?: readonly string[];
  interestDomains: readonly string[];
  surpriseMe?: boolean;
  /** The answers the hard filters read; the two derived dials are filled in here. */
  constraints: { budget: string; timeAvailable: string; mustHaves: string; socialFormats: readonly string[]; ageCategory: string };
  seed: string;
  activities?: readonly Activity[];
}): AssociationEngineInput {
  const chosen = input.associationIds.filter((id) => byId.has(id));
  const axes = averageAxes(ASSOCIATIONS, chosen);
  const dials = deriveDials(axes, chosen.length > 0);
  const interestDomains = [...input.interestDomains];
  const base = { interestDomains, ...dials };

  if (chosen.length === 0 && (input.corrections ?? []).length === 0) {
    // Nothing to read: worlds alone (or "verras me") go to the engine as they are.
    return { interests: [], ...base, sources: {} };
  }

  const profile = tagProfile(ASSOCIATIONS, chosen, input.corrections ?? []);
  const constraints = resolveConstraints({
    interests: [],
    interestDomains,
    socialFormats: input.constraints.socialFormats,
    practicalToWild: dials.practicalToWild,
    budget: input.constraints.budget,
    effort: dials.effort,
    timeAvailable: input.constraints.timeAvailable,
    ageCategory: input.constraints.ageCategory,
    mustHaves: input.constraints.mustHaves,
    seed: input.seed,
  });
  const pool = (input.activities ?? getActivities({ minStatus: DISCOVERY_MIN_STATUS })).filter(
    (a) => a.status !== "retired" && passesConstraints(a, constraints).ok,
  );

  const rnd = mulberry32(hashSeed(`assoc:${input.seed}`));
  const raw = pool.map((a) => {
    const tagScore = a.tags.reduce((s, t) => s + (profile[t] ?? 0) * (GENERIC.has(t) ? 0.5 : 1), 0) / Math.sqrt(Math.max(1, a.tags.length));
    return { a, tagScore };
  });
  const maxTag = Math.max(0.0001, ...raw.map((r) => r.tagScore));
  const worlds = new Set(interestDomains);
  const scored = raw
    .filter((r) => r.tagScore > 0)
    .map(({ a, tagScore }) => {
      const ax = activityAxes(a);
      const fit = 1 - (Math.abs(ax.social - axes.social) + Math.abs(ax.energy - axes.energy) + Math.abs(ax.setting - axes.setting)) / 6;
      const score = tagScore / maxTag + (worlds.has(a.domain) ? 0.35 : 0) + 0.3 * fit + rnd() * 0.25 - agePenalty(a, input.constraints.ageCategory);
      return { a, score };
    })
    .sort((x, y) => y.score - x.score);

  // Up to six, spread out: one per world (measured: two per world gave fewer worlds per book
  // than the card wizard, 5.6 vs 5.8; one per world gives 5.8). The jitter (0.25) keeps the
  // same images from always leading to the same activities.
  const picked: Activity[] = [];
  const perDomain = new Map<string, number>();
  const subs = new Set<string>();
  for (const { a } of scored) {
    if (picked.length === 6) break;
    if ((perDomain.get(a.domain) ?? 0) >= 1 || subs.has(a.sub)) continue;
    picked.push(a);
    perDomain.set(a.domain, (perDomain.get(a.domain) ?? 0) + 1);
    subs.add(a.sub);
  }

  const sources: Record<string, string[]> = {};
  for (const a of picked) {
    const behind = imagesBehind(a.tags, chosen, 2);
    if (behind.length) sources[a.id] = behind;
  }

  return { interests: picked.map((a) => a.id), ...base, sources };
}

/** Labels of the chosen images, per round, for the prompt (English; the book is written in the person's language). */
export function describeAssociationsForPrompt(ids: readonly string[], corrections: readonly string[] = []): string {
  const lines: string[] = [];
  for (const round of ASSOCIATION_ROUNDS) {
    const labels = ids.map((id) => byId.get(id)).filter((c) => c?.round === round).map((c) => c!.label.en);
    if (labels.length) lines.push(`${round}: ${labels.join("; ")}`);
  }
  if (lines.length === 0) return "";
  const tagLabel = new Map(TAGS.map((t) => [t.id, t.label.en]));
  const fixes = corrections.map((t) => tagLabel.get(t)).filter(Boolean);
  return [
    "Imagery the person chose (association images of places, moments and senses, not activities):",
    ...lines.map((l) => `  ${l}`),
    ...(fixes.length ? [`  When we read these back, they said they want more of: ${fixes.join("; ")}`] : []),
    "Mention at most one chosen image per idea in why_it_fits, and only where it genuinely explains the choice.",
  ].join("\n");
}
