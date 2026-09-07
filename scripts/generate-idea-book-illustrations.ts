// One-time script: generates the Idea Book's single, fixed illustration
// set (a cover/hero shot plus 3 mood images) referenced directly by
// src/lib/pdf/ideaBook.ts. Replaces the earlier multi-style "Style Engine"
// (scripts/generate-style-illustrations.ts, now removed) now that the
// intake no longer offers a style choice — every Idea Book uses this one
// "cheerful luxury" look. Run once (locally, with GEMINI_API_KEY set)
// whenever these need regenerating — the running app never calls Gemini
// itself.
//
//   GEMINI_API_KEY=... npx tsx scripts/generate-idea-book-illustrations.ts
import { writeFileSync, mkdirSync } from "node:fs";
import { generateIllustration } from "../src/lib/gemini";

const OUT_DIR = "public/illustrations/idea-book";

const PREFIX =
  "Joyful, luxurious editorial illustration — radiant golden-hour light, rich jewel-toned colors (emerald, sapphire, warm coral) balanced with polished gold-leaf accents, lively confident brushwork, an uplifting and celebratory mood that still feels refined and expensive. No text, no words, no letters anywhere in the image.";

const SUBJECTS = {
  cover:
    "An arched window thrown wide open onto a dreamlike horizon blending a mountain trail, a quiet forest, and distant glowing lights into one continuous view. Sweeping, a single striking image full of wonder.",
  "mood-1": "A sunlit trail cutting through tall trees, dappled light on the path ahead. Adventurous, fresh, inviting movement.",
  "mood-2": "A warm cup beside an open book resting on a soft blanket, gentle morning light. Calm, grounded, restorative.",
  "mood-3": "A creative desk scattered with paints, sketches, and colored threads catching afternoon light. Playful, imaginative, hands-on.",
} as const;

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  for (const [name, subject] of Object.entries(SUBJECTS)) {
    console.log(`Generating ${name}...`);
    const image = await generateIllustration(subject, "4:3", PREFIX);
    const path = `${OUT_DIR}/${name}.jpg`;
    writeFileSync(path, image.data);
    console.log(`Saved ${path} (${image.data.length} bytes)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
