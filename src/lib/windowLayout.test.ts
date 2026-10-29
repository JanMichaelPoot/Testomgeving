import { describe, expect, it } from "vitest";
import {
  WINDOW_HEIGHT,
  WINDOW_MAX_PANES,
  WINDOW_MIN_PANES,
  WINDOW_WIDTH,
  layoutWindow,
  paneBox,
  styleForBreadth,
  windowBreadth,
  type WindowItem,
  type WindowStyle,
} from "@/lib/windowLayout";

const STYLES: WindowStyle[] = ["schuifraam", "t-raam", "groot-glas"];

const item = (i: number, extra: Partial<WindowItem> = {}): WindowItem => ({
  id: `i${i}`,
  kind: (["worlds", "places", "moments", "senses"] as const)[i % 4],
  image: `/illustrations/x/${i}.jpg`,
  label: `Beeld ${i}`,
  weight: ((i * 7) % 10) / 10,
  level: 1 + (i % 7),
  tags: [`t${i % 9}`, `u${i % 5}`, `v${i}`],
  ...extra,
});
const items = (n: number, extra?: (i: number) => Partial<WindowItem>) => Array.from({ length: n }, (_, i) => item(i, extra?.(i)));

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6;

describe("every window, from 3 to 24 panes, in every style", () => {
  for (const style of STYLES) {
    for (let n = WINDOW_MIN_PANES; n <= WINDOW_MAX_PANES; n++) {
      it(`${style} with ${n} choices: one pane per choice, inside the glass, no overlap, no leftover cell`, () => {
        const layout = layoutWindow(items(n), { style });
        expect(layout.style).toBe(style);
        expect(layout.panes).toHaveLength(n);
        // every choice appears exactly once
        const used = layout.panes.map((p) => p.item).filter((x): x is number => x !== null).sort((a, b) => a - b);
        expect(used).toEqual(Array.from({ length: n }, (_, i) => i));
        const g = layout.glass;
        for (const p of layout.panes) {
          expect(p.x).toBeGreaterThanOrEqual(g.x - 1e-6);
          expect(p.y).toBeGreaterThanOrEqual(g.y - 1e-6);
          expect(p.x + p.w).toBeLessThanOrEqual(g.x + g.w + 1e-6);
          expect(p.y + p.h).toBeLessThanOrEqual(g.y + g.h + 1e-6);
          expect(p.w).toBeGreaterThan(8); // a pane stays big enough to show something on a phone
          expect(p.h).toBeGreaterThan(8);
        }
        for (let i = 0; i < layout.panes.length; i++) for (let j = i + 1; j < layout.panes.length; j++) expect(overlaps(layout.panes[i], layout.panes[j])).toBe(false);
        // the structure is a transom row plus a full rows x cols grid: nothing is left over
        expect(layout.transom + layout.rows * layout.cols).toBe(n);
        // symmetric: the panes of a row sit mirrored around the vertical axis of the glass
        const axis = g.x + g.w / 2;
        for (const row of new Set(layout.panes.map((p) => p.y.toFixed(3)))) {
          const inRow = layout.panes.filter((p) => p.y.toFixed(3) === row);
          const left = Math.min(...inRow.map((p) => p.x));
          const right = Math.max(...inRow.map((p) => p.x + p.w));
          expect(left + right).toBeCloseTo(2 * axis, 3);
        }
      });
    }
  }
});

