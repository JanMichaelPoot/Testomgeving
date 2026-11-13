import type { Activity } from "@/lib/discovery/types";

// What does not suit three groups the library carries no data for: families with young children, people who use a wheelchair, and
// people who want a calm pace. The library has no age, accessibility or noise field, so (like MINOR_UNSUITABLE in audience.ts) this is a
// short, explicit, human-checked list plus the facets an activity already has. It only rules out a KNOWN conflict; anything it cannot
// judge stays in and is checked by the research step (the "accessibility" and "children" verify flags).
// Pure and client-safe: the wizard (page 2), the engine and the tests run the same code. Every id below is checked against the library
// by suitability.test.ts, so a renamed or removed activity cannot leave a dead entry behind.

type Facets = Pick<Activity, "id" | "domain" | "intensity" | "level" | "formats" | "safety"> & { tags: readonly string[] };

// --- families with young children (roughly up to eight) ------------------------------------------------------------------------

// Worlds that are for adults: skills for a career, volunteering and care work, evenings out. Only the listed activities in them suit a family.
const YOUNG_KIDS_ONLY: Record<string, ReadonlySet<string>> = {
  growth: new Set(),
  society: new Set(["straatfeest"]),
  together: new Set(["familie-uitje", "spelavond-thuis", "potluck", "buurttuin", "muurschildering", "buurtmaaltijd", "kook-club"]),
  night: new Set(["karaoke", "bingo-avond", "rolschaatsdisco", "silent-disco", "openluchtbioscoop", "lichtfestival"]),
};

const ids = (s: string): string[] => s.split(/\s+/).filter(Boolean);

/** Single activities that do not suit young children: sharp or hot tools, long solitary or technical work, adult leisure, hard to do with a toddler. */
export const YOUNG_KIDS_UNSUITABLE: ReadonlySet<string> = new Set([
  ...ids(`katapult-schieten blaaspijp paintball-airsoft houthakken kano-uithollen steenhouwen-dag goudsmeden glasblazen houtsnijden houtdraaien
    houtinleg-marqueterie meubel-bouwen zwaluwstaart-kist scheepsmodel-bouwen vlonder-bouwen tuinmeubels-maken houten-klok-bouwen keukenplank-maken
    pallet-meubels steigerhout-meubel droge-stenen-muur boomhut-bouwen ukelele-bouwen figuurzagen schoenmaken edelstenen-slijpen emailleren glas-mozaiek
    glasfusing betonnen-schalen-maken motor-sleutelen vuur-maken bushcraft boomhut-nacht tarp-nacht`),
  // wellness and slow-down activities for adults
  ...ids(`sauna massage stilteweekend floattank thermen spa-dag wellnessweekend hammam koud-water-sessie ademwerk klankbad levenslijn weekreview
    filosofie volksuniversiteit journaling meditatie wandelmeditatie tai-chi tarot pilates`),
  // alone, abroad or for the evening out
  ...ids(`alleen-uit-eten cafe-schrijven detox dertig-dagen slow-travel groundhoppen online-cursus taal-leren esperanto-leren platenwinkel ander-land toerist
    brieven hoofdrekenen ateliers week-meewerken-boerderij huis-passen pelgrimsroute nachttrein stedentrip-zonder-plan willekeurig-station
    wandelroute-cartograferen thematrip-plannen reisdagboek-bijhouden fietsvakantie`),
  // food and drink with a grown-up point
  ...ids(`vis-roken wijngaard-oogst`),
  // writing, composing, editing and other solo craft that asks for patience and a long attention span
  ...ids(`roman-schrijven column-schrijven tweede-taal-schrijven brieven-aan-jezelf levensverhaal scenario-schrijven songteksten vertalen
    blog-nieuwsbrief-schrijven fanfictie-schrijven reisverhaal-schrijven haiku-schrijven gedichten-schrijven muziektheorie-leren beiaard-leren orgel-leren
    fanfare-orkest operazang elektronische-muziek-produceren muziek-componeren muziek-opnemen videomontage-leren fotobewerking digitale-kunst
    documentaireportret-maken veldopnames-maken levend-model-tekenen kantklossen sashiko-herstellen tuften indigo-verven parfum-maken zichtbaar-herstellen
    stoel-bekleden quilten spinnen hoeden-maken patroontekenen kostuumontwerp modeillustratie upcycle-kleding sieraad-ontwerpen analoge-fotografie
    straatfotografie portretfotografie macrofotografie timelapse-fotografie sterren-fotograferen vlog-maken`),
  // style and beauty for adults
  ...ids(`stijladvies make-up-workshop personal-shopping capsule-garderobe nagelstyling gezichtsbehandeling parfum-ontdekken modemuseum fotoshoot moodboard cosmetica-maken`),
  // history and research
  ...ids(`genealogie archief handschriften archief-indexeren mondelinge-geschiedenis mini-onderzoek-doen latijn-grieks-lezen kunstgeschiedenis-cursus heraldiek
    oude-kaarten begraafplaats verzetsroute regency-bal middeleeuws-banket opgraving industrieel-erfgoed`),
  // technology as a hobby
  ...ids(`data-visualisatie wikipedia-bijdragen open-source kortegolf-luisteren dxen radioamateur retrocomputing ai-creatie website-bouwen energie-besparen
    leren-programmeren game-ontwikkelen synthesizer-bouwen restaureren klokken`),
  // games for older players
  ...ids(`wargaming tabletop-rpg larp solo-rpg murder-mystery pubquiz simracen bordspel-ontwerpen mahjong go rummikub-kaartclub darten-pool`),
  // stage and talk
  ...ids(`stand-up poetry-slam debatclub podcast-maken lokale-radio opera-bezoek filmclub regie-amateurstuk stomme-film bandje-beginnen commedia`),
  // mystery that is dark, technical or on private ground
  ...ids(`lockpicking cryptografie cold-case forensisch paranormaal spookwandeling bunkertocht onder-de-stad escape-room-ontwerpen detectiveverhaal kasteel-overnachting`),
  // collecting for adults
  ...ids(`veiling vulpennen koffie-thee vinyl zendamateur antieke-poppen brocante-antiek vintage-kleding`),
  // movement and speed that needs more than a young child can do or that has an age minimum
  ...ids(`bergtoppen-afvinken wandeltocht-lang langlaufen slackline-park quad-buggy karten buikdans golfles cricket-beginners draakbootvaren sloeproeien
    fpv-drone helikoptervlucht vliegsimulator rib-boot paardenrennen trekkertrek`),
  // nature work and hobbies with sharp tools or a long wait
  ...ids(`natuurbeheer fruitbomen-snoeien vijver-aanleggen tuin-ontwerpen dierenasiel hondensport natuurfotografie dierenfotografie trektocht`),
]);

