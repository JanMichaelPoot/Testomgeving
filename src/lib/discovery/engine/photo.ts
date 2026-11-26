import type { PhotoCategory } from "@/lib/claude/ideaBookTypes";
import type { Activity } from "@/lib/discovery/types";

// The Idea Book shows one photo per idea from a fixed library of 12 categories. With the
// selection engine the activity is known before any text is written, so the category is
// looked up here instead of being asked from the model (which saves output tokens and
// cannot be wrong). Sub-domain gives the default; a few activities override it.

const BY_SUB: Record<string, PhotoCategory> = {
  // movement
  endurance: "active_sport",
  water: "water_activity",
  climbing: "active_sport",
  moving_together: "active_sport",
  precision_strength: "active_sport",
  dance: "active_sport",
  // creative
  shaping: "creative_workshop",
  textile_paper: "creative_workshop",
  visual: "creative_workshop",
  sound_stage: "creative_workshop", // mostly writing and practising; what is done together is in OVERRIDE
  // nature
  walking: "nature_outdoor",
  animals: "nature_outdoor",
  plants: "nature_outdoor",
  light_sky_water: "nature_outdoor",
  // history
  lived_past: "art_culture",
  research: "art_culture",
  places_stories: "art_culture",
  // games
  tabletop: "social_games",
  story_play: "social_games",
  puzzles: "social_games",
  digital_action: "social_games",
  // collecting
  small_building: "home_cozy",
  collecting_hunting: "market_shopping",
  specialist: "home_cozy",
  // tech
  making_tech: "creative_workshop",
  repair_craft: "creative_workshop",
  science: "art_culture",
  // solo
  own_pace: "travel_adventure",
  // together
  join_in: "social_games",
  organise: "social_games",
  // restful
  body_breath: "wellness_relax",
  read_listen: "home_cozy",
  reflection: "home_cozy",
  // adventure
  heights_air: "travel_adventure",
  deep_dark: "travel_adventure",
  wild_water: "water_activity",
  rough_terrain: "travel_adventure",
  // target
  shooting: "active_sport",
  throwing: "active_sport",
  fine_aim: "active_sport",
  // speed
  wheels: "active_sport",
  air_flight: "travel_adventure",
  snow_ice: "active_sport",
  // mystery
  puzzle_rooms: "social_games",
  urban_explore: "travel_adventure",
  true_crime: "art_culture",
  // elements
  fire_metal: "creative_workshop",
  wood_stone: "creative_workshop",
  wild_skills: "nature_outdoor",
  // food
  cooking_craft: "food_drink",
  drink_craft: "food_drink",
  harvest: "food_drink",
  // stage
  spoken_word: "music_nightlife",
  show_craft: "music_nightlife",
  film_media: "creative_workshop",
  // night
  evening_out: "music_nightlife",
  card_chance: "social_games",
  music_night: "music_nightlife",
  // style
  making_wear: "creative_workshop",
  scene_style: "creative_workshop",
  look_care: "creative_workshop",
  flowers_scent: "creative_workshop",
  // travel
  journeys: "travel_adventure",
  stays: "travel_adventure",
  // society and growth: the book types these by the activity itself (bookKindOverride); the category only picks a fallback photo
  helping: "social_games",
  place_care: "social_games",
  speak_lead: "art_culture",
  skills: "art_culture",
};

