import {
  averageAxes,
  axisLeanings,
  deriveDials,
  effectiveAxes,
  sanitizeAxesOverride,
  tagProfile,
  topTags,
  type AssociationAxes,
  type AssociationCardData,
  type AxesOverride,
  type AxisId,
} from "@/lib/discovery/associationProfile";
import { resolveConstraints } from "@/lib/discovery/engine/constraints";
import type { VensterDictionary } from "@/lib/i18n/venster";

// "Zo kijken wij door jouw venster" (R2.1): what the last screen of the image intake says back to
// the person before the question of paying. Everything here is deterministic and made of fixed
// sentence parts (dict.venster.profile), no AI call: it can be tested, it can never say something
// strange, and what it says is what really happens (the lines under "Dit zoeken we / Dit laten we
// weg" come from the very constraints the selection engine will use). Client-safe: no JSON import.

type Copy = VensterDictionary["profile"];

export interface ProfileCard extends AssociationCardData {
  label: string;
  image: string;
}

export interface ProfileInput {
  cards: readonly ProfileCard[];
  tagLabels: Record<string, string>;
  chosen: readonly string[];
  /** Tags added under "Bijsturen". */
  corrections: readonly string[];
  /** Axes the person moved themselves. */
  override?: AxesOverride;
  /** The short place name ("Laren"), empty when not given. */
  place: string;
  timeAvailable: string;
  budget: string;
  searchDistance: string;
  company: readonly string[];
  socialFormats: readonly string[];
  /** The hard limits as the wizard will store them (chips and free text, joined). */
  mustHaves: string;
  gift: boolean;
  name: string;
}

export type TensionKind = "tension" | "strong" | "balanced" | "open";

export interface ProfileStory {
  /** The (at most three) chosen images that weigh most in the profile, for the thumbnails. */
  pickedCards: { id: string; label: string; image: string }[];
  /** The tag words read from the images, strongest first (at most two). */
  tags: string[];
  /** Three to four sentences. */
  story: string;
  tension: { kind: TensionKind; axis: AxisId | null; text: string };
  /** What counts: the images' axes, except where the person moved a slider. */
  axes: AssociationAxes;
  /** What the images alone say; the sliders start here. */
  fromImages: AssociationAxes;
  seek: string[];
  omit: string[];
  /** Up to three starting points for "Wat missen we nog?", from the person's own choices. */
  suggestions: string[];
}

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (m, k) => values[k] ?? m);
const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);

