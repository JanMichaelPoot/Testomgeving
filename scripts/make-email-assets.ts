// One-off, idempotent: the images the e-mails use, made from photos that already exist (no generation,
// no API cost). Mail clients load these from the public site, so they are small:
//   public/email/header.jpg                 1200x420, four panes like a window
//   public/email/thumbs/discovery/<id>.jpg  240x180, one per activity photo
//   public/email/thumbs/categories/<n>.jpg  240x180, one per idea category photo
// Run: npx tsx scripts/make-email-assets.ts [--force]
import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const force = process.argv.includes("--force");
const root = process.cwd();
const pub = (...p: string[]) => path.join(root, "public", ...p);

const HEADER_PHOTOS = ["hero-06", "hero-13", "hero-11", "hero-27"]; // studio, waterfall, sailboat, balloon
const HEADER = { width: 1200, height: 420, gap: 12, background: "#FFFFFF" };
const THUMB = { width: 240, height: 180 };

async function exists(file: string) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function makeHeader() {
  const out = pub("email", "header.jpg");
  if (!force && (await exists(out))) return false;
  const paneW = Math.floor((HEADER.width - HEADER.gap * (HEADER_PHOTOS.length - 1)) / HEADER_PHOTOS.length);
  const tiles = await Promise.all(
    HEADER_PHOTOS.map(async (name, i) => ({
      input: await sharp(pub("illustrations", "hero-pool", `${name}.jpg`)).resize(paneW, HEADER.height, { fit: "cover" }).toBuffer(),
      left: i * (paneW + HEADER.gap),
      top: 0,
    })),
  );
  await mkdir(path.dirname(out), { recursive: true });
  await sharp({ create: { width: HEADER.width, height: HEADER.height, channels: 3, background: HEADER.background } })
    .composite(tiles)
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(out);
  return true;
}

async function makeThumbs(srcDir: string, outDir: string) {
  await mkdir(outDir, { recursive: true });
  let made = 0;
  for (const file of await readdir(srcDir)) {
    if (!file.endsWith(".jpg")) continue;
    const out = path.join(outDir, file);
    if (!force && (await exists(out))) continue;
    await sharp(path.join(srcDir, file)).resize(THUMB.width, THUMB.height, { fit: "cover" }).jpeg({ quality: 76, mozjpeg: true }).toFile(out);
    made++;
  }
  return made;
}

async function main() {
  const header = await makeHeader();
  const discovery = await makeThumbs(pub("illustrations", "discovery"), pub("email", "thumbs", "discovery"));
  const categories = await makeThumbs(pub("illustrations", "idea-book", "categories"), pub("email", "thumbs", "categories"));
  console.log(`header: ${header ? "made" : "kept"}, discovery thumbs made: ${discovery}, category thumbs made: ${categories}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
