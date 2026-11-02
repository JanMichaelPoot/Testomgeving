import { buildAssociationLibrary } from "@/lib/discovery/associations";
import { sampleBalancedBatch } from "@/lib/discovery/twoPages";
import { layoutWindow, type WindowItem, type WindowLayout } from "@/lib/windowLayout";

// The window on the landing page: the same rectangular sash window as everywhere in the app (layoutWindow), filled with real
// images of the association library instead of one photo in an arch. A visitor sees eight of them, another set on another
// visit, and a few spare ones that swap in one by one while the page is open (HeroWindow.tsx).

/** Two sashes of 2 x 2 panes. */
export const HERO_WINDOW_PANES = 8;
/** Images that wait for their turn to swap into a pane. */
export const HERO_WINDOW_SPARE = 6;

export interface HeroWindowData {
  items: WindowItem[];
  spare: WindowItem[];
}

/** The layout of the hero window: always the sash style, so it is the same window as the app's, only bigger. */
export function heroLayout(items: readonly WindowItem[]): WindowLayout {
  return layoutWindow(items, { style: "schuifraam" });
}

/**
 * Eight images for the panes and six spare ones, all from different families, balanced over the registers and rounds the same
 * way page 1 of the intake is (sampleBalancedBatch), so the window never shows eight times the same kind of picture. The same
 * seed gives the same window; the landing page draws a new seed per visit.
 */
export function pickHeroWindow(locale: "nl" | "en", seed: string): HeroWindowData {
  const cards = buildAssociationLibrary(locale).cards.flatMap((c) => (c.register ? [{ ...c, register: c.register }] : []));
  const shown = sampleBalancedBatch(cards, { seed: `hero:${seed}`, size: HERO_WINDOW_PANES });
  const spare = sampleBalancedBatch(cards, { seed: `hero-spare:${seed}`, size: HERO_WINDOW_SPARE, exclude: shown.map((c) => c.id) });
  const toItem = (c: (typeof cards)[number]): WindowItem => ({
    id: c.id,
    kind: "images",
    image: c.image,
    label: c.label,
    weight: 0.5,
    level: 3,
    tags: Object.keys(c.tagWeights),
  });
  return { items: shown.map(toItem), spare: spare.map(toItem) };
}

/** A window with a seed of its own: one per request on the landing page, so a returning visitor sees another set of images. */
export function randomHeroWindow(locale: "nl" | "en"): HeroWindowData {
  return pickHeroWindow(locale, Math.random().toString(36).slice(2));
}
