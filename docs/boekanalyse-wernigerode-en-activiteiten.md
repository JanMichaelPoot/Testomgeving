# Boek Wernigerode (15 nov 2026) en de activiteitenbibliotheek

Twee vragen van Jan, 16 nov 2026: waarom had het laatste boek weinig concrete plekken en slechts vier ideeën, en welke gebruikelijke activiteiten ontbreken (bowlen, tennissen, golfen, koeien knuffelen, paddenstoelen zoeken, bordspellen, bingo)?

## 1. Het boek

**Wat er in de database staat** (`window_plans`, `progress_meta`): plaats Wernigerode (Harz, Duitsland), 15 km, boek in het Nederlands, eerste boek met Zoekmotor 2.0. Drie ideeën en een wildcard, dus vier in plaats van vijf. Kosten $0,361, 14 zoekopdrachten. Van 15 onderzochte activiteiten (5 uit het boek, 10 uit de reserve) had er maar 3 een plek (`candidatesWithOption`); opties per idee 2/1/1/0; `coverage: dropped 1, incomplete`. Het idee zonder plek is volgens de regel van 14 november uit het boek gehaald (`MIN_SEEDS` stond op 4).

**Oorzaken**, in volgorde van gewicht:

1. **Een kleine plaats.** Uit de onderzoekscache (969 antwoorden, 17 plaatsen) blijkt dat de vondstkans met de grootte van de plaats samenhangt en niet met het land: Utrecht 49%, Haarlem 53%, Laren (een Nederlands dorp, Nederlandse zoektermen) 14%, Uster (CH) 14%, Wernigerode 18%. Over alle plaatsen vindt het onderzoek bij 37% van de activiteit-plaatsparen iets.
2. **Weinig plekken-achtige activiteiten.** Het boek bevatte vooral abstracte of nichekeuzes: de eigen keuzes `data-visualisatie`, `plannen-workshop`, `coderen`, `metaaldetectie`, `monumenten` en de motor-ideeën `oude-kaart-wandeling`, `documentaireportret-maken`, `wandelroute-cartograferen`, `sterren-fotograferen`. Daar bestaat in een stad van 33.000 inwoners geen aanbieder van die je kunt bezoeken. Alle 13 lege antwoorden in de cache zijn zulke activiteiten. De bibliotheek markeert ze als `supply: common`, wat voor Nederland is bedoeld.
3. **Het herstel was te beperkt.** De dekkingsronde zocht alleen naar verwante activiteiten (ook niche) en haalde een idee zonder plek uit het boek in plaats van het te vervangen.
4. **Nederlandse zoektermen voor een Duitse zoektocht.** Het prompt zei al "zoek in de taal van het land", maar de voorbeeldzoekopdrachten ("proefles", "beoordelingen") en bij élke activiteit de zoektermen ("Search terms to try (Dutch)") waren Nederlands. Jans idee klopt dus als oorzaak, maar het is niet de hoofdoorzaak: stadsspel is wel als *Stadtspiel* gevonden (Harz Escape, myCityHunt), dus het model vertaalde al vaak zelf, en Laren (Nederlandse termen) scoort even laag.

**Wat is aangepast** (Stap 204):

- `src/lib/claude/searchLanguage.ts`: per land de woorden van een lokale zoekopdracht (DE/AT/CH, BE/LU, FR, ES, IT, PT, GB/IE/US/CA/AU/NZ, DK, SE, NO, PL); andere landen krijgen "de lokale taal". Het prompt noemt voor een plaats in het buitenland die woorden, vraagt de activiteitsnaam te vertalen naar wat de mensen daar zeggen, en geeft de Nederlandse zoektermen alleen nog als betekenis. Nederlandse plaatsen: ongewijzigd.
- Antwoorden voor het buitenland hebben een eigen cacheversie (`v7`), zodat de lege antwoorden uit Nederlandse woorden niet blijven gelden en niet als "stil" meetellen in de aanbodindex.
- `MIN_SEEDS = BOOK_COUNT`: een boek heeft altijd vijf ideeën. Een idee zonder plek wordt eerst vervangen; lukt dat niet, dan blijft het staan en wordt het eerlijk geschreven ("eerst uitzoeken") en gemeld (`coverage_incomplete`).
- `src/lib/claude/everywhere.ts`: 24 activiteiten die bijna elke plaats heeft (wandelgroep, museum, zwembad, bowlen, minigolf, pubquiz, bordspellen, film/theater, tennis, yoga, dansen, kookclub, schilderen, instrument, hardlopen, dierentuin, kinderboerderij, fotowandeling, natuurbeheer, high tea, escape room, klimpark, sauna). De dekkingsronde gebruikt ze vanaf de tweede ronde voor drie van de vijf kandidaten, en in elke ronde als er niets verwants meer is.

