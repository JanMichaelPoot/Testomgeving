// One-time script: the three material textures of the landing-hero window (src/components/window/HeroWindow.tsx):
// dark-stained oak for the frame and glazing bars, limewashed plaster for the wall around it, honed limestone for the sill.
// The component lays them under its own bevels, light and glass in CSS, so the geometry always matches layoutWindow() while
// the materials are photographic. Run once (locally, with GEMINI_API_KEY set); the running app never calls Gemini.
//
//   npx tsx --env-file=.env.local scripts/generate-hero-window-textures.ts [--only oak,plaster,stone] [--force] [--post (only optimize the existing files)]
//
// Level 2 of the interior view (Step 158 and after): three more textures, one request each (about $0.13 per image): the interior wall
// (a large plaster wall for the hero background), the moulded walnut casing (the profile of an architrave, so the boards are no longer flat)
// and the top of the walnut sill. Run them with --only wall,moulding,sill.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { generateIllustration } from "../src/lib/gemini";

const OUT_DIR = "public/illustrations/hero-window";

const STYLE_PREFIX =
  "Flat orthographic macro photograph of a material surface, shot straight on, filling the entire frame edge to edge. " +
  "Even, soft, diffuse daylight, no cast shadows, no vignette, no depth of field, no horizon. " +
  "Texture only: no objects, no hardware, no people, no text, no letters, no logos, no watermark.";

const MOULDING_PREFIX =
  "Straight-on photograph of a straight length of wooden interior trim, horizontal, filling the entire frame edge to edge. " +
  "Soft daylight from the upper left, so the shaped profile reads as bands of light and shade running the full length. " +
  "No joints, no corners, no ends, no wall, no objects, no people, no text, no letters, no logos, no watermark.";

/** Per texture: aspect ratio and size for the request, and the width it is optimised to. */
const OPTIONS: Record<string, { aspect: "1:1" | "3:2" | "4:3"; size: "1K" | "2K"; width: number; prefix?: string }> = {
  oak: { aspect: "1:1", size: "1K", width: 800 },
  plaster: { aspect: "1:1", size: "1K", width: 1024 },
  stone: { aspect: "1:1", size: "1K", width: 800 },
  wall: { aspect: "3:2", size: "2K", width: 1800 },
  moulding: { aspect: "3:2", size: "1K", width: 1200, prefix: MOULDING_PREFIX },
  sill: { aspect: "3:2", size: "1K", width: 1200 },
};

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
  wall:
    "A large interior wall finished in hand-troweled limewash plaster, warm cream and pale sand between hex EDE3D1 and D9CCB6, broad soft cloudy " +
    "trowel marks, very gentle large-scale tonal variation, a few faint hairline cracks, matte and slightly chalky. Even light all over, nothing mounted on it.",
  moulding:
    "Dark-stained walnut architrave trim with a classic moulded profile: a flat outer band, a small bead, a concave cove and a rounded inner edge, " +
    "so the profile shows as clear horizontal bands of highlight and shadow along the whole length; rich walnut brown between hex 3C2920 and 5B3F2F, " +
    "fine open grain running along the length, a gentle satin wax sheen.",
  sill:
    "The top surface of an aged dark-stained walnut windowsill board, seen straight from above, the grain running left to right, rich walnut brown " +
    "between hex 3C2920 and 5B3F2F, fine open pores, a few tiny knots, faint wear marks and a soft satin sheen.",
};

/** Web sizes: 800px (plaster 1024) mozjpeg, plus oak-h.jpg, the oak turned 90 degrees for the horizontal rails (head, foot, meeting rail). */
async function optimize(name: string) {
  const path = `${OUT_DIR}/${name}.jpg`;
  // Read into memory first: on Windows sharp keeps a file it opened by path locked, and we overwrite it below.
  const source = readFileSync(path);
  const width = OPTIONS[name]?.width ?? 800;
  const resized = await sharp(source).resize({ width }).jpeg({ quality: name === "wall" ? 70 : 78, mozjpeg: true }).toBuffer();
  writeFileSync(path, resized);
  if (name === "oak") writeFileSync(`${OUT_DIR}/oak-h.jpg`, await sharp(resized).rotate(90).jpeg({ quality: 78, mozjpeg: true }).toBuffer());
  // The moulding is made horizontal; the side boards of the casing are the same picture turned upright.
  if (name === "moulding") writeFileSync(`${OUT_DIR}/moulding-v.jpg`, await sharp(resized).rotate(90).jpeg({ quality: 78, mozjpeg: true }).toBuffer());
  console.log(`Optimized ${path} (${resized.length} bytes)`);
}

const onlyArg0 = () => process.argv.indexOf("--only");

async function main() {
  if (process.argv.includes("--post")) {
    const names = onlyArg0() > -1 ? process.argv[onlyArg0() + 1].split(",") : Object.keys(TEXTURES);
    for (const name of names) await optimize(name);
    return;
  }
  const onlyArg = process.argv.indexOf("--only");
  const only = onlyArg > -1 ? process.argv[onlyArg + 1].split(",") : ["oak", "plaster", "stone"];
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
    const o = OPTIONS[name];
    const image = await generateIllustration(prompt, o.aspect, o.prefix ?? STYLE_PREFIX, o.size);
    writeFileSync(path, image.data);
    console.log(`Saved ${path} (${image.data.length} bytes)`);
    await optimize(name);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
