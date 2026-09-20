// One-time script: generates a small, categorized stock-photo library for
// per-idea header photos (2 photos per category, 12 categories = 24
// images). Replaces the earlier IDEA_HERO_PHOTOS pool (7 generic Unsplash
// photos cycled by index, with no relation to an idea's actual content —
// see the removed comment in src/lib/illustrations.ts) with photos Claude
// can actually pick deterministically via the new `photo_category` field on
// every generated idea (see src/lib/claude/generateIdeaBook.ts). Still no
// live per-idea generation: this is a one-time, committed asset set, so a
// real purchase never calls Gemini for imagery.
//
//   GEMINI_API_KEY=... npx tsx scripts/generate-idea-category-illustrations.ts
import { writeFileSync, mkdirSync } from "node:fs";
import { generateIllustration } from "../src/lib/gemini";

const OUT_DIR = "public/illustrations/idea-book/categories";

// Same photographic language as the rest of the Idea Book/site photography
// (see generate-idea-book-illustrations.ts, generate-outdoor-illustrations.ts)
// so a category photo never looks like it came from a different shoot.
const STYLE_PREFIX =
  "Photorealistic, warm editorial travel-magazine photography — rich " +
  "walnut wood tones, warm golden daylight, a muted earthy palette " +
  "(walnut brown, cream, soft antique gold), calm and inviting, " +
  "magazine-quality composition with generous negative space. No text, no " +
  "words, no letters, no visible faces anywhere in the image. Elegant, " +
  "uncluttered, evocative — never busy or cluttered.";

// Each category gets two visually distinct variants so an Idea Book with
// several ideas in the same category doesn't repeat the exact same photo —
// see ideaCategoryPhoto() in src/lib/illustrations.ts for how a variant is
// picked per idea.
const CATEGORIES: Record<string, [string, string]> = {
  art_culture: [
    "A softly lit art gallery interior, a large framed painting on a warm wall, a wooden bench in the foreground.",
    "Close-up of an artist's hands shaping clay on a pottery wheel, warm studio light, ceramic tools nearby.",
  ],
  creative_workshop: [
    "A creative workshop table with paintbrushes, an open sketchbook, and jars of pigment in warm daylight.",
    "Hands weaving on a small wooden loom, wool threads and workshop tools in soft afternoon light.",
  ],
  food_drink: [
    "A rustic wooden table set with a steaming cup of coffee, a croissant, and morning light through a window.",
    "A cozy restaurant table with a shared plate of food and two glasses of wine, warm evening light.",
  ],
  nature_outdoor: [
    "A sunlit forest path winding through tall trees, dappled light on the ground.",
    "A wildflower meadow under a soft blue sky, a narrow walking trail leading into the distance.",
  ],
  water_activity: [
    "A calm canal at golden hour, a wooden rowboat resting at the water's edge, reflections on the surface.",
    "A view across still water from a paddleboard, gentle ripples and trees reflected in the distance.",
  ],
  active_sport: [
    "A pair of bicycles leaning against a rustic wall, warm afternoon light, a scenic road ahead.",
    "Hiking boots and a walking stick on a rocky mountain trail, a sweeping valley view beyond.",
  ],
  music_nightlife: [
    "A dimly lit, warm-toned live music stage with a single spotlight and string lights overhead.",
    "A cozy jazz bar interior, a piano bathed in warm amber light, empty stools nearby.",
  ],
  wellness_relax: [
    "A serene spa setting with candles, a folded towel, and a small bowl of stones, soft warm light.",
    "A yoga mat unrolled on a sunlit wooden floor, a plant and a cushion nearby, calm morning light.",
  ],
  social_games: [
    "A wooden table set with a board game, dice, and warm mugs, cozy indoor lighting.",
    "Close-up of a chessboard mid-game on an outdoor cafe table, warm afternoon sun.",
  ],
  travel_adventure: [
    "An open road stretching toward distant hills, seen through a car window at golden hour.",
    "A vintage suitcase and a folded paper map resting on a wooden bench at a train station.",
  ],
  home_cozy: [
    "A cozy reading nook with a warm blanket, a stack of books, and a steaming mug by a window.",
    "Two mugs of tea and an open book on a soft blanket near a fireplace, warm evening glow.",
  ],
  market_shopping: [
    "A bustling outdoor market stall with fresh flowers and produce, warm midday light.",
    "A vintage market stall with antique trinkets and books, warm afternoon sun filtering through.",
  ],
};

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  for (const [category, variants] of Object.entries(CATEGORIES)) {
    for (let i = 0; i < variants.length; i++) {
      const name = `${category}-${i + 1}`;
      console.log(`Generating ${name}...`);
      const image = await generateIllustration(variants[i], "3:2", STYLE_PREFIX, "2K");
      const path = `${OUT_DIR}/${name}.jpg`;
      writeFileSync(path, image.data);
      console.log(`Saved ${path} (${image.data.length} bytes)`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
