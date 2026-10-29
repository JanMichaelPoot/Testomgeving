import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { provenanceFor } from "@/lib/imageProvenance";

// Fase 3: no image ships without a recorded source and licence.

const PUBLIC = path.resolve("public");
const IMAGE = /\.(jpe?g|png|webp|avif|gif)$/i;

function images(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) images(full, out);
    else if (IMAGE.test(name)) out.push(path.relative(PUBLIC, full).replace(/\\/g, "/"));
  }
  return out;
}

describe("image provenance", () => {
  const all = images(path.join(PUBLIC, "illustrations")).concat(images(path.join(PUBLIC, "logo")), images(path.join(PUBLIC, "email")));

  it("has a recorded source and licence for every image under /public", () => {
    expect(all.length).toBeGreaterThan(500);
    const missing = all.filter((p) => provenanceFor(p) === null);
    expect(missing).toEqual([]);
  });

  it("flags exactly the supplied images whose origin the repository cannot establish", () => {
    const flagged = all.filter((p) => provenanceFor(p)?.confirm);
    expect(flagged.sort()).toEqual(["illustrations/hero-fan/hero.jpg", "illustrations/outdoor/openness.jpg", "illustrations/outdoor/situation.jpg"]);
  });

  it("matches the specific rule before the general one", () => {
    expect(provenanceFor("illustrations/outdoor/situation.jpg")?.confirm).toBe(true);
    expect(provenanceFor("illustrations/outdoor/final.jpg")?.confirm).toBe(false);
    expect(provenanceFor("illustrations/discovery/pottenbakken.jpg")?.source).toMatch(/discovery/);
    expect(provenanceFor("illustrations/does-not-exist/x.jpg")).toBeNull();
  });

  it("states the licence of generated images in words, not as a code", () => {
    const p = provenanceFor("illustrations/associations/place-forest-edge.jpg")!;
    expect(p.license).toMatch(/Gemini/);
    expect(p.license).not.toBe("generated");
  });
});
