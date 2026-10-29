import type { Metadata } from "next";
import type { Dictionary } from "@/lib/i18n/dictionaries";

// The preview card of a shared Idea Book (the picture WhatsApp, iMessage, LinkedIn, X and Facebook
// show when the link is pasted), and its page metadata. Pure, so it can be tested. The rule for
// everything in here: show what is meant for a stranger, never the buyer's personal answers (no
// open answer, age, place or profile text).

/** "7 deuren uit één venster". The wildcard counts as a door, so 6 ideas + 1 wildcard = 7. */
export function shareCardLine(dict: Dictionary["shared"], doors: number): string {
  return doors === 1 ? dict.cardLineOne : dict.cardLine.replace("{n}", String(doors));
}

export function sharedMetadata(dict: Dictionary["shared"], doors: number): Metadata {
  const title = dict.ogTitle;
  const description = doors > 0 ? `${shareCardLine(dict, doors)}. ${dict.intro}` : dict.intro;
  return {
    title,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

/** Only our own illustrations may be read into the card; ids come from the database. */
export function safeIllustrationPath(src: string): string | null {
  return /^\/illustrations\/[A-Za-z0-9_\-/]+\.jpg$/.test(src) && !src.includes("..") ? src : null;
}

