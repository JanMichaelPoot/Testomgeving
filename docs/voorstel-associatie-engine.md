# Analyse en voorstel: de instructies voor de associatie-engine (hoofdstuk 3 van het ChatGPT-plan)

Status: **akkoord van Jan (18 nov)** op alle aanbevolen opties; E1 tot en met E3 zijn gebouwd (Stap 211), de rest volgt, zie sectie 6. Alle cijfers komen uit lokale metingen. Alle cijfers komen uit lokale metingen op de bibliotheek (792 activiteiten, 30 thema's), geen betaalde aanroepen.

## 1. Wat de schermafbeeldingen vragen, en waar we staan

| # | Instructie | Stand na blok 2 | Wat nog moet |
|---|---|---|---|
| 3.1 | Associaties (wat spreekt mij aan?) en activiteiten (wat kan ik doen?) strikt scheiden; eerst verbreden, dan vertalen | **Gedaan.** Pagina 1 = 30 thema's, pagina 2 = concrete activiteiten | Niets |
| 3.2 | Thematische categorieën, herkenbaar, breed, uitnodigend; starttaxonomie, geen beperking | **Gedaan, en breder.** 30 thema's tegenover hun 12 | Twee kleine gaten, zie sectie 3 |
| 3.3 | Beeld licht het thema toe zonder één activiteit voor te schrijven; per thema wisselende beelden; herkenbaar blijven; onderscheidend; **passend bij doelgroep en zoekcontext** | Punten 1 tot 5 gedaan (30 herkenbare beelden, 2 of 3 per thema, rotatie per bezoek). **Punt 6 niet**: het beeld verandert niet met doelgroep of context | Zie vraag 3 |
| 3.4 | Hele tegel is de knop: beeld, titel, omschrijving, duidelijke geselecteerde staat, mobiel en toetsenbord | Data (titel, omschrijving) staat klaar, de UI nog niet | Blok 3 (tegel-UI) |
| 3.5 | **Voldoende diepgang**: meerdere associaties per thema, combinaties van ogenschijnlijk verschillende thema's, ruimte buiten de eerste voorkeuren; de engine moet onverwachte combinaties kunnen maken, anders wordt het een filtermachine | **Dit is het belangrijkste en het grootste gat.** Zie sectie 2 | Blok 2b |
| 3.6 | Zeven vensters: van vertrouwd naar onverwacht, geleidelijke verbreding, geen lange enquête | De engine heeft al zeven interne niveaus, maar met een andere inhoud dan de zeven uit het plan | Zie vraag 4 |

## 2. Hoe de huidige engine met meerdere thema's omgaat (3.5)

Het huidige pad: de gekozen beelden worden een tagprofiel (de som van hun gewichten), pagina 2 (`composeConcretePage`) scoort elke activiteit op de **som** van `profiel[tag]` over zijn tags, en het boek (`select.ts`) bouwt uit wat iemand op pagina 2 koos: vertrouwd, verwant, **onverwacht** (via de 80 handgemaakte combinaties in `hybrids.json` of een keten over gedeelde tags), uitdaging en wildcard.

Wat dat voor thema's betekent, gemeten op de echte bibliotheek:

1. **Een som beloont niet de combinatie.** Wie natuur, techniek en ambacht kiest, krijgt bovenaan activiteiten die op één thema heel sterk zijn. Een scoring die het *minimum* over de gekozen thema's neemt (de activiteit moet bij alle drie passen) geeft ander, beter resultaat:

| Gekozen | Nu (som), bovenaan | Combinatiescore (minimum), bovenaan |
|---|---|---|
| natuur + techniek + ambacht | kettingzaagcursus, hoeden maken, graffiti, tuinmeubels maken, vlonder bouwen | wilgenvlechten, **nestkast bouwen**, papier scheppen, kruidenspiraal bouwen, inmaken |
| natuur + wetenschap | sterrenkijken, weerstation, insecten tellen | bomen herkennen, gidswandeling, insecten tellen, fossielen zoeken, natuurhistorisch museum |
| dieren + zorg | zorgboerderij, mieren houden, dierentuin, bloeddonor | zorgboerderij, boerderijdag, dierenasiel, plogging |
| geschiedenis + eten + reizen | streekweekend, high tea, buitenplaats | high tea, onbekendendiner, streetfoodtour, nachtmarkt, streekweekend |
| water + tekenen/foto's | kajak, vliegvissen, kitesurfen (alleen water) | aquarium, vliegvissen, slow travel (**ruis**: de tags van dit paar zijn te zwak) |

   Het voorbeeld uit het plan (natuur, techniek en creativiteit geven insectenhotel en weerstation) komt dus in de goede richting uit de data, maar niet vanzelf in elk geval.

2. **Thema's overlappen weinig.** Van de 435 paren thema's hebben er **204 geen enkele activiteit gemeenschappelijk**, bijvoorbeeld natuur en techniek, of dieren met bijna alles. 221 activiteiten horen bij één thema, 306 bij twee, 206 bij drie. Een lidmaatschapsregel alleen ("activiteit in beide thema's") levert dus geen combinaties voor de helft van de paren. De combinatie moet over tags lopen (zoals hierboven gemeten), niet over lidmaatschap, en daar waar de tags te zwak zijn is handwerk nodig.

3. **Niets dwingt nu dat elk gekozen thema aan bod komt.** Een thema met veel sterke tags (natuur) kan pagina 2 domineren; een stil gekozen thema (zorg) kan helemaal wegvallen.

4. **De ruimte buiten de eerste voorkeuren** (`EXPLORE_SLOTS`, "Misschien ook?") is nu gedefinieerd via stijlregisters en domeinen. Met thema's is er een scherper criterium: drie plekken uit **niet gekozen thema's die dichtbij liggen** (gedeelde tags), zodat de verrassing nog bij je past.

5. **Het boek (`select.ts`) maakt "onverwacht" uit 80 vaste combinaties en een tagketen.** Geen van beide kent de gekozen thema's. Een eenvoudige uitbreiding: de onverwachte deur mag een activiteit zijn met een hoge combinatiescore voor twee gekozen thema's die ver uit elkaar liggen.

## 3. Taxonomie: 30 thema's tegenover hun 12

| Hun thema | Onze dekking | Opmerking |
|---|---|---|
| Natuur, Water, Avontuur, Techniek, Beweging, Ambacht, Creativiteit, Cultuur, Mensen | Volledig, vaak in meer tegels | |
| Onderzoek (onderzoeken, verzamelen, uitproberen) | Wetenschap, mysterie, verzamelen | |
| **Lucht en vliegen** (vliegen, hoogte, zweven) | **Gedeeltelijk**: alleen via "snelheid en motoren" en "avontuur" | Eigen thema is te overwegen: 23 activiteiten met hoogte, plus zweefvliegen, ballonvaart, uitkijktoren, kitesurfen |
| **Beleving** (ervaren, proeven, beleven) | **Gedeeltelijk**: eten en drinken, avond uit, reizen | Eigen thema is te overwegen: proeverijen, markten, festivals, bijzonder logeren |

## 4. Voorstel (blok 2b, na het akkoord)

Alles lokaal en gratis te bouwen en te meten. Bestanden: `twoPages.ts` (`composeConcretePage`), `AssociationWizard.tsx` (doorgeven van de gekozen thema's), `engine/select.ts` (onverwachte deur), `themes.json` (paren), tests in `themeTiles.test.ts` en het bestaande evalpakket.

| Stap | Wat | Meting |
|---|---|---|
| E1 | **Dekking per gekozen thema** op pagina 2: elk gekozen thema minstens 2 van de 18 plekken (bij meer dan 5 thema's 1) | Elk gekozen thema komt voor, over de 20 vaste profielen en 300 synthetische bezoekers |
| E2 | **Combinatiescore**: de score van een activiteit wordt een mengsel van de som (nu) en het minimum over de beste twee gekozen thema's; ongeveer 5 van de 18 plekken worden voor combinaties gereserveerd. Een activiteit met een minimum onder 0,5 van het beste telt niet als combinatie (tegen ruis als bij water en beeld) | Aandeel pagina's met minstens één echte combinatie; diversiteit; geen verlies aan de bestaande harde regels |
| E3 | **"Misschien ook?" uit niet gekozen, nabije thema's** in plaats van uit stijlregisters | De drie plekken komen uit drie verschillende ongekozen thema's, elk met minstens één tag in het profiel |
| E4 | **Onverwachte deur via thema-paren**: de onverwachte seed in het boek mag een hoge combinatiescore voor twee gekozen, verre thema's zijn; de 80 handgemaakte combinaties blijven | Evalpakket: aandeel onverwachte seeds dat bij twee gekozen thema's past |
| E5 | **Uitleg bij een combinatie** op de pagina en in het boek: "omdat je natuur en ambacht koos" (de bestaande "Omdat je … koos"-regel kan twee thema's noemen) | Test op de tekst, nl en en |
| E6 (optioneel) | ±30 handgemaakte thema-paren voor de combinaties waar de tags te zwak zijn (water en beeld, zorg en techniek) | Alleen als de meting na E2 ruis laat zien |

Risico's: de combinatiescore kan activiteiten omhoog brengen die bij geen enkel thema echt passen (ruis); daarom de ondergrens en de meting. De wijziging verandert de momentopname van de 20 vaste profielen (ververs ik, zoals eerder) en mogelijk twee bewakers (diversiteit); die versoepel ik alleen met uitleg en meting.

## 5. Vragen voor jou

1. **Akkoord op E1 tot en met E5** (E6 alleen bij ruis)? Alternatief: eerst alleen E1 en E2 bouwen en met acht voorbeeldprofielen naast elkaar zetten, dan pas beslissen.
2. **Twee extra thema's** ("Iets met lucht en hoogte", "Iets met beleving")? Dat is ±5 nieuwe beelden (één vel, ±$0,13) en de omschrijvingen.
3. **Beeld per doelgroep** (3.3 punt 6)? Nu zijn de 30 beelden voor iedereen gelijk en past alleen de tekst zich aan. Een kind of groep zou eigen beelden voor enkele thema's kunnen krijgen.
4. **De zeven vensters** (3.6): de zeven niveaus uit het plan (vertrouwd, persoonlijke interesses, nieuwe manieren van beleven, creativiteit en vaardigheden, andere omgevingen, uitdaging en avontuur, onverwachte combinaties) wijken af van de zeven interne niveaus van de engine (vertrouwd, praktisch, verwant, inspirerend, onverwacht, uitdaging, wildcard). Een boek heeft vijf ideeën, dus zeven zichtbare vensters passen niet.

Voor de tegel-UI (blok 3) neem ik, tenzij je anders zegt: hele tegel is een knop met beeld, titel en omschrijving; geselecteerd = rand in walnoot met vinkje en het woord "Gekozen" (geen groen, dat past niet bij het merk); "Tik om te kiezen" onder de omschrijving; twee kolommen op een telefoon, vijf tot zes op een breed scherm; toetsenbord met zichtbare focus; kop en tekst van pagina 1 herschreven voor thema's ("Waar word je nieuwsgierig van?", "Kies er 3 tot 8").

## 6. Besluiten (Jan, 18 nov) en stand van zaken

| Vraag | Besluit | Stand |
|---|---|---|
| Combinaties | E1 tot en met E5 bouwen | **E1, E2, E3 gebouwd (Stap 211)**; E4 (onverwachte deur in het boek) en E5 (uitleg "omdat je X en Y koos") volgen |
| Extra thema's | "Iets met lucht en hoogte" en "Iets met beleving" toevoegen | Nog niet gedaan: de beelden (±5, één vel, ±$0,13) wachten op akkoord op het bedrag; omschrijvingen en gewichten zijn lokaal |
| Doelgroepbeelden | Beelden voor iedereen gelijk | Niets te bouwen |
| Zeven vensters | Als dekkingscontrole op het boek | Nog niet gedaan; een lokale test op de uitkomst van de engine, geen zichtbare namen |

### Wat Stap 211 heeft gemeten, en een eerlijke kanttekening

De tabel in sectie 2 vergeleek de **bovenkant van de ranglijst** van de som met die van het minimum. Op de echte pagina is het verschil kleiner dan die tabel doet vermoeden, omdat de som al voor een deel naar activiteiten trekt die bij meerdere thema's passen, en omdat de pagina ook registerbalans, een plafond per domein en een seeded spreiding heeft. Gemeten over 7 themakeuzes en 8 seeds (56 pagina's):

| Maat | Som (nu) | Met E1 tot en met E3 |
|---|---|---|
| Sterke combinaties per pagina (passen bij twee gekozen thema's op 0,6 of meer) | 3,6 | 4,5 |
| Gemiddelde combinatiewaarde van de beste vijf | 0,678 | 0,702 |

De winst is dus **bescheiden**: ongeveer één sterke combinatie meer per pagina. Waar de wijziging vooral voor zorgt is **zekerheid**: elk gekozen thema komt ten minste twee keer voor, er zijn gereserveerde combinatieplekken die elk echt aan twee thema's voldoen, en de "Misschien ook?"-plekken komen uit drie verschillende, niet gekozen thema's. De vergelijking "som tegenover minimum" op de volledige ranglijst blijft een zwakke maat voor wat de pagina laat zien; het echte effect zit in E4 en E5 (het boek en de uitleg), omdat daar de verrassing zichtbaar wordt.

### Stap 212: E4 en E5 gebouwd

**E4, de onverwachte deur uit twee ver uiteenliggende thema's.** De engine krijgt de gekozen thema's mee (`EngineInput.themes`, alleen bij de beeld-intake met twee pagina's). Heeft iemand er minstens twee gekozen, dan komt er bij de kandidaten voor de onverwachte deur een derde soort bij naast de 80 handgemaakte combinaties en de tweestapsketens: een activiteit die bij twee gekozen thema's tegelijk past (het zwakste van de twee op minstens 0,5 van de beste activiteit van dat thema, dezelfde maat als pagina 2) en waarvan de twee thema's ver uit elkaar liggen (cosinus van hun tagprofielen onder 0,15; de meeste paren delen helemaal geen tag). Nooit een eigen keuze van de bezoeker. De score ligt net onder die van een handgemaakte combinatie (`themeComboBase` 2,2 plus 0,6 maal de pasvorm), dus de handgemaakte combinaties blijven gelijkwaardig meedoen en de tweestapsketens worden voorbijgestreefd zodra er een echte combinatie is. Zonder thema's verandert er niets (de eval-baseline is onaangeroerd). De zaadregel naar Claude zegt dan: een onverwachte ontmoeting van twee gebieden die de persoon koos; de combinatie is van ons, de twee gebieden zijn van de persoon.

Gemeten over 96 synthetische boeken (8 themakeuzes x 12 profielen): **39 % van de boeken** krijgt zo'n onverwachte deur; de rest houdt de oude soort (ketens, handgemaakte combinaties) omdat er voor dat themapaar geen activiteit is die aan beide voldoet. Voorbeelden: high tea (geschiedenis en eten), weer volgen en een weerstation (natuur en techniek), muziek maken of dj'en (muziek en techniek), wilgentenen vlechten (natuur en ambacht). Een strengere drempel (0,6 of 0,65) liet het aandeel zakken naar 17 en 9 %, dus de drempel blijft 0,5. Kanttekening: niet elke treffer is even sterk ("boomklimmen in een oude boom" als natuur en techniek is zwak); dat zit in de tagweging van het thema techniek, niet in de selectie.

**E5, de uitleg "omdat je natuur en ambacht koos".** Drie plekken:
- *Pagina 2:* een tegel in een gereserveerde combinatieplek toont boven de naam een klein kopje "natuur + ambacht en handwerk"; een "Misschien ook?"-plek uit een niet gekozen thema toont "Misschien ook: kunst en cultuur".
- *Idea Book op /plan:* de regel "Omdat je ‘natuur’ en ‘ambacht en handwerk’ koos" (of "Gekozen met ... in gedachten" voor iemand anders) verschijnt zodra de activiteit aan twee gekozen thema's voldoet, met het beeld van het eerste thema; in de draad "Zo kwamen we hierop" komt dan één schakel "natuur + ambacht" met het bijschrift "Twee thema's die jij koos, in één idee" in plaats van één beeld.
- *PDF:* dezelfde draad als zin: "Dit idee komt uit twee dingen die je koos: ‘natuur’ en ‘ambacht en handwerk’."
Een idee dat de bezoeker zelf koos (pagina 2) zegt eerst dat het zelf gekozen is en toont geen combinatie. De combinatie wordt bij het schrijven van het boek bewaard in `association_sources.combos` (bestaande jsonb-kolom, geen migratie; oudere boeken zonder dat veld worden gewoon gelezen). Het bepalen is overal dezelfde functie (`themeComboFor`, `themeFit.ts`), dus pagina, boek en PDF noemen dezelfde twee thema's. Gemeten: ongeveer 12 % van de ideeën in zulke boeken krijgt de tweethema-regel; de overige houden de regel met één thema.

**Bijgesteld in blok 2:** de gereserveerde combinatieplekken worden over de themaparen gespreid (bij drie thema's hooguit twee per paar, bij vier of meer één per paar; wat overblijft gaat naar de beste van elk paar). In de praktijk zijn natuur-combinaties met techniek schaars, dus bij natuur, techniek en ambacht blijft techniek met ambacht domineren; dat is wat de data geeft.

### Stap 213: de zeven vensters als dekkingscontrole

Gemeten op 72 synthetische boeken met themakeuzes: een boek raakt minimaal 5, mediaan 6 en maximaal 7 van de zeven vensters uit het plan. Per venster: vertrouwd 97 %, persoonlijke interesses 100 %, nieuwe manieren van beleven 97 %, creativiteit en vaardigheden 86 %, andere omgevingen 90 %, uitdaging en avontuur 24 %, onverwachte combinaties 100 %. De zwakke plek is **uitdaging**: het productiegewicht laat de uitdagingsplek weg ten gunste van een tweede eigen keuze. Dat is niet aangepast; het is een keuze voor Jan of elk boek een uitdagend idee moet bevatten.
