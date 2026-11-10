// The geometry of the landing-hero window (HeroWindow.tsx), in units: the sash is 100 wide and 4:3 upright. Nothing here is measured
// from the screen: the figure has a fixed aspect ratio and every part of the window is a percentage of it. Server-safe, so the hero
// section can size the window with the same numbers.

export const SASH_W = 100;
export const SASH_H = (SASH_W * 4) / 3;
/** Depth of the recess, as it shows on each side and at the top. */
export const REVEAL = 7;
/** Width of the architrave boards. */
export const CASING = 7;
/** Height of the head board. */
export const HEAD = 8;
/** The top face of the sill, as seen from the front. */
export const SILL_DEPTH = 12;
/** The front edge of the sill. */
export const SILL_FRONT = 7;
/** How far down the wall plane meets the sill top, measured from the back edge. */
export const WALL_PLANE = 4;

export const GEO = (() => {
  const sashX = (140 - SASH_W) / 2;
  const sashY = HEAD + REVEAL;
  const backY = sashY + SASH_H;
  const wallY = backY + WALL_PLANE;
  const frontY = backY + SILL_DEPTH;
  return { W: 140, H: frontY + SILL_FRONT, sashX, sashY, backY, wallY, frontY };
})();

/** Width over height of the whole figure. */
export const HERO_WINDOW_ASPECT = GEO.W / GEO.H;
