import type { PhotoCategory } from "@/lib/claude/ideaBookTypes";
import type { Locale } from "@/lib/locale";

// The one idea shown on the landing page's hero card. Not invented for the
// landing page: it is the first idea of the example Idea Book that the
// "Voorbeeld-Idea Book" links point at (public/examples/idea-book-*.pdf).
// scripts/generate-example-idea-book.ts imports these very strings for that
// idea, so the card and the PDF cannot drift apart — after changing one,
// re-run the script to regenerate the PDFs.
export const EXAMPLE_IDEA_DOOR = "natural" as const;
export const EXAMPLE_IDEA_PHOTO_CATEGORY = "creative_workshop" satisfies PhotoCategory;

export interface ExampleIdeaCopy {
  title: string;
  whyItFits: string;
  firstAction: string;
}

export const EXAMPLE_IDEAS: Record<Locale, ExampleIdeaCopy> = {
  nl: {
    title: "Pottenbakken zoals je stiekem wilde",
    whyItFits: "Je zei zelf dat je best weer eens een workshop zou willen doen — hier is hij.",
    firstAction: "Zoek 'pottenbakken workshop' + je woonplaats en bekijk de eerstvolgende datum.",
  },
  en: {
    title: "Pottery, the way you secretly wanted",
    whyItFits: "You said yourself you'd love to do a workshop again — here it is.",
    firstAction: "Search 'pottery workshop' + your town and check the next available date.",
  },
};
