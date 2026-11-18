import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { ALL_ASSOCIATIONS, ASSOCIATIONS, THEMES, THEME_CARDS, buildAssociationLibrary, describeAssociationsForPrompt, getAssociation, hasOwnImage, sanitizeAssociations } from "@/lib/discovery/associations";
import { TAGS, ALL_ACTIVITIES } from "@/lib/discovery/library";
import { MAX_THEME_PICKS, MIN_THEME_PICKS, THEME_GROUP_ORDER, sampleThemeTiles } from "@/lib/discovery/twoPages";
import { tagProfile } from "@/lib/discovery/associationProfile";

// The 30 "Iets met ..." theme tiles of the image intake (Step 210, docs/voorstel-themabeelden.md).

const lib = buildAssociationLibrary("nl", undefined, false, "themes");
const familyOf = (c: { id: string; family?: string }) => c.family ?? c.id;

describe("theme cards: the data", () => {
  it("are 30 themes of 2 or 3 images each, with real files, unique ids and no clash with the old cards", () => {
    expect(THEMES).toHaveLength(30);
    const ids = THEME_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const old = new Set(ASSOCIATIONS.map((c) => c.id));
    for (const id of ids) expect(old.has(id), id).toBe(false);
    for (const t of THEMES) {
      expect(t.images.length, t.id).toBeGreaterThanOrEqual(2);
      expect(t.images.length, t.id).toBeLessThanOrEqual(3);
      for (const im of t.images) expect(existsSync(path.join(process.cwd(), "public", im.image)), im.image).toBe(true);
    }
    for (const c of THEME_CARDS) expect(hasOwnImage(c), c.id).toBe(true);
  });

  it("carry real tags, a title and a blurb in both languages, and a group the page knows", () => {
    const tags = new Set(TAGS.map((t) => t.id));
    for (const t of THEMES) {
      expect(t.label.nl.startsWith("Iets"), t.id).toBe(true);
      expect(t.label.en.startsWith("Something"), t.id).toBe(true);
      expect(t.blurb.nl.length, t.id).toBeGreaterThan(10);
      expect(t.blurb.en.length, t.id).toBeGreaterThan(10);
      expect(Object.keys(t.tagWeights).length, t.id).toBeGreaterThan(0);
      for (const tag of Object.keys(t.tagWeights)) expect(tags.has(tag), `${t.id}:${tag}`).toBe(true);
      expect(THEME_GROUP_ORDER as readonly string[], t.id).toContain(t.group);
      for (const v of Object.values(t.axes)) expect(Math.abs(v)).toBeLessThanOrEqual(1);
    }
  });

  it("each lead to enough of the library: at least ten activities per theme (the tile is a promise)", () => {
    const live = ALL_ACTIVITIES.filter((a) => a.status !== "retired" && !a.image_pending);
    const themesJson = THEMES as unknown as { id: string; members: { subs: string[]; tags: string[] } }[];
    for (const t of themesJson) {
      const n = live.filter((a) => t.members.subs.includes(a.domain) || t.members.subs.includes(`${a.domain}:${a.sub}`) || t.members.tags.some((x) => a.tags.includes(x))).length;
      expect(n, t.id).toBeGreaterThanOrEqual(10);
    }
  });
});

describe("the image intake library", () => {
  it("offers only the theme tiles (the old cards stay in the data but are not shown)", () => {
    expect(lib.cards).toHaveLength(THEME_CARDS.length);
    expect(lib.cards.every((c) => c.round === "themes")).toBe(true);
    expect(new Set(lib.cards.map(familyOf)).size).toBe(30);
  });

  it("still resolves the old cards for a stored book: the default library has both", () => {
    const all = buildAssociationLibrary("nl", undefined, false);
    expect(all.cards.some((c) => c.round === "places")).toBe(true);
    expect(all.cards.some((c) => c.round === "themes")).toBe(true);
    expect(getAssociation(ASSOCIATIONS[0].id)).toBeDefined();
    expect(getAssociation(THEME_CARDS[0].id)).toBeDefined();
    expect(ALL_ASSOCIATIONS).toHaveLength(ASSOCIATIONS.length + THEME_CARDS.length);
  });
});

