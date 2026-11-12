// Activities that are the same kind of thing in different worlds: three dances (a swing night, a historical dance, ballroom), four walks, three
// ways to look at the stars. They sit in different sub-domains, so the one-per-sub-domain rule does not see them, and a book with three of one
// kind feels like one idea said three times. The engine allows at most MAX_PER_CLUSTER of a cluster in one book (engine/select.ts).
// A short, explicit, human-checked list on purpose (the library has no "kind" field): add an id when a new activity belongs. A test checks that
// every id exists and that no activity is in two clusters.

const ids = (s: string): string[] => s.split(/\s+/).filter(Boolean);

export const MAX_PER_CLUSTER = 2;

export const CLUSTERS: Readonly<Record<string, readonly string[]>> = {
  dance: ids(`swingdansen dansen hist-dans ballroom bollywood flamenco paaldansen buikdans ballet-beginners dansperformance-meedoen regency-bal rolschaatsdisco silent-disco`),
  walking: ids(`wandelen gids-wandeling nachtwandeling spookwandeling detective-wandeling audiowandeling fotowandeling wandelgroep wandelmaatje wandeltocht-lang trektocht
    wandelmeditatie dauwtrappen oude-kaart-wandeling verzetsroute pelgrimsroute wandelroute-cartograferen geocaching orientatieloop plogging nordic-walking bosbaden
    kastelenroute stadswandeling hofjes`),
  stars: ids(`telescoop sterrenkijken sterren-fotograferen`),
  archives: ids(`genealogie archief archief-indexeren handschriften mondelinge-geschiedenis oude-kaarten mini-onderzoek-doen heraldiek legendes sagen`),
  writing: ids(`schrijven roman-schrijven gedichten-schrijven haiku-schrijven blog-nieuwsbrief-schrijven fanfictie-schrijven reisverhaal-schrijven kinderverhaal-schrijven
    column-schrijven tweede-taal-schrijven scenario-schrijven songteksten brieven-aan-jezelf levensverhaal journaling cafe-schrijven schrijfcirkel`),
  drawing: ids(`schilderen tekenen aquarelleren pastel-tekenen pen-inkt-tekenen portret-tekenen plein-air-schilderen gouache-schilderen kleurpotlood-tekenen botanisch-tekenen
    levend-model-tekenen mandala-tekenen sketchnotes-maken handlettering kalligrafie schilder-avond modeillustratie`),
  woodwork: ids(`houtbewerking houtsnijden houtdraaien figuurzagen meubel-bouwen houtinleg-marqueterie zwaluwstaart-kist houten-speelgoed-maken houten-klok-bouwen keukenplank-maken
    pallet-meubels steigerhout-meubel vlonder-bouwen tuinmeubels-maken schaakbord-maken ukelele-bouwen boomhut-bouwen`),
  music: ids(`instrument zangles drummen-leren mondharmonica-leren handpan-spelen orgel-leren beiaard-leren koor operazang muziek-maken muziektheorie-leren muziek-componeren`),
  photography: ids(`fotografie analoge-fotografie macrofotografie portretfotografie straatfotografie timelapse-fotografie natuurfotografie dierenfotografie cyanotypie fotobewerking`),
  fibre: ids(`breien-haken borduren-weven naaien quilten spinnen macrame kantklossen tuften naaldvilten sashiko-herstellen bandweven`),
  tabletop: ids(`bordspellen kaartspellen schaken go mahjong dammen rummikub-kaartclub backgammon bridge wargaming tabletop-rpg solo-rpg murder-mystery bordspel-ontwerpen`),
  escape: ids(`escape-room escape-doos escape-room-ontwerpen puzzeljacht speurtocht-kaart detectivebox cold-case`),
  radio: ids(`zendamateur radioamateur kortegolf-luisteren dxen`),
  reptile_pets: ids(`reptielen aquarium duiven-houden mieren-houden insecten-tellen`),
};

const CLUSTER_OF: ReadonlyMap<string, string> = new Map(Object.entries(CLUSTERS).flatMap(([name, list]) => list.map((id) => [id, name] as const)));

/** The cluster an activity belongs to, or undefined when it is on its own. */
export function clusterOf(id: string): string | undefined {
  return CLUSTER_OF.get(id);
}
