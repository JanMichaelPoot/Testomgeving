// Who are we searching for? The search context (asked first, on the start page) and the Dynamic Audience & Interest Profile that
// the image choices refine. Pure and client-safe (no JSON import): the wizard, the server and the tests run the same code.
//
// Rules this module keeps:
//  - The search context is explicit input and is stored as such. "Voor mezelf" does not mean adult, "kind of jongere" does not say
//    child or teenager, "groep" does not mean one age: the context is a starting point, never a conclusion about a person.
//  - Every dimension of the profile says where it comes from (explicit, inferred from the choices, or unknown) and how sure we
//    are. Below a confidence threshold a dimension stays "unknown": we do not force conclusions.
//  - No gender is asked, stored or inferred. The style register of an image is a property of the image, not of the person.
//  - Nothing here excludes an activity because of an assumed stereotype. The only hard rule is for the minors context
//    (alcohol, gambling, weapons, sharp or heavy tools, the dance form with an adult setting), plus the existing supervision rules.

export const SEARCH_CONTEXTS = ["self", "child", "adult", "group", "unknown"] as const;
export type SearchContext = (typeof SEARCH_CONTEXTS)[number];

/** The contexts where the search is for somebody else (or for several people), whatever the reason for asking. */
export const OTHER_CONTEXTS: readonly SearchContext[] = ["child", "adult", "group"];

/**
 * A value from the browser (or an old draft) becomes a known context; anything else is "unknown". "senior" was a choice until Step 135
 * (nobody should be sorted by age bracket in a label): an older stored value reads as "another adult".
 */
export function normalizeSearchContext(raw: unknown): SearchContext {
  if (raw === "senior") return "adult";
  return typeof raw === "string" && (SEARCH_CONTEXTS as readonly string[]).includes(raw) ? (raw as SearchContext) : "unknown";
}

/** True when the window is for somebody else: a context other than "for myself" (a child, another adult, a group). */
export function isForOther(answers: { searchContext?: string }): boolean {
  return OTHER_CONTEXTS.includes(normalizeSearchContext(answers.searchContext));
}

/**
 * The age category the engine weighs with. An explicit answer always wins; otherwise the context gives a soft default for
 * the two contexts that say something about age. The result only steers weights (agePenalty), it never excludes.
 */
export function effectiveAgeCategory(answers: { ageCategory?: string; searchContext?: string }): string {
  if (answers.ageCategory) return answers.ageCategory;
  const ctx = normalizeSearchContext(answers.searchContext);
  return ctx === "child" ? "under18" : "";
}

// --- what is suitable ---------------------------------------------------------------------------------------------------------

/**
 * Activities that are not offered when the search is for a child or young person: alcohol, gambling, weapons and shooting, sharp or
 * heavy tools, an adult-setting dance form, and risk or motor sports that most providers only offer from 16 or 18. A short, explicit list on purpose (the library has no age field): add an id here when
 * a new activity belongs on it. Supervised (tier 2) activities are handled by the existing weighting.
 */
export const MINOR_UNSUITABLE: ReadonlySet<string> = new Set([
  // alcohol and gambling
  "bier-brouwen", "wijnproeverij", "cocktailworkshop", "kruidenlikeur", "luisterbar", "pokeravond", "casinoavond",
  // weapons, shooting, sharp or heavy tools
  "schietles", "kleiduifschieten", "luchtbukschieten", "pistoolschieten", "kruisboog", "meswerpen", "bijlwerpen",
  "mes-smeden", "kettingzaagcursus", "lassen", "metaalgieten",
  // adult setting
  "paaldansen",
  // risk sports and motor sport with an adult minimum age at most providers, and trespassing
  "vrije-val", "tandem-parachute", "bungeejump", "grotduiken", "wrakduiken", "freediven", "jetski", "driftles", "circuitdag",
  "enduro-offroad", "motorvlucht", "ijsbaden", "urbex-tour",
  // hunting (a licence and an adult course are needed even to be introduced)
  "jachtkennismaking",
]);

/** Whether an activity may be offered in the given context. Only the minors context excludes anything. */
export function allowedForContext(a: { id: string; tags: readonly string[] }, ctx: SearchContext | string | undefined): boolean {
  if (normalizeSearchContext(ctx) !== "child") return true;
  return !MINOR_UNSUITABLE.has(a.id);
}

/**
 * A small nudge per context for the selection engine (positive = less likely). A group is better served by something that can be done
 * together; for the other contexts nothing is assumed beyond the age weighting.
 */
export function audienceBias(a: { formats?: readonly string[] | null }, ctx: SearchContext | string | undefined): number {
  if (normalizeSearchContext(ctx) !== "group") return 0;
  const formats = a.formats ?? [];
  const together = formats.some((f) => f === "small_group" || f === "large_group" || f === "with_known" || f === "duo");
  if (together) return -0.15;
  return formats.length > 0 && formats.every((f) => f === "solo") ? 0.3 : 0;
}