/**
 * True when an activity does not suit a family with young children. Beyond the list: heavy exertion (intensity 3) and anything that needs
 * qualified supervision are out, and so is every adult-only world (YOUNG_KIDS_ONLY).
 */
export function unsuitableForYoungKids(a: Facets): boolean {
  if (a.intensity === 3 || a.safety.tier === 2) return true;
  const only = YOUNG_KIDS_ONLY[a.domain];
  if (only && !only.has(a.id)) return true;
  if (YOUNG_KIDS_UNSUITABLE.has(a.id)) return true;
  return false;
}

// --- people who use a wheelchair ----------------------------------------------------------------------------------------------

// Tags that always mean climbing, heights, caves or deep water: no step-free way in.
const WHEELCHAIR_CONFLICT_TAGS: readonly string[] = ["height", "depths"];

/** Activities that, as the library describes them, cannot be done from a wheelchair: rough terrain, running, skating, climbing, boarding a boat. */
export const WHEELCHAIR_UNSUITABLE: ReadonlySet<string> = new Set(
  ids(`wandeltocht-lang trektocht bergtoppen-afvinken hardlopen nordic-walking skaten rolschaatsen schaatsen langlaufen sneeuwschoenen slackline-park
    touwtjespringen modderlopen bushcraft boomhut-nacht tarp-nacht dauwtrappen strandjutten plogging bunkertocht urbex-tour houthakken droge-stenen-muur
    metaaldetectie natuurbeheer mountainbiken wildwaterraften kajak-wildwater suppen snorkelen klipper-zeilen draakbootvaren sloeproeien boomklimmen
    kano-uithollen quad-buggy`),
);

/** True when an activity has a known conflict with being in a wheelchair. Everything else stays in and is checked for step-free access. */
export function unsuitableForWheelchair(a: Facets): boolean {
  if (a.tags.some((t) => WHEELCHAIR_CONFLICT_TAGS.includes(t))) return true;
  return WHEELCHAIR_UNSUITABLE.has(a.id);
}

// --- a calm pace --------------------------------------------------------------------------------------------------------------

/**
 * True when an activity is not calm: more than light movement, anything that needs qualified supervision, or advanced. Facets only,
 * no list, so a new activity is judged by what it says about itself.
 */
export function unsuitableForCalmPace(a: Facets): boolean {
  return (a.intensity !== null && a.intensity > 1) || a.safety.tier === 2 || a.level === 2;
}

