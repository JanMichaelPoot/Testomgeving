import associationsJson from "@/lib/discovery/associations.json";
import cardAssociationsJson from "@/lib/discovery/cardAssociations.json";
import themesJson from "@/lib/discovery/themes.json";
import { COMBO_FLOOR, MAX_IMAGE_PICKS } from "@/lib/discovery/twoPages";
import { themeNameInSentence, themeRelative, type ThemeProfile } from "@/lib/discovery/themeFit";
import { knowledgeAssociationLayerEnabled } from "@/lib/knowledgeFlags";
import { TAGS, getActivities, getActivity, isImagePending } from "@/lib/discovery/library";
import { inSeason } from "@/lib/discovery/season";
import { registerOfCard } from "@/lib/discovery/register";
import { DISCOVERY_MIN_STATUS } from "@/lib/discovery/cardLibrary";
import { passesConstraints, resolveConstraints } from "@/lib/discovery/engine/constraints";
import { agePenalty, supplyPenalty } from "@/lib/discovery/engine/select";
import { audienceBias, effectiveAgeCategory } from "@/lib/discovery/audience";
import { buildGraph } from "@/lib/discovery/engine/graph";
import { hashSeed, mulberry32 } from "@/lib/discovery/rng";
import {
  ASSOCIATION_ROUNDS,
  averageAxes,
  deriveDials,
  effectiveAxes,
  sanitizeAxesOverride,
  tagProfile,
  type AssociationAxes,
  type AxesOverride,
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

/**
 * The old cards (places, moments, senses): 172 families kept in the data and in every stored book, but no longer offered by the image
 * intake since the 30 theme tiles (Step 210). Old drafts and books still resolve their ids through ALL_ASSOCIATIONS.
 */
export const ASSOCIATIONS = associationsJson as unknown as AssociationCardFull[];

/**
 * The theme tiles of the image intake ("Iets met natuur", ...; themes.json, docs/voorstel-themabeelden.md). One family per theme, one card
 * per image of it: the sampler shows one image per theme and rotates through the others on later visits.
 */
interface ThemeJson {
  id: string;
  group: string;
  label: Localized;
  blurb: Localized;
  images: { id: string; image: string; scene: string }[];
  tagWeights: Record<string, number>;
  axes: AssociationAxes;
}
export const THEMES = themesJson as unknown as ThemeJson[];
export const THEME_CARDS: AssociationCardFull[] = THEMES.flatMap((t) =>
  t.images.map((im) => ({
    id: `theme-${im.id}`,
    family: `theme-${t.id}`,
    round: "themes" as const,
    group: t.group,
    label: t.label,
    scene: im.scene,
    image: im.image,
    tagWeights: t.tagWeights,
    axes: t.axes,
    status: "reviewed" as const,
  })),
);

/** Every card an answer or a stored book can name: the old ones and the themes. */
export const ALL_ASSOCIATIONS: AssociationCardFull[] = [...ASSOCIATIONS, ...THEME_CARDS];
const byId = new Map(ALL_ASSOCIATIONS.map((c) => [c.id, c]));

export function getAssociation(id: string): AssociationCardFull | undefined {
  return byId.get(id);
}

/** Tags that can be read from an image: offered as corrections under "Niet helemaal". */
const CORRECTION_TAGS = [
  "stillness", "conviviality", "outdoors", "nature", "making", "movement", "story", "food", "water",
  "challenge", "play", "learning", "rhythm", "caring", "discovery", "balance",
];

/**
 * A card is only shown once its own image exists. New cards start with a stand-in path (another card's photo) until
 * `npm run taxonomy:images -- --associations` has made theirs; showing that stand-in would put the wrong picture
 * under the wrong words, so such a card is simply left out until then.
 */
export function hasOwnImage(c: { id: string; image: string }): boolean {
  // A theme card's image is named after the theme image, not after the card (themes.test.ts checks that every file exists).
  return c.image === `/illustrations/associations/${c.id}.jpg` || c.image === `/illustrations/themes/${c.id.replace(/^theme-/, "")}.jpg`;
}

/** The slim card data the wizard receives (one language; no scenes). */
const CARD_ASSOCIATIONS = cardAssociationsJson as Record<string, Record<string, number>>;

/** The association layer's weights for a card: its family's (the variants of one family mean the same). */
export function cardAssoc(c: { family?: string; id: string }): Record<string, number> | undefined {
  return CARD_ASSOCIATIONS[c.family ?? c.id];
}

export function buildAssociationLibrary(
  locale: "nl" | "en",
  month?: number,
  layer: boolean = knowledgeAssociationLayerEnabled(),
  /** "themes": only the 30 theme tiles (what the image intake offers). "all" (default): also the old cards, for showing a stored book. */
  offer: "all" | "themes" = "all",
): AssociationLibrary {
  return {
    cards: (offer === "themes" ? THEME_CARDS : ALL_ASSOCIATIONS).filter(hasOwnImage).map((c) => ({
      id: c.id,
      family: c.family,
      round: c.round,
      ...(c.group ? { group: c.group } : {}),
      label: c.label[locale],
      image: c.image,
      tagWeights: c.tagWeights,
      axes: c.axes,
      register: registerOfCard(c),
      ...(layer && cardAssoc(c) ? { assoc: cardAssoc(c) } : {}),
    })),
    tagLabels: Object.fromEntries(TAGS.map((t) => [t.id, t.label[locale]])),
    correctionTags: CORRECTION_TAGS.filter((t) => TAGS.some((x) => x.id === t)),
    worldExamples: worldExamples(locale, month),
  };
}

/** The labels of the activities of every world, for the examples on the direction cards (R3: more dynamic directions). */
function worldExamples(locale: "nl" | "en", month?: number): Record<string, { label: string; sub: string }[]> {
  const out: Record<string, { label: string; sub: string }[]> = {};
  for (const a of getActivities({ minStatus: DISCOVERY_MIN_STATUS })) {
    if (!inSeason(a, month)) continue; // no ice skating as an example in July
    (out[a.domain] ??= []).push({ label: a.label[locale], sub: a.sub });
  }
  return out;
}

const MAX_PER_ROUND = 5;
/** The theme tiles are one round of up to MAX_IMAGE_PICKS (a visitor picks 3 to 8 of the 30). */
const maxPerRound = (round: AssociationRound) => (round === "themes" ? MAX_IMAGE_PICKS : MAX_PER_ROUND);
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
    if (n >= maxPerRound(card.round)) continue;
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

/** The themes among the chosen card ids (one per theme, whichever of its images was shown), as the engine and page 2 read them; ids like "theme-natuur". */
export function themeProfilesFor(cardIds: readonly string[]): ThemeProfile[] {
  const out: ThemeProfile[] = [];
  const seen = new Set<string>();
  for (const id of cardIds) {
    const card = byId.get(id);
    if (!card || card.round !== "themes" || !card.family || seen.has(card.family)) continue;
    seen.add(card.family);
    out.push({ id: card.family, weights: card.tagWeights });
  }
  return out;
}

/** "natuur", "ambacht en handwerk": the theme's name without its "Iets met" (inside a sentence, between quotes). */
export function themeShortLabel(themeId: string, locale: "nl" | "en"): string {
  const theme = THEMES.find((t) => `theme-${t.id}` === themeId);
  if (!theme) return themeId;
  return themeNameInSentence(theme.label[locale]);
}

// How close an activity is to a theme, against the best activity of the whole shown library (E5: "omdat je natuur en ambacht koos").
const themeRelCache = new Map<string, (tags: readonly string[]) => number>();
function themeRelOf(theme: ThemeProfile) {
  let rel = themeRelCache.get(theme.id);
  if (!rel) {
    rel = themeRelative(theme.weights, getActivities(), GENERIC);
    themeRelCache.set(theme.id, rel);
  }
  return rel;
}

/**
 * The two chosen themes an activity fits at once (the weaker of the two at least COMBO_FLOOR of the best activity of that theme, the same
 * measure page 2 uses for its combination slots), the pair with the highest minimum; null when it fits fewer than two. Ids like "theme-natuur".
 */
export function themeComboFor(activityTags: readonly string[], chosenIds: readonly string[]): [string, string] | null {
  const themes = themeProfilesFor(chosenIds);
  if (themes.length < 2) return null;
  const rels = themes.map((t) => themeRelOf(t)(activityTags));
  let best = 0;
  let pair: [string, string] | null = null;
  for (let i = 0; i < themes.length; i++) {
    for (let j = i + 1; j < themes.length; j++) {
      const m = Math.min(rels[i], rels[j]);
      if (m > best) {
        best = m;
        pair = [themes[i].id, themes[j].id];
      }
    }
  }
  return pair && best >= COMBO_FLOOR ? pair : null;
}

export interface AssociationEngineInput {
  /** 4-6 activity ids that stand in for "what they picked" (empty: the engine's surprise path). */
  interests: string[];
  interestDomains: string[];
  practicalToWild: string;
  effort: string;
  /** Per chosen activity: the images (ids) that weighed most, strongest first. */
  sources: Record<string, string[]>;
  /** Per chosen activity: the (at most two) tags through which the images and the activity meet. */
  sourceTags: Record<string, string[]>;
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

/**
 * The tags through which the chosen images and an activity meet: tags the activity has AND at
 * least one chosen image carries, strongest first (mood-only tags count half, as in the engine).
 * Never a tag that is not on both sides, so the thread on /plan only shows real connections.
 */
export function sourceTagsFor(activityTags: readonly string[], chosenIds: readonly string[], n = 2): string[] {
  const cards = chosenIds.map((id) => byId.get(id)).filter((c): c is AssociationCardFull => !!c);
  return [...new Set(activityTags)]
    .map((t) => ({ t, w: cards.reduce((s, c) => s + (c.tagWeights[t] ?? 0), 0) * (GENERIC.has(t) ? 0.5 : 1) }))
    .filter((x) => x.w > 0)
    .sort((a, b) => b.w - a.w || a.t.localeCompare(b.t))
    .slice(0, n)
    .map((x) => x.t);
}

/**
 * What a finished book remembers about how its doors came about (window_plans.association_sources,
 * migration 0019): per activity the images and the tags behind it, at the moment of writing.
 * Version 2. A plain {activityId: [imageIds]} object (what associationsToEngineInput returned
 * before) is still read; see parseAssociationSources.
 */
export interface AssociationSources {
  version: 2;
  sources: Record<string, string[]>;
  sourceTags: Record<string, string[]>;
  /** Two-page intake: the activities of this book that the person chose themselves on page 2 (not derived from the images). */
  own?: string[];
  /** Theme tiles (E5): per activity the two chosen themes it fits at once (ids like "theme-natuur"), for "omdat je natuur en ambacht koos". */
  combos?: Record<string, [string, string]>;
}

/** For every idea that came from the library (it has an activity_id): its images and tags. */
export function buildAssociationSources(
  ideas: readonly { activity_id?: string | null }[],
  chosenIds: readonly string[],
  ownPicks: readonly string[] = [],
): AssociationSources {
  const sources: Record<string, string[]> = {};
  const sourceTags: Record<string, string[]> = {};
  const combos: Record<string, [string, string]> = {};
  for (const idea of ideas) {
    const activity = idea.activity_id ? getActivity(idea.activity_id) : undefined;
    if (!activity) continue;
    const images = imagesBehind(activity.tags, chosenIds, 2);
    const tags = sourceTagsFor(activity.tags, chosenIds, 2);
    if (images.length) sources[activity.id] = images;
    if (tags.length) sourceTags[activity.id] = tags;
    const combo = themeComboFor(activity.tags, chosenIds);
    if (combo) combos[activity.id] = combo;
  }
  const own = ideas.map((i) => i.activity_id).filter((id): id is string => !!id && ownPicks.includes(id));
  return { version: 2, sources, sourceTags, ...(own.length ? { own: [...new Set(own)] } : {}), ...(Object.keys(combos).length ? { combos } : {}) };
}

const stringList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 4) : []);

