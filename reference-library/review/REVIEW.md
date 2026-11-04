# Review van de referentiebibliotheek, ronde 1

Datum: 2026-11-05. Omvang: alle 550 activiteiten, 127 associaties, 8.883 koppelingen.
De volledige lijst bevindingen staat in `findings.json` (en in het Excel-tabblad *Review*).

## Hoe er is beoordeeld

Eerst een geautomatiseerde audit van alle records (trefwoordregels, gelijkenis van koppelingen, scorestatistiek,
taalpariteit). Daarna zijn de sterkste activiteiten van elke associatie en elk gemarkeerd record met de hand gelezen,
vanuit vier rollen:

| Rol | Kijkt naar |
|---|---|
| Ambachtsmeester | materialen, technieken, klopt een vaardigheids- of esthetiekkoppeling met het echte werk |
| Sport- en avontuurcoach met veiligheidsachtergrond | veiligheidsklasse, binnen/buiten, fysieke associaties, eerlijk over risico en inspanning |
| Cultuurhistoricus en docent | feitelijke beweringen in de ontdekkingsredenen, zijn de bruggen zinvol, culturele balans |
| Taxonoom en UX-onderzoeker | overlap en gaten in de woordenlijst, scoredisipline, bijna-dubbelen, consistentie, taalpariteit |

**Eerlijke beperking:** dit is één AI die vier rollen speelt, geen beoordeling door vier mensen. Feiten zijn getoetst aan
mijn kennis, niet aan bronnen. Alle records blijven op status *Concept*; *Reviewed* is gereserveerd voor een mens.

## Wat is aangepast

**Woordenlijst: 112 naar 127 associaties.** Vijftien nieuwe, elk met definitie in NL en EN en koppelingen:
muziek (47 activiteiten), taal en schrift (38), spellen en spelregels (33), voertuigen en vervoer (28), ambacht en vakwerk (48),
online en digitaal (29), café en uitgaan (26), museum, theater en bibliotheek (21), leren en groeien (33), snelheid (30),
luisteren en inleven (34), conditie en kracht (43), coördinatie en balans (46), kans en geluk (18), miniatuur en schaal (21).
Reden: een derde van de bibliotheek ging over muziek, taal of spel zonder dat daar een thema voor was, sport werd alleen via
"beweging" beschreven, en ambacht (het hart van de bibliotheek) had geen eigen thema.

**Afbakening.** 29 associaties die makkelijk door elkaar lopen hebben nu een korte *scope*-notitie (wat het niet is, welke buur
je dan gebruikt): rust/stilte/welzijn, zorg/welzijn, gemeenschap/gezelligheid, ontdekking/verwondering, geschiedenis/tradities/nostalgie,
precisie/detail, kunst/schoonheid, trots/meesterschap en meer. Staat in het tabblad *Associations*.

**Scoredisipline.** `trots` stond op 43% van de activiteiten en `concentratie` op 43%, waardoor ze weinig onderscheiden.
170 zwakke generieke koppelingen zijn weggehaald; `trots` zit nu op 18%, `concentratie` op 37%. 22 generieke score-5-koppelingen
bij ambachten zijn naar 4 gezet.

**Feiten.** Twaalf absolute beweringen ("het oudste", "als eerste", "opgelost") zijn gecontroleerd. Eén was fout:
"computers hebben dammen opgelost" geldt alleen voor het Engelse 8x8-spel, niet voor 10x10-dammen. Elf redenen zijn in
beide talen voorzichtiger geformuleerd. Twee zwakke ontdekkingsredenen (vlog-maken/humor, lezing-workshop-geven/zorg) zijn herschreven.

**Veiligheid.** Twee echte gevallen gevonden door te lezen: `vijver-aanleggen` (graven naast open water) en `cyanotypie`
(fotochemicaliën) zijn naar veiligheidsklasse 1 gegaan. De 37 trefwoordhits in klasse 0 waren verder vals alarm.

**Consistentie.** Tegenstrijdige sterke koppelingen op drie records onderzocht; `sashiko-herstellen` gerepareerd
(minimalisme naar 3), de andere twee zijn terecht (luisteren in stilte, een stille nacht met nachtgeluiden).

