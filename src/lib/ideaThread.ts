import { getAssociation, type AssociationSources } from "@/lib/discovery/associations";
import { TAGS } from "@/lib/discovery/library";
import { ideaKey, WILDCARD_KEY } from "@/lib/ideaKeys";
import type { IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import type { Dictionary } from "@/lib/i18n/dictionaries";

// The thread per door (R2.2): "jouw beeld -> wat we erin lazen -> deze deur -> de echte plek".
// Built from what the book stored at the moment it was written (association_sources), so it only
// ever shows connections that really are in the data: an image the person chose, tags that sit on
// both that image and the activity, the door itself, and the place the research found. A link
// that is not there is left out, never filled in. Server side: it reads the image library.

export interface IdeaThreadData {
  image: { src: string; label: string } | null;
  /** Labels of the (at most two) tags through which the image and the activity meet. */
  tags: string[];
  /** The door: the idea's title. */
  title: string;
  /** "Name, City" of the real place, when the idea has one. */
  place: string | null;
}

const tagLabel = (locale: "nl" | "en") => new Map(TAGS.map((t) => [t.id, t.label[locale].toLowerCase()]));

/** Per idea key ("idea-0" ... and "wildcard"): its thread. Ideas without one are simply absent. */
export function buildIdeaThreads(
  ideas: readonly IdeaBookEntry[],
  wildcard: IdeaBookEntry | null,
  sources: AssociationSources | null,
  locale: "nl" | "en",
): Record<string, IdeaThreadData> {
  if (!sources) return {};
  const labels = tagLabel(locale);
  const out: Record<string, IdeaThreadData> = {};
  const add = (key: string, idea: IdeaBookEntry | null) => {
    const id = idea?.activity_id;
    if (!idea || !id) return;
    const card = (sources.sources[id] ?? []).map((imageId) => getAssociation(imageId)).find((c) => !!c);
    // The words we "read in it" sit next to the image that is shown, so only tags that image
    // itself carries are shown: a tag that came from another chosen image would suggest the
    // wrong connection. Without a shown image, the stored tags stand on their own.
    const tags = (sources.sourceTags[id] ?? [])
      .filter((t) => !card || (card.tagWeights[t] ?? 0) > 0)
      .map((t) => labels.get(t))
      .filter((t): t is string => !!t);
    // A thread needs at least one thing the person recognises: the image or the words we read.
    if (!card && tags.length === 0) return;
    const place = idea.location ? [idea.location.name, idea.location.city].filter(Boolean).join(", ") : "";
    out[key] = {
      image: card ? { src: card.image, label: card.label[locale] } : null,
      tags,
      title: idea.title,
      place: place || null,
    };
  };
  ideas.forEach((idea, i) => add(ideaKey(i), idea));
  add(WILDCARD_KEY, wildcard);
  return out;
}

/** The thread as one short sentence for the PDF page (no arrows: the fonts have no such glyph). */
export function threadSentence(thread: IdeaThreadData | undefined, copy: Dictionary["venster"]["thread"], and: string): string | null {
  if (!thread) return null;
  const tags = thread.tags.length <= 1 ? thread.tags.join("") : `${thread.tags.slice(0, -1).join(", ")} ${and} ${thread.tags[thread.tags.length - 1]}`;
  const image = thread.image?.label.replace(/^./, (c) => c.toLowerCase());
  if (image && tags) return copy.pdfBoth.replace("{image}", image).replace("{tags}", tags);
  if (image) return copy.pdfImage.replace("{image}", image);
  if (tags) return copy.pdfTags.replace("{tags}", tags);
  return null;
}