/** Reads what is stored, in either format; null for nothing or for something that is not ours. */
export function parseAssociationSources(raw: unknown): AssociationSources | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const pick = (map: unknown): Record<string, string[]> => {
    const out: Record<string, string[]> = {};
    if (map && typeof map === "object" && !Array.isArray(map)) {
      for (const [id, list] of Object.entries(map as Record<string, unknown>)) {
        const items = stringList(list);
        if (items.length) out[id] = items;
      }
    }
    return out;
  };
  if (obj.version === 2) {
    const own = Array.isArray(obj.own) ? obj.own.filter((x): x is string => typeof x === "string").slice(0, 12) : [];
    const combos: Record<string, [string, string]> = {};
    if (obj.combos && typeof obj.combos === "object" && !Array.isArray(obj.combos)) {
      for (const [id, pair] of Object.entries(obj.combos as Record<string, unknown>)) {
        if (Array.isArray(pair) && pair.length === 2 && pair.every((x) => typeof x === "string") && pair[0] !== pair[1]) combos[id] = [pair[0], pair[1]];
      }
    }
    return { version: 2, sources: pick(obj.sources), sourceTags: pick(obj.sourceTags), ...(own.length ? { own } : {}), ...(Object.keys(combos).length ? { combos } : {}) };
  }
  // The old shape: just the images per activity.
  const legacy = pick(obj);
  return Object.keys(legacy).length ? { version: 2, sources: legacy, sourceTags: {} } : null;
}