describe("the layout of a given set of choices", () => {
  it("is deterministic: the same ordered choices give the same window, byte for byte", () => {
    expect(JSON.stringify(layoutWindow(items(11)))).toBe(JSON.stringify(layoutWindow(items(11))));
  });

  it("has the same outer size whatever the style, so the page does not jump when the style changes", () => {
    for (const style of STYLES) {
      const l = layoutWindow(items(9), { style });
      expect([l.width, l.height]).toEqual([WINDOW_WIDTH, WINDOW_HEIGHT]);
    }
  });

  it("with fewer than three choices still shows three panes, the free ones empty", () => {
    for (const n of [0, 1, 2]) {
      const l = layoutWindow(items(n));
      expect(l.panes).toHaveLength(WINDOW_MIN_PANES);
      expect(l.panes.filter((p) => p.item === null)).toHaveLength(WINDOW_MIN_PANES - n);
    }
  });

  it("with more than 24 choices keeps the 24 strongest, in the order they were chosen", () => {
    const many = items(30, (i) => ({ weight: i < 6 ? 0 : 0.5 + i / 100 }));
    const l = layoutWindow(many);
    expect(l.panes).toHaveLength(WINDOW_MAX_PANES);
    expect(l.shown.map((x) => x.id)).toEqual(many.slice(6).map((x) => x.id));
  });

  it("gives the strongest choices the transom light", () => {
    const strong = items(9, (i) => ({ weight: i === 4 ? 1 : i === 7 ? 0.9 : 0.1 }));
    const l = layoutWindow(strong, { style: "t-raam" });
    expect(l.transom).toBeGreaterThan(0);
    const inTransom = l.panes.filter((p) => p.zone === "bovenlicht").map((p) => l.shown[p.item!].id);
    expect(inTransom).toContain("i4");
    if (l.transom >= 2) expect(inTransom).toContain("i7");
    // and the transom light is the top row
    const topY = Math.min(...l.panes.map((p) => p.y));
    for (const p of l.panes.filter((x) => x.zone === "bovenlicht")) expect(p.y).toBe(topY);
  });

  it("is a classic T-window for three choices: one transom light over two casements", () => {
    const l = layoutWindow(items(3), { style: "t-raam" });
    expect([l.transom, l.cols, l.rows]).toEqual([1, 2, 1]);
  });

  it("shows a sash window as two sashes: an even number of rows gets a heavier meeting rail in the middle", () => {
    const l = layoutWindow(items(12), { style: "schuifraam" });
    if (l.rows % 2 === 0 && l.rows >= 2) {
      const rowYs = [...new Set(l.panes.filter((p) => p.zone === "hoofd").map((p) => p.y))].sort((a, b) => a - b);
      const gaps = rowYs.slice(1).map((y, i) => y - (rowYs[i] + l.panes.find((p) => p.y === rowYs[i])!.h));
      const mid = gaps[l.rows / 2 - 1];
      expect(mid).toBeGreaterThan(Math.max(...gaps.filter((_, i) => i !== l.rows / 2 - 1), 0));
    }
  });

  it("converts a pane to CSS percentages of the whole frame", () => {
    const l = layoutWindow(items(5));
    const box = paneBox(l, l.panes[0]);
    expect(box.left).toMatch(/^\d+(\.\d+)?%$/);
    expect(parseFloat(box.width)).toBeLessThan(100);
  });
});

describe("the breadth of a profile decides the style", () => {
  const focused = items(9, () => ({ tags: ["nature", "stillness", "outdoors", "discovery"] }));
  const wide = items(9, (i) => ({ tags: [`a${i}`, `b${i}`, `c${i}`, `d${i}`] }));

  it("is low for a focused profile and high for a wide one", () => {
    expect(windowBreadth(focused)).toBeLessThan(0.05);
    expect(windowBreadth(wide)).toBeGreaterThan(0.9);
  });

  it("maps to three styles: big glass for focus, a T-window in between, a sash window for breadth", () => {
    expect(styleForBreadth(0)).toBe("groot-glas");
    expect(styleForBreadth(0.45)).toBe("t-raam");
    expect(styleForBreadth(0.9)).toBe("schuifraam");
    expect(layoutWindow(focused).style).toBe("groot-glas");
    expect(layoutWindow(wide).style).toBe("schuifraam");
  });

  it("says nothing yet for fewer than three choices (the middle)", () => {
    expect(windowBreadth(items(2))).toBe(0.5);
  });
});
