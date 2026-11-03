import { ASSOCIATIONS } from "@/lib/discovery/associations";
import { getActivity, TAGS } from "@/lib/discovery/library";
import { averageAxes, axisLeanings, effectiveAxes, sanitizeAxesOverride, type AxesOverride } from "@/lib/discovery/associationProfile";
import { normalizeSearchContext } from "@/lib/discovery/audience";
import { cleanRecipientName } from "@/lib/discovery/imageIntake";
import type { InterpretAudience, InterpretFacts } from "@/lib/discovery/interpretation";

// The facts the model-written reading is made from, rebuilt on the server from ids (src/app/intake/interpret.ts). Nothing the browser typed
// goes in except a first name, cleaned. Kept out of the server-action file so it is not callable from the browser.

export interface InterpretRequest {
  associations: string[];
  interests: string[];
  corrections: string[];
  axesOverride?: AxesOverride;
  searchContext?: string;
  purpose?: string;
  recipientName?: string;
}

const LEAN_WORDS: Record<string, string> = {
  inside: "leans towards being indoors",
  outside: "leans towards being outdoors",
  calm: "leans towards calm, unhurried things",
  active: "leans towards active, energetic things",
  alone: "leans towards doing things on their own",
  together: "leans towards doing things with others",
  familiar: "leans towards the familiar",
  fresh: "leans towards something new",
};

/** The facts the model gets, rebuilt on the server from ids (nothing the browser typed except a first name, cleaned). */
export function buildFacts(req: InterpretRequest, locale: "nl" | "en"): InterpretFacts | null {
  const byId = new Map(ASSOCIATIONS.map((c) => [c.id, c]));
  const cards = [...new Set(req.associations ?? [])].map((id) => byId.get(id)).filter((c): c is NonNullable<typeof c> => !!c).slice(0, 12);
  if (cards.length === 0) return null;
  const tagLabel = new Map(TAGS.map((t) => [t.id, t.label[locale].toLowerCase()]));
  const ids = cards.map((c) => c.id);
  const corrections = (req.corrections ?? []).filter((t) => tagLabel.has(t)).slice(0, 3);
  const images = cards.map((c) => {
    const own = Object.entries(c.tagWeights)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([t]) => tagLabel.get(t))
      .filter((l): l is string => !!l);
    return { label: c.label[locale], tags: own };
  });
  const activities = [...new Set(req.interests ?? [])]
    .map((id) => getActivity(id))
    .filter((a): a is NonNullable<typeof a> => !!a)
    .slice(0, 8)
    .map((a) => a.label[locale]);
  const axes = effectiveAxes(averageAxes(cards, ids), sanitizeAxesOverride(req.axesOverride));
  const lean = axisLeanings(axes);
  const leans = [lean.setting, lean.energy, lean.social, axes.novelty <= -0.35 ? "familiar" : axes.novelty >= 0.35 ? "fresh" : undefined]
    .filter((x): x is string => !!x)
    .map((x) => LEAN_WORDS[x]);
  // Who the reading is about.
  const ctx = normalizeSearchContext(req.searchContext);
  const name = cleanRecipientName(req.recipientName ?? "");
  const forOther = req.purpose === "gift" || ctx === "child" || ctx === "adult" || ctx === "group";
  const audience: InterpretAudience = ctx === "group" ? "group" : forOther ? (name ? "named" : "other") : "self";
  return {
    locale,
    audience,
    name: audience === "named" ? name : "",
    images,
    activities,
    leans,
    corrections: corrections.map((t) => tagLabel.get(t)!),
  };
}

