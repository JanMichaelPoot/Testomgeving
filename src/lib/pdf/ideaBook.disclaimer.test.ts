// Build brief 5a: the general text on the page that introduces the book and at the foot of every page with a picture, and under every idea
// picture its own caption. What is written on which page is read from the drawing calls (the fonts are subsets, so the file cannot be read back).
import { afterEach, describe, expect, it, vi } from "vitest";
import { PDFPage } from "pdf-lib";
import { renderIdeaBookPdf } from "@/lib/pdf/ideaBook";
import { IMAGE_DISCLAIMER, imageCaption, imageTag } from "@/lib/copy/disclaimers";
import type { GeneratedIdeaBook, IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import type { Locale } from "@/lib/locale";

const SCORES = { relevance: 70, novelty: 60, feasibility: 75, surprise: 50, shareability: 60, effort: 50, cost: 40, social_fit: 60, challenge_level: 50 };
const entry = (over: Partial<IdeaBookEntry> = {}): IdeaBookEntry => ({
  title: "Een avond tussen de sterren", intro: "Kijken door een grote telescoop.", why_it_fits: "Je koos de stilte.", details: ["Reserveer een plek.", "Kleed je warm aan."],
  first_action: "Open de website.", practical: { estimated_cost: "€15", duration: "2 uur", difficulty: "easy", preparation: "" }, location: null, requirements: [],
  image_suggestion: "", photo_category: "nature_outdoor", door: "natural", scores: SCORES, ...over,
});
// one idea with a second page, so both kinds of idea page are in the book
const book: GeneratedIdeaBook = {
  profile_summary: "Je zoekt iets nieuws, dicht bij huis.", must_haves: ["Dichtbij"], preferences: ["Buiten"],
  ideas: [entry({ places: [{ name: "Sterrenwacht", city: "Utrecht", url: "https://sterren.test/", note: "Kijkavonden" }] }), entry({ door: "discovery" }), entry({ door: "unexpected" }), entry({ door: "stretch" })],
  wildcard: entry({ door: "wildcard" }),
  labels: { steps_heading: "", first_action_heading: "", wildcard_heading: "", time_label: "", cost_label: "", location_heading: "", requirements_heading: "" },
};

afterEach(() => vi.restoreAllMocks());

async function textPerPage(locale: Locale) {
  const drawn = new Map<PDFPage, string[]>();
  const original = PDFPage.prototype.drawText;
  vi.spyOn(PDFPage.prototype, "drawText").mockImplementation(function (this: PDFPage, text, options) {
    drawn.set(this, [...(drawn.get(this) ?? []), text]);
    return original.call(this, text, options);
  });
  const bytes = await renderIdeaBookPdf(book, "Titel", locale);
  const { PDFDocument } = await import("pdf-lib");
  const count = (await PDFDocument.load(bytes)).getPageCount();
  // the pages in the order they were first written on, which is the order of the book
  return { pages: [...drawn.values()], count };
}

describe("the picture disclaimer in the PDF", () => {
  for (const locale of ["nl", "en"] as const) {
    it(`stands on every page with a picture, in full where the book is introduced, and each idea picture has its caption (${locale})`, async () => {
      const { pages, count } = await textPerPage(locale);
      expect(pages).toHaveLength(count);
      const { long, short } = IMAGE_DISCLAIMER[locale];
      // the short text: at the foot of every page, the cover included
      for (const [i, texts] of pages.entries()) expect(texts, `page ${i + 1}`).toContain(short);
      // the full text, wrapped over its lines, on the introducing page only
      const squeeze = (texts: string[]) => texts.join(" ").replace(/\s+/g, " ");
      expect(squeeze(pages[1])).toContain(long);
      for (const [i, texts] of pages.entries()) if (i !== 1) expect(squeeze(texts), `page ${i + 1}`).not.toContain(long);
      // the caption: on each of the five idea pages and on the second page, not on the cover or the introducing page
      const caption = imageCaption("illustration", locale);
      const captioned = pages.map((texts, i) => (texts.includes(caption) ? i + 1 : 0)).filter(Boolean);
      expect(captioned).toEqual(Array.from({ length: count - 2 }, (_, i) => i + 3));
      expect(count).toBe(8);
    }, 60_000);
  }
});

describe("the captions", () => {
  it("name the source only for a picture of the place itself, and say plainly when it is not", () => {
    expect(imageCaption("source_site", "nl", "sonnenborgh.nl")).toBe("Beeld: sonnenborgh.nl");
    expect(imageCaption("places", "en", "Google")).toBe("Image: Google");
    expect(imageCaption("commons", "nl", "Wikimedia Commons")).toBe("Beeld: Wikimedia Commons");
    expect(imageCaption("stock", "nl", "pexels.com")).toBe("Sfeerbeeld — niet de genoemde locatie");
    expect(imageCaption("illustration", "nl")).toBe("Illustratie — niet de genoemde locatie");
    expect(imageCaption("illustration", "en")).toBe("Illustration — not the place named");
    // without a source a picture is never presented as the place
    expect(imageCaption("source_site", "nl", " ")).toBe("Illustratie — niet de genoemde locatie");
    expect(imageTag("illustration", "nl")).toBe("Illustratie");
    expect(imageTag("stock", "en")).toBe("Mood image");
  });

  it("keeps the brief's own Dutch words", () => {
    expect(IMAGE_DISCLAIMER.nl.short).toBe("Beelden zijn illustratief en kunnen afwijken van de genoemde locatie.");
    expect(IMAGE_DISCLAIMER.nl.long.startsWith("Afbeeldingen in dit boek zijn illustratief.")).toBe(true);
    expect(IMAGE_DISCLAIMER.nl.long.endsWith("via de website van de locatie.")).toBe(true);
  });
});