**Niet gedaan, voorgesteld**:

- De plaatsgrootte (Photon geeft `city`/`town`/`village`) bij de intake bewaren en de motor daar gevoelig voor maken: in een dorp zwaarder straffen op `regional` en `rare`, de niche-bonus uitzetten, en de "overal"-activiteiten al in de reserve van de eerste zoekronde opnemen.
- Een meting op dit profiel: dezelfde invoer met het oude en het nieuwe prompt, alleen onderzoek, ongeveer $0,55 voor twee runs. Zonder die meting is het effect van de taalaanpassing niet bewezen.

## 2. De activiteitenbibliotheek

756 activiteiten in 22 werelden (`creative` 133, `movement` 68, `nature` 77, ...).

**Alles wat Jan noemt staat er al in:**

| Genoemd | In de bibliotheek |
|---|---|
| bowlen | `bowlen` |
| tennissen | `tennis-proefles`, `padel`, `squash`, `tafeltennis`, `badminton` |
| golven | `golfles`, `driving-range`, `boerengolf`, `minigolf`, `frisbeegolf` |
| andere sporten | `teamsport`, `volleybal`, `handbal-vereniging`, `honkbal-softbal`, `cricket-beginners`, `rugby-proeftraining`, `vechtsport`, `boksles`, `schaatsen`, `klimmen`, `darten-pool`, `biljarten`, `curling`, ... (68 in `movement`) |
| koeien knuffelen | `koeknuffelen`, `dierenopvang-knuffelen`, `geitenyoga`, `alpaca-wandeling` |
| paddenstoelen zoeken | `paddenstoelen`, `kruiden` |
| bordspellen | `bordspellen`, `rummikub-kaartclub` (spelletjescafé), `kaartspellen`, `mahjong`, `dammen`, `legpuzzels` |
| bingo | `bingo-avond` |

**Waarom het toch zo voelt**: ze worden bijna nooit getoond. Een simulatie van 800 bezoekers van de beeld-intake (pagina 2 toont 18 van de 756) geeft:

- een gemiddelde activiteit staat bij 2,4% van de bezoekers op pagina 2; bowlen 2,5%, tennis 2,0%, padel 1,0%, golfles 0,6%, koeknuffelen 1,1%, paddenstoelen 0,4%, bordspellen 2,6%, bingo 2,1%;
- de motor kiest ze zelden in een boek (golfles 0, paddenstoelen 0 van 800);
- 390 van de 756 activiteiten zien minder dan 2% van de bezoekers, 5 nooit (`parfum-maken`, `bandweven`, `zwaluwstaart-kist`, `muziektheorie-leren`, `krabben-vangen`), 70 komen in geen enkel gesimuleerd boek.

Pagina 2 wordt samengesteld uit wat bij de gekozen beelden past, met een demper op activiteiten die bij alles passen (de "hubs"). Een gebruikelijke activiteit komt dus alleen langs als een beeld erop lijkt, en er is geen plek om er zelf een te zoeken.

**Echte gaten** (niet gevonden op naam of trefwoord, na controle van ±120 gebruikelijke activiteiten): pretpark, kermis, brunchen of uit ontbijten, zaalvoetbal/futsal, wielrennen of racefiets, e-bike tocht, windsurfen, triatlon, tafelvoetbal, hardloopgroep of parkrun, zelfpluktuin, subtropisch zwembad, rommelmarkt, uitkijktoren of uitzicht, bollenvelden (seizoen), kegelen, pickleball, speeltuin (met kinderen). Het zijn er een paar tientallen, geen gat in de breedte.

