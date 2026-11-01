# Associatiemodule, bibliotheek en aanbevelingsengine: analyse en uitbreiding (Stap 127)

Dit is Fase 1 van de master prompt "Strategische uitbreiding associatiemodule, activiteitenbibliotheek en intelligente aanbevelingsengine", gemeten op de code van 1 november 2026. Alles hieronder is gemeten of uit de code gelezen. Waar iets een mening is, staat dat erbij.

## 1. Wat er al is (en blijft)

| Onderdeel uit de prompt | Wat er is | Waar |
|---|---|---|
| Keten associaties, interesses, voorkeuren, clusters, activiteiten, aanbevelingen | Beeldkaarten dragen tagwichten en vier assen. De tags zijn de interessetaal. Een activiteit heeft 2 tot 5 tags. De motor verbindt via een graaf met zeldzaamheid. | `associations.json`, `vocabulary.json`, `engine/graph.ts` |
| Many-to-many | Een beeld verwijst naar veel tags, een tag naar veel activiteiten, een activiteit is via veel beelden te bereiken. Gecureerde combinaties (`hybrids.json`, nu 80) koppelen twee werelden. | `associationProfile.ts`, `hybrids.json` |
| Vier typen associaties | Plekken, momenten en zintuigen (sferen en ervaringen) staan op pagina 1. Concrete activiteiten (bezigheden) staan op pagina 2. | twee-pagina-intake (Stap 117) |
| Gestandaardiseerde activiteitendata | id, domein, subgroep, naam nl en en, tags, sociale vormen, binnen of buiten, inspanning, niveau, kosten, duur, seizoen, veiligheid, aanbod, instap, aliassen, herkomst. | `types.ts` |
| Aanbevelingslogica met gewichten | Zeven ideeën. Tot vier eigen keuzes (anker), één aangrenzend, één onverwacht en een wildcard. Alle getallen staan in `engine/weights.ts`. | `engine/select.ts` |
| Dubbelen, synoniemen, algemeenheid | Naamnormalisatie, aliassen, een validator die dubbele namen en te algemene items afkeurt, en een register-balans. | `names.ts`, `validate.ts`, `register.ts` |
| Kosten | Selectie, filters en ontdubbelen zijn gewone code zonder AI. Onderzoek loopt met Haiku in één gegroepeerde aanroep, met cache per plaats en maand. | Stap 56, 107, 126 |
| Eén gebruikersroute | Twee beeldpagina's, situatie, profiel met betaling. Geen extra stappen toegevoegd door deze uitbreiding. | Stap 117 |

## 2. Wat de prompt vraagt en wat er echt ontbrak

De twintig domeinen uit de prompt zijn de inhoudelijke structuur, geen twintig schermen. De bibliotheek had 19 domeinen met een andere indeling. Dit is de afbeelding, op de bestaande 524 activiteiten:

| Domein in de prompt | Staat in | Oordeel |
|---|---|---|
| 1 Dieren | natuur, subgroep dieren (11) | **dun**: dierentuin, kinderboerderij, roofvogelshow, vlindertuin, reptielen, stoeterij, safaripark, dierenfotografie ontbraken |
| 2 Natuur en buitenleven | natuur (31), avontuur | goed |
| 3 Sport en beweging | beweging (53) | goed; **ontbrak**: badminton, squash, golfles, volleybal |
| 4 Spel, competitie, puzzels | spel (30), mikken, nacht | goed (pubquiz, schaken, boules, kubb, sjoelen, murder mystery bestonden al) |
| 5 Creativiteit en beeldende kunst | creatief (49), stijl | goed; digitale kunst ontbrak |
| 6 Literatuur, taal, schrijven | creatief, podium, samen | **dun**: poëzie, scenario, songteksten, vertalen, levensverhaal ontbraken |
| 7 Muziek, dans, podium | creatief, podium, beweging | goed; muziek opnemen ontbrak |
| 8 Sociale interactie | samen (24) | goed; netwerkborrel ontbrak |
| 9 Cultuur, geschiedenis, erfgoed | geschiedenis (27) | goed |
| 10 Wetenschap en ontdekking | techniek (28) | goed |
| 11 Ambacht en handvaardigheid | creatief, elementen | goed |
| 12 Koken en gastronomie | eten (24) | goed |
| 13 Wellness | ontspanning (28) | goed |
| 14 Avontuur en sensatie | avontuur (28) | goed |
| 15 Reizen en bijzondere ontdekkingen | verspreid (trein-dagtrip, slow-travel, boomhut-nacht, vuurtoren) | **ontbrak als domein**: roadtrip, nachttrein, camper, eilandhoppen, kastelenroute, themareis, fietsvakantie |
| 16 Technologie en digitale ervaringen | techniek, spel | dun in creatieve digitale kant: gameontwikkeling, AI-creatie, fotobewerking ontbraken |
| 17 Verzamelen en onderzoeken | verzamelen (30) | goed |
| 18 Maatschappelijke betrokkenheid | samen, natuur (9 los) | **ontbrak als domein**: mentor, voedselbank, erfgoed, ouderenbezoek, knotten, huiswerkbegeleiding |
| 19 Persoonlijke ontwikkeling | los (online-cursus, taal-leren) | **ontbrak als domein**: presenteren, Toastmasters, leiderschap, coaching, geheugentechnieken, EHBO |
| 20 Bijzondere en alternatieve ervaringen | geschiedenis, mysterie, podium | goed |

**Bijkomende bevinding.** De meeste voorbeelden uit de prompt stonden al onder een andere id. Een eerste telling op exacte id's gaf te veel gaten. Een telling op naam en tag gaf er 54.

## 3. De uitbreiding (gebouwd, nog onzichtbaar)

