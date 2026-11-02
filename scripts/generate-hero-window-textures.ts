// One-time script: the three material textures of the landing-hero window (src/components/window/HeroWindow.tsx):
// dark-stained oak for the frame and glazing bars, limewashed plaster for the wall around it, honed limestone for the sill.
// The component lays them under its own bevels, light and glass in CSS, so the geometry always matches layoutWindow() while
// the materials are photographic. Run once (locally, with GEMINI_API_KEY set); the running app never calls Gemini.
//
//   npx tsx --env-file=.env.local scripts/generate-hero-window-textures.ts [--only oak,plaster,stone] [--force] [--post (only optimize the existing files)]
//
// Three images, one request each (about $0.13 per image).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { generateIllustration } from "../src/lib/gemini";

const OUT_DIR = "public/illustrations/hero-window";

const STYLE_PREFIX =
  "Flat orthographic macro photograph of a material surface, shot straight on, filling the entire frame edge to edge. " +
  "Even, soft, diffuse daylight, no cast shadows, no vignette, no depth of field, no horizon. " +
  "Texture only: no objects, no hardware, no people, no text, no letters, no logos, no watermark.";

const TEXTURES: Record<string, string> = {
  oak:
    "A vertical plank of aged dark-stained oak, the grain running straight up and down, rich walnut brown between hex 3C2920 and 5B3F2F, " +
    "fine open pores, a few tiny natural knots and soft wear, a gentle satin wax sheen.",
  plaster:
    "A hand-troweled limewash plaster wall in warm cream and pale sand tones between hex E9DFCF and D8CBB6, soft cloudy trowel marks, " +
    "a few faint hairline cracks, matte and slightly chalky.",
  stone:
    "A honed, weathered natural limestone slab in warm pale grey-beige, fine fossil speckle, a softly worn surface with a faint sheen, " +
    "no joints and no edges visible.",
};

/** Web sizes: 800px (plaster 1024) mozjpeg, plus oak-h.jpg, the oak turned 90 degrees for the horizontal rails (head, foot, meeting rail). */
async function optimize(name: string) {
  const path = `${OUT_DIR}/${name}.jpg`;
  // Read into memory first: on Windows sharp keeps a file it opened by path locked, and we overwrite it below.
  const source = readFileSync(path);
  const width = name === "plaster" ? 1024 : 800;
  const resized = await sharp(source).resize({ width }).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
  writeFileSync(path, resized);
  if (name === "oak") writeFileSync(`${OUT_DIR}/oak-h.jpg`, await sharp(resized).rotate(90).jpeg({ quality: 78, mozjpeg: true }).toBuffer());
  console.log(`Optimized ${path} (${resized.length} bytes)`);
}

async function main() {
  if (process.argv.includes("--post")) {
    for (const name of Object.keys(TEXTURES)) await optimize(name);
    return;
  }
  const onlyArg = process.argv.indexOf("--only");
  const only = onlyArg > -1 ? process.argv[onlyArg + 1].split(",") : Object.keys(TEXTURES);
  mkdirSync(OUT_DIR, { recursive: true });
  for (const name of only) {
    const prompt = TEXTURES[name];
    if (!prompt) throw new Error(`Unknown texture: ${name}`);
    const path = `${OUT_DIR}/${name}.jpg`;
    if (existsSync(path) && !process.argv.includes("--force")) {
      console.log(`Skipping ${path} (exists, use --force)`);
      continue;
    }
    console.log(`Generating ${name}...`);
    const image = await generateIllustration(prompt, "1:1", STYLE_PREFIX, "1K");
    writeFileSync(path, image.data);
    console.log(`Saved ${path} (${image.data.length} bytes)`);
    await optimize(name);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
