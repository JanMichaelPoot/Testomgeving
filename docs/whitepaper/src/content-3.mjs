import { h1, h2, h3, p, ul, ol, laagA, laagB, fig, tab, code, note, facts, pb, steps } from "./dsl.mjs";

// ====================================================================================================================
// Chapter 7: the algorithm
// ====================================================================================================================
export const ch7 = h1("ch7", "Het algoritme en de beslislogica", { blocks: [
  laagA("De motor werkt als een zorgvuldige reisadviseur met een regelboek. Eerst schrapt hij alles wat niet mag. Dan zoekt hij wat bij je smaak past. Daarna vult hij zeven plekken, één voor één, en kijkt elke keer of het geheel gevarieerd blijft. Een taalmodel doet daar niets van: dat schrijft later alleen de tekst."),
  note("feit", "**Er bestaat geen enkele score voor 'hoe goed past dit idee'.** De motor rekent per richting (vertrouwd, aangrenzend, onverwacht, uitdaging, wildcard) met een eigen formule uit dezelfde bouwstenen: verbindingsgewicht, nabijheid, zeldzaamheid, leeftijdsweging, aanbod en overlap met wat al gekozen is. De getallen 0 tot 100 die bij een idee worden opgeslagen (`scores`) zijn vaste waarden per richting, bijgesteld met enkele eigenschappen van de activiteit. Het zijn indicaties voor een volgorde, geen metingen (bevinding F-23)."),

  h3("Waar elke stap draait en wat hij kost"),
  p("Het algoritme loopt van invoer tot boek in tien stappen. Zeven daarvan zijn gewone code zonder netwerk en zonder kosten, stap 9 is een HTTP-controle van websites zonder model, en twee stappen (8 en 10) zijn aanroepen van een taalmodel."),
  tab("stappen", "De tien stappen: waar ze draaien en of ze geld kosten", ["Stap", "Waar", "Kosten", "AI"], [
    ["1 Inputverwerking", "Browser en server (`saveIntake`)", "Geen", "Nee"],
    ["2 Contextbepaling", "Server", "Geen", "Nee"],
    ["3 Associatieselectie", "Browser (`sampleBalancedBatch`)", "Geen", "Nee"],
    ["4 Koppeling aan activiteiten", "Browser (pagina 2) en server (`applyImageIntake`)", "Geen", "Nee"],
    ["5 Filtering", "Server, selectiemotor", "Geen", "Nee"],
    ["6 Scoring en weging", "Server, selectiemotor", "Geen", "Nee"],
    ["7 Rangschikking en selectie", "Server, selectiemotor", "Geen", "Nee"],
    ["8 Externe zoekopdrachten", "Server naar Anthropic: Haiku 4.5 met webzoeken", "$ 0,04 tot $ 0,28 per boek (vier meetboeken)", "Ja"],
    ["9 Verwerking van zoekresultaten", "Server, plus een HTTP-controle van de websites", "Geen aanroep van een model", "Nee"],
    ["10 Eindselectie en presentatie", "Server naar Anthropic: Sonnet 5 (twee aanroepen), daarna pdf-lib en Resend", "± $ 0,09 tot $ 0,11 per boek", "Ja"],
  ], { widths: [28, 38, 26, 8], small: true }),
  fig("algo", "Het algoritme in tien stappen. Stap 1 tot 4 gebeuren in de browser en bij het opslaan, 5 tot 7 in de motor zonder AI, 8 tot 10 zijn zoeken en schrijven.", { landscape: true }),

  h2("7.1  Inputverwerking"),
  steps([
    ["Invoer", "Het concept in de browser (`IntakeAnswers`), met de gekozen kaart-id's, activiteit-id's, schuifwaarden en antwoorden van de startpagina."],
    ["Logica", "`saveIntake` en `persistIntake` (`src/app/intake/actions.ts`): onbekende id's worden weggefilterd (`sanitizeDiscoveryAnswers`, `sanitizeAssociations`: hoogstens 5 per ronde, hoogstens 3 correcties), het land wordt genormaliseerd, de afstand moet een echte stap zijn, het budget valt terug op de laagste band als een oud concept 'gratis' stuurt."],
    ["Voorwaarden", "Alleen de plaats is verplicht. Een verbinding die zijn testboeken heeft opgebruikt, wordt geweigerd (`checkTestQuota`)."],
    ["Beslissingen", "De server vertrouwt de browser niet. Wijzigen vóór betaling vervangt de antwoorden in dezelfde sessie (`replaceIntake`); na betaling of tijdens het maken start opnieuw versturen een nieuwe sessie, zodat niemand zijn invoer kwijtraakt."],
    ["Uitvoer", "Een rij in `intake_answers` (`raw_json`) en een httpOnly-cookie voor de sessie (7 dagen)."],
    ["Volgende stap", "Contextbepaling (7.2) en, tegelijk, de vertaling van beelden naar de motorinput (7.4)."],
  ]),

  h2("7.2  Contextbepaling"),
  steps([
    ["Invoer", "`StoredIntake`: zoekcontext, leeftijd, plaats, afstand, budget, tijd, sociale vormen, chips en tekst."],
    ["Logica", "`normalizeSearchContext`, `effectiveAgeCategory` (een zelf opgegeven leeftijd wint; alleen 'kind' geeft een zachte standaard `under18`), `resolveConstraints` (kostenklasse, intensiteitsgrens, toezicht verbergen, vormen, binnen of buiten, chips, maand) en `buildAudienceProfile`."],
    ["Voorwaarden", "De maand is die van Nederland op het moment van maken. Zonder maand wordt niet op seizoen gefilterd (oudere aanroepen en tests)."],
    ["Beslissingen", "Een onbekend feit sluit nooit uit. Een expliciete keuze van een sociale vorm wél; 'maakt niet uit' en 'hangt van de dag af' leggen niets op."],
    ["Uitvoer", "`EngineInput`, `ResolvedConstraints` en een `AudienceProfile` met herkomst en zekerheid per dimensie."],
    ["Volgende stap", "De motor (7.5)."],
  ]),

  h2("7.3  Associatieselectie"),
  steps([
    ["Invoer", "516 kaarten, de seed van de bezoeker, de zoekcontext, eerder geziene kaarten en eerder gekozen kaarten."],
    ["Logica", "`sampleBalancedBatch` (`src/lib/discovery/twoPages.ts`, `associationSampling.ts`): per familie één variant, vier registers elk ≥ 4, elke as tweezijdig, elke ronde vertegenwoordigd, vloeren voor de sierlijke wereld en voor vier nichesmaken, een lichte contextvoorkeur op elk tweede beeld."],
    ["Voorwaarden", "3 tot 8 gekozen beelden; hoogstens 3 vernieuwingen; hoogstens 5 per ronde tellen mee."],
    ["Beslissingen", "Bij een vernieuwing wisselen 'dichtbij wat je koos' en 'nog niet gekozen' elkaar af. Een eerste set verspringt niet als de context later verandert."],
    ["Uitvoer", "Een lijst gekozen kaart-id's; het tag-profiel (som van de tagwaarden) en vier gemiddelde assen."],
    ["Volgende stap", "Koppeling aan activiteiten (7.4)."],
  ]),

  h2("7.4  Koppeling aan activiteiten"),
  steps([
    ["Invoer", "Tag-profiel, assen, de pool van 756 activiteiten (in het seizoen), de context en de eigen keuzes van de bezoeker."],
    ["Logica", "Pagina 2: `composeConcretePage` (formule in hoofdstuk 5). Bij het opslaan: `applyImageIntake` en `associationsToEngineInput`. Op de tweepaginaroute zijn de gekozen activiteiten de `interests`; de werelden zijn die van die activiteiten; `practicalToWild` en `effort` komen uit de assen."],
    ["Voorwaarden", "Kies de bezoeker 'verras me' (of niets), dan zijn er geen `interests` en draait de motor in verkenmodus: de beelden sturen dan alleen de twee dials."],
    ["Beslissingen", "Een gekozen activiteit met verplicht toezicht blijft staan als het 'praktisch'-dial alleen uit de beelden komt (`explicitPicks`); elke andere harde grens blijft gelden."],
    ["Uitvoer", "`interests` (de ankers), `interestDomains`, `practicalToWild`, `effort`, en per activiteit het beeld dat erachter ligt."],
    ["Volgende stap", "Filtering (7.5)."],
  ]),
  laagB("Laag B: het oudere pad (vierrondesintake)", [
    p("Bij de oudere route, zonder eigen activiteitkeuzes, leidt `associationsToEngineInput` zes activiteiten af, één per wereld en nooit twee uit één subdomein, uit de gewogen overeenkomst met het tag-profiel:"),
    code("score(a) = tagScore(a)/max + 0,35·[wereld gekozen] + 0,3·aspassing(a) + 0,3·zeldzaamheid(a)·(0,4 + 1,2·u) + 0,5·u' − aanbod(a) − leeftijd(a) − doelgroep(a)\ntagScore(a) = Σ profiel[t] × (0,5 als generiek) × idf(t) / √(aantal tags);  idf(t) = clamp(0,4; 1,6; 1 + 0,35·ln(0,15 / aandeel van t))", "text"),
  ]),

  h2("7.5  Filtering"),
  steps([
    ["Invoer", "Alle niet-vervallen activiteiten en de `ResolvedConstraints`."],
    ["Logica", "`passesConstraints` (`src/lib/discovery/engine/constraints.ts`), in deze volgorde: seizoen, kind-lijst, jonge kinderen, rolstoel, rustig tempo, zonder alcohol, rustig en voorspelbaar, mensen ontmoeten, zonder Nederlands, jagen en dieren, kosten, intensiteit, toezicht, binnen of buiten, sociale vormen. Daarna: eerder getoond (laatste twee sessies) en uitgesloten activiteiten."],
    ["Voorwaarden", "Alleen een *bekend* conflict sluit uit. Een onbekend facet (`null`) laat door en wordt een `verify`-vlag. Met `strictFreeCost` komt een onbekende prijs niet langs een gratis budget."],
    ["Beslissingen", "Een activiteit die buiten het seizoen valt, verdwijnt ook als de bezoeker hem koos. Tijd en afstand zijn bewust geen filter."],
    ["Uitvoer", "De pool, met per activiteit zijn controlevlaggen. Is de pool kleiner dan 12, dan krijgt het rapport de notitie `pool_small`."],
    ["Volgende stap", "Scoren (7.6)."],
  ]),

  h2("7.6  Scoring en weging"),
  p("De bouwstenen zijn hieronder samengevat. Alle getallen die de selectie sturen staan in één bestand (`engine/weights.ts`). De standaardinstelling in productie is `WEIGHTS_ANCHOR`: het ankermodel, de B4-rangschikking en de hub-demping samen."),
  laagB("Laag B: de bouwstenen en de formule per richting", [
    code("weight(t)     = ln(N / gebruik(t)),  N = 756, alleen niet-generieke tags\nbridge(a,b)   = Σ weight(t) over gedeelde niet-generieke tags            (echt vanaf 2,0)\nsim(a,b)      = 0,6 · Σ_gemeen w / Σ_unie w  + 0,25·[zelfde wereld] + 0,15·[zelfde subdomein]\nrarity(a)     = gemiddeld tagweight, uitgerekt over de bibliotheek tot 0..1\nhubness(a)    = aantal echte buren, uitgerekt van de mediaan (0) tot het maximum (1)\nrel(a)        = max over de ankers r van sim(a, r)\nleeftijd(a)   = agePenalty + audienceBias + meetingBias + internationalBias + 0,6·hubness(a)   (hub niet voor eigen keuzes)\naanbod(a)     = 0,18 (rare) | 0,04 (regional) | 0\nredundantie(a)= Σ_gekozen u bridge(a,u)·0,05 + 0,45 × #gekozen u met ≥ 2 gedeelde tags\nzeldzaam(a)   = rarity(a) · (0,4 + 1,2·u(a, seed))", "text"),
    tab("formules", "De score per richting (productiewaarden, `WEIGHTS_ANCHOR`)", ["Richting", "Score (hoger is beter; u is seeded toeval tussen 0 en 1)"], [
      ["Anker (eigen keuze)", "0,3·u − 0,35·(ankers uit dezelfde wereld) − 0,2·[subdomein al gebruikt] − redundantie"],
      ["Vertrouwd (zonder ankers)", "Gekozen: 2 + 0,3·u − 0,35·spreiding (+ 0,3·praktisch bij het tweede slot). Buur in een gekozen wereld met rel ≥ 0,4: rel − leeftijd + 0,12·zeldzaam − aanbod + 0,3·u"],
      ["Onverwacht (a) combinatie", "2,5 + 0,15·bridge(keuze, partner) + 0,3·u − redundantie − leeftijd + 0,25·zeldzaam − aanbod"],
      ["Onverwacht (b) keten", "min(sim(keuze, tussenstap), sim(tussenstap, ver)) + 0,15·u − redundantie − leeftijd + 0,25·zeldzaam − aanbod. Eis: beide bruggen ≥ 2,0, wereld niet gekozen, rel < 0,3"],
      ["Onverwacht (c) één stap", "0,1·beste brug + 0,15·u − redundantie − leeftijd + 0,25·zeldzaam − aanbod. Eis: brug ≥ 2,0, rel < 0,3"],
      ["Onverwacht (d) iets verre", "u − leeftijd + 0,25·zeldzaam − aanbod, uit een wereld die niet gekozen is"],
      ["Aangrenzend", "rel·(1 − |rel − 0,38|) + 0,15·[wereld niet gekozen] + 0,15·u − redundantie − leeftijd + 0,2·zeldzaam − aanbod. Banden: rel 0,2 tot 0,6 met brug ≥ 2,0; dan rel 0,1 tot 0,75 met brug ≥ 1,2"],
      ["Aangrenzend: 'indirecte plek'", "0,5·delers + 0,4·sterke delers + 0,25·[subdomein nieuw] + 0,15·[wereld nieuw] + 0,15·u − redundantie_buiten_ankers − leeftijd + 0,2·zeldzaam − aanbod. Eis: ≥ 2 delers (deelt een tag met een anker), ≥ 1 sterke deler (≥ 2 tags)"],
      ["Uitdaging", "2 − |omvang − doel| + 0,15·brug(a, p0) + 0,2·u − redundantie − leeftijd + 0,15·zeldzaam − aanbod. Omvang = [binnen/buiten omgedraaid] + intensiteitswinst + 0,5·niveauwinst + 0,5·[langer] + 0,7·[nieuwe vorm] + 0,5·[andere wereld]. Doel = 1 | 1,2 | 2 | 2,8 voor het wildheidsdial"],
      ["Wildcard (gewogen loting)", "(1 + 2·beste brug + 2·[wereld niet in je geschiedenis]) / (1 + 4·redundantie) · e^(−2·leeftijd) · (0,5 + 1,5·zeldzaam) · e^(−3·aanbod)"],
    ], { widths: [26, 74] }),
    p("`agePenalty` voor 65-plus is `0,5` bij intensiteit 3 of `0,15` bij 2, `+0,4` bij verplicht toezicht en `+0,2` bij niveau 2. Voor 'onder 18' is het `+0,5` bij toezicht en `+0,2` bij kosten boven € 50, `−0,1` voor alleen-erbij of grote groep. Alles is zacht: het schuift een score, het sluit niets uit."),
  ]),
  steps([
    ["Invoer", "De pool, de graaf (`buildGraph`, gecached per bibliotheek), de gewichten en de seed (`mulberry32(hashSeed(sessie-id))`)."],
    ["Logica", "De formules hierboven. Het toeval is *seeded*: dezelfde sessie geeft dezelfde keuze."],
    ["Voorwaarden", "Bruggen tellen pas vanaf 2,0 mee als 'echt'; sfeertags tellen nooit."],
    ["Beslissingen", "Een hoge score koopt nooit een harde grens terug: de harde regels zijn geen gewicht."],
    ["Uitvoer", "Per kandidaat een score; per gekozen zaad ook `fit` (gemeten relevantie 0 tot 1; 1 voor een eigen keuze) en `reasons[]`."],
    ["Volgende stap", "Rangschikken en kiezen (7.7)."],
  ]),

  h2("7.7  Rangschikking en selectie"),
  steps([
    ["Invoer", "Kandidaten met scores per slot en de diversiteitsregels."],
    ["Logica", "`selectSeeds` vult de slots in een vaste volgorde (figuur 7.2). Per slot geldt: de beste kandidaat die door `canUse` komt. `firstFit` probeert meerdere kandidaatsets (beste eerst) en geeft een diversiteitsregel pas op als geen set past."],
    ["Voorwaarden", "Hoogstens 2 per wereld (op de valreep 3), 1 per subdomein, hoogstens 2 van dezelfde soort (cluster). Een idee dat al een eerdere keuze nabootst (≥ 2 gedeelde tags) krijgt een straf van 0,45."],
    ["Beslissingen", "Zonder keuzes: zes ideeën uit zes werelden, mildste eerst, deuren naar `challenge`. Met minstens drie bruikbare eigen keuzes: het ankermodel. Anders: twee vertrouwd, één onverwacht, twee aangrenzend, één uitdaging."],
    ["Uitvoer", "Zeven `Seed`-objecten, eerst de zes gewone op deur, dan de wildcard, elk met `door`, `level`, `chain`, `via`, `fit` en `reasons`."],
    ["Volgende stap", "Het zoeken (7.8)."],
  ]),
  fig("slots", "Beslisboom van de selectiemotor. Het ankermodel (rechts) is de standaard sinds 31 oktober 2026."),

  h2("7.8  Externe zoekopdrachten"),
  steps([
    ["Invoer", "De zeven seeds, plaats, afstand, taal, controlevlaggen (avond, vervoer, toegankelijkheid, kinderen, rustig, geen alcohol, mensen ontmoeten, geen Nederlands) en de datum van vandaag."],
    ["Logica", "`researchSeeds` (`src/lib/claude/localResearch.ts`): eerst de cache (per activiteit, plaats, afstand, maand en wensen), daarna één gegroepeerde aanroep van Claude Haiku 4.5 met de webzoektool. Eigen keuzes krijgen een eigen, ruimere aanroep. De zoektermen per activiteit komen uit `searchHints`."],
    ["Voorwaarden", "Alleen fysieke plekken. Een dateerbare activiteit moet binnen vier weken plaatsvinden of in dit seizoen lopen. De hele zoektocht stopt met nieuwe rondes na 120 seconden (`RESEARCH_BUDGET_MS`)."],
    ["Beslissingen", "Wat de standaardronde niet vindt, krijgt een brede ronde over de dubbele afstand; daarna 'online' alleen voor activiteiten die van nature online zijn; dan een vervangend idee (hoofdstuk 8)."],
    ["Uitvoer", "`LocalOption[]` per activiteit: naam, plaats, link, korte notitie, einddatum en eventueel een beoordeling die een zoekresultaat echt liet zien."],
    ["Volgende stap", "Resultaten verwerken (7.9)."],
  ]),

  h2("7.9  Verwerking van zoekresultaten"),
  steps([
    ["Invoer", "De ruwe JSON-antwoorden van het model."],
    ["Logica", "`parseResearchAnswer`, `cleanOptions`, `isPhysicalOption`, `verifyOptionUrls` (de website wordt gelezen: bestaat de host, zegt de pagina 'gesloten' of is het een geparkeerd domein, staat de naam erop), `rankOptions` (beoordeling, gecorrigeerd naar 4,0 met gewicht 20 reviews), `dedupePlaces` (één plek, één idee)."],
    ["Voorwaarden", "Een time-out, 403 of 429 telt niet als bewijs van het tegendeel. Een mislukte zoekronde telt niet als 'geen aanbod'."],
    ["Beslissingen", "Een idee dat een aanbieder nodig heeft en geen optie vond, wordt vervangen (twee rondes; de laatste alleen activiteiten die geen aanbieder nodig hebben). Een eigen keuze wordt vervangen door een verwant idee uit de graaf, en het boek zegt dat in één zin. Als alles faalt, wordt geruild met een idee dat eerder in dezelfde run wél een optie vond."],
    ["Uitvoer", "Per idee één tot drie geverifieerde opties, of een vervanger. Notities in het rapport: `broadened_search`, `widened_radius`, `replaced_no_local_offer`, `replaced_pick`, `swapped_no_option`, `no_option`."],
    ["Volgende stap", "Schrijven en presenteren (7.10)."],
  ]),

  h2("7.10  Eindselectie en presentatie"),
  steps([
    ["Invoer", "De zeven seeds met hun opties, het profiel, de datum en de schrijfregels."],
    ["Logica", "Twee aanroepen van Claude Sonnet 5 tegelijk: de ideeën (zes plus wildcard; maximaal 9.000 tokens; één herhaling bij een onleesbaar antwoord) en de lagen (sfeerbeschrijving, drie maten, volgende stap; 6.000 tokens; zonder herhaling, optioneel). `checkEntry` haalt een locatie weg die niet in het onderzoek stond en meldt websites die nergens in het onderzoek voorkomen. Daarna de kwaliteitspoort (`runQualityGate`): zichtbare 'machinerie', herhaalde zinnen, seizoensfouten, tegenstrijdige chips en dekking van tijd en budget."],
    ["Voorwaarden", "Het model mag ideeën niet wisselen, toevoegen of hernoemen, geen bedrijfsnaam, adres, prijs of website noemen die niet in de opties van dat idee staat, en alle tekst is in één taal."],
    ["Beslissingen", "Een herschrijving mag feiten weglaten maar nooit toevoegen (`addsNoFacts`). Alles faalt zacht: het boek wordt altijd afgeleverd, desnoods zonder lagen of via de klassieke pijplijn."],
    ["Uitvoer", "`GeneratedIdeaBook`, de PDF (`pdf-lib`, ± 16 pagina's), een rij in `window_plans`, een bijlage in de e-mail en de pagina `/plan`."],
    ["Volgende stap", "Het boek wordt getoond; de rest is hoofdstuk 3 (stap 7 en 8)."],
  ]),
  fig("dataflow", "Datastroomdiagram: welke objecten door de applicatie gaan, van invoer tot boek, en welke bewerking ze verbindt.", { landscape: true }),

  h2("Een voorbeeldberekening"),
  p("De berekening hieronder is van de 'indirecte plek' van fictief profiel A (hoofdstuk 11). De kandidaten en hun bibliotheekwaarden zijn echt; het profiel is fictief. De motor voegt aan elke score tot 0,15 toeval toe, dat hier is weggelaten, en de uitkomst is daarom indicatief."),
  tab("rekenvoorbeeld", "Het slot 'aangrenzend, indirect' voor profiel A (echte bibliotheekwaarden, zonder toeval)", ["Kandidaat", "Delers", "Sterk", "Basis", "Zeldzaam", "Leeftijd + hub", "Aanbod", "Overlap met high tea", "Totaal", "Uitkomst"], [
    ["Kruidenlikeur of bitter maken", "3", "1", "2,15", "+0,05", "−0,06", "−0,04", "−0,14", "1,95", "**Valt af:** de wereld *Eten* heeft al twee ideeën (sushi, high tea)"],
    ["Wandeling over een oude begraafplaats", "3", "1", "1,90", "+0,04", "−0,13", "0", "−0,10", "1,71", "**Gekozen**"],
    ["Een stoel opnieuw bekleden", "2", "1", "1,80", "+0,04", "0", "−0,04", "−0,15", "1,65", "Tweede keus"],
    ["Een eigen sieraad ontwerpen", "2", "1", "1,80", "+0,01", "−0,09", "−0,04", "−0,10", "1,58", "Derde keus"],
  ], { widths: [26, 6, 6, 7, 8, 9, 7, 10, 7, 14], small: true }),
  p("Wat de tabel laat zien: de hoogste ruwe score wint niet altijd. *Kruidenlikeur* scoort het hoogst, maar de diversiteitsregel (hoogstens twee ideeën per wereld) laat het niet toe. Dat is precies waarom de selectie 'het beste dat past' kiest en niet 'het beste'. *Basis* is `0,5·delers + 0,4·sterke delers + 0,25·[subdomein nieuw] + 0,15·[wereld nieuw]`; het verschil met begraafplaats komt van het nieuwe subdomein (+0,25)."),
  p("Een tweede, volledig **fictieve** berekening toont de band van de aangrenzende richting. Stel dat een kandidaat X een aansluiting van 0,50 heeft, uit een andere wereld komt, regionaal aanbod heeft en 0,11 overlap met al gekozen ideeën; kandidaat Y heeft aansluiting 0,30, zit in dezelfde wereld, heeft 0,15 leeftijdsstraf en 0,05 overlap; kandidaat Z heeft aansluiting 0,80."),
  tab("fictief", "Fictieve invoer voor de aangrenzende formule", ["", "X", "Y", "Z"], [
    ["Aansluiting rel", "0,50", "0,30", "0,80"],
    ["rel · (1 − |rel − 0,38|)", "0,44", "0,28", "0,46"],
    ["Wereld niet gekozen", "+0,15", "0", "n.v.t."],
    ["Toeval", "+0,07", "+0,12", "n.v.t."],
    ["− overlap, − leeftijd, + zeldzaam, − aanbod", "−0,11, 0, +0,06, −0,04", "−0,05, −0,15, +0,02, 0", "n.v.t."],
    ["**Totaal**", "**0,57**", "**0,22**", "valt buiten de band (rel ≥ 0,75): geen aangrenzend maar een vertrouwde buur"],
  ], { widths: [38, 20, 20, 22] }),
  note("let-op", "Deze tweede tabel is een rekenvoorbeeld met verzonnen getallen, bedoeld om de formule te tonen. Ze komt niet uit een echte run."),

  h2("Samenvatting van de beslislogica"),
  ul([
    "Wat mag, wordt door harde regels bepaald, op een bekend conflict. Dit is nooit een gewicht.",
    "Wat past, volgt uit een graaf van zeldzaamheidsgewogen bruggen. Dit is het enige 'smaakmodel', zonder AI en zonder gebruikersdata.",
    "Wat gekozen wordt, volgt uit een vaste volgorde van slots met een eigen formule, een diversiteitscontrole en seeded toeval.",
    "Wat bestaat, wordt buiten de motor bepaald door het zoeken, en een idee zonder bestaande optie komt niet in het boek.",
  ]),
] });
