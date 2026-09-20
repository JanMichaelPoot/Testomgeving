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
// Replaces the old IDEA_HERO_PHOTOS pool (7 generic Unsplash photos cycled
// purely by index, with no relation to an idea's actual content — leading
// to mismatches like a misty-forest photo on an art-gallery idea) with a
// small, self-hosted, categorized library (see
// scripts/generate-idea-category-illustrations.ts, 2 photos per category).
// Claude tags every idea with the best-fitting category itself
// (photo_category, see generateIdeaBook.ts) — far more reliable than
// keyword-matching free text after the fact — so the header photo is
// chosen by an idea's actual subject, still with zero live image
// generation per purchase.
import type { PhotoCategory } from "@/lib/claude/ideaBookTypes";
import { PHOTO_CATEGORIES } from "@/lib/claude/ideaBookTypes";

const IDEA_CATEGORY_PHOTOS = Object.fromEntries(
  PHOTO_CATEGORIES.map((category) => [
    category,
    [
      `/illustrations/idea-book/categories/${category}-1.jpg`,
      `/illustrations/idea-book/categories/${category}-2.jpg`,
    ] as const,
  ])
) as Record<PhotoCategory, readonly [string, string]>;

// `variantSeed` (e.g. an idea's index within the book) just picks between
// the category's two photos, so two ideas sharing a category in the same
// book don't show the exact same photo twice.
export function ideaCategoryPhoto(category: PhotoCategory, variantSeed: number): string {
  const variants = IDEA_CATEGORY_PHOTOS[category] ?? IDEA_CATEGORY_PHOTOS.nature_outdoor;
  return variants[variantSeed % variants.length];
}
