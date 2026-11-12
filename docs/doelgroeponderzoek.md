# Doelgroep- en matchingonderzoek WindowInto (12 november 2026)

Status: onderzoek, geen productiecode gewijzigd. Reproduceerbaar met `npx tsx scripts/audience-research.ts 30` (gratis, schrijft `scratch/audience-results.json`). De brief noemt `windowsinto.nl`; de live site is **windowinto.nl** (hier gebruikt).

## Wat wel en niet is getest (lees dit eerst)

| Wel gedaan | Niet gedaan |
|---|---|
| Nulmeting van de live site (landing en intake-startpagina, tekst en velden) | Geen betaalde generaties: Jan koos "geen betaalde boeken", en betalen op de live site doe ik niet. Er is dus **geen geschreven boek per persona** beoordeeld |
| Broncode van intake, engine, bibliotheek en filters gelezen en aangehaald | Geen echte bezoekers; persona's zijn simulaties: hun smaak (tags) bepaalt welke beelden en activiteiten ze kiezen |
| 16 persona's x 30 sessies door de **echte productie-engine** (`WEIGHTS_ANCHOR`, november, bibliotheek van 729 activiteiten en 163 beeldfamilies), zoals de intake het doet (geen leeftijd, geen sociale vorm meegegeven) | Geen beoordeling van teksten, afbeeldingen, links en plekken in een persona-boek; de "presentatie" is alleen steekproefsgewijs bekeken in 12 opgeslagen boeken van eigen tests (zie E5) |
| 12 opgeslagen echte boeken read-only geteld | Geen Engelstalige reis, geen scherm-lezers, geen mobiele UX-test in dit onderzoek |

**Hoe de scores zijn opgebouwd.** Zes criteria zijn berekend uit de bibliotheek-eigenschappen van de geselecteerde activiteiten, gemiddeld over 30 sessies (score = 1 + 9 x aandeel dat past, met per persona de regels in het script). "Relevantie en aantrekkelijkheid" is een **handmatig oordeel** over de zeven activiteiten van de representatieve sessie (met reden in het script, `MANUAL`). De berekende interessescore is te mild (een tag als `story` of `craft` telt snel mee), daarom staat in de tabel de **gecorrigeerde totaalscore**: de interessescore is daar het laagste van berekend en handmatig. Een andere generatie of een andere seed geeft andere zeven activiteiten; de 30-sessiecijfers vangen dat op, het handmatige oordeel niet.

## A. Managementsamenvatting

**Antwoord op de centrale vraag: gedeeltelijk.** WindowInto maakt voor een brede groep een gevarieerd en haalbaar aanbod (gemiddeld 77,9 gecorrigeerd; berekend 82,8) en doet dat zonder stereotypen (geen geslacht gevraagd; de stijlregisters verschillen niet systematisch per persona). Maar voor zes soorten bezoekers is de uitkomst **onvoldoende betrouwbaar**, en dat komt vooral door wat de intake niet vraagt en wat de bibliotheek niet weet, niet door de AI-generatie:

1. **Gezinnen met jonge kinderen** (gecorrigeerd 66,3, de enige onder de 70): "Met kinderen" is alleen een vlag zonder leeftijd. In de representatieve lijst staan een boogparcours (toezicht), mountainbiken (intensiteit 3) en een week boerderijwerk.
2. **Mensen met beperkte mobiliteit en rolstoelgebruikers**: de bibliotheek heeft geen toegankelijkheidsgegevens. "Met de rolstoel bereikbaar" levert in 100% van de sessies de vlag "controleer toegankelijkheid", geen filter; 16% van de ideeën is volgens mijn regels niet haalbaar.
3. **Ouderen (68+)**: de leeftijd wordt in de live intake nooit meegegeven (`ageCategory` wordt op `""` gezet), dus de 65+-weging in de engine is in productie dood. In 30% van de sessies staat een idee met verplicht toezicht (zoals een urbex-tour) in het boek.
4. **Sociale doelen** (nieuw in de stad, eenzaam): de sociale vorm wordt nooit gevraagd (`socialFormats: []`); niets stuurt op "mensen ontmoeten": bij Priya en Gerda past de vorm van ongeveer een op de vijf ideeën niet (sociaal 8,0 en 8,4), en alleen een enkel idee (een dinerkring, een open podium) is echt gericht op ontmoeten.
5. **Prikkelarm of structuur nodig**: geen chip, geen veld; "Alleen binnen" laat toch `both` en een boksles (intensiteit 3) door.
6. **Beperkingen als "Zonder alcohol"** zijn alleen een vlag: alcoholgerichte activiteiten blijven mogelijk (Alex kreeg in een eerdere run van dit onderzoek een netwerkborrel; in de laatste run niet).

