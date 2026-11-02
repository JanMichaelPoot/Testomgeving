import { describe, expect, it } from "vitest";
import { HERO_WINDOW_PANES, HERO_WINDOW_SPARE, heroLayout, pickHeroWindow } from "@/lib/heroWindow";
import { hasOwnImage } from "@/lib/discovery/associations";

const familyOf = (id: string) => id.replace(/-[bc]$/, "");

describe("the hero window", () => {
  const seeds = Array.from({ length: 40 }, (_, i) => `seed-${i}`);

  it("shows eight images and keeps six spare, none of them twice", () => {
    for (const seed of seeds) {
      const { items, spare } = pickHeroWindow("nl", seed);
      expect(items).toHaveLength(HERO_WINDOW_PANES);
      expect(spare).toHaveLength(HERO_WINDOW_SPARE);
      const ids = [...items, ...spare].map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
      // Different families too: not eight variants of the same picture.
      const families = [...items, ...spare].map((i) => familyOf(i.id));
      expect(new Set(families).size).toBe(families.length);
    }
  });

  it("only uses cards that have a picture of their own", () => {
    for (const seed of seeds.slice(0, 10)) {
      const { items, spare } = pickHeroWindow("en", seed);
      for (const it of [...items, ...spare]) {
        expect(it.image).toBeTruthy();
        expect(hasOwnImage({ id: it.id, image: it.image! })).toBe(true);
        expect(it.label.length).toBeGreaterThan(0);
      }
    }
  });

  it("gives the same window for the same seed and another one for another seed", () => {
    const a = pickHeroWindow("nl", "same").items.map((i) => i.id);
    expect(pickHeroWindow("nl", "same").items.map((i) => i.id)).toEqual(a);
    const sets = new Set(seeds.map((s) => pickHeroWindow("nl", s).items.map((i) => i.id).sort().join(",")));
    expect(sets.size).toBeGreaterThan(30);
  });

  it("is laid out as the app's sash window: two sashes of 2 x 2 panes, none empty", () => {
    const layout = heroLayout(pickHeroWindow("nl", "layout").items);
    expect(layout.style).toBe("schuifraam");
    expect(layout.cols).toBe(2);
    expect(layout.rows).toBe(4);
    expect(layout.transom).toBe(0);
    expect(layout.panes).toHaveLength(8);
    expect(layout.panes.every((p) => p.item !== null)).toBe(true);
  });
});