/** How much the long tail is lifted when interests are read from the images, and the random spread between close scores. */
const RARITY_LIFT = 0.3;
const JITTER = 0.5;

// What a visitor can meet: not the activities whose photo is still to be made.
const SHOWN_ACTIVITIES = getActivities();

// 0.4..1.6: how specific a tag is, from how many activities carry it (the library as a whole, not this pool).
const TAG_USES = (() => {
  const uses = new Map<string, number>();
  for (const a of SHOWN_ACTIVITIES) for (const t of a.tags) uses.set(t, (uses.get(t) ?? 0) + 1);
  return uses;
})();
function tagIdf(tag: string): number {
  const share = (TAG_USES.get(tag) ?? 1) / Math.max(1, SHOWN_ACTIVITIES.length);
  return Math.min(1.6, Math.max(0.4, 1 + Math.log(0.15 / Math.max(0.005, share)) * 0.35));
}

export function associationsToEngineInput(input: {
  associationIds: readonly string[];
  corrections?: readonly string[];
  interestDomains: readonly string[];
  surpriseMe?: boolean;
  /** Axes the person moved on the profile screen; they replace what the images say for that axis. */
  axesOverride?: AxesOverride;
  /** The answers the hard filters read; the two derived dials are filled in here. */
  constraints: { budget: string; timeAvailable: string; mustHaves: string; socialFormats: readonly string[]; ageCategory: string; searchContext?: string };
  seed: string;
  activities?: readonly Activity[];
  /** The month the person asks in: the activities read from the images are in season then. */
  month?: number;
  /**
   * The two-page intake (docs/fase4-opzet.md): the activities the person chose themselves on the concrete page. Then nothing is
   * derived from the images as interests; the images only give the dials and, per chosen activity, the image behind it.
   */
  explicitInterests?: readonly string[];
}): AssociationEngineInput {
  const chosen = input.associationIds.filter((id) => byId.has(id));
  const axes = effectiveAxes(averageAxes(ALL_ASSOCIATIONS, chosen), input.axesOverride);
  // Moving a slider is an answer too, also when no image was chosen.
  const dials = deriveDials(axes, chosen.length > 0 || Object.keys(sanitizeAxesOverride(input.axesOverride)).length > 0);
  const interestDomains = [...input.interestDomains];
  const base = { interestDomains, ...dials };

  if (input.explicitInterests) {
    const picks = [...new Set(input.explicitInterests)].filter((id) => {
      const a = getActivity(id);
      return !!a && a.status !== "retired" && !isImagePending(a);
    });
    const sources: Record<string, string[]> = {};
    const sourceTags: Record<string, string[]> = {};
    for (const id of picks) {
      const a = getActivity(id)!;
      const behind = imagesBehind(a.tags, chosen, 2);
      if (behind.length) sources[id] = behind;
      const tags = sourceTagsFor(a.tags, chosen, 2);
      if (tags.length) sourceTags[id] = tags;
    }
    return { interests: picks, ...base, sources, sourceTags };
  }

  if (chosen.length === 0 && (input.corrections ?? []).length === 0) {
    // Nothing to read: worlds alone (or "verras me") go to the engine as they are.
    return { interests: [], ...base, sources: {}, sourceTags: {} };
  }

  const profile = tagProfile(ALL_ASSOCIATIONS, chosen, input.corrections ?? []);
  const constraints = resolveConstraints({
    interests: [],
    interestDomains,
    socialFormats: input.constraints.socialFormats,
    practicalToWild: dials.practicalToWild,
    budget: input.constraints.budget,
    effort: dials.effort,
    timeAvailable: input.constraints.timeAvailable,
    ageCategory: input.constraints.ageCategory,
    searchContext: input.constraints.searchContext,
    mustHaves: input.constraints.mustHaves,
    seed: input.seed,
    month: input.month,
  });
  const pool = (input.activities ?? getActivities({ minStatus: DISCOVERY_MIN_STATUS })).filter(
    (a) => a.status !== "retired" && passesConstraints(a, constraints).ok,
  );

  const rnd = mulberry32(hashSeed(`assoc:${input.seed}`));
  // Variety (Stap 88): a tag that half the library carries (outdoors, nature, making) says little about one
  // activity, so it counts by how rare it is; and activities built from rare tag mixes get a lift, so the
  // same few hubs do not lead every book.
  const graph = buildGraph(SHOWN_ACTIVITIES, TAGS);
  const raw = pool.map((a) => {
    const tagScore =
      a.tags.reduce((s, t) => s + (profile[t] ?? 0) * (GENERIC.has(t) ? 0.5 : 1) * tagIdf(t), 0) / Math.sqrt(Math.max(1, a.tags.length));
    return { a, tagScore };
  });
  const maxTag = Math.max(0.0001, ...raw.map((r) => r.tagScore));
  const worlds = new Set(interestDomains);
  const scored = raw
    .filter((r) => r.tagScore > 0)
    .map(({ a, tagScore }) => {
      const ax = activityAxes(a);
      const fit = 1 - (Math.abs(ax.social - axes.social) + Math.abs(ax.energy - axes.energy) + Math.abs(ax.setting - axes.setting)) / 6;
      const score =
        tagScore / maxTag + (worlds.has(a.domain) ? 0.35 : 0) + 0.3 * fit + RARITY_LIFT * graph.rarity(a) * (0.4 + 1.2 * mulberry32(hashSeed(`assoc:${input.seed}:rare:${a.id}`))()) + rnd() * JITTER - supplyPenalty(a) - agePenalty(a, effectiveAgeCategory(input.constraints)) - audienceBias(a, input.constraints.searchContext);
      return { a, score };
    })
    .sort((x, y) => y.score - x.score);

  // Up to six, spread out: one per world (measured: two per world gave fewer worlds per book
  // than the card wizard, 5.6 vs 5.8; one per world gives 5.8). The jitter keeps the
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
  const sourceTags: Record<string, string[]> = {};
  for (const a of picked) {
    const behind = imagesBehind(a.tags, chosen, 2);
    if (behind.length) sources[a.id] = behind;
    const tags = sourceTagsFor(a.tags, chosen, 2);
    if (tags.length) sourceTags[a.id] = tags;
  }

  return { interests: picked.map((a) => a.id), ...base, sources, sourceTags };
}