**Grootste risico:** een verkeerd advies bij een kwetsbare doelgroep (kinderen, mobiliteit, ouderen) voelt voor die bezoeker als "niet voor mij" en schaadt het vertrouwen vlak na een betaling van EUR 7,50. **Grootste verbeterkans:** vijf kleine intakevragen/velden die de bestaande, werkende engine al kan gebruiken (leeftijdsband optioneel, sociale vorm, "met kinderen" met leeftijd, toegankelijkheid als echt filter, "rustig/prikkelarm").

## B. Doelgroepenmatrix en persona's

Dimensies uit de brief (leeftijd/levensfase, geslacht, sociale situatie, cultuur/taal, fysiek/cognitief, persoonlijkheid) zijn combineerbaar gebruikt. Geslacht wordt in WindowInto niet gevraagd of afgeleid (dat is een bewuste regel in `audience.ts`), dus er is geen geslachtsvariant getest; de persona's verschillen wel in wat stereotiep gecodeerd wordt (Henk technisch, Joyce zorgzaam, Mila avontuurlijk, Alex tegen het patroon in).

| Persona | Leeftijd/fase | Sociaal | Beperking of voorwaarde | Smaak |
|---|---|---|---|---|
| P01 Lotte | 9 (via ouder, "kind") | met ouder | veilig | dieren, knutselen |
| P02 Daan | 15 (via ouder) | vrij | toegestaan voor 15 | techniek, snelheid, muziek |
| P03 Mila | 22, student | vrienden | EUR 25, weekend | avontuur, sociaal |
| P04 Tim en Sanne | gezin, kinderen 3 en 6 | gezin | "Met kinderen" | natuur, creatief |
| P05 Joyce | 41, alleenstaande moeder, kind 12 | met kind | EUR 10, zonder auto | maken, eten, natuur |
| P06 Mark en Eva | 38 en 36, stel | duo | weekend, EUR 100 | eten, cultuur, verhalen |
| P07 Vriendengroep | 6 mensen, 29 | groep | 's avonds | competitie, spel |
| P08 Henk | 52 | vrij | - | gereedschap, techniek |
| P09 Marijke | 49, introvert | niet in groep | - | stilte, natuur, verhalen |
| P10 Anouk | 45, rolstoel | vrij | rolstoel | cultuur, taal |
| P11 Bram | 27, prikkelarm en structuur | niet in groep | alleen binnen | puzzelen, strategie |
| P12 Priya | 36, internationale inwoner | wil mensen ontmoeten | 's avonds | taal, eten, ontdekken |
| P13 Jan en Ria | 68 en 70, gepensioneerd | duo | zonder auto | natuur, geschiedenis |
| P14 Gerda | 79, beperkt mobiel, eenzaam | zoekt contact | zonder auto, binnen | contact, rust, verhalen |
| P15 Voor mijn vader | 71, voor een ander | onbekend | - | techniek, geschiedenis |
| P16 Alex | 26, ruim spectrum | vrij | EUR 10, zonder alcohol | actief, cultureel, strategie |

Onderbouwing: elke dimensie uit de brief komt minstens twee keer voor; minder voor de hand liggende combinaties zijn P12 (internationaal en sociaal), P14 (hoogbejaard, mobiliteit en eenzaamheid), P16 (veel tegengestelde smaken) en P15 (voor iemand anders, leeftijd alleen indirect).

