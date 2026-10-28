# De discovery-bibliotheek uitbreiden

De bibliotheek is de lijst met concrete activiteiten waaruit de visuele profielwizard
zijn kaarten toont en de associatiemotor zijn ideeën kiest. Ze is gemaakt om **flink te
groeien**: alles is gewone data (JSON) en niets in de code hoeft te veranderen als je
activiteiten, tags of zelfs een heel nieuw domein toevoegt.

## Waar staat wat

| Bestand | Inhoud |
|---|---|
| `src/lib/discovery/vocabulary.json` | Domeinen (met kleur), subdomeinen en tags, allemaal met NL- en EN-labels |
| `src/lib/discovery/data/<domein>.json` | De activiteiten van één domein |
| `src/lib/discovery/hybrids.json` | Gecureerde combinaties van twee activiteiten uit verre domeinen |
| `src/lib/discovery/types.ts` | De typen en uitleg per kenmerk |
| `src/lib/discovery/library.ts` | Laadt alles; `getActivities()`, `getActivity(id)`, `activityImage(id)` |
| `src/lib/discovery/validate.ts` | De regels waaraan de bibliotheek moet voldoen |
| `public/illustrations/discovery/` | Kaartfoto's, `<id>.jpg` per activiteit en `domains/<domein>.jpg` |

## Een activiteit toevoegen

Voeg een object toe aan het juiste `data/<domein>.json`:

```json
{
  "id": "kalligrafie-workshop",
  "domain": "creative",
  "sub": "textile_paper",
  "label": { "nl": "Kalligrafie", "en": "Calligraphy" },
  "tags": ["precision", "language", "craft"],
  "formats": ["solo", "drop_in_alone", "small_group"],
  "intensity": 0,
  "level": 0,
  "cost": 2,
  "duration": 2,
  "setting": "indoor",
  "safety": { "tier": 0 },
  "entry": { "nl": "Halve-dag-workshop, alles inbegrepen", "en": "Half-day workshop, everything included" },
  "scene": "a calligraphy pen, an ink pot and a sheet with flowing lettering on a wooden desk",
  "status": "concept"
}
```

Regels om te onthouden:

- **`id`** is een stabiele sleutel (kleine letters, cijfers, streepjes). **Hernoem hem nooit**: opgeslagen profielen en straks de herhalingsbescherming verwijzen ernaar. Wil je iets weghalen, zet `"status": "retired"`: het verdwijnt uit nieuwe sessies maar blijft vindbaar.
- **`tags`**: 2 tot 5, altijd uit `vocabulary.json`, en minstens één die niet `generic` is. Tags zijn de bruggen tussen activiteiten; kies wat het écht gemeen heeft met andere activiteiten (precisie, verhaal, water), niet een stemming.
- **Onbekend is `null`**, geen gok. Weet je de kosten niet, zet `"cost": null`. De motor sluit dan niets uit en laat het onderzoek per boek het lokaal controleren.
- **`formats`**: alle sociale vormen die écht kunnen, zonder rangorde. `drop_in_alone` betekent "alleen komen, samen doen".
- **`safety.tier` 2** (alleen onder gekwalificeerd toezicht) vraagt een `note` met de legale, begeleide instap.
- **`entry`**: de laagdrempelige eerste stap (proefles, beginnersavond, open dag).
- **`months`** (optioneel): de maanden (1-12) waarin een beginner dit in Nederland echt kan doen, bijvoorbeeld `[6, 7, 8, 9]` voor zwemmen in open water of `[10, 11, 12, 1, 2, 3]` voor schaatsen. Laat het weg als het het hele jaar kan of er geen duidelijk seizoen is: zet het alleen als een activiteit buiten die maanden niet realistisch is. De motor stelt een activiteit buiten zijn maanden nooit voor (ook niet als iemand hem zelf koos), en de kaartenwizard en de voorbeelden onder de richtingen tonen hem dan ook niet. De validatie eist een niet-lege lijst van verschillende maanden 1-12.
- **`supply`** (optioneel, standaard `common`): hoe makkelijk je dit in Nederland bij een aanbieder in de buurt vindt. `common` kan bijna iedereen morgen beginnen (een wandeling, schrijven); `regional` vraagt een club, studio of school binnen bereik (glasblazen, schietles); `rare` bestaat maar op een paar plekken of in het buitenland (grotduiken, paragliden, canyoning). De motor stelt `regional` en vooral `rare` iets minder snel voor, en de generatie stelt een idee met `regional` of `rare` alleen voor als het onderzoek echt een aanbieder binnen bereik vond: anders wordt het één keer vervangen. Wie zelf een `rare` activiteit koos, krijgt hem niet minder snel.
- **`scene`**: Engelse beeldomschrijving voor de foto. **Geen mensen of gezichten** (de validatie weigert het). Beschrijf één duidelijk onderwerp.
- **`status`**: start als `concept`. Zet op `reviewed` als iemand het heeft gecontroleerd, `live` als het voor iedereen mag.

