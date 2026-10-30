// The generative window ("Fase 2" of the focused improvement). A window is a frame with a glass area divided by mullions
// into panes; every chosen image gets its own pane, and the shape of the whole window follows the person's choices:
//
//   - the NUMBER of panes is the number of choices, kept between 3 and 24 (fewer than 3 choices leave empty panes);
//   - the STYLE follows how broad the profile is (rule "B"): a wide, exploring profile gives a fine mullion pattern with
//     many small panes (a Dutch sash window, 18th century), a mixed profile a T-window with a transom light (Empire),
//     a focused one few large panes (a late 19th century window with big glass);
//   - the strongest choices (highest weight) take the transom light, the prominent panes at the top;
//   - the structure is always rectangular and symmetric: a transom row of t equal panes on top, then r rows of c equal
//     panes, so there are never leftover cells;
//   - it is deterministic: the same ordered choices give the same window (shareable, reproducible).
//
// Pure and client-safe: the website (React), the PDF cover (pdf-lib) and the share images (Satori) all draw these same
// rectangles. All numbers are in "units" of a fixed 300 x 400 frame (3:4), so the page never jumps when the style changes.

export const WINDOW_MIN_PANES = 3;
export const WINDOW_MAX_PANES = 24;
export const WINDOW_WIDTH = 300;
export const WINDOW_HEIGHT = 400;

// "images" and "picks" belong to the two-page intake: the associative images of page 1 and the activities chosen on page 2.
export const WINDOW_KINDS = ["worlds", "places", "moments", "senses", "images", "picks"] as const;
export type WindowKind = (typeof WINDOW_KINDS)[number];

/** One chosen element of the profile, as the window needs it. */
export interface WindowItem {
  id: string;
  kind: WindowKind;
  /** Public path of the photo; absent for a placeholder pane ("Verras me"). */
  image?: string;
  label: string;
  /** Shown instead of a photo (e.g. "Verras me"). */
  placeholder?: string;
  /** 0..1: how central this choice is to the profile. The strongest ones take the transom light. */
  weight: number;
  /** 1..7: how far from the familiar the choice is (the discovery scale), from the novelty axis of the image. */
  level: number;
  /** The connection tags of the choice (for the breadth of the profile). */
  tags: string[];
}

export type WindowStyle = "schuifraam" | "t-raam" | "groot-glas";

export interface PaneRect {
  /** Position in the display order (transom first, then rows left to right). */
  slot: number;
  /** Index into `shown`, or null for an empty pane. */
  item: number | null;
  x: number;
  y: number;
  w: number;
  h: number;
  zone: "bovenlicht" | "hoofd";
}

export interface WindowLayout {
  style: WindowStyle;
  /** 0..1, how broad the profile is (what chose the style). */
  breadth: number;
  width: number;
  height: number;
  /** Frame thickness of the sides, the head and the foot, and the glass area they leave. */
  frame: { stile: number; head: number; foot: number };
  glass: { x: number; y: number; w: number; h: number };
  panes: PaneRect[];
  /** The items in display order; `panes[i].item` indexes into this. */
  shown: WindowItem[];
  cols: number;
  rows: number;
  /** Number of panes in the transom light. */
  transom: number;
}

interface StyleSpec {
  stile: number;
  head: number;
  foot: number;
  mullion: number;
  /** Heavier horizontal bar between two sashes (when the rows split evenly). */
  meetingRail: number;
  /** Heavier vertical bar between two casements (when the columns split evenly). */
  centerStile: number;
  transomFrac: number;
  transomBar: number;
  targetAspect: number;
}

const SPECS: Record<WindowStyle, StyleSpec> = {
  // Two sashes, fine mullions, small upright panes.
  schuifraam: { stile: 12, head: 12, foot: 12, mullion: 3, meetingRail: 7, centerStile: 3, transomFrac: 0.14, transomBar: 5, targetAspect: 0.8 },
  // A transom light on top, two or three tall casements below.
  "t-raam": { stile: 14, head: 14, foot: 14, mullion: 4, meetingRail: 4, centerStile: 8, transomFrac: 0.22, transomBar: 9, targetAspect: 0.5 },
  // Few large panes, heavy frame.
  "groot-glas": { stile: 18, head: 18, foot: 18, mullion: 6, meetingRail: 6, centerStile: 10, transomFrac: 0.2, transomBar: 10, targetAspect: 0.95 },
};

