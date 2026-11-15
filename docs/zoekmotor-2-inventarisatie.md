# Search Engine 2.0: technische inventarisatie (15 november 2026)

Opdracht van Jan: de fase na het genereren van de ideeën (ideeën omzetten naar concrete activiteiten, aanbieders en vindplaatsen) herontwerpen, met per venster vijf concrete opties en aantoonbaar lagere kosten. Eerst inventariseren, dan gecontroleerd bouwen. **In deze inventarisatie is geen code gewijzigd en geen betaalde aanroep gedaan.** Alles hieronder is gelezen in de code van `site-optimalisatie` (stand na Stap 199) en in het kostenrapport van 14 november (`docs/kostenonderzoek-boekgeneratie.md`); waar iets niet gemeten is, staat dat erbij.

Zekerheid: **[B]** gelezen in de code of gemeten, **[O]** onderbouwde raming, **[H]** hypothese.

---

## 1. Wat er nu is (alle aanroepen van een boek)

| # | Stap | Model / dienst | Waar | Per boek |
|---|---|---|---|---|
| 1 | Ideeën kiezen | geen AI: de selectiemotor (`discovery/engine/`, ±700 activiteiten) | `select.ts` | gratis [B] |
| 2a | Onderzoek, standaardronde (alle ideeën zonder eigen keuze in één aanroep) | Haiku 4.5 + `web_search_20250305`, 2-5 zoekopdrachten | `localResearch.ts` `searchOnce` | $0,059-0,082 [B] |
| 2b | Onderzoek, eigen keuzes (parallel aan 2a, ruimer, 3-4 zoekopdrachten) | idem | idem | $0,106-0,137 [B] |
| 2c | Brede ronde voor wat niets vond (clubs, buurthuizen, bibliotheken...), 3-4 zoekopdrachten | idem | idem | $0,059-0,125 [B] |
| 2d | Online ronde (laatste redmiddel), ≤4 zoekopdrachten | idem | `searchOnlineOnce` | $0,043 [B] |
| 2e | Vervangrondes en de plekkenrondes van Stap 197 (opnieuw selecteren, dan 2a/2c voor de nieuwe ideeën) | idem | `generateFromSeeds.ts` | $0,04-0,60 [B] |
| 3 | Website controleren | geen AI: eigen HTTP-controle (bestaat, geen parkeerpagina, naam staat op de site) | `verifyUrls.ts` | gratis [B] |
| 4 | Google-score per plek | Google Places API (New), Text Search Enterprise, max. 8 per boek | `placesRatings.ts` | gratis tot 900/maand, daarna $0,035 [B] |
| 5 | Schrijven, ideeën + lagen (twee parallelle aanroepen) | Sonnet 5 | `generateFromSeeds.ts` | $0,043 + $0,055 voor zeven ideeën [B]; voor vijf ideeën nog niet gemeten |
| 6 | Kwaliteitspoort | lokale regels; Haiku-grammatica; Sonnet alleen bij fouten | `qualityRepair.ts` | ±$0,005 [O] |
| 7 | Opwarmstap tijdens het betalen (stap 2 vooraf, ook voor afbrekers) | Haiku + zoektool | `prewarmResearch.ts` | $0,07-0,17 per betaald boek [O] |
| 8 | Klassieke terugval bij een fout | Sonnet + 4 zoekopdrachten | `generateIdeaBook.ts` | niet gemeten |

Buiten het boek: de lezing op het profielscherm (Sonnet, `intake/interpret.ts`, ±$0,005).

**Prompts** [B]: een vaste systeemprompt voor het onderzoek (`SYSTEM`, "echt, nu open, nooit verzinnen, leeg is een goed antwoord") en per ronde een prompt die `buildResearchPrompt` bouwt (standaard, eigen keuzes met extra ruimte, breed, praktische wensen, land) of `buildOnlinePrompt`; de schrijfprompts (`SYSTEM_PROMPT`, `LAYERS_SYSTEM_PROMPT`) lezen wat het onderzoek vond. De afhankelijkheid is strikt sequentieel: elke ronde bepaalt wat de volgende nodig heeft; de selectie kiest ideeën zonder te weten of er aanbod is, tenzij de aanbodindex van Stap 195 het al weet.

**Zoeken** [B]: er is **één** zoekprovider, de zoektool van Anthropic die binnen een modelaanroep draait ($0,01 per zoekopdracht plus de teruggelezen resultaten als inputtokens: 35-55k tokens per ronde). Het model bedenkt zelf de zoektermen (met per activiteit de termen uit `searchHints.generated.json`), voert ze uit, leest de resultaten en levert JSON. Er is geen andere zoek-API, geen Google Search, geen Bing.