## Een nieuwe tag, subdomein of domein toevoegen

- **Tag of subdomein**: eerst toevoegen in `vocabulary.json` (met `nl` en `en`), dan gebruiken.
- **Nieuw domein**: (1) voeg het toe aan `vocabulary.json` met kleur (`#RRGGBB`), `colorName` en `scene`; (2) maak `data/<domein>.json`; (3) voeg **één importregel** toe in `src/lib/discovery/library.ts`. De test `library.test.ts` faalt als je stap 3 vergeet.

## Controleren

```bash
npm run taxonomy:check     # regels controleren (fouten stoppen, waarschuwingen zijn advies)
npm run taxonomy:report    # dekking per domein, sociale vorm, tag; toont waar het dun is
npm test                   # draait dezelfde controle als onderdeel van de testsuite
```

Waarschuwingen gaan over balans (een domein onder de 10 items of boven de 15%, een tag die
maar één keer gebruikt wordt). Ze blokkeren niets, zodat je ongelijkmatig kunt uitbreiden.

## Foto's maken

```bash
npm run taxonomy:images                         # alleen wat nog ontbreekt
npx tsx scripts/generate-discovery-illustrations.ts --only kalligrafie-workshop
npx tsx scripts/generate-discovery-illustrations.ts --domain creative
npx tsx scripts/generate-discovery-illustrations.ts --limit 10   # testbatch
npx tsx scripts/generate-discovery-illustrations.ts --force --only yoga  # opnieuw maken
npx tsx scripts/generate-discovery-illustrations.ts --sheet 2x2 --limit 1  # goedkoper: 4 foto's per gegenereerd beeld
```