const MAX_COLS = 8;
const MAX_ROWS = 8;
const MAX_TRANSOM = 6;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * How broad the profile is, 0 (focused) to 1 (wide): the effective number of different connection tags over all
 * choices (exp of the entropy of the tag counts), mapped from 4 (one theme) to 18 (many themes). Fewer than three
 * choices say nothing yet and count as the middle.
 */
export function windowBreadth(items: readonly Pick<WindowItem, "tags">[]): number {
  if (items.length < WINDOW_MIN_PANES) return 0.5;
  const counts = new Map<string, number>();
  let total = 0;
  for (const item of items) {
    for (const tag of new Set(item.tags)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
      total++;
    }
  }
  if (total === 0) return 0.5;
  let entropy = 0;
  for (const n of counts.values()) {
    const p = n / total;
    entropy -= p * Math.log(p);
  }
  return clamp((Math.exp(entropy) - 4) / 14, 0, 1);
}

export const STYLE_BREAKPOINTS = { schuifraam: 0.6, tRaam: 0.3 } as const;

export function styleForBreadth(breadth: number): WindowStyle {
  return breadth >= STYLE_BREAKPOINTS.schuifraam ? "schuifraam" : breadth >= STYLE_BREAKPOINTS.tRaam ? "t-raam" : "groot-glas";
}

interface Candidate {
  t: number;
  cols: number;
  rows: number;
  cost: number;
}

function transomPenalty(style: WindowStyle, t: number): number {
  if (style === "schuifraam") return t === 0 ? 0 : 0.9 + 0.2 * t;
  if (style === "t-raam") return t === 0 ? 1.2 : t <= 2 ? 0 : 0.5 * (t - 2);
  return t === 0 ? 0.3 : t === 1 ? 0 : 0.8 * (t - 1);
}

/** Pixel-free geometry of one (t, cols, rows) arrangement in the given style. */
function geometry(style: WindowStyle, t: number, cols: number, rows: number) {
  const s = SPECS[style];
  const gx = s.stile;
  const gy = s.head;
  const gw = WINDOW_WIDTH - 2 * s.stile;
  const gh = WINDOW_HEIGHT - s.head - s.foot;
  const transomH = t > 0 ? gh * s.transomFrac : 0;
  const mainY = gy + (t > 0 ? transomH + s.transomBar : 0);
  const mainH = gh - (t > 0 ? transomH + s.transomBar : 0);

  // Vertical gaps in the main area: a heavier centre stile between two casements, otherwise plain mullions.
  const colGap = (i: number, n: number) => (n % 2 === 0 && i === n / 2 - 1 ? s.centerStile : s.mullion);
  const rowGap = (i: number, n: number) => (style === "schuifraam" && n % 2 === 0 && i === n / 2 - 1 ? s.meetingRail : s.mullion);

  const gapsX = Array.from({ length: cols - 1 }, (_, i) => colGap(i, cols));
  const gapsY = Array.from({ length: rows - 1 }, (_, i) => rowGap(i, rows));
  const pw = (gw - gapsX.reduce((a, b) => a + b, 0)) / cols;
  const ph = (mainH - gapsY.reduce((a, b) => a + b, 0)) / rows;

  const tGaps = Array.from({ length: Math.max(0, t - 1) }, (_, i) => colGap(i, t));
  const tw = t > 0 ? (gw - tGaps.reduce((a, b) => a + b, 0)) / t : 0;

  return { s, gx, gy, gw, gh, transomH, mainY, mainH, gapsX, gapsY, pw, ph, tGaps, tw };
}

