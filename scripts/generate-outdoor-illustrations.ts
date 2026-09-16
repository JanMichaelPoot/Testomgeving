// One-time script: generates the five "outdoor adventure" still-life images
// for the intake wizard pages, replacing the indoor walnut/leather set from
// scripts/generate-luxury-illustrations.ts. The homepage/checkout window
// view is deliberately NOT regenerated here — see src/lib/illustrations.ts
// (LUXURY_ILLUSTRATIONS.windowView stays as-is). Run once (locally, with
// GEMINI_API_KEY set) whenever these need regenerating — the running app
// never calls Gemini itself.
//
//   GEMINI_API_KEY=... npx tsx scripts/generate-outdoor-illustrations.ts
import { writeFileSync, mkdirSync } from "node:fs";
import { generateIllustration } from "../src/lib/gemini";

interface Target {
  name: string;
  prompt: string;
}

const PUBLIC_DIR = "public/illustrations/outdoor";

// Per the user's own style guide: warm, natural, photorealistic, soft
// directional daylight, muted earthy palette shifted toward outdoor greens
// and sky blues (sage, moss, terracotta, warm wood, soft denim blue).
// Shallow depth of field, flat-lay or window-side compositions, minimal and
// airy — no people, no text, no logos. Kept as its own prefix (distinct from
// generate-luxury-illustrations.ts's indoor warm-neutral one) so the two
// sets can't accidentally drift onto the same palette.
const STYLE_PREFIX =
  "Photorealistic editorial still-life photography for a premium outdoor " +
  "lifestyle/travel brand — warm, natural light, soft directional daylight, " +
  "a muted earthy palette shifted toward outdoor greens and sky blues (sage, " +
  "moss, terracotta, warm wood, soft denim blue), shallow depth of field, " +
  "minimal and airy composition with generous negative space. No text, no " +
  "words, no letters, no people, no logos, no illustration or painterly " +
  "style — genuine photographic realism.";

const TARGETS: Target[] = [
  {
    name: "situation",
    prompt:
      "A wooden windowsill scene where the window opens onto a misty green forest trail under a pale blue sky. On the sill: a worn leather field journal with a fountain pen, a brass compass, a pair of binoculars, and a rolled trail map with visible topographic lines, plus a small sprig of fresh greenery. Vintage-explorer warmth, but let the outdoor view dominate the light.",
  },
  {
    name: "about",
    prompt:
      "An outdoor-gear rack — a rain jacket, a canvas daypack, worn hiking boots, wool socks, and a rolled sleeping mat — hanging and resting near a sunlit window with a soft green garden view outside. Clean, minimalist boutique-wardrobe styling, just outdoor gear instead of office clothing.",
  },
  {
    name: "dials",
    prompt:
      "A rustic wooden outdoor table (garden or cabin porch) with a stack of field notebooks, a compass, dried wildflowers in a small jar, a pencil, and a folded trail map, with a hint of blue sky and green foliage visible at the edge of frame. Tactile, tidy-desk styling, relocated outside.",
  },
  {
    name: "openness",
    prompt:
      "A picnic-blanket flat-lay outdoors on grass: a kraft-paper wrapped gift, a small watercolor set with a blank canvas propped on a mini easel, a bundle of fresh herbs beside a small mortar, and a couple of smooth stones. Dappled sunlight through leaves, soft green background, hint of blue sky.",
  },
  {
    name: "final",
    prompt:
      "A garden bench in soft afternoon light, with a small stack of books, two mugs, and a few pencils resting on it, lush greenery behind and a glimpse of blue sky through trees. Calm, unhurried, inviting closing mood.",
  },
];

async function main() {
  mkdirSync(PUBLIC_DIR, { recursive: true });

  for (const target of TARGETS) {
    console.log(`Generating ${target.name}...`);
    // Portrait + 2K per explicit request — these fill a tall desktop-only
    // side column (IntakeWizard.tsx's md:w-2/5 photo panel), where a
    // landscape source cropped down via object-cover loses detail a
    // portrait-native image keeps.
    const image = await generateIllustration(target.prompt, "3:4", STYLE_PREFIX, "2K");
    const path = `${PUBLIC_DIR}/${target.name}.jpg`;
    writeFileSync(path, image.data);
    console.log(`Saved ${path} (${image.data.length} bytes)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