**Bijna-dubbelen.** Negen paren met 90% of meer gelijke koppelingen, na de andere wijzigingen nog vijf (zwemmen/zwemmen-baantjes,
padel/badminton, vechtsport/boksles, tuinmeubels-maken/vlonder-bouwen, buurtmaaltijd/potluck). Elk staat als opmerking op beide records.

**Per record:** `qa` (ronde 1, *aangepast* of *gecontroleerd*) en waar nodig `qa_notes` (ingeschatte kenmerken, overlap, bewuste gaten).
Zichtbaar in *Activities*.

## Wat klopt en is dus niet veranderd

- Alle materiaalkoppelingen met score 4-5 (hout, papier, textiel, verf, metaal, steen, leer, klei, glas): geen foute gevonden.
- Elf records met een afwijkende binnen/buiten-combinatie (zwembad, windtunnel, pizzaoven): terecht.
- Taalpariteit: geen onvertaalde omschrijving of reden; de 19 gelijke namen zijn leenwoorden (yoga, sudoku, go).

## Wat nog openstaat

1. **Mens-beoordeling.** Scores en redenen zijn nog steeds het oordeel van één beoordelaar. Een steekproef door een mens, en
   een bronnencontrole van de genoemde feiten (Anna Atkins 1843, eerste ballonvaarten 1783, UNESCO-lijsten, Zumba), is nodig voor je ze aan bezoekers toont.
2. **Culturele balans.** Voorbeelden en bruggen leunen Nederlands/westers. Een volgende batch met niet-westerse ambachten, muziek en spellen helpt.
3. **Ontdekkingsbruggen.** Ze leunen nog op wetenschap (128 van 1.100), geschiedenis (89), verhalen (80), tradities (69); samen 27%, onder de alarmgrens
   van 30%. De eerste batches kunnen naar de smallere nieuwe associaties worden omgezet.
4. **Dekking van de app.** Circa 160 van de 578 app-activiteiten staan nog niet in de referentiebibliotheek.
5. **Was en zeep** als materiaal ontbreekt (kaarsen-gieten, zeep-maken); pas toevoegen als er meer van die ambachten komen.

## Advies voor de app (niet doorgevoerd)

Dertien voorgestelde extra tags voor `vocabulary.json`: strength, coordination, speed, listening, digital, mobility, music,
tradition, spirituality, seafaring, weather, humour, fairness (met reden in `findings.json` en tabblad *App_Vocabulaire_Advies*).
**Niet toegepast**: nieuwe tags veranderen de relatiegraaf, de scores van de motor en de opgeslagen basislijnen; dat is een
eigen besluit met eigen metingen. Verder aanbevolen voor de app zelf: `zwemmen` en `zwemmen-baantjes` samenvoegen, en
veiligheidsklasse heroverwegen voor `synthesizer-bouwen` (solderen) en `nachtdieren` (in het donker).


## Aanvulling: mens-steekproef (Jan, 30 activiteiten)

Jan beoordeelde 30 willekeurige activiteiten (minstens een per categorie, 10 nieuw voor de app, 3 met toezicht). Uitslag:

| Onderdeel | Uitslag |
|---|---|
| Sterkste associaties | 3 van 180 aangemerkt als niet passend (1,7%) |
| Ontdekkingsbruggen | 50 zinvol, 9 zwak, 1 onzin van 60 (83% zinvol) |
| Kenmerken (plek, duur, niveau, kosten, veiligheid) | 5 van 30 activiteiten kloppen niet (17%) |

**Wat dit zegt:** de associaties zelf zijn betrouwbaar. De bruggen en de kenmerken zijn de zwakke laag. Bij 60 bruggen is 17% zwak grofweg 8-28%; extrapoleer dus voorzichtig (circa 190 zwakke bruggen van 1.100 is een schatting, geen telling).

