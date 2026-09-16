// One-time script: generates all three Idea Book PDF images — the cover,
// the shared background used on every content page (profile, possibility
// map, and each idea), and the closing/wildcard-page image. Replaces the
// earlier "sheer curtain window" set (built around a user-supplied photo)
// with a "Warm Walnut" set matching the website's current photography —
// on explicit request, so the PDF stops looking visually disconnected from
// the site. Run once (locally, with GEMINI_API_KEY set) whenever these need
// regenerating — the running app never calls Gemini itself.
//
//   GEMINI_API_KEY=... npx tsx scripts/generate-idea-book-illustrations.ts
import { writeFileSync, mkdirSync } from "node:fs";
import { generateIllustration } from "../src/lib/gemini";

const OUT_DIR = "public/illustrations/idea-book";

// Same photographic language as the website's recent still lifes
// (scripts/generate-outdoor-illustrations.ts, generate-hero-illustration.ts)
// — warm walnut wood, golden light, an evocative "premium travel magazine"
// feel — rather than the earlier pastel/sheer-curtain airiness, so the
// printed book and the site read as one world.
const STYLE_PREFIX =
  "Photorealistic, warm editorial travel-magazine photography — rich " +
  "walnut wood tones, warm golden daylight, a muted earthy palette " +
  "(walnut brown, cream, soft antique gold), calm and inviting, " +
  "magazine-quality composition with generous negative space. No text, no " +
  "words, no letters anywhere in the image. Elegant, uncluttered, " +
  "evocative — never busy or cluttered.";

const TARGETS = {
  cover:
    "A warm walnut writing desk beside a sunlit window: an open leather journal, a brass compass resting on its pages, and a steaming cup of coffee, soft morning light streaming in, a small potted plant on the windowsill. Inviting and hopeful — the feeling of a new possibility about to unfold.",
  background:
    "A cozy walnut window nook with warm sunlight streaming through sheer curtains, a small stack of well-loved books and a potted olive branch resting on the windowsill, a soft view of green trees just outside the glass. Calm, warm, and quietly inviting.",
  closing:
    "A warm wooden garden bench at golden hour, two ceramic mugs and a small stack of books resting on the seat, dappled evening light through trees behind. Calm, intimate — a gentle sense of closure and quiet satisfaction.",
} as const;

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  for (const [name, subject] of Object.entries(TARGETS)) {
    console.log(`Generating ${name}...`);
    const image = await generateIllustration(subject, "4:3", STYLE_PREFIX, "2K");
    const path = `${OUT_DIR}/${name}.jpg`;
    writeFileSync(path, image.data);
    console.log(`Saved ${path} (${image.data.length} bytes)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