## C/D. Testresultaten en scoreoverzicht

▲ = 9 of hoger, ▼ = onder de 7. `*` = laagste van berekend en handmatig. "Misser" = aandeel ideeën dat volgens de persona-regels niet bij fase, sociale vorm of haalbaarheid past (gemiddeld over 30 sessies). "Eerste set" = aandeel sessies waarin de eerste 18 beelden minstens 5 beelden in haar smaak bevatten (anders moet de persoon "Andere beelden" kiezen).

| Persona | Leeftijd | Interesses* | Sociaal | Haalbaar | Origineel | Divers | Relevantie (hand) | Totaal berekend | **Totaal gecorrigeerd** | Oordeel | Misser | Eerste set |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| P01 Lotte (9) | 9.7▲ | 5.5▼ | 9.8▲ | 10.0▲ | 7.1 | 9.8▲ | 5.5▼ | 84.1 | **79.0** | Voldoende | 6% | 57% |
| P02 Daan (15) | 9.1▲ | 5.5▼ | 10.0▲ | 10.0▲ | 7.5 | 9.6▲ | 5.5▼ | 84.1 | **78.8** | Voldoende | 10% | 13% |
| P03 Mila (22) | 10.0▲ | 6.0▼ | 9.5▲ | 10.0▲ | 7.6 | 9.7▲ | 6.0▼ | 84.8 | **81.6** | Goed | 5% | 77% |
| P04 Gezin met kleuters | 9.2▲ | 2.5▼ | 9.5▲ | 9.4▲ | 7.0 | 9.7▲ | 2.5▼ | 76.6 | **66.3** | Matig | 14% | 27% |
| P05 Joyce (41, alleenstaand) | 9.6▲ | 5.0▼ | 9.1▲ | 10.0▲ | 8.8 | 9.6▲ | 5.0▼ | 81.4 | **78.8** | Voldoende | 15% | 53% |
| P06 Mark en Eva (stel) | 10.0▲ | 5.5▼ | 8.0 | 10.0▲ | 7.0 | 9.8▲ | 5.5▼ | 82.6 | **77.5** | Voldoende | 22% | 77% |
| P07 Vriendengroep (6) | 10.0▲ | 7.0 | 9.5▲ | 10.0▲ | 7.3 | 9.8▲ | 7.0 | 86 | **84.8** | Goed | 5% | 40% |
| P08 Henk (52) | 10.0▲ | 7.0 | 10.0▲ | 10.0▲ | 7.0 | 9.8▲ | 7.0 | 86.2 | **84.8** | Goed | 0% | 53% |
| P09 Marijke (49) | 10.0▲ | 7.0 | 9.8▲ | 9.6▲ | 7.3 | 9.9▲ | 7.0 | 86.4 | **84.5** | Goed | 7% | 90% |
| P10 Anouk (rolstoel) | 10.0▲ | 6.5▼ | 10.0▲ | 8.5 | 7.2 | 9.6▲ | 6.5▼ | 84.9 | **80.9** | Goed | 16% | 57% |
| P11 Bram (prikkelarm) | 10.0▲ | 6.0▼ | 9.6▲ | 9.1▲ | 7.7 | 9.5▲ | 6.0▼ | 83.7 | **80.3** | Goed | 13% | 7% |
| P12 Priya (internationaal) | 10.0▲ | 4.5▼ | 8.0 | 10.0▲ | 7.3 | 9.6▲ | 4.5▼ | 81.7 | **74.3** | Voldoende | 22% | 87% |
| P13 Jan en Ria (68+) | 8.7 | 4.5▼ | 9.4▲ | 9.1▲ | 7.0 | 9.7▲ | 4.5▼ | 77.6 | **72.0** | Voldoende | 21% | 73% |
| P14 Gerda (79) | 9.7▲ | 4.5▼ | 8.4 | 9.7▲ | 7.6 | 9.7▲ | 4.5▼ | 80.6 | **74.3** | Voldoende | 21% | 97% |
| P15 Vader (71, voor ander) | 9.3▲ | 3.0▼ | 10.0▲ | 10.0▲ | 7.0 | 9.8▲ | 3.0▼ | 81 | **69.8** | Matig | 8% | 73% |
| P16 Alex (26) | 10.0▲ | 4.0▼ | 10.0▲ | 10.0▲ | 9.6▲ | 9.6▲ | 4.0▼ | 82.4 | **78.0** | Voldoende | 0% | 30% |
Gemiddelde: berekend 82,8; gecorrigeerd 77,9. Geen persona onder de 60 (onvoldoende); P04 zit met 66,3 in "matig", P12, P13, P14 en P15 liggen rond de 70-75. **Een gemiddelde van 78 verhult hier de structurele gaten**: dertien van de zestien persona's hebben op relevantie een hand-score van 6,5 of lager, terwijl "divers" en "origineel" bij iedereen 7 tot 10 zijn.