describe("sampleThemeTiles (page 1)", () => {
  it("shows all 30 themes once, the groups in the fixed order", () => {
    const tiles = sampleThemeTiles(lib.cards, { seed: "s1" });
    expect(tiles).toHaveLength(30);
    expect(new Set(tiles.map(familyOf)).size).toBe(30);
    const order = tiles.map((c) => THEME_GROUP_ORDER.indexOf(c.group as (typeof THEME_GROUP_ORDER)[number]));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("is the same for the same seed and mixes the tiles inside a group for another", () => {
    const a = sampleThemeTiles(lib.cards, { seed: "s1" }).map((c) => c.id);
    expect(sampleThemeTiles(lib.cards, { seed: "s1" }).map((c) => c.id)).toEqual(a);
    const orders = new Set(Array.from({ length: 8 }, (_, i) => sampleThemeTiles(lib.cards, { seed: `x${i}` }).map(familyOf).join(",")));
    expect(orders.size).toBeGreaterThan(1);
  });

  it("rotates: a visit that saw the first images shows the other image of every theme", () => {
    const first = sampleThemeTiles(lib.cards, { seed: "v1" });
    const second = sampleThemeTiles(lib.cards, { seed: "v2", seen: first.map((c) => c.id) });
    const byFamily = new Map(first.map((c) => [familyOf(c), c.id]));
    for (const c of second) expect(c.id, familyOf(c)).not.toBe(byFamily.get(familyOf(c)));
    // And a third visit has seen every image of the 2-image themes: it goes back to the one shown longest ago.
    const third = sampleThemeTiles(lib.cards, { seed: "v3", seen: [...first, ...second].map((c) => c.id) });
    expect(third).toHaveLength(30);
  });

  it("keeps the image of a theme the visitor chose, and choosing moves no other tile", () => {
    const base = sampleThemeTiles(lib.cards, { seed: "k1" });
    const chosen = base[7];
    const other = lib.cards.find((c) => familyOf(c) === familyOf(chosen) && c.id !== chosen.id)!;
    // Whatever was seen before, the chosen image stays.
    const kept = sampleThemeTiles(lib.cards, { seed: "k2", seen: [chosen.id], keep: [chosen.id] });
    expect(kept.find((c) => familyOf(c) === familyOf(chosen))!.id).toBe(chosen.id);
    expect(other.id).not.toBe(chosen.id);
    const withKeep = sampleThemeTiles(lib.cards, { seed: "k1", keep: [chosen.id] });
    expect(withKeep.map((c) => c.id)).toEqual(base.map((c) => c.id));
  });
});

describe("picking themes", () => {
  it("allows up to the maximum of themes in an answer, and still five of an old round", () => {
    const eight = THEMES.slice(0, MAX_THEME_PICKS + 1).map((t) => `theme-${t.images[0].id}`);
    expect(sanitizeAssociations({ associations: eight }).associations).toHaveLength(MAX_THEME_PICKS);
    const oldPlaces = ASSOCIATIONS.filter((c) => c.round === "places").slice(0, 7).map((c) => c.id);
    expect(sanitizeAssociations({ associations: oldPlaces }).associations).toHaveLength(5);
    expect(MIN_THEME_PICKS).toBe(3);
  });

  it("turns three themes into a tag profile and a prompt line", () => {
    const ids = ["theme-natuur-a", "theme-dieren-b", "theme-water-a"];
    const profile = tagProfile(ALL_ASSOCIATIONS, ids);
    expect(profile["nature"] ?? 0).toBeGreaterThan(0);
    expect(profile["animals"] ?? 0).toBeGreaterThan(0);
    const text = describeAssociationsForPrompt(ids);
    expect(text).toContain("Something with nature");
    expect(text).toContain("Areas of interest");
  });
});