**Locatie** [B]: de tekstuele plaatsnaam en straal staan in de prompt en in `user_location` van de zoektool; er is **geen** geocoding in de zoekfase. Geocoding bestaat alleen voor de plaatsuggesties in de intake (PDOK en Photon, gratis, `api/location-suggest`). Google Maps/Places wordt uitsluitend gebruikt voor het opzoeken van de score van een gevonden plek (stap 4 hierboven).

**Controle op bestaan** [B]: `verifyUrls.ts` (gratis): de site moet antwoorden, mag geen parkeerpagina of "gesloten" zijn en de naam moet op de pagina staan; opties met een verlopen datum vallen af; `optionRelevance.ts` (Stap 196) weigert opties die niet over hun activiteit gaan.

**Cache** [B]: antwoord per (activiteit, plaats, straal, versie), 30 dagen voor gevonden opties, 14 voor leeg, met hergebruik over stralen heen en een aanbodindex voor activiteiten waarvoor deze plaats al twee keer niets gaf.

**Kosten en grenzen** [B]: `costLedger.ts` telt elke aanroep van een boek; de optionele rondes stoppen bij $0,40, de plekkenrondes bij de harde grens van $0,50 (Stap 198); de kosten van elk boek worden sinds Stap 195 bewaard in `progress_meta.cost` en staan op `/admin`. **Er zijn nog geen echte productieboeken gemeten sinds die teller bestaat**; alle cijfers hierboven komen uit de metingen van Stap 191 en uit teruggespeelde cijfers.

## 2. Wat de opdracht vraagt, naast wat de code kan

| Onderdeel van de opdracht | Stand van de code | Haalbaarheid binnen bestaande infrastructuur |
|---|---|---|
| Alle ideeën gezamenlijk verwerken, één opdracht | **Bestaat al**: één onderzoeksaanroep voor alle ideeën van een boek (gegroepeerd), een tweede alleen voor eigen keuzes | Ja |
| Search Planner (AI clustert, bepaalt zoekcombinaties) | Het zoekmodel plant zijn zoektermen nu zelf binnen de zoekaanroep; een aparte planner is een extra aanroep, geen besparing, tenzij de planning de zoekaanroep aantoonbaar goedkoper of beter maakt | Ja, als meting [H] |
| Gebundelde websearch met batch en parallelle verwerking | De zoektool van Anthropic heeft **geen batch-aanroep** en draait alleen binnen een modelbeurt. De bundeling zit al in het groeperen van alle ideeën in één beurt | Beperkt |
| Resultaten door gewone code normaliseren, ontdubbelen, voorselecteren | **Niet mogelijk met de bestaande provider**: de zoekresultaten komen in het antwoord alleen als `url`, `title` en `page_age` terug; de tekst is versleuteld en alleen het model kan hem lezen. Code kan dus alleen werken op wat het model teruggeeft (naam, stad, url, notitie) en op de pagina's die `verifyUrls` zelf ophaalt | Alleen op modeluitvoer |
| Final Selector: één aanroep kiest per venster de beste vijf | Kan zonder zoektool, op de kandidaten die het onderzoek teruggaf. De huidige code houdt maximaal 3 opties per idee over (`MAX_OPTIONS`) en vraagt het model om "up to 4" | Ja |
| Fallback alleen voor vensters met te weinig kandidaten | **Bestaat al** (Stap 197: vervangrondes en brede ronde per idee) | Ja, bijstellen |
| Geen Google Maps, geen geocoding | Voor het zoeken waar; **wel** in gebruik voor de Google-score van een plek (Stap 192, Jans wens van 14 november: de getoonde opties moeten de hoog beoordeelde zijn) | Keuze nodig |
| Kosten en kwaliteit per generatie registreren | Deels: modelkosten per soort, Places-opzoekingen, onderzoekstellers, notities (`BookCostMeta`) | Ja, aanvullen |

## 3. Wat dit betekent voor het ontwerp

