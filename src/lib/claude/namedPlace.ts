// Which of its places an idea is about (Step 254). An idea lists up to three places; its title, its price and its first step name one of
// them, and that is not always the first in the list. The fact check read the first two and judged an idea against another club's site.
//
// Pure and client-safe.
import type { IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import type { IdeaPlace } from "@/lib/claude/ideaLayers";
import { hostKey } from "@/lib/links/normalizeUrl";

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** The name without what a listing adds after it: "Stadsboerderij Griftsteede | Utrecht Natuurlijk", "Get Events - Spookwandeling Utrecht". */
export const mainName = (name: string) => name.split(/\s+[|–—-]\s+/)[0].trim();

const sameName = (a: string, b: string) => {
  const x = fold(mainName(a));
  const y = fold(mainName(b));
  return x.length >= 4 && y.length >= 4 && (x.includes(y) || y.includes(x));
};
const names = (text: string, place: IdeaPlace) => {
  const wanted = fold(mainName(place.name));
  return wanted.length >= 5 && fold(text).includes(wanted);
};

function score(entry: Pick<IdeaBookEntry, "title" | "first_action" | "details" | "location" | "practical">, place: IdeaPlace): number {
  const host = place.url ? hostKey(place.url) : "";
  const steps = (entry.details ?? []).join(" ");
  let points = 0;
  if (entry.location?.name && sameName(entry.location.name, place.name)) points += 8;
  if (names(entry.title ?? "", place)) points += 4;
  if (place.price && place.price.text === entry.practical?.estimated_cost) points += 3;
  if (host && (entry.first_action ?? "").toLowerCase().includes(host)) points += 2;
  if (names(entry.first_action ?? "", place)) points += 2;
  if ((host && steps.toLowerCase().includes(host)) || names(steps, place)) points += 1;
  return points;
}

/** The idea's places, the one it names first; the others keep their order. */
export function placesNamedFirst(entry: Pick<IdeaBookEntry, "title" | "first_action" | "details" | "location" | "practical" | "places">): IdeaPlace[] {
  return [...(entry.places ?? [])].map((place, i) => ({ place, i, points: score(entry, place) })).sort((a, b) => b.points - a.points || a.i - b.i).map((x) => x.place);
}
