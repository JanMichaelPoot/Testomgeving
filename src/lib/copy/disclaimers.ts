// Every text about what a picture does and does not show, in one place (build brief "beeld per vensteroptie", section 5a). Two layers that
// go together: one general disclaimer per book and screen, and a caption under each idea picture. The general text never replaces the
// caption: without it a reader cannot tell which pictures do show the real place.
//
// Pure and client-safe. The Dutch texts are the brief's own words.
import type { Locale } from "@/lib/locale";

export const IMAGE_DISCLAIMER: Record<Locale, { long: string; short: string }> = {
  nl: {
    long: "Afbeeldingen in dit boek zijn illustratief. Ze geven een indruk van de activiteit en komen niet altijd overeen met de specifieke locatie die wordt genoemd. Bekijk de actuele situatie altijd via de website van de locatie.",
    short: "Beelden zijn illustratief en kunnen afwijken van de genoemde locatie.",
  },
  en: {
    long: "The images in this book are illustrative. They give an impression of the activity and do not always match the specific place that is named. Always check the current situation on the place's website.",
    short: "Images are illustrative and may differ from the place named.",
  },
};

/** Where a picture comes from. The first three show the named place itself (its own site, Google Places, Wikimedia Commons, after the match check). */
export type ImageOrigin = "source_site" | "places" | "commons" | "stock" | "illustration";

const CAPTION: Record<Locale, { image: string; stock: string; illustration: string; stockTag: string; illustrationTag: string }> = {
  nl: { image: "Beeld: {source}", stock: "Sfeerbeeld — niet de genoemde locatie", illustration: "Illustratie — niet de genoemde locatie", stockTag: "Sfeerbeeld", illustrationTag: "Illustratie" },
  en: { image: "Image: {source}", stock: "Mood image — not the place named", illustration: "Illustration — not the place named", stockTag: "Mood image", illustrationTag: "Illustration" },
};

const localeOf = (locale: string): Locale => (locale === "en" ? "en" : "nl");

/** The caption that belongs under a picture. A picture of the place itself names its source; without a source it is not presented as the place. */
export function imageCaption(origin: ImageOrigin, locale: string, source?: string): string {
  const words = CAPTION[localeOf(locale)];
  if (origin === "stock") return words.stock;
  if (origin === "illustration" || !source?.trim()) return words.illustration;
  return words.image.replace("{source}", source.trim());
}

/** The one word that fits on a small thumbnail; the full caption stands with the larger picture. */
export function imageTag(origin: "stock" | "illustration", locale: string): string {
  const words = CAPTION[localeOf(locale)];
  return origin === "stock" ? words.stockTag : words.illustrationTag;
}

/**
 * Where an idea's picture comes from. Today every one of them is a picture generated beforehand, one per activity or per category
 * (src/lib/imageProvenance.json): never the named place. The image matching of the brief's sections 3 and 4 would change that here.
 */
export function ideaImageOrigin(): "illustration" {
  return "illustration";
}

export const imageDisclaimer = (locale: string) => IMAGE_DISCLAIMER[localeOf(locale)];
