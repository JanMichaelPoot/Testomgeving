// R2.3 "Meer body per deur": the extra layers of one idea. Pure and free of any server-only
// import, so the web components, the PDF and the tests can all use it.
//
// Every layer is optional. A book made before R2.3, a model answer that left a field out, or one
// that broke a length limit simply has no such layer: the rest of the idea is shown as it always
// was, and the book never fails because of a layer.

import { storedRating, type Rating } from "@/lib/claude/rating";

/** The three sizes of one door, in this fixed order. */
export const SIZE_KINDS = ["taste", "do", "deepen"] as const;
export type SizeKind = (typeof SIZE_KINDS)[number];

export interface IdeaSize {
  kind: SizeKind;
  title: string;
  description: string;
  estimated_cost: string;
  duration: string;
}

/** A real place found by the local research (never written by the model). */
export interface IdeaPlace {
  name: string;
  city: string;
  url: string | null;
  note: string;
  /** A review score a search result showed (with its source), or absent. */
  rating?: Rating;
}

/** Another activity in the same direction, chosen by code from the relation graph. */
export interface RelatedActivity {
  id: string;
  label: string;
}

export interface IdeaLayers {
  /** Two sentences: what it feels like to be there. */
  feels_like?: string;
  /** Exactly three: taste (about an hour), do (half a day), go further (a weekend or a course). */
  sizes?: IdeaSize[];
  /** What to do after the first time. */
  next_step?: string;
  places?: IdeaPlace[];
  related?: RelatedActivity[];
}

// Hard limits (characters). The prompt asks for much shorter text; these only catch a runaway
// answer. A text over its limit is dropped, never cut off in the middle of a sentence.
export const LAYER_LIMITS = {
  feels_like: 320,
  size_title: 48,
  size_description: 170,
  size_cost: 32,
  size_duration: 32,
  next_step: 170,
} as const;

const clean = (v: unknown): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

export function normalizeFeelsLike(value: unknown): string | undefined {
  const text = clean(value);
  return text && text.length <= LAYER_LIMITS.feels_like ? text : undefined;
}

export function normalizeNextStep(value: unknown): string | undefined {
  const text = clean(value);
  return text && text.length <= LAYER_LIMITS.next_step ? text : undefined;
}

/** All three sizes, or none: two cards out of three would read as a mistake. */
export function normalizeSizes(value: unknown): IdeaSize[] | undefined {
  return checkSizes(value).sizes;
}

/** Like normalizeSizes, but says why the layer was dropped (for the generation log). */
export function checkSizes(value: unknown): { sizes?: IdeaSize[]; problem?: string } {
  if (value === undefined || value === null) return { problem: "missing" };
  if (!Array.isArray(value)) return { problem: "not a list" };
  if (value.length !== SIZE_KINDS.length) return { problem: `${value.length} sizes instead of 3` };
  const out: IdeaSize[] = [];
  for (const [i, raw] of value.entries()) {
    if (!raw || typeof raw !== "object") return { problem: `size ${i + 1} is not an object` };
    const r = raw as Record<string, unknown>;
    const title = clean(r.title);
    const description = clean(r.description);
    const estimated_cost = clean(r.estimated_cost);
    const duration = clean(r.duration);
    if (!title || !description || !estimated_cost || !duration) return { problem: `size ${i + 1} has an empty field` };
    if (title.length > LAYER_LIMITS.size_title) return { problem: `size ${i + 1} title is ${title.length} characters` };
    if (description.length > LAYER_LIMITS.size_description) return { problem: `size ${i + 1} description is ${description.length} characters` };
    if (estimated_cost.length > LAYER_LIMITS.size_cost) return { problem: `size ${i + 1} cost is ${estimated_cost.length} characters` };
    if (duration.length > LAYER_LIMITS.size_duration) return { problem: `size ${i + 1} duration is ${duration.length} characters` };
    out.push({ kind: SIZE_KINDS[i], title, description, estimated_cost, duration });
  }
  return { sizes: out };
}

/** Reads what was stored with an idea (any shape) and keeps only what is valid. */
export function readStoredLayers(raw: unknown): IdeaLayers {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const layers: IdeaLayers = {};
  const feels = normalizeFeelsLike(r.feels_like);
  if (feels) layers.feels_like = feels;
  const sizes = normalizeSizes(r.sizes);
  if (sizes) layers.sizes = sizes;
  const next = normalizeNextStep(r.next_step);
  if (next) layers.next_step = next;
  const places = normalizePlaces(r.places);
  if (places.length) layers.places = places;
  const related = normalizeRelated(r.related);
  if (related.length) layers.related = related;
  return layers;
}

export function normalizePlaces(value: unknown, max = 3): IdeaPlace[] {
  if (!Array.isArray(value)) return [];
  const out: IdeaPlace[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const name = clean(r.name);
    if (!name) continue;
    const city = clean(r.city);
    const key = `${name}|${city}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const url = typeof r.url === "string" && /^https?:\/\//i.test(r.url.trim()) ? r.url.trim() : null;
    const rating = storedRating(r.rating);
    out.push({ name, city, url, note: clean(r.note), ...(rating ? { rating } : {}) });
    if (out.length === max) break;
  }
  return out;
}

export function normalizeRelated(value: unknown, max = 3): RelatedActivity[] {
  if (!Array.isArray(value)) return [];
  const out: RelatedActivity[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const id = clean(r.id);
    const label = clean(r.label);
    if (id && label) out.push({ id, label });
    if (out.length === max) break;
  }
  return out;
}

/** Whether an idea has anything beyond the original blocks (for the "more about this door" fold and the PDF's extra page). */
export function hasMoreLayers(idea: IdeaLayers): boolean {
  return !!(idea.feels_like || idea.sizes || idea.next_step || idea.places?.length || idea.related?.length);
}

/**
 * PDF page numbers of the ideas (in door order) and of the wildcard. Page 1 is the cover, 2 the
 * profile with the possibility map, so the first idea is on page 3; an idea with extra layers has
 * a second page, which pushes everything after it on by one. The renderer and the web page both
 * use this, so "view as PDF page" can never point at the wrong page.
 */
export function pdfPageNumbers(orderedIdeas: readonly IdeaLayers[], first = 3): { ideas: number[]; wildcard: number } {
  const ideas: number[] = [];
  let next = first;
  for (const idea of orderedIdeas) {
    ideas.push(next);
    next += hasMoreLayers(idea) ? 2 : 1;
  }
  return { ideas, wildcard: next };
}

/** The entry with its layers replaced by their validated form (anything invalid or malformed is gone). */
export function withValidLayers<T extends IdeaLayers>(entry: T): T {
  const { feels_like: _f, sizes: _s, next_step: _n, places: _p, related: _r, ...rest } = entry;
  void [_f, _s, _n, _p, _r];
  return { ...rest, ...readStoredLayers(entry) } as T;
}
