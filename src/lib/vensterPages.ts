// The screens of the image intake ("Het venster"), in order. Shared by the wizard and the
// server (the intake page clamps ?page=N to this list; checkout links into it).
//
// R2.1: the profile screen ("Zo kijken wij door jouw venster") is the last one; it replaced the screen after the image
// rounds and the separate open question. Since the improvement plan (D3) the payment is on that same screen, so there is no
// separate checkout page for this intake any more.
export const VENSTER_PAGES = ["worlds", "places", "moments", "senses", "situation", "profile"] as const;
export type VensterPageId = (typeof VENSTER_PAGES)[number];

/** The page to open for "Wijzig", per part of the window. */
export const VENSTER_EDIT_PAGE = { worlds: 0, places: 1, moments: 2, senses: 3, situation: 4, profile: 5 } as const;

/**
 * The draft layout the browser stores (sessionStorage). 3 = six screens: the former "Praktisch" (room) and "Met wie" (who)
 * are one "Jouw situatie" screen, and the checkout is part of the profile screen (improvement plan D3). 2 = the seven
 * screens before that; older drafts have no version and use the first eight-screen layout.
 */
export const DRAFT_VERSION = 3;

/**
 * A page number from a draft or link made with an older layout becomes the closest page of this one: the eight screens
 * (worlds, places, moments, senses, reflection, room, who, extra), the seven (..., room, who, profile) or the current six.
 * The old reflection screen no longer exists, so it lands on the first practical screen.
 */
export function migrateDraftPage(page: number, version: number | undefined): number {
  const last = VENSTER_PAGES.length - 1;
  if (!Number.isFinite(page)) return 0;
  const p = Math.max(0, Math.trunc(page));
  if (version === DRAFT_VERSION) return Math.min(p, last);
  const map = version === 2 ? [0, 1, 2, 3, 4, 4, 5] : [0, 1, 2, 3, 4, 4, 4, 5]; // old index -> new index
  return map[Math.min(p, map.length - 1)];
}

// The two-page image intake (docs/fase4-opzet.md): page 1 associative images, page 2 concrete activities that follow from them,
// then the situation and the profile (where the payment is). It has its own draft, so a draft of the four-round intake is never
// read as one of these.
export const TWO_PAGE_PAGES = ["images", "concrete", "situation", "profile"] as const;
export type TwoPageId = (typeof TWO_PAGE_PAGES)[number];
export type AnyVensterPageId = VensterPageId | TwoPageId;

/** The screens of a flow. */
export function pagesFor(flow: "images2" | undefined): readonly AnyVensterPageId[] {
  return flow === "images2" ? TWO_PAGE_PAGES : VENSTER_PAGES;
}

/** Which of the three chapters of the progress bar a screen belongs to: images (0), situation (1), window (2). */
export function chapterOf(page: AnyVensterPageId): 0 | 1 | 2 {
  if (page === "situation") return 1;
  if (page === "profile") return 2;
  return 0;
}
