// One-time script: (re)generates the single landing-hero fan-collage image
// (src/components/window/HeroFanCollage.tsx just displays this one file —
// no CSS-built wedges, see CLAUDE.md Stap 28 for why that approach was
// dropped). Run once (locally, with GEMINI_API_KEY set) whenever this needs
// regenerating — the running app never calls Gemini itself.
//
//   GEMINI_API_KEY=... npx tsx scripts/generate-hero-illustration.ts
import { writeFileSync, mkdirSync } from "node:fs";
import { generateIllustration } from "../src/lib/gemini";

const PUBLIC_DIR = "public/illustrations/hero-fan";

const STYLE_PREFIX =
  "Photorealistic photo collage, professional editorial composite, sharp " +
  "pointed pinwheel/ninja-star silhouette — straight-edged triangular " +
  "wedges meeting at crisp points, NOT a rounded rainbow-arc silhouette. " +
  "Panels butt directly against each other with only a hairline white gap, " +
  "no colored border or outline stroke around panels. Warm and cohesive " +
  "color grading throughout in walnut browns and creams. No text, no " +
  "words, no letters, no logos, no watermark.";

const PROMPT =
  "A pinwheel-shaped photo collage: six photographs fanned out from a " +
  "single pivot point low in the frame, each photo a sharp, pointed " +
  "triangular wedge (like a ninja star or an opened pinwheel, not a soft " +
  "rounded hand-fan), arranged clockwise: (1) two cups of coffee with " +
  "steam beside a sunlit window with sheer curtains and an open book, " +
  "(2) a dirt trail through green alpine meadows leading to a snow-capped " +
  "mountain peak, (3) a lush kitchen garden with raised beds and a wooden " +
  "trellis, (4) a colorful outdoor market alley with fruit and vegetable " +
  "stalls under canvas awnings, a few small distant anonymous figures " +
  "shopping, (5) a home studio corner where a person is seen from behind, " +
  "seated, painting at an easel by a window — face not visible, (6) warm " +
  "sunlit ancient stone columns of a classical ruin. At the pivot point, " +
  "layered on top of the wedges, a small square inset photo — tilted " +
  "slightly — of a window frame with a white ceramic vase holding an " +
  "olive branch on the sill. All six wedges plus the inset in one seamless, " +
  "professionally composited image on a plain warm off-white background " +
  "(hex F7F5F0), generous empty margin around the pinwheel shape, nothing " +
  "else in frame.";

async function main() {
  mkdirSync(PUBLIC_DIR, { recursive: true });
  console.log("Generating hero...");
  const image = await generateIllustration(PROMPT, "3:2", STYLE_PREFIX, "2K");
  const path = `${PUBLIC_DIR}/hero.jpg`;
  writeFileSync(path, image.data);
  console.log(`Saved ${path} (${image.data.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