54 activiteiten en 3 nieuwe domeinen (reizen, helpen, groeien), 10 gecureerde combinaties, allemaal met nl en en, tags, sociale vormen, seizoen, instap, beeldbeschrijving en stijlregister. Ze staan op `image_pending`: de motor en de bezoeker zien ze pas als hun foto bestaat, zodat er geen kapotte kaart kan verschijnen en de selectie vandaag **bit voor bit gelijk** blijft (de baseline-test op de 20 vaste profielen slaagt ongewijzigd).

| Domein | Nieuw |
|---|---|
| Reizen, routes en bijzonder logeren (nieuw) | 10 |
| Maatschappelijk betrokken en helpen (nieuw) | 10 |
| Persoonlijke ontwikkeling en nieuwe vaardigheden (nieuw) | 10 |
| Dieren (in natuur) | 9 |
| Schrijven en muziek (in creatief) | 6 |
| Digitaal (creatief en techniek) | 4 |
| Racket- en teamsport (beweging) | 4 |
| Netwerken (samen) | 1 |

Kwaliteitsregels: geen nieuw item met toezichtsplicht boven niveau 1 (dus geen nieuwe juridische veiligheidsnotities), elk item heeft minstens één echte brugtag, geen mensen in de beeldbeschrijving, en `taxonomy:check` meldt 0 fouten en 0 waarschuwingen.

## 4. De engine gemeten tegen de prompt (gratis, `scripts/combo-test.ts`)

De zeven combinaties uit Fase 4 zijn doorgerekend: een gesimuleerde bezoeker kiest de beelden en vier activiteiten die bij de combinatie horen, en het boek wordt met de huidige gewichten geselecteerd.

| Maat | Vandaag | Met alle nieuwe items |
|---|---|---|
| Dubbelen (zelfde activiteit of zelfde naam) | 0 | 0 |
| Werelden per boek (gemiddeld) | 5,0 | 4,7 |
| Ideeën die de gekozen tags dragen | 33 van 49 (67%) | 33 van 49 |
| Nieuwe items die in een boek komen | n.v.t. | 6 (alleen waar de bezoeker ze koos of ze bij de combinatie passen) |

**Verdeling tegen het doel 40 / 25 / 20 / 15** (direct, indirect, verwant, verrassend):

| | Direct | Indirect | Verwant | Verrassend |
|---|---|---|---|---|
| Doel uit de prompt | 40% | 25% | 20% | 15% |
| Gemeten (7 combinaties) | 55% | **0%** | 14% | 31% |

Dat is de belangrijkste bevinding. Het anker-model (jouw keuze na de blinde vergelijking: vier eigen keuzes, één aangrenzend, één onverwacht, één wildcard) geeft veel directe aanbevelingen en tegelijk twee of drie "verrassende" plekken, maar **de middencategorie ontbreekt**: ideeën die uit dezelfde interesse volgen zonder letterlijk gekozen te zijn (paarden gekozen, dierenfotografie of stoeterij komt mee). Verder zijn enkele aangrenzende ideeën zwak (bij dieren en natuur kwam "Helikoptervlucht boven de kust"; bij elegantie en muziek kwam "Een online cursus volgen"). Dat zijn de "onlogische combinaties" die de prompt wil voorkomen.

## 5. Wat ik niet heb gedaan, en waarom

- **De verdeling 40/25/20/15 niet ingebouwd.** Het huidige 4 + 1 + 1 + 1 is door jou blind gekozen (B in 3 van 3 profielen). Een andere verdeling verandert wat je hebt goedgekeurd. Het past in `engine/weights.ts` en is dan een nieuwe, kleine blinde vergelijking waard (zie voorstel).
- **De prompt vraagt "duizenden activiteiten"; dit is 578.** Elke activiteit kost ongeveer $0,02 aan foto (negen per aanvraag van $0,134) en een eerste klassering door mij. Duizend meer is ongeveer $15 aan beelden, plus de tijd om ze te controleren. Bezoekers zien er toch maar 18 per keer, dus meer is pas nuttig als de nieuwe items gaten dichten, niet als ze de grootste domeinen nog groter maken.
- **Geen nieuwe velden "leeftijdsgroepen" en "toegankelijkheid".** Leeftijd stuurt nu zacht via inspanning, veiligheid en kosten, en toegankelijkheid (rolstoel, hond, dieet) gaat als controlepunt naar het onderzoek. Een eigen veld heeft geen lezer. Zeg het als je ze toch wilt.
- **Geen twintig aparte associatiepagina's.** De route blijft twee beeldpagina's.
- **Geen associatiebeelden voor de nieuwe thema's.** Pagina 1 gebruikt beelden, geen activiteiten; nieuwe onderwerpen (dieren, maatschappij, groei, reizen) hebben nu geen eigen beeldfamilies. Dat kost 3 varianten per familie (ongeveer $0,13 per vel van negen kaarten).

## 6. Voorstel voor de volgende stap

1. **Foto's maken** voor de 54 activiteiten en 3 domeinen: 9 aanvragen, ongeveer **$1,21**. Daarna zijn ze zichtbaar en zet ik de vlaggen uit.
2. **Een "indirect"-plek**: de tweede aangrenzende plek wordt een idee dat minstens twee tags deelt met twee eigen keuzes (de 25%), plus een strengere eis aan de overige aangrenzende ideeën (geen "helikoptervlucht bij dieren"). Gratis te meten met `scripts/combo-test.ts`; daarna een kleine blinde vergelijking (ongeveer $0,45 per paar).
3. **Beeldfamilies voor dieren, reizen, maatschappij en groei**: 12 families van drie varianten, ongeveer $0,70.