**Voorgesteld**:

1. Een vaste "klassiekers"-plek op pagina 2: twee of drie bekende activiteiten (bowlen, tennis, een wandelgroep, een museum) naast de activiteiten die bij de beelden passen, of een zoekveld "Mis je iets? Typ het hier". Dat lost het gevoel op zonder de bibliotheek te vergroten.
2. De gaten hierboven toevoegen (±18 activiteiten). Met `image_pending` zijn ze onzichtbaar tot ze een foto hebben; twee vellen van 3×3 kosten ongeveer $0,27.
3. De 70 activiteiten die nooit in een boek komen nakijken: te smal, te abstract of te weinig gekoppeld.

## 3. Controle met het nieuwe prompt (16 nov 2026, één echte run, $0,305)

Dezelfde invoer als het boek van 15 november (Wernigerode, 15 km, dezelfde zeven eigen keuzes), alleen het onderzoek, zonder Googlescore, met het nieuwe prompt en de nieuwe dekkingsronde. Jan koos voor één run (geen oude-tegen-nieuwe-vergelijking); de oude cijfers komen uit het opgeslagen boek.

| | Boek 15 nov (oud prompt) | Controle (nieuw prompt) |
|---|---|---|
| Kosten onderzoek | $0,286 (boek $0,361) | $0,305 |
| Activiteiten onderzocht / met plek | 15 / 3 | 20 / 8 |
| Ideeën in het boek | 4 (3 + wildcard) | 5 |
| Ideeën met een plek | 3 | 4 |
| Eigen keuze `monumenten` | geen plek | Schloss Wernigerode |
| `oude-kaart-wandeling` | geen plek | Stadtführung "1000 Schritte rund um's Rathaus" |
| `ballroom` | n.v.t. | Tanzschule Kastern, Pure Dance Academy |

Eerlijk: één run is een aanwijzing, het web geeft niet elke keer hetzelfde terug. De vondstkans per onderzocht idee ging van 20% naar 40%, en een eigen keuze die eerst niets opleverde (`monumenten`, een stad vol monumenten) vindt nu een kasteel. Dat past bij Duitse zoektermen. Het vijfde idee (`architectuur`) bleef zonder plek: de dekkingsronde koos een vervanger waarvan de enige plek al bij het stadswandelingidee hoorde, waarna die plek terecht verviel (één plek, één idee). Dat is hersteld: een vervanger wordt nu alleen gekozen als hij een plek heeft die nog bij geen ander idee van het boek hoort. Daarna zijn de extra rondes wegens het kostenplafond ($0,40) niet meer uitgevoerd (`cost_cap_skipped:broad`); dat ene idee staat dus als "eerst uitzoeken" in het boek. Dat dit hersteld is, is niet opnieuw met een echte run gemeten.

## 4. Nieuwe activiteiten (Jan: "ja" op punt 3)

Achttien activiteiten uit de gaten hierboven zijn toegevoegd, met foto (twee vellen 3×3 bij Gemini, ≈ $0,27 binnen het goedgekeurde bedrag): `pretpark`, `kermis`, `brunchen`, `zaalvoetbal`, `wielrennen`, `e-bike-tocht`, `windsurfen`, `triatlon`, `tafelvoetbal`, `hardloopgroep`, `zelfpluktuin`, `zwemparadijs`, `rommelmarkt`, `uitkijktoren`, `bollenvelden`, `pickleball`, `kegelen`, `kerstmarkt`. Bibliotheek 756 → 774. Elk met seizoen waar dat telt (kermis maart-oktober, kerstmarkt november-december, bollenvelden april-mei, ...), een stijlregister, Nederlandse zoektermen en status `concept`. De foto's tonen geen mensen; op de kermisfoto staat een lichtbord "POPCORN" en op de hardloopfoto een banner "START" (leesbare tekst, zoals eerder zonder tekst bedoeld was; opnieuw maken kost ≈ $0,27).
