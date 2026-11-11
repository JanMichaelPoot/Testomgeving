// Free, local follow-up of generate-hero-window-photo.ts: finds the chroma-green panes in the generated photo, cuts them out as transparent
// glass (with a small spill clean-up at the edges), measures the pane rectangles as fractions of the picture and writes
//   public/illustrations/hero-window/frame.webp   the photographed frame with transparent glass
//   src/lib/heroWindowFrame.json                  { aspect, panes: [{ x, y, w, h }] }, row by row, left to right
// The component puts the library images behind the glass. Nothing here costs anything; it can be re-run on the same raw photo.
//
//   npx tsx scripts/process-hero-window-photo.ts data/sources/raw/hero-photo-raw-1.jpg [--width 1200]
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

/** The part of the photo that is kept (fractions): the window with enough plaster around it for a soft edge. */
const CROP = { x0: 0.06, x1: 0.94, y0: 0.09, y1: 0.9 };

const isGreen = (r: number, g: number, b: number) => g > 120 && g > r + 55 && g > b + 55;

async function main() {
  const input = process.argv[2];
  if (!input) throw new Error("Give the raw photo.");
  const wIdx = process.argv.indexOf("--width");
  const outWidth = wIdx > -1 ? Number(process.argv[wIdx + 1]) : 1200;

  const { data, info } = await sharp(readFileSync(input)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const at = (x: number, y: number) => (y * W + x) * 4;

  // 1. The green mask.
  const mask = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = at(x, y);
    if (isGreen(data[i], data[i + 1], data[i + 2])) mask[y * W + x] = 1;
  }

  // 2. Connected components (4-neighbour, iterative flood fill); small specks (the brass catch is not green) are ignored.
  const label = new Int32Array(W * H);
  const comps: { id: number; x0: number; y0: number; x1: number; y1: number; n: number }[] = [];
  const stack: number[] = [];
  for (let start = 0; start < W * H; start++) {
    if (!mask[start] || label[start]) continue;
    const id = comps.length + 1;
    const c = { id, x0: W, y0: H, x1: 0, y1: 0, n: 0 };
    stack.push(start);
    label[start] = id;
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % W;
      const y = (p - x) / W;
      c.n++;
      if (x < c.x0) c.x0 = x;
      if (x > c.x1) c.x1 = x;
      if (y < c.y0) c.y0 = y;
      if (y > c.y1) c.y1 = y;
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) {
        if (q >= 0 && mask[q] && !label[q]) {
          label[q] = id;
          stack.push(q);
        }
      }
    }
    comps.push(c);
  }
  const panes = comps.filter((c) => c.n > W * H * 0.005);
  console.log(`Components: ${comps.length}, panes (> 0.5% of the picture): ${panes.length}`);
  if (panes.length !== 8) throw new Error(`Expected 8 panes, found ${panes.length}. Do not use this picture.`);

  // 3. Order row by row, left to right, and sanity-check that the panes form a 2 x 4 grid of near-equal rectangles.
  panes.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  const cx = panes.map((p) => (p.x0 + p.x1) / 2);
  const left = panes.filter((p) => (p.x0 + p.x1) / 2 < W / 2);
  const right = panes.filter((p) => (p.x0 + p.x1) / 2 >= W / 2);
  if (left.length !== 4 || right.length !== 4) throw new Error("The panes are not two columns of four.");
  const rect = (p: (typeof panes)[number]) => ({ w: p.x1 - p.x0 + 1, h: p.y1 - p.y0 + 1, fill: p.n / ((p.x1 - p.x0 + 1) * (p.y1 - p.y0 + 1)) });
  for (const p of panes) {
    const r = rect(p);
    if (r.fill < 0.97) throw new Error(`A pane is not a clean rectangle (fill ${r.fill.toFixed(3)}).`);
  }
  console.log("Pane sizes (px):", panes.map((p) => `${rect(p).w}x${rect(p).h}`).join(" "), "centres x:", cx.map((v) => Math.round(v)).join(" "));

  // 4. Cut the glass out: dilate the green by a few pixels so no green fringe is left, clear the alpha there and clean the spill in a band around it.
  const R = 4;
  const dil = new Uint8Array(W * H);
  for (const c of panes) {
    for (let y = Math.max(0, c.y0 - R); y <= Math.min(H - 1, c.y1 + R); y++) {
      for (let x = Math.max(0, c.x0 - R); x <= Math.min(W - 1, c.x1 + R); x++) {
        // Within R of a green pixel of this component, measured on the bounding box edge (the panes are clean rectangles).
        dil[y * W + x] = 1;
      }
    }
  }
  const out = Buffer.from(data);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const i = p * 4;
      if (dil[p]) {
        out[i + 3] = 0;
        continue;
      }
      // Spill: pixels right next to the cut (within 10 px) lose any green cast.
      let near = false;
      for (const c of panes) {
        if (x >= c.x0 - R - 10 && x <= c.x1 + R + 10 && y >= c.y0 - R - 10 && y <= c.y1 + R + 10) {
          near = true;
          break;
        }
      }
      if (near) {
        const lim = Math.max(out[i], out[i + 2]);
        if (out[i + 1] > lim) out[i + 1] = lim;
      }
    }
  }

  const cl = Math.round(CROP.x0 * W);
  const ct = Math.round(CROP.y0 * H);
  const cw = Math.round((CROP.x1 - CROP.x0) * W);
  const ch = Math.round((CROP.y1 - CROP.y0) * H);
  // The generated panes differ by a pixel or two; snap them to one grid (two columns, four rows, each the union of its panes so the image always covers the whole cut-out) so the layout is exact.
  const byY = (a: (typeof panes)[number], b: (typeof panes)[number]) => a.y0 - b.y0;
  const cols = [left.slice().sort(byY), right.slice().sort(byY)];
    const colX = cols.map((c) => ({ x0: Math.min(...c.map((p) => p.x0)), x1: Math.max(...c.map((p) => p.x1)) }));
  const rowY = [0, 1, 2, 3].map((r) => ({ y0: Math.min(...cols.map((c) => c[r].y0)), y1: Math.max(...cols.map((c) => c[r].y1)) }));
  const rects = [0, 1, 2, 3].flatMap((r) =>
    [0, 1].map((c) => ({
      x: +((colX[c].x0 - R - cl) / cw).toFixed(5),
      y: +((rowY[r].y0 - R - ct) / ch).toFixed(5),
      w: +((colX[c].x1 - colX[c].x0 + 1 + 2 * R) / cw).toFixed(5),
      h: +((rowY[r].y1 - rowY[r].y0 + 1 + 2 * R) / ch).toFixed(5),
    })),
  );

  const outHeight = Math.round((outWidth * ch) / cw);
  const webp = await sharp(out, { raw: { width: W, height: H, channels: 4 } })
    .extract({ left: cl, top: ct, width: cw, height: ch })
    .resize({ width: outWidth, height: outHeight })
    .webp({ quality: 84, alphaQuality: 100, effort: 5 })
    .toBuffer();
  writeFileSync("public/illustrations/hero-window/frame.webp", webp);
  writeFileSync("src/lib/heroWindowFrame.json", JSON.stringify({ aspect: +(cw / ch).toFixed(5), panes: rects }, null, 2) + "\n");
  console.log(`Wrote frame.webp (${webp.length} bytes, ${outWidth}x${outHeight}) and heroWindowFrame.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