Diversiteit tussen sessies is goed: dezelfde persona krijgt in 30 sessies 108 tot 138 verschillende activiteiten (geen vaste lijst). Tussen persona's is de overlap laag (hoogste paar P01-P03, Jaccard 0,29), maar er zijn "standaardantwoorden": `wandelen` komt bij 12 van de 16 persona's voor, `geocaching` bij 11, en daarna `legendes`, `origami`, `voedselbank` en `genealogie` bij 9.

### Concrete voorbeelden (representatieve sessie, productie-engine)

**Goede matches**
- P07 vriendengroep, 's avonds: larp, bubble football, potluck, nachtwandeling, oriëntatieloop. Past bij groep, avond en competitie.
- P08 Henk: meubels restaureren, edelstenen slijpen, mes smeden, brocante. Past bij praktisch en materiaal.
- P09 Marijke: natuurwandeling met gids, wilgenvlechten, geocaching, bonsai. Rustig en buiten.
- P11 Bram: zendamateur, lockpicking, open source, microscopie. Puzzelen en verdiepen.
- P12 Priya: dineren met onbekenden (precies haar doel, maar het is het enige echt sociale idee).

**Slechte matches**
- P04 gezin met kleuters: 3D-boogparcours (toezicht), mountainbiken (intensiteit 3), een week meewerken op een boerderij, buurtvrijwilliger. Alleen geocaching past.
- P15 voor een vader van 71 met techniek en geschiedenis: solo-rollenspel, blokdruk-textiel, cosplay, kostuumontwerp, slides ontwerpen.
- P13 Jan en Ria: urbex-tour met toezicht bij 68+; P14 Gerda (79, beperkt mobiel): pallet-meubels maken als wildcard.
- P16 Alex, "sportief en cultureel": niets-doen, spelavond thuis, platenwinkel, reptielen; geen actieve of culturele ideeën.
- P03 Mila: drie van de zeven zijn dans (swingdansen, dansen, historische dans).
- P11 Bram, prikkelarm en "alleen binnen": een boksles (intensiteit 3).

### Oordeel per onderdeel (1-10, mijn oordeel op basis van bovenstaande tests)

| Onderdeel | Cijfer | Waarom |
|---|---|---|
| Intake | 6,5 | Sterk op plaats, afstand, budget, tijd en chips. Zwak: geen leeftijd (geforceerd leeg), geen sociale vorm (geforceerd leeg), geen prikkel/structuur, geen kinderleeftijd |
| Profielopbouw | 5,5 | Uit de beelden komen alleen twee draaiknoppen in de engine (praktisch-wild en inzet, `deriveDials`); het publieksprofiel (`audienceProfile`) is voor leeftijd en levenswereld vrijwel altijd "onbekend" |
| Associaties | 7 | 163 families, goed onderscheidend en zonder personen; maar de eerste set van 18 dekt niet-gangbare smaken slecht: genoeg beelden in de eerste set bij Bram 7%, Daan 13%, het gezin 27%, Alex 30% (de rest moet verversen) |
| Matching | 6 | Vaste filters (budget, seizoen, minderjarigen, verplichte vormen) werken en geven nooit minder dan zeven ideeën. Maar alle praktische wensen zijn vlaggen, geen filters, en leeftijd, sociale vorm en toegankelijkheid ontbreken in de data |
| Presentatie | niet gescoord | Zie E5: alleen steekproefsgewijs bekeken, geen boek per persona |

