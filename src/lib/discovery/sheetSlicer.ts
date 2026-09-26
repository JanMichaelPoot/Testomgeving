import sharp from "sharp";

// Cuts a "contact sheet" (one generated image holding a grid of separate photos
// on white gutters) into its individual tiles. Used by
// scripts/generate-discovery-illustrations.ts --sheet: the image model charges
// per image, not per pixel, so one 2K sheet with 4 or 9 photos costs the same as
// one single photo.
//
// The grid is FOUND, not assumed: the model never places gutters exactly where
// asked, so we look for full-length near-white bands and take what lies between.
// If the number of tiles found is not the number asked for, we throw and the
// caller falls back to generating those photos one by one.

export interface SliceOptions {
  cols: number;
  rows: number;
  /** Width / height of every output tile. */
  tileAspect?: number;
  /** Output tile width in px. */
  outWidth?: number;
  /** A pixel counts as gutter when its darkest channel is at least this. */
  whiteThreshold?: number;
  /** Fraction of a line that must be white for it to count as a gutter line. */
  lineFraction?: number;
}

export interface SlicedTile {
  jpeg: Buffer;
  /** Source size of the tile before resizing; tells how sharp it is. */
  sourceWidth: number;
  sourceHeight: number;
}

/** Runs of consecutive `true`s as [start, endExclusive). */
function runs(flags: boolean[]): [number, number][] {
  const out: [number, number][] = [];
  let start = -1;
  flags.forEach((f, i) => {
    if (f && start < 0) start = i;
    if (!f && start >= 0) {
      out.push([start, i]);
      start = -1;
    }
  });
  if (start >= 0) out.push([start, flags.length]);
  return out;
}

/** The content spans between gutter bands along one axis. */
function contentSpans(whiteFraction: number[], count: number, lineFraction: number): [number, number][] {
  const size = whiteFraction.length;
  const isGutter = whiteFraction.map((f) => f >= lineFraction);
  // Content = everything that is not gutter; ignore slivers (edge fringe, noise).
  const minSpan = Math.max(8, Math.round(size * 0.08));
  const spans = runs(isGutter.map((g) => !g)).filter(([a, b]) => b - a >= minSpan);
  if (spans.length !== count) {
    throw new Error(`expected ${count} tiles along an axis but found ${spans.length}`);
  }
  return spans;
}

export async function sliceSheet(input: Buffer, opts: SliceOptions): Promise<SlicedTile[]> {
  const { cols, rows, tileAspect = 4 / 3, outWidth = 800, whiteThreshold = 240, lineFraction = 0.985 } = opts;

  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  const colWhite = new Array<number>(width).fill(0);
  const rowWhite = new Array<number>(height).fill(0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      if (Math.min(data[i], data[i + 1], data[i + 2]) >= whiteThreshold) {
        colWhite[x]++;
        rowWhite[y]++;
      }
    }
  }
  const xs = contentSpans(colWhite.map((n) => n / height), cols, lineFraction);
  const ys = contentSpans(rowWhite.map((n) => n / width), rows, lineFraction);

  const tiles: SlicedTile[] = [];
  for (const [y0, y1] of ys) {
    for (const [x0, x1] of xs) {
      // Trim a hair off every side so no white fringe from a soft gutter edge survives.
      const inset = Math.round(Math.min(x1 - x0, y1 - y0) * 0.008) + 1;
      const left = x0 + inset;
      const top = y0 + inset;
      const w = x1 - x0 - inset * 2;
      const h = y1 - y0 - inset * 2;
      // Centre-crop to the wanted aspect ratio (the model's tiles are only roughly 4:3).
      let cw = w;
      let ch = Math.round(w / tileAspect);
      if (ch > h) {
        ch = h;
        cw = Math.round(h * tileAspect);
      }
      const cl = left + Math.floor((w - cw) / 2);
      const ct = top + Math.floor((h - ch) / 2);
      const jpeg = await sharp(input)
        .extract({ left: cl, top: ct, width: cw, height: ch })
        .resize({ width: outWidth })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer();
      tiles.push({ jpeg, sourceWidth: cw, sourceHeight: ch });
    }
  }
  return tiles;
}