// --- the first and the follow-up images ---------------------------------------------------------------------------------------

/**
 * How much an image with a given tag suits a context, -1..1. Images carry no age, so this reads the tags they do carry. It is a lean for
 * the first selection, never a filter, and it is deliberately broad: a child context mixes the play of young children with what a
 * teenager picks; an adult context has no lean at all.
 */
export const CONTEXT_TAG_LEAN: Record<SearchContext, Record<string, number>> = {
  self: {},
  adult: {},
  unknown: {},
  child: {
    play: 0.9, animals: 0.8, nature: 0.5, outdoors: 0.5, making: 0.6, movement: 0.6, discovery: 0.6, water: 0.5, color: 0.5, puzzling: 0.4,
    rhythm: 0.4, sound: 0.4, miniature: 0.4, growing: 0.4, competition: 0.5, teamwork: 0.5, speed: 0.4, performance: 0.5, style: 0.4, strategy: 0.4,
    roleplay: 0.5, chance: -1, depths: -0.4, suspense: -0.2,
  },
  group: {
    teamwork: 0.9, competition: 0.7, conviviality: 0.8, play: 0.7, food: 0.6, strategy: 0.5, puzzling: 0.5, suspense: 0.5, roleplay: 0.5,
    performance: 0.5, movement: 0.4, rhythm: 0.4, sound: 0.3,
  },
};

/** The lean of one image (its tags, each weighted by the card's own weight for it) for a context, roughly -1..1. */
export function cardContextLean(tags: Readonly<Record<string, number>>, ctx: SearchContext | string | undefined): number {
  const lean = CONTEXT_TAG_LEAN[normalizeSearchContext(ctx)];
  let sum = 0;
  let weight = 0;
  for (const [tag, w] of Object.entries(tags)) {
    weight += w;
    sum += (lean[tag] ?? 0) * w;
  }
  return weight > 0 ? sum / weight : 0;
}

/** The lean of an activity (its tags, equal weight) for a context, roughly -1..1. */
export function activityContextLean(tags: readonly string[], ctx: SearchContext | string | undefined): number {
  return cardContextLean(Object.fromEntries(tags.map((t) => [t, 1])), ctx);
}

/**
 * Preference score (0..1) for an image on the images page. The first page leans on the context only. A page after "Andere beelden"
 * deepens what the choices so far point at and, in the other half of the pages, opens something new: alternating cards of the order get
 * "close to what was chosen" and "not yet seen in the choices" as their ranking, so the profile can neither be fixed early nor ignored.
 * `index` is the position in a seeded order, so the split is deterministic.
 */
export function imagePreference(
  card: { tagWeights: Readonly<Record<string, number>> },
  opts: { context: SearchContext | string | undefined; chosenTags: Readonly<Record<string, number>>; refresh: number; index: number },
): number {
  const ctxPart = Math.max(0, Math.min(1, 0.5 + cardContextLean(card.tagWeights, opts.context))); // 0..1, 0.5 = no lean
  if (opts.refresh === 0 || Object.keys(opts.chosenTags).length === 0) return ctxPart;
  const maxChosen = Math.max(0.0001, ...Object.values(opts.chosenTags));
  let near = 0;
  let total = 0;
  for (const [tag, w] of Object.entries(card.tagWeights)) {
    near += (opts.chosenTags[tag] ?? 0) / maxChosen * w;
    total += w;
  }
  const affinity = total > 0 ? Math.min(1, near / total) : 0;
  return opts.index % 2 === 0 ? 0.35 * ctxPart + 0.65 * affinity : 0.35 * ctxPart + 0.65 * (1 - affinity);
}

// --- the Dynamic Audience & Interest Profile ----------------------------------------------------------------------------------------

export type Provenance = "explicit" | "inferred" | "unknown";

export interface Dimension<V> {
  value: V;
  source: Provenance;
  /** 0..1. Below CONFIDENCE_FLOOR the value is "unknown" (no conclusion is forced). */
  confidence: number;
}

export type AudienceKind = "child_or_youth" | "adult" | "mixed" | "unknown";
export type LifeWorld = "family" | "work" | "school_age" | "partner" | "friends" | "unknown";
export type Orientation = "creative" | "active" | "social" | "adventurous" | "relaxed";

