import { getAssociation, imagesBehind } from "@/lib/discovery/associations";
import { getActivity } from "@/lib/discovery/library";
import { ideaKey, WILDCARD_KEY } from "@/lib/ideaKeys";
import { formatSituationForEcho } from "@/lib/planEcho";
import type { IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import type { Dictionary } from "@/lib/i18n/dictionaries";

// /plan and the PDF for books made with the image intake ("Het venster", fase 5): the echo
// ("Je koos een stille bosrand, handen vol klei en houtgeur.") with the chosen images, and
// per idea the chosen image behind it ("Omdat je X koos"). Server side: it reads the library.

export interface VensterEchoSource {
  intakeVariant?: string;
  associations?: string[];
  purpose?: string;
  personalReflection?: string;
}

export interface VensterEcho {
  sentence: string;
  images: { src: string; alt: string }[];
  wrote: string | null;
}

export interface BecauseLine {
  src: string;
  label: string;
  text: string;
}

// Labels start with a capital ("Een stille bosrand"); inside a sentence they do not.
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function list(items: string[], and: string): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${and} ${items[items.length - 1]}`;
}

export function buildVensterEcho(source: VensterEchoSource | null, locale: "nl" | "en", dict: Dictionary["venster"]): VensterEcho | null {
  if (!source || source.intakeVariant !== "associations") return null;
  const cards = (source.associations ?? []).map((id) => getAssociation(id)).filter((c) => !!c);
  if (cards.length === 0) return null;
  // Three images say enough: one per round where possible.
  const picked = ["places", "moments", "senses"].map((r) => cards.find((c) => c!.round === r)).filter((c) => !!c);
  const shown = (picked.length >= 2 ? picked : cards).slice(0, 3);
  const labels = shown.map((c) => lower(c!.label[locale]));
  const gift = source.purpose === "gift";
  const wrote = formatSituationForEcho(source.personalReflection);
  return {
    sentence: (gift ? dict.reveal.choseGift : dict.reveal.chose).replace("{list}", list(labels, dict.reflection.and)),
    images: shown.map((c) => ({ src: c!.image, alt: c!.label[locale] })),
    wrote: wrote ? dict.reveal.wrote.replace("{text}", wrote.replace(/[.!?…]$/u, "")) : null,
  };
}

/** Per idea key ("idea-0" ... and "wildcard"): the chosen image that lies behind it. */
export function buildBecauseLines(
  ideas: IdeaBookEntry[],
  wildcard: IdeaBookEntry | null,
  source: VensterEchoSource | null,
  locale: "nl" | "en",
  dict: Dictionary["venster"],
): Record<string, BecauseLine> {
  if (!source || source.intakeVariant !== "associations") return {};
  const chosen = source.associations ?? [];
  const gift = source.purpose === "gift";
  const out: Record<string, BecauseLine> = {};
  const add = (key: string, idea: IdeaBookEntry | null) => {
    const activity = idea?.activity_id ? getActivity(idea.activity_id) : undefined;
    if (!activity) return;
    const [id] = imagesBehind(activity.tags, chosen, 1);
    const card = id ? getAssociation(id) : undefined;
    if (!card) return;
    const label = lower(card.label[locale]);
    out[key] = { src: card.image, label: card.label[locale], text: (gift ? dict.reveal.becauseGift : dict.reveal.because).replace("{image}", label) };
  };
  ideas.forEach((idea, i) => add(ideaKey(i), idea));
  add(WILDCARD_KEY, wildcard);
  return out;
}
