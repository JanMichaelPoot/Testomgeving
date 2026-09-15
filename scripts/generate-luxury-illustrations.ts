// One-time script: generates the six "luxury magazine" still-life images
// used across the "Clean Premium Hybrid" redesign (landing hero, the 5
// intake wizard pages, checkout) — see src/lib/illustrations.ts
// (LUXURY_ILLUSTRATIONS). Run once (locally, with GEMINI_API_KEY set)
// whenever these need regenerating — the running app never calls Gemini
// itself.
//
//   GEMINI_API_KEY=... npx tsx scripts/generate-luxury-illustrations.ts
import { writeFileSync, mkdirSync } from "node:fs";
import { generateIllustration } from "../src/lib/gemini";

interface Target {
  name: string;
  prompt: string;
}

const PUBLIC_DIR = "public/illustrations/luxury";

// Distinct from the emerald/gold "cheerful luxury" style used elsewhere
// (scripts/generate-illustrations.ts) — this set backs the newer, more
// restrained "Clean Premium Hybrid" identity (off-white/ink/deep teal), so
// the photography itself stays warm and neutral rather than jewel-toned,
// letting the surrounding UI carry the accent color.
const STYLE_PREFIX =
  "Photorealistic editorial still-life photography for a minimalist luxury " +
  "magazine — soft directional natural light, shallow depth of field, warm " +
  "neutral tones (ivory, walnut, brushed aluminum, deep charcoal), " +
  "understated and refined composition with generous negative space, " +
  "tactile premium materials, in the style of Kinfolk or Cereal magazine. " +
  "No text, no words, no letters anywhere in the image, no illustration or " +
  "painterly style — genuine photographic realism.";

const TARGETS: Target[] = [
  {
    name: "compass",
    prompt:
      "A weathered wooden compass resting on an unfolded paper map, softly lit from one side with a subtle shadow, close-up still life.",
  },
  {
    name: "hanger",
    prompt:
      "A single leather-wrapped clothing hanger hanging from a sleek matte black rod, softly lit against a plain neutral wall, minimal and tactile.",
  },
  {
    name: "mixer",
    prompt:
      "An analog mixing console built from brushed aluminum and rich walnut wood, rows of knobs, dials and sliders, softly lit from one side, close-up still life.",
  },
  {
    name: "window-view",
    prompt:
      "A sleek minimal window frame looking out onto a sun-drenched courtyard with dappled shadows and a single potted olive tree, warm midday light.",
  },
  {
    name: "prism",
    prompt:
      "A clear glass prism catching a single beam of light, casting a soft spectrum of color across a plain surface, close-up macro still life, dark neutral background.",
  },
  {
    name: "marble-bowl",
    prompt:
      "A smooth marble bowl on a plain surface, warm low-angle raking light casting long soft shadows, minimal still life.",
  },
];

async function main() {
  mkdirSync(PUBLIC_DIR, { recursive: true });

  for (const target of TARGETS) {
    console.log(`Generating ${target.name}...`);
    const image = await generateIllustration(target.prompt, "4:3", STYLE_PREFIX);
    const path = `${PUBLIC_DIR}/${target.name}.jpg`;
    writeFileSync(path, image.data);
    console.log(`Saved ${path} (${image.data.length} bytes)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