export interface AudienceProfile {
  /** Who the search is for, as the person said. Always explicit (or unknown when skipped). */
  searchContext: Dimension<SearchContext>;
  /** The age phase: explicit when an age was given, otherwise a soft reading of the context. */
  audience: Dimension<AudienceKind>;
  /** Home and work setting, from who goes along and (weakly) the context. */
  lifeWorld: Dimension<LifeWorld>;
  /** The strongest themes: chosen activities count as explicit, themes read from images as inferred. */
  interests: Dimension<string[]>;
  /** What kind of activity the choices lean to. */
  orientation: Dimension<Orientation[]>;
  /** Specific themes that stand out beyond the broad interests (tag ids, minus the generic mood tags). */
  preferences: Dimension<string[]>;
  /** How many distinct themes the choices span (0..1). Low = a narrow profile; the engine keeps its room for the unexpected either way. */
  breadth: number;
}

export const CONFIDENCE_FLOOR = 0.3;

export interface AudienceInput {
  searchContext?: string;
  ageCategory?: string;
  company?: readonly string[];
  /** Tag weights of the chosen images (tagProfile). */
  imageProfile: Readonly<Record<string, number>>;
  /** Average of the chosen images on the three axes we know and novelty. */
  axes?: { social: number; energy: number; setting: number; novelty?: number };
  imageCount: number;
  /** Tags of the activities the person chose themselves (page 2) and how many were chosen. */
  pickTags: readonly string[];
  pickCount: number;
  genericTags?: ReadonlySet<string>;
  /** Tags added with "Niet helemaal". */
  corrections?: readonly string[];
}

const ORIENTATION_TAGS: Record<Orientation, readonly string[]> = {
  creative: ["making", "craft", "color", "style", "performance", "sound", "story", "language"],
  active: ["movement", "outdoors", "speed", "height", "water", "challenge", "competition"],
  social: ["conviviality", "teamwork", "caring", "play", "food"],
  adventurous: ["discovery", "suspense", "depths", "height", "fire", "challenge", "speed"],
  relaxed: ["stillness", "balance", "nature", "restful", "growing", "focus"],
};

function top(entries: [string, number][], n: number): string[] {
  return entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([k]) => k);
}

/** Builds the profile. Deterministic; reads only what the person answered and chose. */
export function buildAudienceProfile(input: AudienceInput): AudienceProfile {
  const ctx = normalizeSearchContext(input.searchContext);
  const generic = input.genericTags ?? new Set<string>();

  const searchContext: AudienceProfile["searchContext"] =
    ctx === "unknown" ? { value: "unknown", source: "unknown", confidence: 0 } : { value: ctx, source: "explicit", confidence: 1 };

  let audience: AudienceProfile["audience"] = { value: "unknown", source: "unknown", confidence: 0 };
  const age = input.ageCategory ?? "";
  if (age) {
    const value: AudienceKind = age === "under18" ? "child_or_youth" : "adult";
    audience = { value, source: "explicit", confidence: 0.95 };
  } else if (ctx === "child") audience = { value: "child_or_youth", source: "inferred", confidence: 0.6 };
  else if (ctx === "group") audience = { value: "mixed", source: "inferred", confidence: 0.5 };
  else if (ctx === "adult") audience = { value: "adult", source: "inferred", confidence: 0.55 };

  const company = input.company ?? [];
  let lifeWorld: AudienceProfile["lifeWorld"] = { value: "unknown", source: "unknown", confidence: 0 };
  if (company.includes("family")) lifeWorld = { value: "family", source: "explicit", confidence: 0.8 };
  else if (company.includes("colleagues")) lifeWorld = { value: "work", source: "explicit", confidence: 0.8 };
  else if (company.includes("partner")) lifeWorld = { value: "partner", source: "explicit", confidence: 0.7 };
  else if (company.includes("friends")) lifeWorld = { value: "friends", source: "explicit", confidence: 0.6 };
  else if (ctx === "child") lifeWorld = { value: "school_age", source: "inferred", confidence: 0.4 };

  // Interests: the tags of the chosen images (inferred), the tags of the activities the person picked (explicit, weighted heavier).
  const scores = new Map<string, number>();
  for (const [tag, w] of Object.entries(input.imageProfile)) scores.set(tag, (scores.get(tag) ?? 0) + w * (generic.has(tag) ? 0.4 : 1));
  const pickWeight = 1.5;
  const perTag = new Map<string, number>();
  for (const tag of input.pickTags) perTag.set(tag, (perTag.get(tag) ?? 0) + 1);
  for (const [tag, n] of perTag) scores.set(tag, (scores.get(tag) ?? 0) + (n * pickWeight * (generic.has(tag) ? 0.4 : 1)));
  for (const tag of input.corrections ?? []) scores.set(tag, (scores.get(tag) ?? 0) + 2);
  const sorted = [...scores.entries()].filter(([, w]) => w > 0);
  const interestTags = top(sorted.filter(([t]) => !generic.has(t)), 5);
  const evidence = input.imageCount + input.pickCount * 1.5;
  const interestConfidence = Math.min(0.95, evidence / 10);
  const fromPicks = input.pickCount > 0;
  const interests: AudienceProfile["interests"] =
    interestConfidence >= CONFIDENCE_FLOOR && interestTags.length > 0
      ? { value: interestTags, source: fromPicks ? "explicit" : "inferred", confidence: interestConfidence }
      : { value: [], source: "unknown", confidence: interestConfidence };

  // Orientation: which kind of activity the tag mass and the axes lean to.
  const totalMass = sorted.reduce((s, [, w]) => s + w, 0) || 1;
  const mass = (tags: readonly string[]) => sorted.filter(([t]) => tags.includes(t)).reduce((s, [, w]) => s + w, 0) / totalMass;
  const orientations: [Orientation, number][] = (Object.keys(ORIENTATION_TAGS) as Orientation[]).map((o) => {
    let v = mass(ORIENTATION_TAGS[o]);
    const ax = input.axes;
    if (ax) {
      if (o === "active") v += Math.max(0, ax.energy) * 0.15;
      if (o === "relaxed") v += Math.max(0, -ax.energy) * 0.15;
      if (o === "social") v += Math.max(0, ax.social) * 0.15;
      if (o === "adventurous") v += Math.max(0, ax.novelty ?? 0) * 0.15;
    }
    return [o, v];
  });
  const leading = orientations.filter(([, v]) => v >= 0.18).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([o]) => o);
  const orientationConfidence = Math.min(0.9, input.imageCount / 8) * (leading.length > 0 ? 1 : 0.5);
  const orientation: AudienceProfile["orientation"] =
    orientationConfidence >= CONFIDENCE_FLOOR && leading.length > 0
      ? { value: leading, source: "inferred", confidence: orientationConfidence }
      : { value: [], source: "unknown", confidence: orientationConfidence };

  // Preferences: themes beyond the broad interests (the next ones down), only with enough evidence.
  const specific = top(sorted.filter(([t]) => !generic.has(t) && !interestTags.includes(t)), 3);
  const preferences: AudienceProfile["preferences"] =
    interestConfidence >= 0.5 && specific.length > 0
      ? { value: specific, source: "inferred", confidence: Math.min(0.8, interestConfidence - 0.1) }
      : { value: [], source: "unknown", confidence: 0 };

  const distinct = sorted.filter(([t]) => !generic.has(t)).length;
  const breadth = Math.min(1, distinct / 14);

  return { searchContext, audience, lifeWorld, interests, orientation, preferences, breadth };
}