1. **Een echte "zoekmotor" in de zin van de opdracht (planner, door code uitgevoerde zoekopdrachten, resultaten in code filteren, selector) vraagt een ruwe zoek-API.** Dat is een nieuwe betaalde dienst met een eigen sleutel (bijvoorbeeld Brave Search, Serper of Tavily; een account aanmaken en een sleutel plaatsen doe ik niet zelf). Het kostenrapport schatte zo'n pijplijn op $0,10-0,15 per boek tegen nu ±$0,19 voor alleen de eerste ronde en $0,36 gemiddeld [H]. De meerwaarde is dus niet bewezen; het moet in een gemeten proef blijken, op dezelfde invoer als nu.
2. **Binnen de bestaande dienst** zijn drie dingen wel te doen: (a) een goedkope Final Selector zonder zoektool die uit een ruimere kandidatenlijst per idee de beste vijf kiest op relevantie, doelgroep, uitvoerbaarheid, betrouwbaarheid en onderlinge verschillen; (b) het onderzoek vragen om meer kandidaten per idee (nu 3-4) en die in code ontdubbelen, filteren en ordenen; (c) de registratie per generatie uitbreiden met kandidaten, controles, fallbackrondes, opties per idee en kosten per gepresenteerde optie.
3. **Vijf opties per venster is een productwijziging** met gevolgen voor kosten, PDF-opmaak en haalbaarheid: er zijn nu hoogstens 3 plekken per idee en in de onderzoekscache heeft 60% van de standaardantwoorden geen enkele optie [B, steekproef 605 rijen]. Vijf per idee is in een kleine plaats voor veel ideeën niet te vinden; de opdracht zegt zelf "forceer niet".
4. **Wat de kosten bepaalt** [B]: 78-88% van de kosten van een vers boek is webonderzoek, en daarvan is de helft de zoekopdracht zelf ($0,01 per stuk) en ruim een derde de teruggelezen resultaten. Meer opties per idee levert meer lezen op, niet minder, tenzij het aantal zoekopdrachten of rondes daalt.

## 4. Besluiten van Jan (15 november 2026)

1. **"Vijf opties per venster" = de vijf ideeën van het boek** (Stap 198). Het aantal plekken per idee blijft zoals het is (maximaal 3).
2. **We blijven op de bestaande zoekdienst** (de zoektool van Anthropic); geen ruwe zoek-API, geen nieuwe betaalde dienst.
3. **De Google-score (Places API) blijft** voor de getoonde plekken; Google wordt niet gebruikt om te zoeken.

## 5. Wat er gebouwd is (Stap 200), achter de schakelaar `WINDOW_SEARCH_V2`

De schakelaar staat **uit** tot de gemeten vergelijking (zie 7) laat zien dat het goedkoper is bij gelijke kwaliteit.

| Onderdeel van de opdracht | Wat er is gedaan |
|---|---|
| Gezamenlijke Search Planner | In gewone code (`searchPlan.ts`): het boek van vijf ideeën plus een **reserve** (`WINDOW_SEARCH_RESERVE` extra selecties van de motor, standaard 2, elk met een idee per richting) gaan samen in één gegroepeerde onderzoeksaanroep (plus de aanroep voor eigen keuzes). Het zoekmodel combineert zelf de zoektermen; het aantal zoekopdrachten schaalt mee (max. 7 in plaats van 5). Geen aparte AI-planner, zie 6 |
| Gebundelde websearch | De bestaande gegroepeerde aanroepen, nu over een grotere groep; dubbele zoekopdrachten voorkomt de cache; parallel (eigen keuzes en rest naast elkaar) bestond al |
| Resultaatverwerking in code | Bestaand en ongewijzigd: normaliseren, relevantie, websitecontrole, ontdubbelen (één plek, één idee, ook via combinaties, Stap 199) |
| Final Selector | In gewone code (`fillFromReserve`): een idee zonder echte plek wordt vervangen door het reserve-idee **van dezelfde richting** dat wel een plek heeft, mits het boek gevarieerd blijft (geen herhaling of combinatie naast zijn eigen keuze, hoogstens twee ideeën uit één wereld, geen plek die al bij een ander idee staat); eigen keuzes gaan eerst naar een andere eigen keuze; bij meerdere kandidaten wint de best beoordeelde. Zie 6 |
| Gerichte fallback | Wat na de wissel nog zonder plek is, gaat naar de rondes die al bestaan (breed, online, plekkenrondes van Stap 197): alleen voor dat idee, op wat eerder is gevonden. De hele-selectie-herhalingen van Stap 88 vervallen met deze zoekmotor |
| Kosten- en kwaliteitsregistratie | `progress_meta.cost` bewaart nu per aanroep model, tokens, zoekopdrachten en kosten; totaal zoekopdrachten en zoekkosten; en per boek `search`: zoekmotor, onderzochte activiteiten (en met plek), reserve onderzocht en gebruikt, extra rondes, gecontroleerde websites, opties per idee en kosten per getoonde optie. Op `/admin` en op de orderpagina zichtbaar |
| Vergelijking oud en nieuw | `scripts/compare-search.ts` (echt geld, kostenpoort, koude cache voor beide) en de gratis simulatie in `generateFromSeeds.search2.test.ts` (zie 7) |

