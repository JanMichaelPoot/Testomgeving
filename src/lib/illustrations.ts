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