/**
 * The lines the writer's prompt gets. Explicit and inferred are labelled as such and weak readings are marked, so the model neither treats a
 * guess as a fact nor repeats it to the person as if they had said it.
 */
export function describeAudienceForPrompt(profile: AudienceProfile, tagLabels: Readonly<Record<string, string>> = {}): string {
  const label = (t: string) => tagLabels[t] ?? t;
  const mark = (d: Dimension<unknown>) => (d.source === "explicit" ? "stated" : d.source === "inferred" ? `inferred from their choices, confidence ${Math.round(d.confidence * 100)}%` : "unknown");
  const lines: string[] = [];
  const ctx = profile.searchContext.value;
  const ctxText: Record<SearchContext, string> = {
    self: "for themselves",
    child: "for a child or young person (age not known more precisely; do not assume a young child or a teenager unless the choices show it)",
    adult: "for another adult",
    group: "for a group of people (ages and tastes may differ: offer ideas that hold up for a mixed group, do not build on one person's taste)",
    unknown: "not stated",
  };
  lines.push(`Search context (${mark(profile.searchContext)}): ${ctxText[ctx]}`);
  if (profile.audience.source !== "unknown") lines.push(`Audience (${mark(profile.audience)}): ${profile.audience.value}`);
  if (profile.lifeWorld.source !== "unknown") lines.push(`Life setting (${mark(profile.lifeWorld)}): ${profile.lifeWorld.value}`);
  if (profile.interests.value.length) lines.push(`Main interests (${mark(profile.interests)}): ${profile.interests.value.map(label).join(", ")}`);
  if (profile.orientation.value.length) lines.push(`Activity orientation (${mark(profile.orientation)}): ${profile.orientation.value.join(", ")}`);
  if (profile.preferences.value.length) lines.push(`Specific leanings (${mark(profile.preferences)}): ${profile.preferences.value.map(label).join(", ")}`);
  if (profile.breadth > 0) lines.push(`Breadth of the choices: ${profile.breadth < 0.35 ? "narrow" : profile.breadth < 0.65 ? "moderate" : "wide"}`);
  lines.push(
    "Use this profile to fit the ideas to the audience, but keep room for the unexpected: at least one idea must lie outside the stated or inferred interests. Never state an inferred reading to the person as a fact, and never assume gender.",
  );
  return lines.join("\n");
}
