// One-time script: generates the fixed illustrations referenced by
// src/lib/illustrations.ts and saves them into public/illustrations/.
// Run once (locally, with GEMINI_API_KEY set) whenever these need
// regenerating — the running app never calls Gemini itself.
//
//   GEMINI_API_KEY=... npx tsx scripts/generate-illustrations.ts
import { writeFileSync, mkdirSync } from "node:fs";
import { generateIllustration } from "../src/lib/gemini";

const TARGETS: { name: string; prompt: string }[] = [
  {
    name: "landing-hero",
    prompt:
      "A single elegant window frame set into a softly lit interior wall, its casement fanning outward like an open book to reveal four distinct vertical panels side by side, each a glimpse into a different possibility. From left to right: a solitary hiking trail winding up a mountainside at dusk; the warm interior of a cozy café with a table, cup, and open books; a starlit night forest under a deep indigo sky; a vibrant city street at dusk with a couple of small figures walking. Warm light spills from the window onto the interior floor and a plant on the sill. Striking, beautiful, sense of wonder and invitation.",
  },
  {
    name: "practical",
    prompt:
      "A sunlit kitchen counter in the early morning: a steaming cup of coffee, an open notebook, soft warm light through a window. Calm, grounded, achievable.",
  },
  {
    name: "unusual",
    prompt:
      "A spiral staircase standing alone in a quiet garden, climbing up into a sky full of soft clouds and disappearing into the haze. Dreamlike, slightly surreal, intriguing.",
  },
  {
    name: "ambitious",
    prompt:
      "A lone figure standing at the edge of a dramatic mountain ridge at golden hour, a vast valley and horizon stretching out below. Sense of scale, boldness, and possibility.",
  },
  {
    name: "playful",
    prompt:
      "A joyful burst of colorful paper confetti and ribbons floating over a rooftop terrace at dusk, string lights glowing. Lighthearted, whimsical, full of delight.",
  },
];

async function main() {
  mkdirSync("public/illustrations", { recursive: true });

  for (const target of TARGETS) {
    console.log(`Generating ${target.name}...`);
    const image = await generateIllustration(target.prompt, "4:3");
    const path = `public/illustrations/${target.name}.jpg`;
    writeFileSync(path, image.data);
    console.log(`Saved ${path} (${image.data.length} bytes)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
