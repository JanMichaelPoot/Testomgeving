// Fixed, pre-generated illustrations. Generated once via Gemini "Nano
// Banana Pro" and committed as static assets — the running app never calls
// Gemini itself, so every visitor session costs zero image-generation
// credits regardless of how many ideas/plans are generated.

// The homepage hero + checkout bookend photo (see
// scripts/generate-luxury-illustrations.ts) — kept deliberately unchanged
// through the outdoor-adventure restyle below, per explicit instruction.
export const LUXURY_ILLUSTRATIONS = {
  windowView: "/illustrations/luxury/window-view.jpg",
} as const;

// One photo per intake wizard page (src/components/window/IntakeWizard.tsx),
// indexed by page position: situatie, over jou, dials, openness, laatste stap.
// "Outdoor adventure" still-life set (see
// scripts/generate-outdoor-illustrations.ts) — replaces the indoor walnut/
// leather set on these five pages only; the hero/checkout window-view above
// is untouched.
export const INTAKE_LUXURY_PHOTOS = [
  "/illustrations/outdoor/situation.jpg",
  "/illustrations/outdoor/about.jpg",
  "/illustrations/outdoor/dials.jpg",
  "/illustrations/outdoor/openness.jpg",
  "/illustrations/outdoor/final.jpg",
] as const;

// ── Stock photography (idea-card imagery only) ──────────────────────────
// Idea cards are generated freely by Claude, so there's no way to fetch a
// photo that actually matches an arbitrary AI-written idea — IDEA_HERO_PHOTOS
// is a small fixed pool that IdeaDetail cycles through by index instead, so
// every idea still gets a photographic header.
function unsplash(photoId: string, w: number, h: number) {
  return `https://images.unsplash.com/${photoId}?w=${w}&h=${h}&fit=crop&auto=format`;
}

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
