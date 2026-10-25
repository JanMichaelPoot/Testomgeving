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
  // creative
  shaping: "creative_workshop",
  textile_paper: "creative_workshop",
  visual: "creative_workshop",
  sound_stage: "music_nightlife",
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
  organise: "food_drink",
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
  "ijsbaden": "wellness_relax",
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
};

/** The photo category of an idea about this activity. Always one of the 12 library categories. */
export function photoCategoryFor(activity: Activity): PhotoCategory {
  return OVERRIDE[activity.id] ?? BY_SUB[activity.sub] ?? "nature_outdoor";
}
