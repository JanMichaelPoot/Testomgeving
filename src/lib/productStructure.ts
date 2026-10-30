// The product structure, in one place: how many ideas a book has and the ordered list of doors with their names and one-line
// descriptions in Dutch and English. The homepage ("Wat je krijgt"), the checkout bullets, the /plan page, the e-mail and the PDF
// overview and idea pages all read their numbers and door names from here, so they cannot disagree.
//
// A book is 6 ideas + 1 wildcard. The engine also sorts the ideas into seven internal "discovery levels" (src/lib/discoveryLevels.ts);
// those are an ordering for the engine and the evaluation, not something a visitor sees, so no level name appears in the interface.

export const IDEA_COUNT = 6;
export const WILDCARD_COUNT = 1;
export const BOOK_COUNT = IDEA_COUNT + WILDCARD_COUNT;

export type DoorId = "natural" | "discovery" | "unexpected" | "stretch" | "wildcard";
export type IdeaDoorId = Exclude<DoorId, "wildcard">;
type Locale = "nl" | "en";

interface DoorSpec {
  id: DoorId;
  /** How many of the book's ideas sit behind this door. */
  count: number;
  label: Record<Locale, string>;
  description: Record<Locale, string>;
}

/** In reading order: from what is closest to you to what is furthest, the wildcard last. */
export const DOORS: readonly DoorSpec[] = [
  {
    id: "natural",
    count: 2,
    label: { nl: "Vertrouwd", en: "Familiar" },
    description: {
      nl: "Dicht bij wat je al doet, maar dan net iets beter uitgewerkt.",
      en: "Close to what you already do, just worked out a little better.",
    },
  },
  {
    id: "discovery",
    count: 2,
    label: { nl: "Ontdekking", en: "Discovery" },
    description: {
      nl: "Iets wat aansluit bij wat je leuk vindt, maar dat je nog niet had geprobeerd.",
      en: "Something that fits what you enjoy, that you just haven't tried yet.",
    },
  },
  {
    id: "unexpected",
    count: 1,
    label: { nl: "Onverwacht", en: "Unexpected" },
    description: {
      nl: "Verrast je in eerste instantie, tot je leest waarom het toch bij je past.",
      en: "Surprises you at first, until you read why it actually fits.",
    },
  },
  {
    id: "stretch",
    count: 1,
    label: { nl: "Uitdaging", en: "Stretch" },
    description: {
      nl: "Net buiten je comfortzone. Groter, spannender, nog steeds haalbaar.",
      en: "Just outside your comfort zone. Bigger, more exciting, still doable.",
    },
  },
  {
    id: "wildcard",
    count: WILDCARD_COUNT,
    label: { nl: "Wildcard", en: "Wildcard" },
    description: {
      nl: "Het idee dat we eigenlijk niet zouden voorstellen. Maar toch doen.",
      en: "The idea we shouldn't really suggest. But do anyway.",
    },
  },
];

/** The four door names + descriptions for the dictionaries (the wildcard has its own wording there). */
export function doorTexts(locale: Locale): Record<IdeaDoorId, { label: string; description: string }> {
  const out = {} as Record<IdeaDoorId, { label: string; description: string }>;
  for (const door of DOORS) {
    if (door.id === "wildcard") continue;
    out[door.id] = { label: door.label[locale], description: door.description[locale] };
  }
  return out;
}

/** "Vertrouwd tot Uitdaging": the span of the six ideas, from the closest door to the furthest (the wildcard is its own seventh). */
export function doorRange(locale: Locale): string {
  const ideaDoors = DOORS.filter((d) => d.id !== "wildcard");
  const first = ideaDoors[0].label[locale];
  const last = ideaDoors[ideaDoors.length - 1].label[locale];
  return locale === "nl" ? `${first} tot ${last}` : `${first} to ${last}`;
}

/** "Vertrouwd, Ontdekking, Onverwacht, Uitdaging en een Wildcard": the doors as one line of copy. */
export function doorsSummary(locale: Locale): string {
  const names = DOORS.map((d) => d.label[locale]);
  const last = names.pop()!;
  return locale === "nl" ? `${names.join(", ")} en ${last}` : `${names.join(", ")} and ${last}`;
}