## E. Structurele analyse

**E1. Intake en profielopbouw (oorzaak van de meeste missers, niet de AI).**
- `src/components/window/AssociationWizard.tsx:831` zet `socialFormats: []` en `ageCategory: ""` voor alle bezoekers van de beeld-intake. Gevolg: `agePenalty` in `engine/select.ts` (65+, 55-64, 18-24, onder 18) werkt alleen via de zoekcontext "kind" (`under18`), nooit voor een volwassene of oudere; en geen enkel idee wordt op sociale vorm gefilterd of gewogen.
- De startpagina vraagt alleen: voor wie, plaats, afstand, tijd, budget en chips (omgeving, bereikbaarheid, gezelschap, eten/drinken, wanneer). Dat is netjes en kort, maar sociale situatie en levensfase ontbreken.
- Het "Voor iemand anders"-pad kent kind, volwassene en groep, maar geen leeftijd of relatie. De vader van P15 wordt dus niet als 71 gezien.

**E2. Praktische wensen zijn vlaggen, geen filters** (`engine/constraints.ts`, `parseMustHaves`). Rolstoel, kinderen, vervoer, avond, weekend, dieet, alcohol en huisdier worden alleen "verify"-vlaggen voor de schrijver en de zoekstap. De bibliotheek heeft er ook geen velden voor: de activiteit-records hebben alleen `formats`, `intensity`, `level`, `cost`, `duration`, `setting`, `safety.tier`, `supply`, `months` en `tags`. Er zijn geen velden voor toegankelijkheid, minimumleeftijd, geluid of drukte, alcohol of taal. Alleen "binnen/buiten", "geen groepen" en "kind" (een vaste lijst `MINOR_UNSUITABLE` van 32 id's) zijn echte filters.

**E3. Matching en bibliotheek.**
- Verplicht toezicht (`safety.tier 2`, 57 van 729) en intensiteit 3 (34) worden alleen zacht gewogen; zonder leeftijd komen ze bij ouderen en gezinnen toch in het boek (in 30 sessies: P13 30%, P10 27%, P04 43% van de sessies met minstens één idee met toezicht).
- Er is geen "gezinsvriendelijk" of minimumleeftijd per activiteit, dus "Met kinderen" kan alleen de lijst voor minderjarigen toepassen (alcohol, wapens, zware machines). Dat sluit een boogparcours niet uit.
- Binnen één lijst kan een cluster herhaald worden (P03: drie dansactiviteiten); de diversiteitsstap telt werelden en tags, geen subdomein.
- Een kleine set "standaardideeën" komt overal terug (`wandelen`, `geocaching`).

**E4. Generatie en foutafhandeling (apart onderzocht, geen oorzaak van bovenstaande).** In twee echte runs viel generatie uit door een lijst die als tekst met een ontbrekende `}` terugkwam; zie `docs/changelog.md` (Stap 166): de reparatie en tests staan klaar. De selectie hier gebeurt vóór de AI; fouten in de persoonsmatch zijn dus **intake-, profiel- en bibliotheekfouten**, geen generatiefouten.

**E5. Presentatie (steekproef, niet per persona).** In de 12 meest recente opgeslagen boeken (84 ideeën, eigen testboeken) noemt 29% van de ideeën een benoemde plek (24 van 84) en 62% een website (52 van 84); 60 ideeën hebben geen plek (veel activiteiten hebben er ook geen nodig, dus dit is geen foutpercentage). Of die plekken en links bestaan is hier niet gecontroleerd. Voor een uitspraak over presentatie per doelgroep zijn echte boeken per persona nodig (zie F, P2).

## F. Verbeterplan

| Prio | Probleem | Voorgestelde oplossing | Verwacht effect | Onderdeel | Complexiteit |
|---|---|---|---|---|---|
| **P0** | Gezin met jonge kinderen krijgt toezicht-, risico- en vrijwilligersideeën (P04, 66) | Vraag bij "Met kinderen" de leeftijden (kleuter, basisschool, tiener) en laat de engine intensiteit 3, toezicht (tier 2) en volwassen-vormen uitsluiten; voeg per activiteit `family`/`minAge` toe (eerst voor de ±150 activiteiten die in een gezinsboek kunnen komen) | Gezinsscore van 66 naar 80+ (schatting, niet gemeten) | Startpagina, `constraints.ts`, bibliotheek | Midden |
| **P0** | "Met de rolstoel bereikbaar" geeft alleen een vlag; geen toegankelijkheidsdata (P10, P14) | Veld `access` (rolstoel, geen trappen, zittend) per activiteit; bij de chip filteren op bekende conflicten en het boek eerlijk zeggen wat gecontroleerd is | Geen buitensport/klimmen meer bij rolstoel; missers van 16% naar onder 5% (schatting) | Bibliotheek, `constraints.ts`, schrijversprompt | Midden tot hoog (data) |
| **P0** | Leeftijd wordt nooit doorgegeven; 65+-weging is in productie dood (P13, P14, P15) | Vraag optioneel een leeftijdsband of een chip "Rustig tempo" die intensiteit en toezicht begrenst, en geef die door | Geen urbex-tour of boerderijweek bij 68+; sessies met toezicht van 30% naar onder 10% (schatting) | Startpagina, `AssociationWizard.tsx:831`, `select.ts` | Laag tot midden |
| **P1** | Sociale vorm wordt nooit gevraagd (P12, P14, P05) | Eén vraag of chip "alleen / met één / met een groep / mensen ontmoeten" gekoppeld aan `formats`, met zwaar gewicht bij "mensen ontmoeten" | Ideeën die op ontmoeten gericht zijn krijgen voorrang bij Priya en Gerda | Startpagina, `engineInputFromIntake` | Laag |
| **P1** | "Zonder alcohol" is een vlag (P16: in een eerdere run een netwerkborrel) | Veld `alcohol` (centraal / bijzaak / geen); filter bij de chip | Geen borrel meer bij "zonder alcohol" | Bibliotheek, `constraints.ts` | Laag |
| **P1** | Prikkelarm en structuur ontbreken (P11) | Chip "Rustig en voorspelbaar" met veld `crowd`/`noise` (laag/midden/hoog) en een begrenzing op intensiteit | Bram krijgt geen boksles | Startpagina, bibliotheek | Midden |
| **P2** | Eerste set van 18 beelden dekt niche-smaken niet (Bram 7%, Daan 13%, Alex 30%) | Voeg beeldfamilies toe voor geschiedenis, techniek, snelheid en strategie en weeg de eerste set op breedte van smaken | Minder "Andere beelden"-klikken; betere profielen | Associaties, `sampleBalancedBatch` | Laag tot midden (beeldkosten) |
| **P2** | Herhaling van een cluster in één lijst (P03: drie dansen) en standaardideeën (`wandelen`) | Maximaal twee ideeën per subdomein; dempende gewichten op de meest gekozen activiteiten | Meer variatie in één boek | `engine/select.ts` | Laag |
| **P2** | Presentatie per doelgroep niet gemeten | Genereer één echt boek per persona (16 x EUR 0,15-0,50) en beoordeel plaats, link, toon en afbeelding | Eerste echte meting van de laatste schakel | Eval-harnas (`scripts/eval`) | Laag (kosten) |
| **P3** | Taal en cultuur zijn geen dimensie (P12) | Veld `language` per activiteit (Nederlandstalig, Engelstalig, taalvrij) en een voorkeur voor internationale bezoekers | Priya krijgt taalvrije of Engelstalige ideeën | Bibliotheek, intake | Midden tot hoog |
| **P3** | Persona-regressietest ontbreekt | Neem `scripts/audience-research.ts` op in de testsuite met drempels per persona (bv. geen toezicht bij 65+ met de chip) | Voorkomt terugval bij bibliotheekuitbreiding | Tests | Laag |

**Opmerking over herhaalbaarheid.** De uitkomsten zijn deterministisch voor dezelfde seed en bibliotheek; een nieuwe bibliotheekversie (zoals de 27 activiteiten van Stap 164) verandert de lijsten. De generatiestap (AI) kan bij dezelfde selectie andere tekst geven; die is hier niet gemeten.

## G. Uitvoering van de P0-fixes (Stap 167)

Gebouwd en gemeten met `scripts/audience-research.ts` (zelfde 30 sessies per persona, zelfde seeds; de drie persona's kregen de nieuwe chips). Geen betaalde aanroepen.

**Wat er is gebouwd.** Twee nieuwe chips op de startpagina (nl en en) en een filter voor de bestaande rolstoelchip, alle drie met dezelfde regels in de selectie, op pagina 2 en in de "dit kon niet mee"-melding:
- **"Met jonge kinderen"** sluit uit: intensiteit 3, verplicht toezicht (tier 2), de werelden `growth` en (bijna) `society`/`together`/`night`, en 242 benoemde activiteiten die niet bij kleuters passen (scherp gereedschap, wellness, solo-werk, vrijwilligerswerk). Plus de bestaande kinderlijst.
- **"Met de rolstoel bereikbaar"** sluit uit wat bekend onmogelijk is vanuit een rolstoel: alles met tag `height` of `depths` (klimmen, grotten, duiken) en een lijst ruw terrein, hardlopen, schaatsen en bootinstappen. De rest blijft erin met de bestaande controle op stap-vrije toegang.
- **"Rustig tempo"** begrenst op lichte beweging (intensiteit ≤ 1), geen toezicht en geen gevorderd niveau, ook niet voor een zelf gekozen activiteit. Dit is de leeftijdsvrije vervanger van de leeftijdsvraag (Stap 135: niemand wordt op leeftijdsklasse gelabeld).
- De schrijver en het lokale onderzoek krijgen voor de twee nieuwe chips een eigen schrijfregel ("jonge kinderen", "rustig tempo").

**Gemeten (selectie, 30 sessies):**

| Persona | Sessies met toezicht-idee | "Misser" (eigen maatstaf van het onderzoek) | Eerste set |
|---|---|---|---|
| P04 gezin met kleuters | 43% naar 0% | 14% naar 7% | n.v.t. |
| P13 Jan en Ria (68+) | 30% naar 0% | 21% naar 8% | n.v.t. |
| P14 Gerda (79) | 10% naar 0% | 21% naar 18% | n.v.t. |
| P10 Anouk (rolstoel) | 27% naar 13% | 16% naar 14% | n.v.t. |

Het berekende gemiddelde over de 16 persona's gaat van 82,8 naar 83,2. De handmatige relevantiescores (de zeven beoordeelde activiteiten) zijn niet opnieuw gegeven, dus een nieuw "gecorrigeerd" gemiddelde ontbreekt bewust.

**Wat dit wel en niet oplost.**
- Gezinnen en "rustig tempo" zijn echt verbeterd: geen toezicht-ideeën meer, geen boogparcours of mountainbiken.
- Voor de rolstoel is de winst klein onder de strengere maatstaf van het onderzoek (binnen, geen beweging). Wat overblijft zijn stads- en spookwandelingen en fotografie buiten: die kunnen met een rolstoel, maar de bibliotheek weet niet of de route te doen is. Dat blijft een controle in het boek, geen filter; echt oplossen vraagt het veld `access` per activiteit (data, niet code).
- P14 (eenzaam) verbetert op tempo maar niet op contact: dat is het sociale-vormpunt (P1).
- De lijsten zijn met de hand gemaakt (`src/lib/discovery/suitability.ts`) en niet door een tweede persoon beoordeeld; een test garandeert alleen dat elk genoemd id bestaat. Een nieuwe activiteit komt er niet vanzelf op; zie de regressietest (P3).