**Wat er is aangepast:** de drie niet-passende associaties zijn verwijderd (Trots bij Jam en inmaken, Weer bij Tuinmeubels en een pergola, Wereldculturen bij Gebarentaal). Alle tien zwakke of onzinnige bruggen zijn vervangen: de nieuwe zijn inhoudelijk of juist breder (Wetenschap, Weer en seizoenen, Voertuigen, Film en beeldtaal, Muziek, Geschiedenis, Spiritualiteit, Wiskunde en patronen). De vijf kenmerken zijn gecorrigeerd en op bron *authored* gezet; drie ervan komen uit de app (IJsbaden: plek, Een tas ontwerpen: niveau, Legpuzzels: duur) en zijn daar niet aangepast. Elk aangepast record heeft ronde 2 en een opmerking.

**Wat de zwakke bruggen gemeen hadden:** de verbinding is een bijkomstigheid van de activiteit (de stilte na een klifduik, de geur van fotochemie, "elke bibliotheek heeft ook technologie") in plaats van een richting waarin iemand verder zou zoeken. Voor een volgende brugronde is dat het criterium.

**Gevonden gat in de woordenlijst:** er is geen associatie voor technische vaardigheid of constructie ("techniek"), terwijl de app wel een tag *technique* heeft. Kandidaat voor een volgende ronde.

**Volgende stap:** een tweede steekproef met alleen bruggen (50 stuks, over 50 verschillende associaties gespreid) in `bruggen-ronde-2.html`, gemaakt met `scripts/reference-library/make-bridge-sheet.py`. Dat geeft een schatting per soort brug en laat zien welke soorten systematisch moeten worden herzien.


## Aanvulling 2: bruggen-steekproef (Jan, 50 bruggen)

| | Zinvol | Zwak | Onzin |
|---|---|---|---|
| Steekproef 2 (50 bruggen, over 50 associaties gespreid) | 26 | 15 | 9 |
| Steekproef 1 en 2 samen (110 bruggen) | 76 (69%) | | 34 (31%) |

**Wat dit betekent:** steekproef 1 liet 83% zinvol zien, steekproef 2 52%. Dat verschil komt doordat de eerste vooral veelgebruikte associaties raakte en de tweede de hele lijst. Het echte aandeel zinvolle bruggen in de bibliotheek ligt waarschijnlijk dichter bij de helft dan bij 83%; een precieze schatting kan ik niet geven. Van de 1.100 bruggen zijn 110 door een mens beoordeeld. De rest is ongecontroleerd.

**Wat de zwakke bruggen gemeen hebben:** een brede, abstracte associatie aan een activiteit gehangen met een reden die voor bijna elke activiteit te schrijven is (spiritualiteit bij baantjes zwemmen, rechtvaardigheid bij een naaicafé, wiskunde bij tennis, generaties bij verhalen vertellen). De goede bruggen noemen een **concrete vervolgstap**: een andere activiteit, plek of vaardigheid waar je daarna naartoe kunt (trailrunning na hardlopen, een club na een proefles, snorkelen na onderwaterhockey). Dat is het criterium voor een volgende ronde.

**Kan het automatisch?** Ik heb getest of zwakke bruggen te voorspellen zijn uit de koppelingen zelf (gelijkenis met buur-activiteiten, hoe vaak de associatie in dezelfde categorie voorkomt, gemeenschappelijke voorkomens, associatiedomein). Dat lukt niet (beste maat 0,65 op een schaal waar 0,5 toeval is). Alleen de lengte van de reden zegt iets: onder 45 tekens was 12 van 13 keer zwak. Een betrouwbare controle vraagt dus een mens.

**Aangepast:** de 24 zwakke of onzinnige bruggen zijn vervangen door bruggen met een concrete vervolgstap, plus 8 zeer korte redenen die niet beoordeeld waren maar hetzelfde patroon hadden. Elk aangepast record heeft een opmerking.

**Advies:** gebruik de bruggen nog niet om iets aan bezoekers aan te bevelen. Een volgende ronde herschrijft alle bruggen volgens het criterium hierboven, per association-groep, en laat daarna weer een steekproef beoordelen.


## Aanvulling 3: zelfbeoordeling van alle bruggen

Op Jans verzoek heb ik alle 984 bruggen die nog geen mens had gezien zelf gelezen en alleen de bruggen verwijderd die ik zelf zwak vond. Ik legde de lat hoger dan in de eerste ronde: een brug blijft alleen staan als de reden iets specifieks over **deze** activiteit zegt, geen metafoor ("een taart is architectuur") en geen algemeenheid die voor bijna elke activiteit te schrijven is.

