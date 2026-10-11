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