/** The best (t, cols, rows) for this many panes in this style; deterministic. */
function solve(style: WindowStyle, panes: number): Candidate {
  const spec = SPECS[style];
  let best: Candidate | null = null;
  for (let t = 0; t <= Math.min(MAX_TRANSOM, panes - 1); t++) {
    const rest = panes - t;
    for (let cols = 1; cols <= Math.min(MAX_COLS, rest); cols++) {
      if (rest % cols !== 0) continue;
      const rows = rest / cols;
      if (rows > MAX_ROWS) continue;
      const g = geometry(style, t, cols, rows);
      const aspect = g.pw / g.ph;
      // Panes far from upright (long thin strips) never read as a window, whatever else fits.
      let cost = 3 * Math.abs(Math.log(aspect / spec.targetAspect)) + transomPenalty(style, t) + (aspect > 1.8 || aspect < 0.3 ? 2 : 0);
      if (t > 0) cost += 0.5 * Math.abs(Math.log(g.tw / g.transomH / 1.6));
      // A sash window reads best with an even number of rows (two sashes).
      if (style === "schuifraam" && rows % 2 === 1 && rows > 1) cost += 0.3;
      const cand = { t, cols, rows, cost };
      if (!best || cost < best.cost - 1e-9 || (Math.abs(cost - best.cost) <= 1e-9 && (t < best.t || (t === best.t && cols < best.cols)))) best = cand;
    }
  }
  // Every count from 3 to 24 has an arrangement (checked by the tests); this only guards a future change.
  return best ?? { t: 0, cols: 1, rows: panes, cost: Infinity };
}

/** Which items to show (at most 24, the strongest when there are more), in the order they were chosen. */
function cap(items: readonly WindowItem[]): WindowItem[] {
  if (items.length <= WINDOW_MAX_PANES) return [...items];
  const keep = new Set(
    items
      .map((item, i) => ({ i, w: item.weight }))
      .sort((a, b) => b.w - a.w || a.i - b.i)
      .slice(0, WINDOW_MAX_PANES)
      .map((x) => x.i),
  );
  return items.filter((_, i) => keep.has(i));
}

/** `opts.style` forces a style (a gallery, a test); normally the breadth of the profile decides. */
export function layoutWindow(input: readonly WindowItem[], opts: { style?: WindowStyle } = {}): WindowLayout {
  const shown = cap(input);
  const n = shown.length;
  const panes = clamp(n, WINDOW_MIN_PANES, WINDOW_MAX_PANES);
  const breadth = windowBreadth(shown);
  const style = opts.style ?? styleForBreadth(breadth);
  const { t, cols, rows } = solve(style, panes);
  const g = geometry(style, t, cols, rows);
  const { s } = g;

  // The strongest choices take the transom light; the rest keep the order they were chosen in.
  const byStrength = shown.map((item, i) => ({ i, w: item.weight })).sort((a, b) => b.w - a.w || a.i - b.i);
  const top = new Set(byStrength.slice(0, Math.min(t, n)).map((x) => x.i));
  const transomItems = shown.map((_, i) => i).filter((i) => top.has(i));
  const mainItems = shown.map((_, i) => i).filter((i) => !top.has(i));

  const rects: PaneRect[] = [];
  let slot = 0;
  let x = g.gx;
  for (let k = 0; k < t; k++) {
    rects.push({ slot, item: transomItems[k] ?? null, x, y: g.gy, w: g.tw, h: g.transomH, zone: "bovenlicht" });
    slot++;
    x += g.tw + (g.tGaps[k] ?? 0);
  }
  let y = g.mainY;
  for (let r = 0; r < rows; r++) {
    x = g.gx;
    for (let c = 0; c < cols; c++) {
      rects.push({ slot, item: mainItems[r * cols + c] ?? null, x, y, w: g.pw, h: g.ph, zone: "hoofd" });
      slot++;
      x += g.pw + (g.gapsX[c] ?? 0);
    }
    y += g.ph + (g.gapsY[r] ?? 0);
  }

  return {
    style,
    breadth,
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    frame: { stile: s.stile, head: s.head, foot: s.foot },
    glass: { x: g.gx, y: g.gy, w: g.gw, h: g.gh },
    panes: rects,
    shown,
    cols,
    rows,
    transom: t,
  };
}

/** A pane rectangle as percentages of the whole frame, for CSS. */
export function paneBox(layout: WindowLayout, pane: PaneRect): { left: string; top: string; width: string; height: string } {
  const pct = (v: number, total: number) => `${((v / total) * 100).toFixed(3)}%`;
  return { left: pct(pane.x, layout.width), top: pct(pane.y, layout.height), width: pct(pane.w, layout.width), height: pct(pane.h, layout.height) };
}
