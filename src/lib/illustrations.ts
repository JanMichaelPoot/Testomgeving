// Fixed, pre-generated illustrations (see scripts/generate-illustrations.ts).
// Generated once via Gemini "Nano Banana Pro" and committed as static
// assets — the running app never calls Gemini itself, so every visitor
// session costs zero image-generation credits regardless of how many
// ideas/plans are generated.
export const LANDING_HERO_ILLUSTRATION = "/illustrations/landing-hero.jpg";

// One image per intake wizard page (src/components/window/IntakeWizard.tsx),
// indexed by page position.
export const WIZARD_PAGE_ILLUSTRATIONS = [
  "/illustrations/step-situation.jpg",
  "/illustrations/step-about.jpg",
  "/illustrations/step-dials.jpg",
  "/illustrations/step-openness.jpg",
  "/illustrations/step-final.jpg",
] as const;

// ── Stock photography (site chrome only) ────────────────────────────────
// The landing hero's 4-panel window, the intake wizard's full-bleed side
// panels, and each idea card's header photo use hotlinked Unsplash photos
// instead of pre-generated illustrations — this set mirrors the WINDOW
// Figma Make prototype (window.app/shared/4x9mq) so the live site matches
// it as closely as possible. Unlike LANDING_HERO_ILLUSTRATION above, these
// are *not* self-hosted: they're fetched from images.unsplash.com at
// request time (allow-listed in next.config.ts + the CSP in src/proxy.ts).
//
// Idea cards are generated freely by Claude, so there's no way to fetch a
// photo that actually matches an arbitrary AI-written idea — IDEA_HERO_PHOTOS
// is a small fixed pool that IdeaDetail cycles through by index instead, so
// every idea still gets a photographic header in the prototype's style.
function unsplash(photoId: string, w: number, h: number) {
  return `https://images.unsplash.com/${photoId}?w=${w}&h=${h}&fit=crop&auto=format`;
}

export const HERO_WINDOW_PANELS = [
  { photo: unsplash("photo-1464822759023-fed622ff2c3b", 600, 450), alt: "Bergpad bij avondlicht" },
  { photo: unsplash("photo-1501339847302-ac426a4a7cbb", 600, 450), alt: "Gezellig café" },
  { photo: unsplash("photo-1440342359743-84fcb8c21f21", 600, 450), alt: "Sterrenbos" },
  { photo: unsplash("photo-1477959858617-67f85cf4f1df", 600, 450), alt: "Stad bij avond" },
] as const;

export const INTAKE_STOCK_PHOTOS = [
  unsplash("photo-1506905925346-21bda4d32df4", 900, 1200),
  unsplash("photo-1455390582262-044cdead277a", 900, 1200),
  unsplash("photo-1476514525535-07fb3b4ae5f1", 900, 1200),
  unsplash("photo-1499803270242-467f7311582d", 900, 1200),
  unsplash("photo-1488085061387-422e29b40080", 900, 1200),
] as const;

export const IDEA_HERO_PHOTOS = [
  unsplash("photo-1506905925346-21bda4d32df4", 800, 500),
  unsplash("photo-1565193566173-7a0ee3dbe261", 800, 500),
  unsplash("photo-1448375240586-882707db888b", 800, 500),
  unsplash("photo-1500514966906-fe245eea9344", 800, 500),
  unsplash("photo-1455390582262-044cdead277a", 800, 500),
  unsplash("photo-1585208798174-6cedd86e019a", 800, 500),
  unsplash("photo-1474722883778-792e7990302f", 800, 500),
] as const;

export function ideaHeroPhoto(index: number): string {
  return IDEA_HERO_PHOTOS[index % IDEA_HERO_PHOTOS.length];
}
