// Fixed, pre-generated illustrations. Generated once via Gemini "Nano
// Banana Pro" and committed as static assets — the running app never calls
// Gemini itself, so every visitor session costs zero image-generation
// credits regardless of how many ideas/plans are generated.

// "Clean Premium Hybrid" luxury-magazine still-life set (see
// scripts/generate-luxury-illustrations.ts) — the landing hero, each intake
// wizard page, and the checkout summary each get one of these, chosen for a
// thematic fit with that screen (e.g. the analog mixing console for the
// dials/sliders page).
export const LUXURY_ILLUSTRATIONS = {
  compass: "/illustrations/luxury/compass.jpg",
  hanger: "/illustrations/luxury/hanger.jpg",
  mixer: "/illustrations/luxury/mixer.jpg",
  windowView: "/illustrations/luxury/window-view.jpg",
  prism: "/illustrations/luxury/prism.jpg",
  marbleBowl: "/illustrations/luxury/marble-bowl.jpg",
} as const;

// One photo per intake wizard page (src/components/window/IntakeWizard.tsx),
// indexed by page position: situatie, over jou, dials, openness, laatste stap.
export const INTAKE_LUXURY_PHOTOS = [
  LUXURY_ILLUSTRATIONS.compass,
  LUXURY_ILLUSTRATIONS.hanger,
  LUXURY_ILLUSTRATIONS.mixer,
  LUXURY_ILLUSTRATIONS.prism,
  LUXURY_ILLUSTRATIONS.marbleBowl,
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