Foutisolatie: een mislukte reserve-selectie of -onderzoek laat het boek zoals het was; een mislukte aanroep voor één groep activiteiten (`source: "none"`) laat de andere groep ongemoeid (bestond al).

## 6. Bewust anders dan de opdracht

- **Geen AI-planner en geen AI-selector.** De planning zit al in het zoekmodel (het bepaalt zelf zijn zoektermen met de zoektermen per activiteit), dus een planner is een extra aanroep voor een stap die al gebeurt; en de keuze tussen gecontroleerde kandidaten rust op feiten die de code heeft (een echte, gecontroleerde plek, de beoordeling, de diversiteitsregels van de motor). Een model zou daar kosten toevoegen, geen informatie. Beide zijn later in te bouwen en met `compare-search.ts` te testen; ze staan niet in de eerste versie omdat de opdracht zelf zegt: "gebruik AI alleen waar semantisch inzicht daadwerkelijk noodzakelijk is".
- **Geen batch-aanroep van de zoekprovider** (die bestaat niet voor de zoektool van Anthropic); de bundeling is het groeperen van alle activiteiten in één modelbeurt, zoals al het geval was.
- **Resultaten voorselecteren in code kan alleen op wat het model teruggeeft** (zie 2): de zoekresultaten zelf zijn voor code versleuteld.

## 7. Oude en nieuwe architectuur naast elkaar

Alles hieronder in dit hoofdstuk is een **simulatie [O]**, geen meting: dezelfde gesimuleerde wereld voor beide zoekmotoren, 40 boeken (`generateFromSeeds.search2.test.ts`, "the two searches on the same simulated supply"). Aannames, uit de metingen van 14 november: een activiteit heeft met 40% kans een echte plek bij een gewone ronde (60% van de antwoorden in de cache was leeg), een brede ronde vindt er een voor 1 op 10; een ronde leest 7k tokens per zoekopdracht terug (brede 10k), een zoekopdracht kost $0,01; de kans op een plek daalt evenredig als een aanroep minder dan 0,7 zoekopdracht per activiteit krijgt; de kostengrenzen van Stap 193 en 198 gelden in beide ($0,40 optioneel, $0,50 totaal). Alleen onderzoek, zonder Google-score en zonder schrijven.

| | Oud | Nieuw, reserve 1 | **Nieuw, reserve 2 (standaard)** | Nieuw, reserve 3 |
|---|---|---|---|---|
| Betaalde onderzoeksrondes per boek | 5,9 | 4,2 | **3,5** | 3,7 |
| Onderzoekskosten per boek | $0,371 | $0,364 | **$0,329** | $0,343 |
| Boeken waarin elk idee een echte plek heeft | 12 van 40 (30%) | 35 (88%) | **38 (95%)** | 37 (93%) |

De uitkomst is vooral een **kwaliteitswinst binnen dezelfde kostengrens** (het oude systeem komt in dit model vaak niet aan alle ideeën toe voordat de grens bereikt is) en een bescheiden besparing (−11% onderzoekskosten, −41% rondes). Dat is een model; wat het echte web doet, moet de meting laten zien.

| Wat | Oud | Nieuw |
|---|---|---|
| AI-aanroepen onderzoek (eerste ronde) | 2 (eigen keuzes, rest) | 2, over een grotere groep |
| Aanroepen daarna | één ronde per vervanging, per idee | alleen voor wat na de wissel nog leeg is |
| Zoekopdrachten eerste ronde | max. 5 + max. 4 | max. 7 + max. 4 |
| Planner en selector | geen (de motor kiest, het model plant) | geen AI; plan en wissel in code |
| Websitecontrole, Google-score, schrijven, PDF | ongewijzigd | ongewijzigd |

## 8. Wat nog gemeten moet worden (betaald, wacht op een bedrag van Jan)

`npx tsx scripts/compare-search.ts --dry-run P12 P13` (gratis) toont wat er zou draaien. Een echte vergelijking draait elke persona tweemaal (oud en nieuw, beide met koude cache, zonder supply-index en zonder Google-score) en schrijft `scratch/compare-search/summary.md` met kosten, aanroepen, zoekopdrachten, extra rondes, gecontroleerde websites, opties per idee, kosten per optie en de gevonden plekken, zodat relevantie en diversiteit naast de kosten gelezen kunnen worden. Richtbedrag: ≈ $0,35 per run in het slechtste geval; twee persona's = vier runs ≈ $1,40 (de poort stopt vóór het budget).
