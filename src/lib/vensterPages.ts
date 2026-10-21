// The screens of the image intake ("Het venster"), in order. Shared by the wizard and the
// server (the intake page clamps ?page=N to this list; checkout links into it).
//
// R2.1: the profile screen ("Zo kijken wij door jouw venster") is the last one, right before the
// checkout; it replaced the screen after the image rounds and the separate open question.
export const VENSTER_PAGES = ["worlds", "places", "moments", "senses", "room", "who", "profile"] as const;
export type VensterPageId = (typeof VENSTER_PAGES)[number];

/** The page to open for "Wijzig" on checkout, per part of the window. */
export const VENSTER_EDIT_PAGE = { worlds: 0, places: 1, moments: 2, senses: 3, room: 4, who: 5, profile: 6 } as const;

/** The draft layout the browser stores (sessionStorage); older drafts have no version. */
export const DRAFT_VERSION = 2;

/**
 * A page number from a draft or link made with the old layout (8 screens: worlds, places,
 * moments, senses, reflection, room, who, extra) becomes the closest page of the new one:
 * the old reflection screen no longer exists, so it lands on the first practical screen.
 */
export function migrateDraftPage(page: number, version: number | undefined): number {
  const last = VENSTER_PAGES.length - 1;
  if (!Number.isFinite(page)) return 0;
  const p = Math.max(0, Math.trunc(page));
  if (version === DRAFT_VERSION) return Math.min(p, last);
  const old = [0, 1, 2, 3, 4, 4, 5, 6]; // old index -> new index
  return old[Math.min(p, old.length - 1)];
}
