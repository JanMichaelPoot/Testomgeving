// One-time script: generates the Style Engine's 24 illustrations (6 styles
// x 4 images each — a cover/hero shot plus 3 mood images), referenced by
// src/lib/styleEngine.ts. Run once (locally, with GEMINI_API_KEY set)
// whenever these need regenerating — the running app never calls Gemini
// itself.
//
//   GEMINI_API_KEY=... npx tsx scripts/generate-style-illustrations.ts
import { writeFileSync, mkdirSync } from "node:fs";
import { generateIllustration } from "../src/lib/gemini";

const OUT_DIR = "public/illustrations/styles";

// Same four subjects reused across every style, so the six presets differ
// purely in palette/mood/technique (set per style below) rather than in
// scene content — that keeps the comparison between styles honest and the
// script itself a simple, maintainable 6x4 grid.
const SUBJECTS = {
  cover:
    "An arched window thrown wide open onto a dreamlike horizon blending a mountain trail, a quiet forest, and distant glowing lights into one continuous view. Sweeping, a single striking image full of wonder.",
  "mood-1": "A sunlit trail cutting through tall trees, dappled light on the path ahead. Adventurous, fresh, inviting movement.",
  "mood-2": "A warm cup beside an open book resting on a soft blanket, gentle morning light. Calm, grounded, restorative.",
  "mood-3": "A creative desk scattered with paints, sketches, and colored threads catching afternoon light. Playful, imaginative, hands-on.",
} as const;

interface StyleSpec {
  id: string;
  prefix: string;
}

const STYLES: StyleSpec[] = [
  {
    id: "bloom",
    prefix:
      "Elegant editorial illustration in a botanical, romantic style — soft blush pinks and sage greens, delicate floral linework woven through the scene. Refined, graceful, a little dreamy. No text, no words, no letters anywhere in the image.",
  },
  {
    id: "warm",
    prefix:
      "Warm, refined editorial illustration in a premium travel-magazine style — amber, honey, and terracotta tones, soft golden light, cozy sophistication. No text, no words, no letters anywhere in the image.",
  },
  {
    id: "bold",
    prefix:
      "Bold, high-contrast editorial illustration — deep charcoal and near-black tones with a single striking crimson or amber accent, strong graphic shapes, dramatic lighting, confident and powerful. No text, no words, no letters anywhere in the image.",
  },
  {
    id: "edge",
    prefix:
      "Modern technical editorial illustration — cool steel-blue and grey palette, clean geometric lines, crisp precise linework, contemporary minimalism. No text, no words, no letters anywhere in the image.",
  },
  {
    id: "calm",
    prefix:
      "Calm, natural editorial illustration — soft sage green, stone, and muted earth tones, organic textures, gentle diffused light, serene and grounded. No text, no words, no letters anywhere in the image.",
  },
  {
    id: "vivid",
    prefix:
      "Vivid, expressive editorial illustration — bold saturated colors, playful unexpected color combinations, energetic brushwork, imaginative and daring. No text, no words, no letters anywhere in the image.",
  },
];

async function main() {
  for (const style of STYLES) {
    const dir = `${OUT_DIR}/${style.id}`;
    mkdirSync(dir, { recursive: true });

    for (const [name, subject] of Object.entries(SUBJECTS)) {
      console.log(`Generating ${style.id}/${name}...`);
      const image = await generateIllustration(subject, "4:3", style.prefix);
      const path = `${dir}/${name}.jpg`;
      writeFileSync(path, image.data);
      console.log(`Saved ${path} (${image.data.length} bytes)`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
