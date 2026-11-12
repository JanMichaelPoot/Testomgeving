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
