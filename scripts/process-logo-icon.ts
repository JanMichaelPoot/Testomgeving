// One-off script: turns public/logo/icon-raw.jpg (the Gemini-generated
// icon on a flat white background) into a transparent PNG, then exports it
// at the sizes the app actually needs. Not called at runtime.
//
// The background removal is a flood fill from the image border rather than
// a global "distance from white" threshold — the icon's own pale fold
// highlight is itself near-white, so a global threshold would eat a hole
// into the icon. Flood fill only clears background-ish pixels that are
// actually *connected* to the outer border, leaving the enclosed highlight
// intact; the threshold is loose enough to also eat the icon's own soft
// drop shadow (neutral gray, same test as the white background), which we
// don't want baked into a reusable icon asset.
//
// The alpha edge is feathered with a plain hand-rolled box blur applied
// directly to the raw RGBA buffer's alpha bytes — NOT via sharp's
// joinChannel()+ensureAlpha(), which was tried first and silently
// discarded the real alpha values on encode (verified by round-tripping
// raw pixel reads at each stage: a manufactured alpha=0 pixel came back
// as 255 after joinChannel().ensureAlpha().png()). Keeping the whole
// keying+feathering step inside one plain Uint8Array avoids that footgun
// entirely.
//
//   npx tsx scripts/process-logo-icon.ts
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SRC = path.join(process.cwd(), "public/logo/icon-raw.jpg");

function isBackgroundish(r: number, g: number, b: number): boolean {
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  return min > 195 && max - min < 45;
}

// Separable box blur (two passes, horizontal then vertical) over the
// alpha plane only — cheap, dependency-free, and plenty smooth enough to
// soften a flood-fill's hard pixel boundary at icon sizes.
function blurAlphaChannel(data: Buffer, width: number, height: number, channels: number, radius: number) {
  const count = width * height;
  const alpha = new Uint8ClampedArray(count);
  for (let p = 0; p < count; p++) alpha[p] = data[p * channels + 3];

  const pass = (src: Uint8ClampedArray, horizontal: boolean): Uint8ClampedArray => {
    const out = new Uint8ClampedArray(count);
    const lineLen = horizontal ? width : height;
    const lines = horizontal ? height : width;
    for (let line = 0; line < lines; line++) {
      for (let i = 0; i < lineLen; i++) {
        let sum = 0;
        let n = 0;
        for (let k = -radius; k <= radius; k++) {
          const j = i + k;
          if (j < 0 || j >= lineLen) continue;
          const p = horizontal ? line * width + j : j * width + line;
          sum += src[p];
          n++;
        }
        const p = horizontal ? line * width + i : i * width + line;
        out[p] = sum / n;
      }
    }
    return out;
  };

  const blurred = pass(pass(alpha, true), false);
  for (let p = 0; p < count; p++) data[p * channels + 3] = blurred[p];
}

async function buildKeyedRaw(): Promise<{ data: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  const visited = new Uint8Array(width * height);
  const queue: number[] = [];
  const pushIfBackground = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (visited[p]) return;
    const idx = p * channels;
    if (!isBackgroundish(data[idx], data[idx + 1], data[idx + 2])) return;
    visited[p] = 1;
    queue.push(p);
  };
  for (let x = 0; x < width; x++) {
    pushIfBackground(x, 0);
    pushIfBackground(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    pushIfBackground(0, y);
    pushIfBackground(width - 1, y);
  }
  while (queue.length > 0) {
    const p = queue.pop()!;
    const x = p % width;
    const y = Math.floor(p / width);
    pushIfBackground(x + 1, y);
    pushIfBackground(x - 1, y);
    pushIfBackground(x, y + 1);
    pushIfBackground(x, y - 1);
  }
  for (let p = 0; p < width * height; p++) {
    if (visited[p]) data[p * channels + 3] = 0;
  }

  blurAlphaChannel(data, width, height, channels, 2);

  return { data, width, height };
}

async function main() {
  const { data, width, height } = await buildKeyedRaw();

  const keyedPng = await sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();

  const trimmedBuf = await sharp(keyedPng).trim({ threshold: 10 }).png().toBuffer();
  const meta = await sharp(trimmedBuf).metadata();
  const side = Math.max(meta.width ?? 1, meta.height ?? 1);
  const padded = Math.round(side * 1.14); // ~7% margin on each side

  const masterBuffer = await sharp(trimmedBuf)
    .resize(padded, padded, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const outDir = path.join(process.cwd(), "public/logo");
  await mkdir(outDir, { recursive: true });

  await sharp(masterBuffer).resize(512, 512).png().toFile(path.join(outDir, "icon.png"));
  await sharp(masterBuffer).resize(128, 128).png().toFile(path.join(outDir, "icon-128.png"));

  // Next.js App Router static icon conventions — picked up automatically,
  // no metadata wiring needed.
  await sharp(masterBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(process.cwd(), "src/app/icon.png"));
  // Apple's convention: a fully opaque square (iOS adds its own rounding),
  // so flatten onto the site's cream background rather than leaving it
  // transparent.
  await sharp(masterBuffer)
    .resize(180, 180)
    .flatten({ background: "#F7F5F0" })
    .png()
    .toFile(path.join(process.cwd(), "src/app/apple-icon.png"));

  console.log("Wrote public/logo/icon.png, public/logo/icon-128.png, src/app/icon.png, src/app/apple-icon.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
