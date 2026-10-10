import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildScrimPng, scrimAlpha } from "@/lib/pdf/scrim";

describe("scrimAlpha", () => {
  it("runs from fully transparent at the top to fully opaque at the bottom, never going back", () => {
    expect(scrimAlpha(0, 256)).toBe(0);
    expect(scrimAlpha(255, 256)).toBe(255);
    let previous = -1;
    for (let row = 0; row < 256; row++) {
      const alpha = scrimAlpha(row, 256);
      expect(alpha).toBeGreaterThanOrEqual(previous);
      previous = alpha;
    }
  });

  it("eases in: the top half carries well under half of the darkness", () => {
    expect(scrimAlpha(128, 256)).toBeLessThan(80);
  });
});

describe("buildScrimPng", () => {
  const png = buildScrimPng([26, 18, 12]);

  it("is a valid PNG of 1 x 256 pixels that PDF embedding accepts, with its alpha channel", async () => {
    expect([...png.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const doc = await PDFDocument.create();
    const image = await doc.embedPng(png);
    expect(image.width).toBe(1);
    expect(image.height).toBe(256);
    const bytes = await doc.save();
    expect(bytes.length).toBeGreaterThan(0);
  });

  it("stays tiny", () => {
    expect(png.length).toBeLessThan(1500);
  });
});
