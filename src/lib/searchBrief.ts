// The search profile ("Jouw zoekprofiel"): what the book is searched for, shown on the last screen right above the order, before anything is generated or paid.
// It only gathers what the person already answered (who it is for, the place and how far, time, budget, what to take into account, the activities chosen) into
// labelled rows, each with the page where it can be changed. Pure: the wizard hands in its answers and its dictionary, nothing here reads state or the network.
import { DISTANCE_OVER_100 } from "@/lib/distanceOptions";
import { displayPlace, shortPlace } from "@/lib/place";
import { normalizeSearchContext } from "@/lib/discovery/audience";

export type BriefRowId = "who" | "where" | "time" | "budget" | "limits" | "picks";

export interface BriefRow {
  id: BriefRowId;
  label: string;
  /** The answer in one line ("Utrecht, Nederland"). */
  value: string;
  /** A second, smaller line ("Binnen 15 km"). */
  detail?: string;
  /** Several short items shown as chips (what to take into account, the activities chosen). */
  items?: string[];
  /** The answer is not given: the row says so softly and does not look like a choice. */
  empty?: boolean;
  /** The screen where this is changed: the start page (who, where, time, budget, limits) or page 2 (the activities). */
  editPage: "start" | "concrete";
}

export interface BriefCopy {
  rows: Record<BriefRowId, string>;
  /** Shown instead of the answer when there is none. */
  empty: { time: string; budget: string; limits: string; picks: string; surprise: string };
  who: { self: string; other: string; named: string; group: string; child: string; childNamed: string };
  /** Conditions that follow from who it is for. */
  rules: { child: string; group: string };
  within: string; // {km}
  over100: string;
  /** The closing sentence: "We zoeken naar echte plekken {where}." */
  foot: string; // {where}
  footWithin: string; // {km} {place}
  footWide: string; // {place}
}

export interface BriefInput {
  searchContext?: string;
  recipientName?: string;
  location?: string;
  countryName?: string;
  distanceKm?: number;
  timeLabel?: string;
  /** The budget as the wizard words it ("Tot €50 per persoon"), "" when the person left it open. */
  budgetLabel?: string;
  /** What to take into account that the person ticked (the older intakes had chips for it; the two-page intake has none). The conditions that follow from who it is for are added here. */
  limits?: readonly string[];
  /** The activities chosen on page 2 (labels), without the ones a limit rules out. */
  picks?: readonly string[];
  surpriseMe?: boolean;
}

export interface SearchBrief {
  rows: BriefRow[];
  /** "We zoeken naar echte plekken binnen 15 km van Utrecht." */
  foot: string;
}

const clean = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

export function buildSearchBrief(input: BriefInput, copy: BriefCopy): SearchBrief {
  const ctx = normalizeSearchContext(input.searchContext);
  const name = clean(input.recipientName).slice(0, 40);
  const who =
    ctx === "group"
      ? copy.who.group
      : ctx === "child"
        ? name
          ? copy.who.childNamed.replaceAll("{name}", name)
          : copy.who.child
        : ctx === "adult"
          ? name
            ? copy.who.named.replaceAll("{name}", name)
            : copy.who.other
          : copy.who.self;

  const place = displayPlace(input.location);
  const short = shortPlace(input.location) || place;
  const country = clean(input.countryName);
  const km = input.distanceKm;
  const wide = typeof km === "number" && km >= DISTANCE_OVER_100;
  const radius = typeof km === "number" ? (wide ? copy.over100 : copy.within.replaceAll("{km}", String(km))) : undefined;

  const limits = [...(ctx === "child" ? [copy.rules.child] : ctx === "group" ? [copy.rules.group] : []), ...(input.limits ?? []).map(clean).filter(Boolean)];
  const picks = (input.picks ?? []).map(clean).filter(Boolean);
  const time = clean(input.timeLabel);
  const budget = clean(input.budgetLabel);

  const rows: BriefRow[] = [
    { id: "who", label: copy.rows.who, value: who, editPage: "start" },
    { id: "where", label: copy.rows.where, value: [place, country].filter(Boolean).join(", ") || "-", ...(radius ? { detail: radius } : {}), editPage: "start" },
    { id: "time", label: copy.rows.time, value: time || copy.empty.time, ...(time ? {} : { empty: true }), editPage: "start" },
    { id: "budget", label: copy.rows.budget, value: budget || copy.empty.budget, ...(budget ? {} : { empty: true }), editPage: "start" },
    limits.length > 0
      ? { id: "limits", label: copy.rows.limits, value: limits.join(", "), items: limits, editPage: "start" }
      : { id: "limits", label: copy.rows.limits, value: copy.empty.limits, empty: true, editPage: "start" },
    input.surpriseMe && picks.length === 0
      ? { id: "picks", label: copy.rows.picks, value: copy.empty.surprise, empty: true, editPage: "concrete" }
      : picks.length > 0
        ? { id: "picks", label: copy.rows.picks, value: picks.join(", "), items: picks, editPage: "concrete" }
        : { id: "picks", label: copy.rows.picks, value: copy.empty.picks, empty: true, editPage: "concrete" },
  ];

  const where = !short ? "" : wide || typeof km !== "number" ? copy.footWide.replaceAll("{place}", short) : copy.footWithin.replaceAll("{km}", String(km)).replaceAll("{place}", short);
  const foot = where ? copy.foot.replaceAll("{where}", where) : "";
  return { rows, foot };
}
