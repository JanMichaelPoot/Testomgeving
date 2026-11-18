import kindJson from "@/lib/discovery/activityKind.json";
import type { Activity, Localized } from "@/lib/discovery/types";

// Two facets the library did not carry (docs/plan-activiteitenselectie.md, B1 and B2), from the reference "De activiteiten-engine" (4.2 and 4.4):
//   kind  what you do: make something, learn, move, play, go out and explore, experience, do together, perform
//   mode  how it can be done: by yourself, with a provider or place, or only after something is organised first
// The table in activityKind.json is the source of truth (one line per activity id, like register.json) and can be corrected there; the
// functions below are the fallback for an activity nobody classified yet, and activityKind.test.ts fails on such an activity so the
// fallback is never silently relied on. Pure and client-safe. Internal: used by selection and the quality gate, and (mode) shown in the book.

export const KINDS = ["make", "learn", "move", "play", "explore", "experience", "meet", "perform"] as const;
export type ActivityKind = (typeof KINDS)[number];

export const MODES = ["self", "provider", "organise"] as const;
export type ExecutionMode = (typeof MODES)[number];

export const KIND_LABELS: Record<ActivityKind, Localized> = {
  make: { nl: "Zelf iets maken", en: "Make something yourself" },
  learn: { nl: "Iets leren", en: "Learn something" },
  move: { nl: "Bewegen en sporten", en: "Move and exercise" },
  play: { nl: "Spelen en uitdagen", en: "Play and compete" },
  explore: { nl: "Erop uit en ontdekken", en: "Go out and explore" },
  experience: { nl: "Beleven en tot rust komen", en: "Experience and unwind" },
  meet: { nl: "Samen doen en helpen", en: "Do together and help" },
  perform: { nl: "Optreden en voordragen", en: "Perform and present" },
};

/** Said in the book, next to the practical facts: what the reader still has to arrange. */
export const MODE_LABELS: Record<ExecutionMode, Localized> = {
  self: { nl: "Zelf te doen", en: "You can do this yourself" },
  provider: { nl: "Via een aanbieder of plek", en: "Through a provider or venue" },
  organise: { nl: "Eerst te organiseren", en: "Needs organising first" },
};

interface KindTable {
  kinds: Record<string, ActivityKind>;
  modes: Record<string, ExecutionMode>;
}
export const KIND_TABLE = kindJson as KindTable;

// The default kind of a subdomain (or of a whole domain with "*"): the fallback and the starting point the table was made from.
const SUB_KIND: Record<string, ActivityKind> = {
  "adventure/*": "move", "collecting/collecting_hunting": "explore", "collecting/small_building": "make", "collecting/specialist": "explore",
  "creative/shaping": "make", "creative/sound_stage": "perform", "creative/textile_paper": "make", "creative/visual": "make",
  "elements/fire_metal": "make", "elements/wood_stone": "make", "elements/wild_skills": "learn",
  "food/cooking_craft": "make", "food/drink_craft": "experience", "food/harvest": "explore",
  "games/*": "play", "growth/skills": "learn", "growth/speak_lead": "learn",
  "history/lived_past": "experience", "history/places_stories": "explore", "history/research": "learn",
  "movement/*": "move", "mystery/puzzle_rooms": "play", "mystery/true_crime": "play", "mystery/urban_explore": "explore",
  "nature/animals": "explore", "nature/light_sky_water": "explore", "nature/plants": "make", "nature/walking": "explore",
  "night/card_chance": "play", "night/evening_out": "experience", "night/music_night": "experience",
  "restful/*": "experience", "society/*": "meet", "solo_explore/own_pace": "explore",
  "speed/*": "move", "stage/film_media": "make", "stage/show_craft": "perform", "stage/spoken_word": "perform",
  "style/flowers_scent": "experience", "style/look_care": "learn", "style/making_wear": "make", "style/scene_style": "experience",
  "target/*": "play", "tech/making_tech": "make", "tech/repair_craft": "make", "tech/science": "learn",
  "together/*": "meet", "travel/*": "explore",
};

type Facets = Pick<Activity, "id" | "domain" | "sub" | "cost" | "supply" | "formats" | "safety">;

/** The kind a subdomain points to. Fallback and sanity check, not the source of truth. */
export function deriveKind(a: Pick<Activity, "domain" | "sub">): ActivityKind {
  return SUB_KIND[`${a.domain}/${a.sub}`] ?? SUB_KIND[`${a.domain}/*`] ?? "explore";
}

// Subdomains that need a venue or a counter even when the activity is cheap and safe.
const VENUE_SUBS = new Set(["night/music_night", "night/evening_out", "target/fine_aim", "target/shooting", "target/throwing"]);

/** The mode the facets point to. Fallback and sanity check, not the source of truth. */
export function deriveMode(a: Facets, kind: ActivityKind = deriveKind(a)): ExecutionMode {
  const sub = `${a.domain}/${a.sub}`;
  const supply = a.supply ?? "common";
  if (a.domain === "travel" || sub === "together/organise") return "organise";
  const aloneOk = !!a.formats && a.formats.some((f) => f === "solo" || f === "duo" || f === "with_known");
  const easy = a.safety.tier === 0 && supply === "common" && (a.cost === null || a.cost <= 1);
  if (easy && aloneOk && kind !== "perform" && kind !== "meet" && !VENUE_SUBS.has(sub) && (kind !== "move" || sub === "movement/endurance")) return "self";
  return "provider";
}

/** The kind of an activity: its line in activityKind.json, else derived from its subdomain. */
export function kindOfActivity(a: Pick<Activity, "id" | "domain" | "sub">): ActivityKind {
  return KIND_TABLE.kinds[a.id] ?? deriveKind(a);
}

/** How an activity can be done: its line in activityKind.json, else derived from its facets. */
export function modeOfActivity(a: Facets): ExecutionMode {
  return KIND_TABLE.modes[a.id] ?? deriveMode(a, kindOfActivity(a));
}