function joinAnd(items: string[], and: string): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} ${and} ${items[items.length - 1]}`;
}

// --- which images weigh most ----------------------------------------------------------------

/**
 * At most three images, the ones that carry the strongest tags of the profile; images of other
 * rounds get preference. When the chosen images pull in opposite directions on `tensionAxis`, one
 * image of each side is among them, so the sentence about the tension has both halves in view.
 */
export function pickRepresentativeCards(
  input: Pick<ProfileInput, "cards" | "chosen" | "corrections">,
  n = 3,
  tensionAxis: AxisId | null = null,
): ProfileCard[] {
  const byId = new Map(input.cards.map((c) => [c.id, c]));
  const picked = input.chosen.map((id) => byId.get(id)).filter((c): c is ProfileCard => !!c);
  if (picked.length === 0) return [];
  const profile = tagProfile(input.cards, input.chosen, input.corrections);
  const top = topTags(profile, 4);
  const base = new Map(picked.map((c) => [c.id, top.reduce((s, t) => s + (c.tagWeights[t] ?? 0), 0)]));
  const out: ProfileCard[] = [];
  const rounds = new Set<string>();
  const left = [...picked];
  while (out.length < n && left.length > 0) {
    left.sort((a, b) => {
      const sa = (base.get(a.id) ?? 0) * (rounds.has(a.round) ? 0.7 : 1);
      const sb = (base.get(b.id) ?? 0) * (rounds.has(b.round) ? 0.7 : 1);
      return sb - sa || a.id.localeCompare(b.id);
    });
    const next = left.shift()!;
    out.push(next);
    rounds.add(next.round);
  }
  if (tensionAxis && out.length >= 2) {
    // Make sure both sides of the tension are shown: swap the weakest image for the strongest one of the missing side.
    const side = (c: ProfileCard, dir: 1 | -1) => c.axes[tensionAxis] * dir >= 0.5;
    for (const dir of [1, -1] as const) {
      if (out.some((c) => side(c, dir))) continue;
      const candidate = picked
        .filter((c) => side(c, dir) && !out.includes(c))
        .sort((a, b) => (base.get(b.id) ?? 0) - (base.get(a.id) ?? 0) || a.id.localeCompare(b.id))[0];
      if (!candidate) continue;
      // The weakest image that is not the only one of the other side.
      const other = (c: ProfileCard) => side(c, dir === 1 ? -1 : 1);
      const removable = out
        .filter((c) => !(other(c) && out.filter(other).length === 1))
        .sort((a, b) => (base.get(a.id) ?? 0) - (base.get(b.id) ?? 0) || b.id.localeCompare(a.id))[0];
      if (removable) out.splice(out.indexOf(removable), 1, candidate);
    }
  }
  return out;
}

// --- tension and strong axes ----------------------------------------------------------------

const TENSION_PRIORITY: AxisId[] = ["energy", "novelty", "social", "setting"];

/** The axis on which the chosen images pull in opposite directions (both clearly past ±0.5), strongest first. */
export function findTension(cards: readonly AssociationCardData[], chosen: readonly string[]): AxisId | null {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const picked = chosen.map((id) => byId.get(id)).filter((c): c is AssociationCardData => !!c);
  let best: { axis: AxisId; magnitude: number } | null = null;
  for (const axis of TENSION_PRIORITY) {
    const values = picked.map((c) => c.axes[axis]);
    if (values.length === 0) continue;
    const high = Math.max(...values);
    const low = Math.min(...values);
    if (high >= 0.5 && low <= -0.5) {
      const magnitude = Math.min(high, -low);
      if (!best || magnitude > best.magnitude) best = { axis, magnitude };
    }
  }
  return best?.axis ?? null;
}

/** The axis the images lean on most clearly (|average| >= 0.2), or null when they point nowhere in particular. */
export function strongestAxis(avg: AssociationAxes): { axis: AxisId; dir: "low" | "high" } | null {
  let best: { axis: AxisId; value: number } | null = null;
  for (const axis of TENSION_PRIORITY) {
    const value = avg[axis];
    if (Math.abs(value) >= 0.2 && (!best || Math.abs(value) > Math.abs(best.value))) best = { axis, value };
  }
  return best ? { axis: best.axis, dir: best.value < 0 ? "low" : "high" } : null;
}

// --- the filters in words -------------------------------------------------------------------

/** What we look for and what we leave out, read from the constraints the engine will really use. */
export function describeFilters(
  input: Pick<ProfileInput, "budget" | "timeAvailable" | "searchDistance" | "socialFormats" | "mustHaves">,
  dials: { practicalToWild: string; effort: string },
  copy: Copy,
): { seek: string[]; omit: string[] } {
  const c = resolveConstraints({
    interests: [],
    interestDomains: [],
    socialFormats: input.socialFormats,
    practicalToWild: dials.practicalToWild,
    budget: input.budget,
    effort: dials.effort,
    timeAvailable: input.timeAvailable,
    ageCategory: "",
    mustHaves: input.mustHaves,
    seed: "profile",
  });

  const seek: string[] = [];
  if (c.formats && copy.seekLines.formats[c.formats[0]]) seek.push(copy.seekLines.formats[c.formats[0]]);
  if (c.setting === "outdoor") seek.push(copy.seekLines.outdoor);
  if (c.setting === "indoor") seek.push(copy.seekLines.indoor);
  if (c.intensityCap === 1) seek.push(copy.seekLines.effortMinimal);
  if (c.intensityCap === 3) seek.push(copy.seekLines.effortCommitted);
  if (c.costCap === 0) seek.push(copy.seekLines.budget.free);
  else if (c.costCap === 2 && input.budget === "25") seek.push(copy.seekLines.budget["25"]);
  else if (c.costCap === 3 && input.budget === "100") seek.push(copy.seekLines.budget["100"]);
  if (copy.seekLines.time[input.timeAvailable]) seek.push(copy.seekLines.time[input.timeAvailable]);
  if (copy.seekLines.distance[input.searchDistance]) seek.push(copy.seekLines.distance[input.searchDistance]);

  const omit: string[] = [];
  if (c.noGroups) omit.push(copy.omitLines.noGroups);
  if (c.setting === "outdoor") omit.push(copy.omitLines.needsInside);
  if (c.setting === "indoor") omit.push(copy.omitLines.needsOutside);
  // "No groups" already says it; do not add the near-identical line about how they like to be together.
  if (c.formats && !c.noGroups) omit.push(copy.omitLines.formats);
  if (c.intensityCap === 1) omit.push(copy.omitLines.effortMinimal);
  if (c.hideSupervised) omit.push(copy.omitLines.supervised);
  if (c.costCap === 0) omit.push(copy.omitLines.costFree);
  if (c.intensityCap === 2) omit.push(copy.omitLines.effortSome);
  if (c.costCap === 2) omit.push(copy.omitLines.costMid);

  return { seek: seek.slice(0, 3), omit: omit.slice(0, 2) };
}

// --- starting points for "what are we missing" ----------------------------------------------

export function suggestMissing(profile: Record<string, number>, copy: Copy, n = 3): string[] {
  const top = topTags(profile, 6);
  const top5 = new Set(top.slice(0, 5));
  const out: string[] = [];
  const add = (text: string | undefined) => {
    if (text && !out.includes(text) && out.length < n) out.push(text);
  };
  for (const combo of copy.combos) if (top5.has(combo.tags[0]) && top5.has(combo.tags[1])) add(combo.text);
  for (const tag of top) add(copy.suggestions[tag]);
  return out;
}

// --- the whole screen -----------------------------------------------------------------------

export function buildProfileStory(input: ProfileInput, copy: Copy): ProfileStory {
  const override = sanitizeAxesOverride(input.override);
  const fromImages = averageAxes(input.cards, input.chosen);
  const axes = effectiveAxes(fromImages, override);
  const anything = input.chosen.length > 0 || Object.keys(override).length > 0;
  const dials = deriveDials(axes, anything);
  const profile = tagProfile(input.cards, input.chosen, input.corrections);
  const nameVars = { name: input.name };

  const tensionAxis = findTension(input.cards, input.chosen);
  const pickedCards = pickRepresentativeCards(input, 3, tensionAxis);
  const ordered = [...input.corrections, ...topTags(profile, 6).filter((t) => !input.corrections.includes(t))].slice(0, 2);
  const tags = ordered.map((t) => (input.tagLabels[t] ?? t).toLowerCase());

  // 1. what they chose
  const list = joinAnd(
    pickedCards.map((c) => `‘${lowerFirst(c.label)}’`),
    copy.and,
  );
  const sentences: string[] = [];
  if (pickedCards.length === 0) {
    sentences.push(input.gift ? fill(copy.openGift, nameVars) : copy.open);
  } else {
    sentences.push(fill(input.gift ? copy.choseGift : copy.chose, { ...nameVars, list }));
    // 2. what we read in them
    if (tags.length === 1) sentences.push(fill(copy.readOne, { a: tags[0] }));
    if (tags.length >= 2) sentences.push(fill(copy.readTwo, { a: tags[0], b: tags[1] }));
    // 3. what we are looking for, in the words of the axes that lean clearly
    const lean = axisLeanings(axes);
    const leaning = [
      lean.setting ? { rank: Math.abs(axes.setting), order: 0, text: copy.leanings[lean.setting] } : null,
      lean.energy ? { rank: Math.abs(axes.energy), order: 1, text: copy.leanings[lean.energy] } : null,
      lean.social ? { rank: Math.abs(axes.social), order: 2, text: copy.leanings[lean.social] } : null,
    ].filter((x): x is { rank: number; order: number; text: string } => !!x);
    // The two that lean hardest, said in a fixed order (place, pace, company).
    const parts = leaning
      .sort((a, b) => b.rank - a.rank || a.order - b.order)
      .slice(0, 2)
      .sort((a, b) => a.order - b.order)
      .map((x) => x.text);
    sentences.push(parts.length ? fill(copy.seek, { parts: parts.join(", ") }) : copy.seekNeutral);
  }
  // 4. the practical frame
  const items: string[] = [];
  if (copy.time[input.timeAvailable]) items.push(copy.time[input.timeAvailable]);
  if (copy.budget[input.budget]) items.push(copy.budget[input.budget]);
  if (input.place) items.push(fill(copy.near, { place: input.place }));
  const others = input.company.filter((v) => copy.company[v]);
  if (others.length > 0) items.push(fill(copy.withWho, { list: joinAnd(others.map((v) => copy.company[v]), copy.and) }));
  else if (input.company.includes("alone")) items.push(copy.noCompany);
  if (items.length > 0) sentences.push(fill(copy.practical, { list: joinAnd(items, copy.and) }));

  // the tension, or the strongest lean, or the plain fact that nothing leans
  let tension: ProfileStory["tension"];
  if (pickedCards.length === 0) {
    tension = { kind: "open", axis: null, text: input.gift ? fill(copy.openGift, nameVars) : copy.open };
  } else if (tensionAxis) {
    tension = { kind: "tension", axis: tensionAxis, text: fill(input.gift ? copy.tensionGift[tensionAxis] : copy.tension[tensionAxis], nameVars) };
  } else {
    const strong = strongestAxis(fromImages);
    tension = strong
      ? { kind: "strong", axis: strong.axis, text: (input.gift ? copy.strongGift : copy.strong)[strong.axis][strong.dir] }
      : { kind: "balanced", axis: null, text: input.gift ? copy.balancedGift : copy.balanced };
  }

  const filters = describeFilters(input, dials, copy);

  return {
    pickedCards: pickedCards.map((c) => ({ id: c.id, label: c.label, image: c.image })),
    tags,
    story: sentences.join(" "),
    tension,
    axes,
    fromImages,
    seek: filters.seek,
    omit: filters.omit,
    suggestions: suggestMissing(profile, copy),
  };
}