// --- no alcohol ---------------------------------------------------------------------------------------------------------------

/** Activities that are about drinking alcohol: a brewing day, a wine tasting, a cocktail class, a bar night. Out when the person says "no alcohol". */
export const ALCOHOL_CENTRAL: ReadonlySet<string> = new Set(ids(`bier-brouwen wijnproeverij cocktailworkshop kruidenlikeur luisterbar netwerkborrel casinoavond`));

/**
 * Activities where a drink is a side issue (a pub quiz, a jam session in a café). They stay in, flagged "alcohol" so the writer plans around
 * it; this list only exists so a test can keep the two apart and the report can name them.
 */
export const ALCOHOL_SIDE: ReadonlySet<string> = new Set(ids(`pubquiz jamsessie folk-sessie pingpongbar pokeravond bingo-avond sjoelen streetfoodtour`));

export function unsuitableWithoutAlcohol(a: Pick<Activity, "id">): boolean {
  return ALCOHOL_CENTRAL.has(a.id);
}

// --- few stimuli (quiet and predictable) ---------------------------------------------------------------------------------------

/** Loud, crowded or unpredictable: discos and festivals, open stages, motor and arcade noise, contact team sport, drum circles. */
export const LOUD_OR_CROWDED: ReadonlySet<string> = new Set(
  ids(`karaoke silent-disco rolschaatsdisco klein-festival lichtfestival nachtmarkt dj-workshop live-comedy variete pingpongbar jamsessie folk-sessie platenclub
    swingdansen bingo-avond stand-up poetry-slam open-podium beatboxen rappen festival-vrijwilliger straatfeest drumcirkel djembe-trommelcirkel fanfare-orkest
    drummen-leren trekkertrek zeepkistenrace karten quad-buggy lasergamen bowlen vr-arcade flipperkast pubquiz darten-pool larp paintball-airsoft teamsport
    rugby-proeftraining handbal-vereniging waterpolo onderwaterhockey ijshockey boksles streetfoodtour modeshow musical-bezoek wielerwedstrijd-kijken
    paardenrennen circusles bollywood pokeravond casinoavond schermen hema driftles circuitdag enduro-offroad jetski
    netwerkborrel vriendschapsdaten murder-mystery`),
);

/**
 * True when an activity does not fit "quiet and predictable": on the loud list, heavy exertion, needs supervision, or only ever done in a
 * big group.
 */
export function unsuitableForQuiet(a: Facets): boolean {
  if (LOUD_OR_CROWDED.has(a.id)) return true;
  if (a.intensity === 3 || a.safety.tier === 2) return true;
  return !!a.formats && a.formats.length > 0 && a.formats.every((f) => f === "large_group");
}

// --- meeting people and the way of taking part -------------------------------------------------------------------------------

const MEETING_FORMS = ["drop_in_alone", "small_group", "large_group"] as const;
const MEETING_WORLDS: ReadonlySet<string> = new Set(["together", "night", "society"]);

/** True when a known set of forms offers no way to meet other people: alone, as a pair, or only with people you already know. */
export function unsuitableForMeeting(a: Pick<Activity, "formats">): boolean {
  return !!a.formats && a.formats.length > 0 && !a.formats.some((f) => (MEETING_FORMS as readonly string[]).includes(f));
}

/**
 * How much an activity helps to meet people, as a nudge for the selection (positive = less likely): come alone and meet others is best,
 * the worlds built around being together count extra, a group you must bring yourself counts least.
 */
export function meetingBias(a: Pick<Activity, "domain" | "formats">): number {
  const f = a.formats ?? [];
  let bias = f.includes("drop_in_alone") ? -0.35 : f.includes("large_group") ? -0.1 : 0.2;
  if (MEETING_WORLDS.has(a.domain)) bias -= 0.2;
  return bias;
}

// --- no hunting or fishing, no animals ----------------------------------------------------------------------------------------------------

/** Hunting and fishing: taking part in killing or catching animals. Out when the visitor chooses "Zonder jagen of vissen". Crab and shrimp catching counts as fishing. */
export const HUNT_OR_FISH: ReadonlySet<string> = new Set(
  ids(`jachtkennismaking jachthoorn-blazen jachthonden-demo vissen karpervissen vliegvissen zeevissen visvijver krabben-vangen`),
);

export function unsuitableWithoutHuntFish(a: Pick<Activity, "id">): boolean {
  return HUNT_OR_FISH.has(a.id);
}

/** Anything with animals in it (tag "animals"), plus fishing, which carries no animal tag. Out when the visitor chooses "Zonder dieren" (afraid, allergic or against it). */
export function unsuitableWithoutAnimals(a: Pick<Activity, "id"> & { tags: readonly string[] }): boolean {
  return a.tags.includes("animals") || HUNT_OR_FISH.has(a.id);
}

