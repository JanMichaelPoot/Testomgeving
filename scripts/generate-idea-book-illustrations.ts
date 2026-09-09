// One-time script: generates the Idea Book's cover and closing images.
// The shared background for every content page (profile + ideas) is no
// longer AI-generated at all — it's the user's own supplied photograph,
// committed directly as public/illustrations/idea-book/background.jpg.
// Only the cover (first page) and closing (last/wildcard page) images are
// generated, in a matching soft, airy, photorealistic style. Run once
// (locally, with GEMINI_API_KEY set) whenever these need regenerating —
// the running app never calls Gemini itself.
//
//   GEMINI_API_KEY=... npx tsx scripts/generate-idea-book-illustrations.ts
import { writeFileSync, mkdirSync } from "node:fs";
import { generateIllustration } from "../src/lib/gemini";

const OUT_DIR = "public/illustrations/idea-book";

const STYLE_PREFIX =
  "Photorealistic, soft and airy interior photograph — sheer white linen curtains, warm soft daylight, muted pastel tones (soft cream, warm white, a hint of gold light), gentle and serene, magazine-quality editorial photography. No text, no words, no letters anywhere in the image. Calm, elegant, uncluttered composition.";

const TARGETS = {
  cover:
    "Sheer white linen curtains billowing gently in front of a tall open window, warm morning light streaming through, a small potted plant on the windowsill. Inviting, hopeful, a sense of a new possibility about to unfold.",
  closing:
    "A quiet still life near a softly lit window at the end of the day — a single lit candle, a folded linen napkin, a small vase with one stem, sheer curtains softly diffusing the fading light. Calm, intimate, a gentle sense of closure.",
} as const;

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  for (const [name, subject] of Object.entries(TARGETS)) {
    console.log(`Generating ${name}...`);
    const image = await generateIllustration(subject, "4:3", STYLE_PREFIX);
    const path = `${OUT_DIR}/${name}.jpg`;
    writeFileSync(path, image.data);
    console.log(`Saved ${path} (${image.data.length} bytes)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