**Goedkoper via vellen (`--sheet 2x2` of `3x3`)**: Gemini rekent per gegenereerd beeld, niet per
pixel ($0,134, 1K en 2K gelijk). Het script laat dan één 2K-beeld maken met een raster van 4 of 9
losse foto's en knipt dat in stukken (`src/lib/discovery/sheetSlicer.ts`; het raster wordt
gezocht, niet aangenomen). 2x2 geeft tegels van ~1000 px (even scherp als losse foto's), 3x3 ~680 px
(nog goedkoper, iets zachter). Faalt het knippen of blijft een rest over, dan valt het script terug op
losse foto's. Test eerst met `--limit 1` en bekijk het resultaat.

Het script stopt bij de eerste betaal- of limietfout van Gemini (402 of 429) in plaats van te
blijven proberen; controleer dan de billing in Google AI Studio en draai het opnieuw, het gaat
verder met alleen wat ontbreekt.

Het script is **idempotent**: na het toevoegen van nieuwe activiteiten maakt het alleen de
ontbrekende foto's. Elk domein heeft één accentkleur (`color` in `vocabulary.json`) die in
de foto's van dat domein terugkomt; dat maakt de kaarten herkenbaar en houdt de site levendig.
Wil je een domeinkleur wijzigen, pas `color`/`colorName` aan en maak de foto's van dat domein
opnieuw (`--domain <id> --force`). Kosten per foto zijn niet gemeten; een batch van 200 duurde
ruim een kwartier.

## Kwaliteitsstatus

Alles staat nu op `concept`: de kenmerken zijn een eerste, door mij opgestelde inschatting,
nog niet getoetst door kenners of gebruikers. Zie het ontwerprapport voor de reviewaanpak.

## Meer activiteiten bedenken: eerst divergeren, dan convergeren

Zo is de bibliotheek in oktober 2026 van 214 naar 423 activiteiten gegroeid (acht nieuwe richtingen). Gebruik hetzelfde werkwoord voor uitbreiden:

1. **Divergeren**: bedenk per richting veel meer kandidaten dan je wilt houden, langs vaste lenzen: werkwoord x omgeving x sociale vorm x intensiteit, "wat doen mensen voor de kick", "wat is stiekem toegankelijk", "wat kun je een middag proberen", "wat doet een buurland dat wij hier ook kunnen". Dit is goedkoop (één batch per richting) en niet op kwaliteit gefilterd.
2. **Convergeren** met vaste filters, in deze volgorde: dubbelingen en bijna-dubbelingen eruit (zelfde tags en subgroep); bestaat het aanbod in Nederland of binnen een reisafstand (`supply`)?; toezicht en wet (`tier 2` met een `note`: alleen de begeleide, legale weg); seizoen (`months`); is het te fotograferen zonder mensen of wapens; en zegt het iets nieuws (een tagmix die de bibliotheek nog mist).
3. **Beoordelen** in de reviewgalerij, en pas daarna beelden maken (`npm run taxonomy:images -- --sheet 3x3`: negen foto's voor de prijs van één).

Nieuwe richtingen, subgroepen en tags staan in `vocabulary.json`; een nieuwe subgroep heeft ook een regel in `engine/photo.ts` nodig (welke fotocategorie het boek erbij toont).

## Kennismodel en import van een bron (B2 en B3)

Een activiteit kan, naast de gewone velden, vier optionele velden hebben (`src/lib/discovery/types.ts`, gevalideerd door `taxonomy:check`):

| Veld | Wat | Regel |
|---|---|---|
| `aliases {nl[], en[]}` | andere namen die mensen gebruiken | alleen voor het vinden van dubbelen en het koppelen van een import, nooit getoond; een alias mag niet de naam of alias van een andere activiteit zijn (vergeleken per taal, na normaliseren) |
| `provenance {source_id, method, source_record_id?, last_verified_at?}` | waar het record vandaan komt als het niet van ons is | `method` is `curated`, `source` of `inferred_ai`; `source` vraagt een `source_record_id`; geen veld = door ons geschreven; `inferred_ai` is een suggestie, geen feit |
| `source_links [{source_id, source_record_id}]` | externe records waarmee deze activiteit is samengevoegd | één extern record hoort bij precies één activiteit; een gekoppeld record wordt niet opnieuw geïmporteerd |
| `reviewed_by {by, at}` | wie het controleerde en wanneer | verplicht zodra `status` `reviewed` of `live` is |

Onbekend blijft `null` (nooit `0`, `false` of een tekst als "unknown"); een test controleert dat.

**Een bron importeren** (`scripts/knowledge/import.ts`, logica in `src/lib/knowledge/`, nu alleen S3 = Wikidata):

```bash
npx tsx scripts/knowledge/import.ts --source S3                  # proef: alleen aantallen, schrijft niets
npx tsx scripts/knowledge/import.ts --source S3 --write          # staging, reviewwachtrij, logboek en rapport
npx tsx scripts/knowledge/import.ts --source S3 --write --apply  # schrijft ook de samenvoegingen (koppeling + bijnamen) in de bibliotheek
```

De ruwe bron staat niet in git (`data/sources/raw/S3/hobby.json`; zie `docs/knowledge-sources.md`). Wat er gebeurt: een record wordt alleen **automatisch** samengevoegd bij een gelijke genormaliseerde naam in dezelfde taal (label of alias); gedeelde woorden leiden alleen tot een kandidaat voor een mens ("schaken" is niet "correspondentieschaak"). Wat overblijft gaat naar `data/knowledge/review-queue.json` (maximaal 80, `--queue-cap`), wat de regels afwijzen (onveilig, vakterm, te algemeen, geen label) of wat onder de grens valt staat met een reden in `docs/knowledge/import-S3.md`. **Niets wordt zomaar een activiteit**: een nieuwe activiteit schrijf je zelf (tags, kenmerken, scène, NL-label) en begint op `concept`. Beslissingen zet je in de wachtrij in `decision`: `"accept"`, `"reject"` of `"merge:<activiteit-id>"`; een volgende run bewaart ze. Voorstellen van de lezer van de bron staan in `data/knowledge/proposals/<bron>.json` (accept, unsure, merge, reject, op genormaliseerd Engels label) en zijn geen beslissingen. Twee keer draaien geeft dezelfde bestanden.