// --- what the browser needs to know -------------------------------------------------------------------------------------------

/** The needs an activity is known not to suit, computed on the server so the browser needs no safety or intensity data (concretePool.ts). */
export type UnfitFlag = "young_kids" | "wheelchair" | "calm" | "alcohol" | "quiet" | "no_meet" | "no_duo" | "no_group" | "dutch" | "hunt_fish" | "animals";

export function unfitFlags(a: Facets): UnfitFlag[] {
  const f = a.formats;
  const known = !!f && f.length > 0;
  return [
    ...(unsuitableForYoungKids(a) ? (["young_kids"] as const) : []),
    ...(unsuitableForWheelchair(a) ? (["wheelchair"] as const) : []),
    ...(unsuitableForCalmPace(a) ? (["calm"] as const) : []),
    ...(unsuitableWithoutAlcohol(a) ? (["alcohol"] as const) : []),
    ...(unsuitableForQuiet(a) ? (["quiet"] as const) : []),
    ...(unsuitableForMeeting(a) ? (["no_meet"] as const) : []),
    ...(unsuitableWithoutDutch(a) ? (["dutch"] as const) : []),
    ...(unsuitableWithoutHuntFish(a) ? (["hunt_fish"] as const) : []),
    ...(unsuitableWithoutAnimals(a) ? (["animals"] as const) : []),
    ...(known && !f!.includes("duo") ? (["no_duo"] as const) : []),
    ...(known && !f!.some((x) => x === "small_group" || x === "large_group") ? (["no_group"] as const) : []),
  ];
}

// --- no Dutch needed ------------------------------------------------------------------------------------------------------------

/**
 * Activities whose medium is the Dutch language: a stand-up or poetry night, a debate club, a talking course, volunteering with Dutch paperwork or
 * neighbours, Dutch archives, a guided walk in Dutch. Out when somebody does not speak Dutch (chip "Zonder Nederlands"). Doing the same thing in English
 * exists, but is not what the library describes, so the book only offers it where the language does not matter.
 */
export const DUTCH_BOUND: ReadonlySet<string> = new Set(
  ids(`stand-up poetry-slam storytelling verteluur debatclub amateurtoneel hoorspel voorlezen podcast-maken lokale-radio schrijfcirkel leesclub book-club-stil kletscafe
    toost-speech-houden presenteren toastmasters leiderschapsworkshop coachgesprek assertiviteit socratisch-gesprek filosofie volksuniversiteit mediation-leren
    feedback-geven onderhandelen-oefenen pitch-geven vergadering-leiden luistercursus mentor-zoeken geheugentechnieken ondernemersidee-uitwerken eerste-klant-vinden
    plannen-workshop live-comedy gids-wandeling mondelinge-geschiedenis genealogie archief archief-indexeren handschriften legendes sagen
    voedselbank buurtvrijwilliger buurtproject ouderenbezoek bestuurslid-vereniging inzamelingsactie-organiseren vrijwilligers-coordineren erfgoed-vrijwilliger
    huiswerkbegeleiding bibliotheek-vrijwilliger mentor-jongere festival-vrijwilliger`),
);

/** Welcoming to newcomers and mostly language-free: a language café, a shared dinner, board games, a repair evening. Favoured for somebody without Dutch. */
export const INTERNATIONAL_FRIENDLY: ReadonlySet<string> = new Set(
  ids(`taalcafe taalmaatje nieuwkomers buurtmaaltijd potluck onbekenden-diner bordspellen kaartspellen schaken escape-room spelavond-thuis repair-cafe proefles-avond
    wandelgroep dansen swingdansen drumcirkel jamsessie koor`),
);
/** Worlds where the language of the host rarely matters: moving, cooking, nature, making, adventure. */
const LANGUAGE_FREE_WORLDS: ReadonlySet<string> = new Set(["movement", "food", "nature", "adventure", "speed", "elements", "target", "restful", "creative"]);

export function unsuitableWithoutDutch(a: Pick<Activity, "id">): boolean {
  return DUTCH_BOUND.has(a.id);
}

/** A nudge for the selection (positive = less likely) when Dutch is not spoken: favours what welcomes newcomers and what needs no language. */
export function internationalBias(a: Pick<Activity, "id" | "domain">): number {
  if (INTERNATIONAL_FRIENDLY.has(a.id)) return -0.35;
  return LANGUAGE_FREE_WORLDS.has(a.domain) ? -0.15 : 0.1;
}
