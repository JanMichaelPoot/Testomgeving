// The screens of the image intake ("Het venster"), in order. Shared by the wizard and the
// server (the intake page clamps ?page=N to this list; checkout links into it).
export const VENSTER_PAGES = ["worlds", "places", "moments", "senses", "reflection", "room", "who", "extra"] as const;
export type VensterPageId = (typeof VENSTER_PAGES)[number];

/** The page to open for "Wijzig" on checkout, per part of the window. */
export const VENSTER_EDIT_PAGE = { worlds: 0, places: 1, moments: 2, senses: 3, room: 5, who: 6, extra: 7 } as const;
