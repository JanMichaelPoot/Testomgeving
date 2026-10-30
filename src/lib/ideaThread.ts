import { getAssociation, type AssociationSources } from "@/lib/discovery/associations";
import { TAGS, getActivity } from "@/lib/discovery/library";
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
  /**
   * B5 / V2 (only with KNOWLEDGE_ENGINE_V2): the activities our selection passed through between the person's
   * images and this door, e.g. "Meditatie → Stilteretraite". They are derived by us, never chosen by the person,
   * and are shown (and captioned) as such. Null when the door is the direct reading of the images.
   */
  path?: string | null;
  /** The door: the idea's title. */
  title: string;
  /** "Name, City" of the real place, when the idea has one. */
  place: string | null;
  /** Two-page intake: the person chose this activity themselves (page 2), it was not derived from their images. */
  own?: boolean;
}

const tagLabel = (locale: "nl" | "en") => new Map(TAGS.map((t) => [t.id, t.label[locale].toLowerCase()]));

/** Per idea key ("idea-0" ... and "wildcard"): its thread. Ideas without one are simply absent. */
export function buildIdeaThreads(
  ideas: readonly IdeaBookEntry[],
  wildcard: IdeaBookEntry | null,
  sources: AssociationSources | null,
  locale: "nl" | "en",
  opts: { showPath?: boolean } = {},
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
    const own = (sources.own ?? []).includes(id);
    // A thread needs at least one thing the person recognises: the image, the words we read, or that they chose it themselves.
    if (!card && tags.length === 0 && !own) return;
    const place = idea.location ? [idea.location.name, idea.location.city].filter(Boolean).join(", ") : "";
    // The chain ends at the idea itself; what stands before it is the way our selection got here.
    const via = opts.showPath && idea.chain && idea.chain.length > 1 ? idea.chain.slice(0, -1) : [];
    const path = via.map((a) => getActivity(a)?.label[locale]).filter((l): l is string => !!l);
    out[key] = {
      image: card ? { src: card.image, label: card.label[locale] } : null,
      tags,
      ...(path.length > 0 ? { path: path.join(" → ") } : {}),
      title: idea.title,
      place: place || null,
      ...(own ? { own: true } : {}),
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
  const read = image && tags ? copy.pdfBoth.replace("{image}", image).replace("{tags}", tags) : image ? copy.pdfImage.replace("{image}", image) : tags ? copy.pdfTags.replace("{tags}", tags) : null;
  // Chosen by the person themselves: said first, and the reading of the images comes after as what it adds.
  const base = thread.own ? (read ? `${copy.pdfOwn} ${read}` : copy.pdfOwn) : read;
  if (!base) return null;
  // V2: the activities in between, said as what they are (derived by us).
  return thread.path ? `${base} ${copy.pdfPath.replace("{path}", thread.path)}` : base;
}