const OVERRIDE: Record<string, PhotoCategory> = {
  // food and drink
  "ander-land": "food_drink",
  "koffie-thee": "food_drink",
  "hist-koken": "food_drink",
  kookwetenschap: "food_drink",
  buurtmaaltijd: "food_drink",
  potluck: "food_drink",
  "kook-club": "food_drink",
  "onbekenden-diner": "food_drink",
  theeceremonie: "food_drink",
  // markets and shopping
  "markt-ingredient": "market_shopping",
  kringloop: "market_shopping",
  vinyl: "market_shopping",
  boekwinkels: "market_shopping",
  "levend-verleden": "market_shopping",
  // water
  kanoen: "water_activity",
  zeilen: "water_activity",
  "open-water": "water_activity",
  aquarium: "home_cozy",
  // music and nightlife
  concert: "music_nightlife",
  "open-podium": "music_nightlife",
  dansen: "music_nightlife",
  "hist-dans": "music_nightlife",
  // outdoors
  kamperen: "nature_outdoor",
  sterrenkijken: "nature_outdoor",
  telescoop: "nature_outdoor",
  fietsroute: "active_sport",
  picknick: "nature_outdoor",
  hangmat: "nature_outdoor",
  "tai-chi": "nature_outdoor",
  wandelmeditatie: "nature_outdoor",
  wandelgroep: "nature_outdoor",
  wandelmaatje: "nature_outdoor",
  geocaching: "nature_outdoor",
  audiowandeling: "nature_outdoor",
  fotowandeling: "nature_outdoor",
  toerist: "travel_adventure",
  stadswandeling: "travel_adventure",
  legendes: "travel_adventure",
  // foraging, farms and the sea
  foerageren: "nature_outdoor",
  pluktuin: "nature_outdoor",
  boerderijdag: "nature_outdoor",
  "wijngaard-oogst": "nature_outdoor",
  wadlopen: "nature_outdoor",
  "zeehonden-varen": "nature_outdoor",
  freediven: "water_activity",
  grotduiken: "water_activity",
  wrakduiken: "water_activity",
  "grotten-verkennen": "travel_adventure",
  hofjes: "art_culture",
  stoomtrein: "travel_adventure",
  oldtimerrit: "travel_adventure",
  "dineren-in-het-donker": "food_drink",
  nachtmarkt: "market_shopping",
  "streetfoodtour": "food_drink",
  "veiling": "market_shopping",
  "ruilbeurs-planten": "market_shopping",
  // at home
  legpuzzels: "home_cozy",
  raadsels: "home_cozy",
  speedcuben: "home_cozy",
  "solo-rpg": "home_cozy",
  "coop-games": "social_games",
  genealogie: "home_cozy",
  archief: "home_cozy",
  handschriften: "home_cozy",
  brieven: "home_cozy",
  postcrossing: "home_cozy",
  kamerplanten: "home_cozy",
  "zaailingen-kweken": "home_cozy",
  "mieren-houden": "home_cozy",
  // places to look around in
  "natuurhistorisch-museum": "art_culture",
  vlindertuin: "art_culture",
  reptielen: "art_culture",
  pluimveetentoonstelling: "art_culture",
  modemuseum: "art_culture",
  modeshow: "art_culture",
  "film-theater": "art_culture",
  ateliers: "art_culture",
  // making
  muurschildering: "creative_workshop",
  ambachten: "creative_workshop",
  "knopen-touwwerk": "creative_workshop",
  buurtkaart: "creative_workshop",
  "cafe-schrijven": "creative_workshop",
  // other cases where the subdomain's default is wrong
  kattencafe: "food_drink",
  "alleen-uit-eten": "food_drink",
  "middeleeuws-banket": "food_drink",
  "personal-shopping": "market_shopping",
  bloemenmarkt: "market_shopping",
  platenwinkel: "market_shopping",
  gezichtsbehandeling: "wellness_relax",
  detox: "wellness_relax",
  schermen: "active_sport",
  hema: "active_sport",
  "regency-bal": "music_nightlife",
  snorkelen: "water_activity",
  ijsbaden: "water_activity",
  fossielen: "nature_outdoor",
  "rc-modellen": "nature_outdoor",
  spotten: "nature_outdoor",
  // making music or theatre together
  koor: "music_nightlife",
  improvisatie: "music_nightlife",
  drumcirkel: "music_nightlife",
  "djembe-trommelcirkel": "music_nightlife",
  "fanfare-orkest": "music_nightlife",
  // alone at your own desk, although the subdomain is about performing
  "podcast-maken": "creative_workshop",
  rappen: "creative_workshop",
  goochelen: "creative_workshop",
  cosplay: "creative_workshop",
  "theatermake-up": "creative_workshop",
  "jongleren-leren": "creative_workshop",
  beatboxen: "creative_workshop",
  detectiveverhaal: "creative_workshop",
  // going to watch
  "opera-bezoek": "art_culture",
  "ballet-bezoek": "art_culture",
  "musical-bezoek": "art_culture",
};

// Learning, helping and collecting fit none of the types the 12 photo categories stand for (volunteering in a hospice would read "Social",
// ending in "one last drink"), so the book types these by the activity itself.
export type BookKindOverride = "learning" | "helping" | "collecting";

const KIND_OVERRIDE: Record<string, BookKindOverride> = {
  "online-cursus": "learning",
  "taal-leren": "learning",
  "gebarentaal-leren": "learning",
  "esperanto-leren": "learning",
  hoofdrekenen: "learning",
  "dertig-dagen": "learning",
  volksuniversiteit: "learning",
  "latijn-grieks-lezen": "learning",
  "data-visualisatie": "learning",
  "mini-onderzoek-doen": "learning",
  dierenasiel: "helping",
  natuurbeheer: "helping",
  "festival-vrijwilliger": "helping",
  "archief-indexeren": "helping",
  "wikipedia-bijdragen": "helping",
};

/** Collecting where the outing itself is the market or shop: these stay "Markets & shopping". */
const MARKET_OUTINGS = new Set(["kringloop", "rommelmarkt", "brocante-antiek", "veiling", "vintage-kleding", "ruilbeurs-planten"]);

/** The type the book names for this activity when its photo category cannot; null when the category says it well enough. */
export function bookKindOverride(activity: Activity): BookKindOverride | null {
  const own = KIND_OVERRIDE[activity.id];
  if (own) return own;
  if (activity.domain === "society") return "helping";
  if (activity.domain === "growth") return "learning";
  if (activity.sub === "collecting_hunting" && !MARKET_OUTINGS.has(activity.id)) return "collecting";
  return null;
}

/** Whether the subdomain has its own default; photo.test.ts keeps this true for every activity, so the fallback below is never relied on. */
export function hasPhotoDefault(sub: string): boolean {
  return sub in BY_SUB;
}

/** The photo category of an idea about this activity. Always one of the 12 library categories. */
export function photoCategoryFor(activity: Activity): PhotoCategory {
  return OVERRIDE[activity.id] ?? BY_SUB[activity.sub] ?? "nature_outdoor";
}
