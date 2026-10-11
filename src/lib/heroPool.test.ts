import { describe, expect, it } from "vitest";
import { HERO_POOL, pickHero } from "@/lib/heroPool";

describe("hero pool", () => {
  it("has 27 distinct photos with a scene and a public image path", () => {
    expect(HERO_POOL).toHaveLength(27);
    expect(new Set(HERO_POOL.map((h) => h.id)).size).toBe(27);
    for (const h of HERO_POOL) {
      expect(h.scene.length).toBeGreaterThan(30);
      expect(h.image).toMatch(/^\/illustrations\/.+\.(jpg|png|webp)$/);
    }
  });

  it("asks for no people, no hands and no text in any scene", () => {
    for (const h of HERO_POOL) expect(h.scene).not.toMatch(/\b(people|person|man|woman|child|hand|hands|face|faces|text)\b/i);
  });

  it("picks the same photo for the same seed and spreads over the pool for other seeds", () => {
    expect(pickHero("a").id).toBe(pickHero("a").id);
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) seen.add(pickHero(`visit-${i}`).id);
    expect(seen.size).toBeGreaterThanOrEqual(24);
  });
});
