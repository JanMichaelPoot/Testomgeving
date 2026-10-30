import heroPoolJson from "@/lib/discovery/heroPool.json";
import { hashSeed, mulberry32 } from "@/lib/discovery/rng";

// The pool of photos the landing hero draws from, so a returning visitor does not see the same
// picture every time. Every photo is a calm, centred scene that survives the arch crop of the
// hero (3:4). Until an image has been generated (scripts/generate-discovery-illustrations.ts
// --hero) its entry points at the original hero photo, so the page always has a picture.

export interface HeroPhoto {
  id: string;
  /** English art direction, used only to generate the image. */
  scene: string;
  /** Public path of the image. */
  image: string;
  status: string;
}

export const HERO_POOL = heroPoolJson as HeroPhoto[];

/** One photo of the pool, the same one for the same seed. */
export function pickHero(seed: string, pool: readonly HeroPhoto[] = HERO_POOL): HeroPhoto {
  const rnd = mulberry32(hashSeed(`hero:${seed}`));
  return pool[Math.floor(rnd() * pool.length)];
}

/** A random photo of the pool: one per request on the landing page. */
export function randomHero(pool: readonly HeroPhoto[] = HERO_POOL): HeroPhoto {
  return pool[Math.floor(Math.random() * pool.length)];
}

// What each photo actually shows, for the alt text (nl and en): the hero's alt text must describe the picture on screen, and the pool
// has 27 different ones. A photo without a line here falls back to the generic text of the dictionary.
const HERO_ALT: Record<string, { nl: string; en: string }> = {
  "hero-01": { nl: "Een smal pad door een mistig dennenbos in de ochtend", en: "A narrow path through a misty pine forest in the morning" },
  "hero-02": { nl: "Een plank met handgemaakte, geglazuurde vazen in aardetinten", en: "A shelf of handmade glazed vases in earth tones" },
  "hero-03": { nl: "Een bergpad door een groen dal, met een besneeuwde top in de verte", en: "A mountain trail through a green valley with a snowy peak ahead" },
  "hero-04": { nl: "Een klein havenstadje bij zonsopgang met geschilderde houten bootjes", en: "A small harbour at dawn with painted wooden boats" },
  "hero-05": { nl: "Een gezellige leeshoek met een groene leeslamp, een fauteuil en boekenkasten", en: "A cosy reading nook with a green lamp, an armchair and bookshelves" },
  "hero-06": { nl: "Een lichte schildersatelier met een groot doek op een ezel", en: "A bright artist studio with a large canvas on an easel" },
  "hero-07": { nl: "Een weide met wilde bloemen in de avondzon, met één boom", en: "A wildflower meadow in the evening sun with a single tree" },
  "hero-08": { nl: "Een oude stenen brug over een heldere rivier", en: "An old stone bridge over a clear river" },
  "hero-09": { nl: "Een marktkraam met kisten sinaasappels, citroenen en perziken", en: "A market stall with crates of oranges, lemons and peaches" },
  "hero-10": { nl: "Een glazen kas vol tomatenplanten met zonlicht", en: "A glass greenhouse full of tomato plants in sunlight" },
  "hero-11": { nl: "Een witte zeilboot op kalm turquoise water", en: "A white sailboat on calm turquoise water" },
  "hero-12": { nl: "Een vuurtoren op een rotskust bij zonsondergang", en: "A lighthouse on a rocky coast at sunset" },
  "hero-13": { nl: "Een bemoste waterval in een groen bos", en: "A mossy waterfall in a green forest" },
  "hero-14": { nl: "Een dakterras in de schemering met lichtsnoeren en twee stoelen", en: "A rooftop terrace at dusk with string lights and two chairs" },
  "hero-15": { nl: "Een werkbank met houtbewerkingsgereedschap in warme houttinten", en: "A workbench with woodworking tools in warm wood tones" },
  "hero-16": { nl: "Een stille vijver met waterlelies en een houten bankje", en: "A still pond with water lilies and a wooden bench" },
  "hero-17": { nl: "Rijen wijnstokken op een heuvel in het avondlicht", en: "Rows of grapevines on a hillside in evening light" },
  "hero-18": { nl: "Een kleine telescoop op een grasheuvel onder een sterrenhemel", en: "A small telescope on a grassy hill under a starry sky" },
  "hero-19": { nl: "Een cafétafel met een kopje bij een door regen beslagen raam", en: "A cafe table with a cup by a rain-streaked window" },
  "hero-20": { nl: "Een duinrug met golvend zand bij zonsopgang", en: "A sand dune ridge with rippled sand at sunrise" },
  "hero-21": { nl: "Een boslaan met gouden herfstbladeren", en: "A forest path covered in golden autumn leaves" },
  "hero-22": { nl: "Een oude fiets tegen een zonnige bakstenen muur met bloempotten", en: "A vintage bicycle against a sunlit brick wall with flower pots" },
  "hero-23": { nl: "Een houten berghut in de sneeuw met één verlicht raam", en: "A wooden mountain hut in the snow with one glowing window" },
  "hero-24": { nl: "Een lange houten tafel gedekt in een olijfgaard bij gouden licht", en: "A long wooden table set for a meal in an olive grove at golden hour" },
  "hero-25": { nl: "Een rustige Japanse tuin met geharkt grind, een rode esdoorn en een stenen lantaarn", en: "A tranquil Japanese garden with raked gravel, a red maple and a stone lantern" },
  "hero-26": { nl: "Een oude gracht in een historisch stadje met weerspiegelde gevels", en: "An old canal in a historic town with reflected gabled houses" },
  "hero-27": { nl: "Een luchtballon boven een mistig dal bij zonsopgang", en: "A hot-air balloon above a misty valley at sunrise" },
};

/** The alt text of a hero photo in `locale`; `fallback` (the dictionary's generic line) when the photo is not described here. */
export function heroAltText(photo: Pick<HeroPhoto, "id">, locale: "nl" | "en", fallback: string): string {
  return HERO_ALT[photo.id]?.[locale] ?? fallback;
}
