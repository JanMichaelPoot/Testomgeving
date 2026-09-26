import { describe, expect, it } from "vitest";
import sharp, { type OverlayOptions } from "sharp";
import { sliceSheet } from "@/lib/discovery/sheetSlicer";

// Builds a synthetic sheet: white background and gutters, one flat colour per
// tile with a little noise so the JPEG-ish content is not perfectly uniform.
async function makeSheet(opts: {
  cols: number;
  rows: number;
  tileW: number;
  tileH: number;
  gutter: number;
  margin: number;
  colors: [number, number, number][];
  whiteWallInTile?: number; // index of a tile that contains a big near-white area
}) {
  const { cols, rows, tileW, tileH, gutter, margin, colors } = opts;
  const width = margin * 2 + cols * tileW + (cols - 1) * gutter;
  const height = margin * 2 + rows * tileH + (rows - 1) * gutter;
  const layers: OverlayOptions[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const [R, G, B] = colors[i];
      const tile = sharp({ create: { width: tileW, height: tileH, channels: 3, background: { r: R, g: G, b: B } } });
      let buf = await tile.png().toBuffer();
      if (opts.whiteWallInTile === i) {
        // A bright wall covering the left 60% of the tile, but never the full height of a line.
        const wall = await sharp({
          create: { width: Math.round(tileW * 0.6), height: tileH - 20, channels: 3, background: { r: 250, g: 248, b: 244 } },
        })
          .png()
          .toBuffer();
        buf = await sharp(buf).composite([{ input: wall, left: 0, top: 10 }]).png().toBuffer();
      }
      layers.push({ input: buf, left: margin + c * (tileW + gutter), top: margin + r * (tileH + gutter) });
    }
  }
  return sharp({ create: { width, height, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .composite(layers)
    .png()
    .toBuffer();
}

const COLORS: [number, number, number][] = [
  [200, 40, 40], [40, 160, 60], [40, 70, 200], [230, 180, 20], [130, 40, 160],
  [20, 150, 150], [180, 90, 30], [90, 90, 90], [220, 100, 160],
];

async function meanColor(jpeg: Buffer) {
  const { channels } = await sharp(jpeg).stats();
  return channels.slice(0, 3).map((c) => Math.round(c.mean));
}

describe("sliceSheet", () => {
  it("cuts a 2x2 sheet into four tiles in reading order", async () => {
    const sheet = await makeSheet({ cols: 2, rows: 2, tileW: 500, tileH: 375, gutter: 40, margin: 30, colors: COLORS });
    const tiles = await sliceSheet(sheet, { cols: 2, rows: 2 });
    expect(tiles).toHaveLength(4);
    for (let i = 0; i < 4; i++) {
      const [r, g, b] = await meanColor(tiles[i].jpeg);
      const [er, eg, eb] = COLORS[i];
      expect(Math.abs(r - er)).toBeLessThan(12);
      expect(Math.abs(g - eg)).toBeLessThan(12);
      expect(Math.abs(b - eb)).toBeLessThan(12);
    }
  });

  it("outputs 4:3 tiles of the requested width", async () => {
    const sheet = await makeSheet({ cols: 3, rows: 3, tileW: 300, tileH: 260, gutter: 30, margin: 20, colors: COLORS });
    const tiles = await sliceSheet(sheet, { cols: 3, rows: 3, outWidth: 600 });
    expect(tiles).toHaveLength(9);
    for (const t of tiles) {
      const meta = await sharp(t.jpeg).metadata();
      expect(meta.width).toBe(600);
      expect(Math.abs((meta.height ?? 0) - 450)).toBeLessThanOrEqual(1); // rounding of the crop
    }
  });

  it("works when the model leaves no outer margin", async () => {
    const sheet = await makeSheet({ cols: 2, rows: 2, tileW: 400, tileH: 300, gutter: 24, margin: 0, colors: COLORS });
    expect(await sliceSheet(sheet, { cols: 2, rows: 2 })).toHaveLength(4);
  });

  it("does not mistake a bright wall inside a photo for a gutter", async () => {
    const sheet = await makeSheet({ cols: 2, rows: 2, tileW: 500, tileH: 375, gutter: 40, margin: 30, colors: COLORS, whiteWallInTile: 0 });
    const tiles = await sliceSheet(sheet, { cols: 2, rows: 2 });
    expect(tiles).toHaveLength(4);
  });

  it("throws when the grid it finds is not the grid it was asked for", async () => {
    const sheet = await makeSheet({ cols: 2, rows: 2, tileW: 500, tileH: 375, gutter: 40, margin: 30, colors: COLORS });
    await expect(sliceSheet(sheet, { cols: 3, rows: 3 })).rejects.toThrow(/expected 3 tiles/);
  });

  it("does not crop across photos when the gutters are slightly off-white", async () => {
    // Gutters at 244 instead of pure white, as a real render tends to have.
    const sheet = await makeSheet({ cols: 2, rows: 2, tileW: 500, tileH: 375, gutter: 40, margin: 30, colors: COLORS });
    const dim = await sharp(sheet).linear(244 / 255, 0).png().toBuffer();
    const tiles = await sliceSheet(dim, { cols: 2, rows: 2, whiteThreshold: 235 });
    expect(tiles).toHaveLength(4);
  });
});
