// One-off (idempotent) script: shrinks the photos the Idea Book PDF embeds.
//
// The generated originals were ~2500px wide, 2-4 MB each; embedded as-is a
// 10-page PDF came out at ~22 MB — too big to send as an e-mail attachment
// (~29 MB after base64, over what Outlook/Gmail accept). The photos are only
// ever shown at most a page wide (A4 = 595pt), so 1600px (~190 dpi) is plenty
// for print and screen, and it also makes the website's own image loads and
// the Open Graph cover much lighter.
//
//   npx tsx scripts/optimize-idea-book-images.ts
//
// Overwrites in place (the originals stay in git history). Re-running is
// harmless: files already at or below the target size are re-encoded only if
// that makes them smaller, and files that are already small are skipped.
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const DIR = path.join(process.cwd(), "public/illustrations/idea-book");
const MAX_WIDTH = 1600;
const QUALITY = 80;

// The cover is a landscape photo shown full-bleed on a portrait page, so it is
// scaled by its HEIGHT (the page height is the limiting dimension); capping its
// width would leave it soft on print.
const COVER_MAX_HEIGHT = 1800;

async function optimize(file: string) {
  const original = await readFile(file);
  const isCover = path.basename(file) === "cover.jpg";
  // Already small: leave it alone rather than re-encoding it a second time
  // (each JPEG generation costs a little quality for no size win).
  const meta = await sharp(original).metadata();
  const withinLimits = isCover ? (meta.height ?? 0) <= COVER_MAX_HEIGHT : (meta.width ?? 0) <= MAX_WIDTH;
  if (withinLimits && original.length < 700 * 1024) {
    return { file, before: original.length, after: original.length, written: false };
  }
  const out = await sharp(original)
    .rotate() // honour EXIF orientation before it is stripped
    .resize(
      isCover
        ? { height: COVER_MAX_HEIGHT, withoutEnlargement: true }
        : { width: MAX_WIDTH, withoutEnlargement: true }
    )
    .jpeg({ quality: QUALITY, mozjpeg: true })
    .toBuffer();
  if (out.length >= original.length) return { file, before: original.length, after: original.length, written: false };
  await writeFile(file, out);
  return { file, before: original.length, after: out.length, written: true };
}

async function main() {
  const files = [
    path.join(DIR, "cover.jpg"),
    path.join(DIR, "background.jpg"),
    ...(await readdir(path.join(DIR, "categories")))
      .filter((f) => f.endsWith(".jpg"))
      .map((f) => path.join(DIR, "categories", f)),
  ];
  let before = 0;
  let after = 0;
  for (const file of files) {
    const r = await optimize(file);
    before += r.before;
    after += r.after;
  }
  const mb = (n: number) => (n / 1024 / 1024).toFixed(1);
  console.log(`${files.length} images: ${mb(before)} MB -> ${mb(after)} MB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
