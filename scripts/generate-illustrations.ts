// One-time script: generates the fixed illustrations referenced by
// src/lib/illustrations.ts (wizard pages, landing hero) and
// src/lib/pdf/ideaBook.ts (PDF imagery). Run once (locally, with
// GEMINI_API_KEY set) whenever these need regenerating — the running app
// never calls Gemini itself.
//
//   GEMINI_API_KEY=... npx tsx scripts/generate-illustrations.ts
import { writeFileSync, mkdirSync } from "node:fs";
import { generateIllustration } from "../src/lib/gemini";

interface Target {
  name: string;
  prompt: string;
  dir: string;
}

const PUBLIC_DIR = "public/illustrations";

// The site's visual identity moved from painterly/watercolor illustration
// to photorealistic "cheerful luxury" photography — gold and emerald,
// matching the Idea Book PDF's restyle and the new fixed Idea Book
// illustration set (see generate-idea-book-illustrations.ts). Passed
// explicitly per generateIllustration() call rather than changing
// gemini.ts's shared default, since that default may still be reused
// elsewhere.
const STYLE_PREFIX =
  "Photorealistic, cinematic photograph — rich jewel-toned lighting in deep emerald and warm gold, a soft golden-hour glow, luxurious and inviting atmosphere, shot on a full-frame camera with shallow depth of field, high production value, joyful and elegant mood. No text, no words, no letters anywhere in the image, no illustration or painterly style — genuine photographic realism.";

const TARGETS: Target[] = [
  {
    name: "landing-hero",
    dir: PUBLIC_DIR,
    prompt:
      "A single elegant window frame set into a softly lit interior wall, its casement fanning outward like an open book to reveal four distinct vertical panels side by side, each a glimpse into a different possibility. From left to right: a solitary hiking trail winding up a mountainside at dusk; the warm interior of a cozy café with a table, cup, and open books; a starlit night forest under a deep indigo sky; a vibrant city street at dusk with a couple of small figures walking. Warm light spills from the window onto the interior floor and a plant on the sill. Striking, beautiful, sense of wonder and invitation.",
  },

  // Intake wizard pages (src/lib/illustrations.ts: WIZARD_PAGE_ILLUSTRATIONS)
  {
    name: "step-situation",
    dir: PUBLIC_DIR,
    prompt:
      "A rain-speckled window at dusk, warm interior light glowing behind gauzy curtains, a steaming mug resting on the sill beside an open journal. Quiet, reflective, inviting — the feeling of pausing to consider what's next.",
  },
  {
    name: "step-about",
    dir: PUBLIC_DIR,
    prompt:
      "A small wooden desk with a folded paper map, a pair of reading glasses, and a brass compass, lit by a single warm desk lamp against a dark backdrop. Personal, grounded, quietly curious.",
  },
  {
    name: "step-dials",
    dir: PUBLIC_DIR,
    prompt:
      "A row of vintage brass dials and knobs mounted on a warm wooden control panel, softly lit from one side, dust motes visible in the light. Tactile, precise, inviting adjustment.",
  },
  {
    name: "step-openness",
    dir: PUBLIC_DIR,
    prompt:
      "A row of five different doors left slightly ajar along a softly lit corridor, each glowing with a different warm hue spilling out. A sense of choice, curiosity, and possibility.",
  },
  {
    name: "step-final",
    dir: PUBLIC_DIR,
    prompt:
      "A small round table set for two with warm mugs and a lit candle, string lights soft-focus in the background at dusk. Cozy, inviting, unhurried.",
  },

  // Idea Book PDF imagery used to live here as a single fixed set — it's
  // now generated per Style Engine preset instead, see
  // scripts/generate-style-illustrations.ts.
];

async function main() {
  const dirs = new Set(TARGETS.map((t) => t.dir));
  for (const dir of dirs) mkdirSync(dir, { recursive: true });

  for (const target of TARGETS) {
    console.log(`Generating ${target.name}...`);
    const image = await generateIllustration(target.prompt, "4:3", STYLE_PREFIX);
    const path = `${target.dir}/${target.name}.jpg`;
    writeFileSync(path, image.data);
    console.log(`Saved ${path} (${image.data.length} bytes)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