/** Labels of the chosen images, per round, for the prompt (English; the book is written in the person's language). */
export function describeAssociationsForPrompt(ids: readonly string[], corrections: readonly string[] = []): string {
  const lines: string[] = [];
  for (const round of [...ASSOCIATION_ROUNDS, "themes"] as const) {
    const labels = ids.map((id) => byId.get(id)).filter((c) => c?.round === round).map((c) => c!.label.en);
    if (labels.length) lines.push(`${round}: ${labels.join("; ")}`);
  }
  if (lines.length === 0) return "";
  const themesOnly = lines.every((l) => l.startsWith("themes:"));
  const tagLabel = new Map(TAGS.map((t) => [t.id, t.label.en]));
  const fixes = corrections.map((t) => tagLabel.get(t)).filter(Boolean);
  return [
    themesOnly
      ? "Areas of interest the person chose by tapping pictures (broad themes such as nature, animals or culture, not activities):"
      : "Imagery the person chose (association images of places, moments and senses, not activities):",
    ...lines.map((l) => `  ${l}`),
    ...(fixes.length ? [`  When we read these back, they said they want more of: ${fixes.join("; ")}`] : []),
    "Mention at most one chosen image per idea in why_it_fits, and only where it genuinely explains the choice.",
  ].join("\n");
}