- **205 van 984 (21%) verwijderd.** Meest verwijderd: verhalen 30, architectuur 23, volkscultuur en tradities 22, humor 20, wiskunde en patronen 14, kunst 12, wetenschap 9.
- **Minimum van twee naar één brug per activiteit.** 155 activiteiten hebben nu één brug, 395 twee. Een ontbrekende brug is beter dan een zwakke. 26 activiteiten die daarna nul bruggen hadden, kregen een of twee nieuwe met een concrete vervolgstap (een club, plek, vaardigheid of ambacht waar je daarna naartoe kunt). Het minimum staat in `validate.ts` (`MIN_DISCOVERY_LINKS`) en is terug te zetten.
- **Nu 945 bruggen** (was 1.100).

**Eerlijk over mijn eigen oordeel:** Jan keurde in steekproef 2 meer dan de helft van mijn bruggen niet goed, terwijl ik er hier maar 21% afkeur. Mijn oordeel is dus waarschijnlijk milder dan het zijne, en er staan nog zwakke bruggen tussen. Daarom volgt een controle: `bruggen-ronde-3.html` (62 bruggen, nog niet door Jan gezien). 50 zijn bruggen die ik heb laten staan (groep A), 12 zijn bruggen die ik zelf in eerdere rondes als vervanging schreef (groep B). Welke welke is, staat in `bruggen-ronde-3.key.json`, niet op het blad. Is het aandeel zinvol in groep A duidelijk hoger dan de 52% van steekproef 2, dan werkt het filteren; zo niet, dan is menselijk oordeel op elke brug nodig.


## Aanvulling 4: uitslag van de controle-steekproef (Jan, 62 bruggen)

| Groep | Zinvol | Zwak of onzin |
|---|---|---|
| A: bruggen die ik na mijn zelfbeoordeling liet staan (50) | 38 (76%) | 12 |
| B: bruggen die ik zelf eerder als vervanging schreef (12) | 10 (83%) | 2 |
| Ter vergelijking: steekproef 2, ongefilterd (50) | 26 (52%) | 24 |

**Conclusie:** mijn eigen filter werkt, maar niet genoeg. Door te schrappen wat ik zelf zwak vond steeg het aandeel zinvolle bruggen van ongeveer de helft naar ruim driekwart. Ongeveer een op de vier bruggen die ik laat staan is volgens Jan nog zwak. Bij 50 bruggen is de marge groot (grofweg 63-87%), en de 83% van groep B berust op 12 bruggen.

**Waar Jan strenger is dan ik:** hij keurt bruggen af die ik vanwege een concreet feit liet staan, zoals zen-boogschieten (spiritualiteit), judo (zorg voor anderen) en Nordic walking (volkscultuur). Er is geen associatie die systematisch slecht is (hoogste aandeel afgekeurd 38%, n=8), dus een eenvoudige regel ("nooit spiritualiteit") bestaat niet.

**Gedaan:** de 14 afgekeurde bruggen zijn verwijderd. Drie activiteiten kregen daardoor geen brug meer en kregen een nieuwe (voedselbank, capsulegarderobe, schrijven in een tweede taal); die drie zijn niet beoordeeld.

**Nu:** 934 bruggen, waarvan 172 een keer door Jan beoordeeld (124 zinvol, die blijven staan) en ongeveer 810 nog niet. Als de 76% ook voor die 810 geldt, zijn er nog ruim 190 zwak.

**Opties:** (1) de bruggen zo laten en ze alleen gebruiken met een kanttekening ("suggestie"); (2) nog een zelfbeoordelingsronde met de lat op Jans niveau (de bruggen die op een enkel feit of een zijpad leunen eruit); (3) Jan beoordeelt meer bruggen. Mijn voorkeur is (2) gevolgd door een kleine steekproef, omdat de eerste ronde 24 punten opleverde. Meer dan driekwart zinvol is waarschijnlijk wat een AI-zelfreview zonder mens kan halen.
