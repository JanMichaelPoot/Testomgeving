# De selectiemotor (fase 3)

`src/lib/discovery/engine/` kiest uit de bibliotheek de zeven **zaden** voor een Idea Book: zes
gewone ideeën plus een wildcard. Een zaad is een activiteit, met een richting, een redenering en
een sociale vorm. De motor is **deterministisch en maakt geen AI-aanroep**. Claude schrijft later
alleen de tekst rond de zaden (fase 4). Nog niet aangesloten op de generatie: fase 3 levert de
motor, de tests en de evaluatie.

## Wat er uit komt

Per zaad (`Seed`): `activityId`, `direction`, `door` (natural, discovery, unexpected, stretch of
wildcard, zodat de bestaande Idea Book-structuur blijft passen), `chain` (het pad van jouw keuze
naar dit idee, om uit te leggen waarom), `via` (de bruggen), optioneel `hybrid` (een gecureerde
combinatie), `lead` (de sociale vorm waar mee geopend wordt: jouw eigen keuze), `alsoFormats` en
`verify` (wat het onderzoek moet controleren, bijvoorbeeld onbekende kosten).

## De vijf richtingen

| Richting | Aantal | Deur | Herkomst |
|---|---|---|---|
| familiar (vertrouwd) | 2 | natural | Een gekozen activiteit zelf, of een directe buur. Bij keuzes uit meerdere werelden liefst uit twee verschillende. |
| unexpected (onverwacht) | 1 | unexpected | Een gecureerde combinatie waarvan jij één helft koos, of een keten keuze → tussenstap → ver idee, elke stap met een echte brug. |
| adjacent (aangrenzend) | 2 | discovery | Niet gekozen, wel een echte brug met een keuze en tamelijk verwant; liefst uit een wereld die je niet koos. |
| stretch | 1 | stretch | Eén kenmerk dat jij niet vastlegde gaat omhoog (binnen ↔ buiten, intensiteit, niveau, duur, een nieuwe vorm). Nooit de sociale vorm als je die koos. De sterkte volgt de wildheidsschuif. |
| wildcard | 1 | wildcard | Een toevallige prikkel uit een wereld die je niet koos. Toeval bepaalt *welke*, niet *of het past*: alles moet door de harde filters. |

Zonder keuzes ("Verras me" of overslaan) volgt een brede spreiding: zes ideeën uit zes werelden,
met deuren naar hoe veeleisend ze zijn (de mildste eerst), plus een wildcard. Met alleen gekozen
werelden staan twee willekeurige activiteiten per wereld model voor je smaak.

## Harde filters (`constraints.ts`)

Een activiteit valt alleen af op een **bekend** conflict. Onbekend (`null`) laat door en wordt een
`verify`-vlag voor het onderzoek.

| Bron | Filter |
|---|---|
| Budgetschuif | Gratis → kosten 0; tot €25 → ≤ 1; tot €100 → ≤ 2; all-in → geen grens. "Gratis" in de vrije tekst maakt het altijd 0. |
| Inspanning | Zo min mogelijk → intensiteit ≤ 1; een beetje → ≤ 2; volledig → alles. |
| Wildheid | "Voorspelbaar" of "praktisch": activiteiten met toezichtsplicht (tier 2) verdwijnen. |
| Sociale vorm | Alleen een **expliciete** keuze filtert: de activiteit moet minstens één gekozen vorm ondersteunen. "Maakt niet uit" en "hangt van de dag af" leggen niets op. |
| Grenzen (vrije tekst) | Alleen wat betrouwbaar leesbaar is: één duidelijke wens voor buiten of binnen, "geen groepen", "gratis". Onduidelijk of tegenstrijdig ("buiten of binnen") wordt genegeerd in plaats van gegokt. |
| Seizoen | Een activiteit met `months` die de maand van de vraag niet bevat valt af, ook als de persoon hem koos. De maand is die van Nederland op het moment van genereren (`season.ts`); zonder maand (oudere aanroepen en tests) wordt niet op seizoen gefilterd. |
| Geen echt aanbod | Een activiteit waar je iemands aanbod voor nodig hebt (kosten, of toezicht) en waarvoor het onderzoek niets verifieerbaars vond, wordt één keer vervangen (`exclude`); zie hieronder. |
| Niet filterbaar | Rolstoeltoegankelijk, hondvriendelijk, dieet of allergie, alcohol, kinderen: geen data in de bibliotheek, dus elk zaad krijgt een `verify`-vlag zodat het niet verloren gaat. De generatie behandelt de vrije tekst al als harde eis. |

Tijd en zoekafstand zijn bewust géén harde filters: de duur in de bibliotheek is een typische
sessielengte en veel hobby's zijn "doorlopend", dus dat zou te veel wegfilteren.

## Echt en van dit moment

Twee dingen moeten kloppen: wat wordt voorgesteld **bestaat** en is **nu** te doen.

- **Seizoen in de selectie**: zie de tabel hierboven. De prompts (onderzoek en schrijven) krijgen bovendien de datum van vandaag en de regel dat alles realistisch moet zijn voor die datum en de weken erna.
- **Onderzoek**: vraagt alleen wat de komende vier weken kan (niet gesloten voor het seizoen, geen verlopen evenement), met een einddatum (`until`) waar de bron die geeft. Het cachesleutel bevat de maand, en een cachevermelding leeft nooit langer dan de einddatum van een optie.
- **Bestaat het?** Elke website uit het onderzoek wordt voor het opslaan met een gratis HTTP-controle bekeken (`verifyUrls.ts`): een host die niet bestaat, of geen openbare website is, laat de optie vallen; een verdwenen pagina op een bestaande site wordt de voorpagina; een time-out, 403 of 429 telt niet als bewijs van het tegendeel.
- **Geen aanbod gevonden**: voor een idee dat aanbod nodig heeft en waar het onderzoek echt niets vond, vraagt de pijplijn de motor één keer om een vervanger en onderzoekt alleen de nieuwe activiteiten (de rest wordt meegegeven). Doet de vervanging het niet beter, dan blijft de eerste selectie, met een notitie `no_local_offer:<id>` in het rapport. Een mislukte onderzoeksronde (storing) telt niet als "geen aanbod".

## Diversiteit en herhaling

- Maximaal twee ideeën per wereld en niet twee uit één subdomein. Liever een zwakkere verbinding
  dan een derde idee uit dezelfde wereld (`firstFit`).
- Thema's stapelen niet: een idee dat zijn bruggen deelt met al gekozen ideeën scoort lager
  (vier wandelingen achter elkaar is geen spreiding).
- **Herhaling**: wat de bezoeker in de laatste twee sessies zag (`history`) komt niet terug,
  behalve wat hij of zij opnieuw kiest. De geschiedenis komt uit het optionele apparaatgeheugen
  (zie hieronder); zonder geheugen is `history` leeg.
- De wildcard heeft een voorkeur voor werelden die de bezoeker nog nooit zag.

## Variatie: de lange staart (okt. 2026)

Gemeten op dezelfde synthetische profielen (300 per soort) kwamen dezelfde paar activiteiten steeds terug: bij de beeld-intake stond "een lange wandeling" in 22% van de boeken en de tien populairste activiteiten namen 20% van alle plekken in. Drie dingen veranderden dat, zonder de harde regels te raken:

- **Zeldzaamheid** (`Graph.rarity`): hoe ver een activiteit buiten de gangbare tagmix valt (0 = opgebouwd uit de meest gebruikte tags, 1 = uit zeldzame). Elke richting krijgt een kleine bonus voor zeldzaam (`RARE` in `select.ts`; de wildcard het sterkst), de eigen keuzes van de bezoeker nooit.
- **Aanbod** (`supply`, `supplyPenalty`): `rare` krijgt een kleine straf (0,18), `regional` een heel kleine (0,04), want ze kosten een extra onderzoeksronde als er niets in de buurt is. Zie ook de vervangronde in `generateFromSeeds.ts`.
- **Interesses uit de beelden** (`associations.ts`): een tag die de helft van de bibliotheek draagt (buiten, natuur) telt minder zwaar (`tagIdf`), zeldzame mixen krijgen een lift (`RARITY_LIFT`), en de willekeur tussen bijna gelijke scores is groter (`JITTER`).

De zeldzaamheid weegt per bezoeker (seed) een beetje anders, zodat dezelfde paar zeldzame activiteiten niet de nieuwe hubs worden. Resultaat op de beeld-intake (nu ook met de nieuwe richtingen): de populairste activiteit in 11% van de boeken (was 22%), de top 10 neemt 12,3% van de plekken in (was 20,0%), 6,1 richtingen per boek (was 5,8), en 366 van 423 activiteiten komen voor. Restant: "sjoelen" (11%) en "wandelen" (11%) blijven vaak komen omdat veel profielen hun tags raken. Opnieuw meten: `npx tsx scripts/discovery-variety.ts 300`; de test "spreads over the library" in `engine.test.ts` bewaakt het minimum.

## Ranking in stappen (B4, achter `KNOWLEDGE_ENGINE_V2`)

Alle getallen die de selectie sturen staan in `engine/weights.ts`, met een uitleg per getal. Er zijn twee sets: `WEIGHTS_CURRENT` (precies wat vóór B4 draaide; een test legt de seeds ervan vast) en `WEIGHTS_V2` (alleen met de vlag aan, en in het harnas als engine `v2`). Een hoge score koopt nooit een harde grens terug: de harde regels staan in `constraints.ts` en zijn geen gewicht.

| Stap | Wat | Waar |
|---|---|---|
| 1 Kandidaten | de pool: alles wat door de filters komt, plus buurdomeinen | `select.ts` (pool) |
| 2 Harde grenzen | `passesConstraints`; met `strictFreeCost` komt een onbekende prijs niet meer door een gratis budget | `constraints.ts` |
| 3 Relevantie | tag-overlap, werelden, associaties | bestaand |
| 4 Nieuwheid en diversiteit | de straf voor gedeelde bruggen, plus `sharedPairPenalty`: een idee dat twee of meer echte tags deelt met een al gekozen idee is een variatie daarop | `redundancy()` |
| 5 Deur-fit | bestaande deurlogica | ongewijzigd |
| 6 Uitleg | per zaad `fit` (gemeten relevantie, 0..1; 1 = eigen keuze, 0,5 = niets om mee te vergelijken) en `reasons[]` (`picked`, `bridge:…`, `chain:…`, `new_world`, `verify:…`) | `commit()` |

**"Als je er maar één kiest"** gebruikt bij boeken met een `fit` die gemeten fit (0,32) naast haalbaarheid (0,30), nieuwheid (0,19) en verrassing (0,19) in plaats van de constanten per richting (`possibilityMap.ts`). Boeken zonder `fit` (oude boeken, de klassieke pijplijn, vlag uit) blijven zoals ze waren. Let op: de verdeling over de deuren is gevoelig voor deze gewichten (0,02 meer op `fit` verschuift het aandeel onverwacht met ± 10 punten); meet opnieuw na elke wijziging.

Niet gewijzigd: het facet `niveau` (402 van 423 activiteiten staan op 0; dat is een bibliotheekkwestie, geen gewicht) en de graaf en deurlogica zelf.

## Bruggen

`graph.ts`: een brug telt zwaarder als de tag zeldzamer is (`ln(N / gebruik)`), en
stemmingstags (focus, gezelligheid, ontdekken, leren, stilte, maken, precisie) tellen nooit als
brug. Een verbinding is "echt" vanaf `BRIDGE_MIN = 2.0`. Zo ontstaat het voorbeeld van het
prototype niet meer: "rollenspel → koor via gezelligheid".

## Uitvoeren en controleren

```bash
npx tsx scripts/discovery-shadow.ts                 # 200 synthetische profielen, samenvatting
npx tsx scripts/discovery-shadow.ts --n 500 --seed abc --show 5   # meer profielen + voorbeeldresultaten
npx tsx scripts/discovery-baseline.ts                # hoe divers is de huidige generatie (zonder motor)?
npm test                                             # de acceptatiecriteria E1-E8 als regressietest
```

`syntheticProfiles` maakt zeven soorten bezoekers (niche, breed, weinig keuzes, alleen werelden,
"verras me", niets gekozen, sterk beperkt) met willekeurige schuiven, sociale keuzes en grenzen.
`evaluate` meet E1 (harde eisen, opnieuw uitgeschreven uit de invoer zodat een fout in de motor
zichzelf niet kan verbergen), E3 (herhaling over drie opeenvolgende sessies), E4 (precies één
wildcard), E5 (sociale keuze gerespecteerd én voorop), E6 (toezichtsplicht), E2 en E8.

## Afstellen

- Te weinig variatie in een bepaald soort boek? Kijk eerst met `--show` naar de ketens
  (`chain`/`via`); zwakke verbindingen los je meestal op met betere tags in de bibliotheek, niet in
  de motor.
- Gewichten staan in `engine/weights.ts` (zie "Ranking in stappen"); drempels in `graph.ts`
  (`BRIDGE_MIN`) en de banden voor "aangrenzend" en `target` voor stretch in `select.ts`/`weights.ts`.
- Na elke wijziging: `npm test`. De regressietest draait op twee vaste reeksen van 200 profielen.

## Bekende beperkingen

- **Aanbod is niet bekend.** De motor weet niet of er in jouw stad een LARP-groep is; het onderzoek
  per boek controleert dat, en een zaad zonder gevonden aanbod moet in fase 4 terugvallen op een
  verwant zaad.
- **Hubs.** Activiteiten die goedkoop, solo en met veel bruggen zijn (Creatief schrijven, Raadsels)
  komen vaker voor, vooral bij sterk beperkte profielen. Dat verdwijnt pas met een grotere
  bibliotheek of een dempende factor op basis van gebruik over alle bezoekers.
- **Stretch is soms mild.** Bij een sterk beperkt profiel (weinig inspanning, alleen solo) zijn er
  weinig manieren om iets "meer" te maken; dan wordt de zoekruimte stapsgewijs verruimd
  (`direction_relaxed:stretch`, zie de evaluatie).
- **Tijd en afstand tellen niet mee** in de selectie (zie hierboven).
- **Alles is concept.** De kenmerken in de bibliotheek zijn nog niet door kenners getoetst; de motor
  is zo goed als zijn data.

## Herhalingsgeheugen (opt-in) en keuzes wijzigen (fase 5)

**Herhalingsgeheugen.** Alleen na een expliciete keuze op de betaalpagina (schakelaar, standaard
uit): er komt een willekeurige apparaatcode in een first-party cookie (`window_device_id`,
httpOnly, 12 maanden). In de database staat alleen de SHA-256 daarvan, nooit de code zelf en nooit
een e-mailadres (`discovery_history`, migratie 0015). De rij wordt bij het afrekenen aangemaakt
(de generatie draait later zonder toegang tot cookies), na de generatie vult
`recordShown` de `activity_id`'s van het boek in, en de volgende generatie voor hetzelfde apparaat
leest via `loadShownBefore` wat de laatste twee boeken toonden en geeft dat als `history` aan de
motor. Een betaald boek zonder ideeën telt niet als sessie. Rijen ouder dan 12 maanden worden bij
elke schrijfactie verwijderd. Uitzetten (schakelaar) of "Vergeet dit apparaat" (privacypagina)
verwijdert alle rijen van het apparaat en het cookie. Alles is best effort: ontbreekt de tabel of
faalt een query, dan wordt het boek gewoon zonder geheugen gemaakt. Code: `discovery/history.ts`
(zuivere hulpfuncties), `discovery/historyStore.ts` (cookie + database).

**Keuzes wijzigen vóór betaling.** De betaalpagina toont "Jouw keuzes", per wizardpagina gegroepeerd
(`checkoutChoices.ts`), elk met een link `/intake?edit=1&page=N`. De wizard start dan met de
opgeslagen antwoorden en de variant waarin ze gegeven zijn; opnieuw versturen vervangt de
antwoorden **in dezelfde sessie** (`replaceIntake`), dus geen dubbele sessies en de betaalpagina,
Stripe-metadata en het geheugen blijven naar één sessie wijzen. Wijzigen kan tot het boek wordt
gemaakt of de bestelling betaald is (`isSessionLocked`); daarna start opnieuw versturen een nieuwe
sessie zodat niemand zijn invoer kwijtraakt. Wijzigen ná betaling (bijv. één gratis herbouw) is
bewust niet gebouwd: dat hangt samen met de prijsstrategie.

## De beeld-intake ("Het venster", okt. 2026)

De derde wizardvariant (`associations`) vraagt geen activiteiten maar **associatiebeelden**: 27
kaarten in drie rondes (plekken, momenten, zintuigen; `src/lib/discovery/associations.json`). Een
kaart heeft 2-5 `tagWeights` uit `vocabulary.json` en vier assen (`social`, `energy`, `setting`,
`novelty`, elk -1..1). `applyImageIntake` (`discovery/imageIntake.ts`) vertaalt bij het versturen,
één keer, wat de motor al begrijpt:

- **interesses**: `associationsToEngineInput` scoort elke activiteit die door de harde filters komt
  op gewogen tag-overlap met het tagprofiel van de gekozen beelden (generieke tags tellen half),
  plus een bonus voor gekozen werelden, plus hoe goed de activiteit op de assen past (sociale vorm,
  intensiteit, binnen/buiten). Zes stuks, één per wereld, nooit twee uit één subdomein; een kleine
  gezaaide ruis voorkomt dat dezelfde beelden altijd dezelfde activiteiten geven. Gemeten met
  `scripts/discovery-shadow.ts --profile associations --n 500`: E1-E6 0 overtredingen, 5,8 werelden
  per boek (gelijk aan de kaartenwizard).
- **`practicalToWild`** uit de `novelty`-as en **`effort`** uit de `energy`-as (de vraag-audit liet
  zien dat beide de motor hard sturen, dus ze mogen niet op een standaardwaarde blijven staan).
- Niet gevraagd en dus leeg: `purposeFollowUp`, `freeTimePattern`, `situation`. De prompt leest
  lege velden als "not stated".

"Niet helemaal" op het beloningsscherm voegt tags toe (`associationCorrections`, gewicht 2,5) die
ook als `preferences` meegaan. `imagesBehind` vindt per idee het gekozen beeld met de meeste overlap,
voor de regel "Omdat je X koos" in de prompt, op `/plan` en in de PDF.

**Leeftijd** stuurt sinds fase 1.5 ook de keuze (`agePenalty` in `engine/select.ts`): een zachte
weging op intensiteit, veiligheidsniveau, niveau, sociale vorm en kosten voor 18-24, 55-64, 65+ en
onder 18. Nooit een uitsluiting: wie zelf iets zwaars kiest, krijgt het nog steeds.
`--ages` in het shadow-script toont de verschuiving per leeftijdsgroep.

## De zeven ontdekkingsniveaus (Fase 3, okt. 2026)

Elk zaad krijgt een `level` van 1 tot 7 (`engine/levels.ts`, namen in `src/lib/discoveryLevels.ts`). Een niveau ordent de aanbevelingen van "het dichtst bij wat je koos" tot "het nieuwst"; het is geen stap en geen pagina. De zeven zaden (2 vertrouwd, 2 aangrenzend, 1 onverwacht, 1 stretch, 1 wildcard) vallen één op één op de zeven niveaus:

| Niveau | Naam | Welk zaad |
|---|---|---|
| 1 | Vertrouwd | van de twee vertrouwde ideeën het minst praktische |
| 2 | Praktisch | van de twee vertrouwde ideeën het praktischste |
| 3 | Verwant | van de twee aangrenzende ideeën het best passende (`fit`, anders de volgorde van kiezen) |
| 4 | Inspirerend | de andere aangrenzende |
| 5 | Verrassend | onverwacht |
| 6 | Uitdagend | stretch |
| 7 | Onontdekt | wildcard |

Heeft een groep minder zaden dan niveaus (een krappe pool), dan blijft het hogere niveau leeg in plaats van dat een zaad in een niveau valt waar het niet bij hoort; een groep met meer zaden (de aanvulstap) zet de extra's op het hoogste niveau van die groep. Zonder keuzes (verkennen) krijgen de zes gewone zaden, op volgorde van hoe veeleisend ze zijn, de niveaus 1 tot 6.

**Praktisch** is afgeleid, niet opgeslagen: `practicality(activiteit)` (0 tot 1) weegt kosten, duur, niveau, toezicht, aanbod, of je het alleen kunt doen en of er een instap is; een onbekend feit telt als middelmatig, nooit als gunstig. Met `WEIGHTS_V2` (`familiar.practicalBonus` 0,3) leunt het tweede vertrouwde slot daarnaast naar wat het makkelijkst te starten is; met `WEIGHTS_CURRENT` verandert de selectie niet (alleen het etiket), zodat de baseline van de 20 profielen hetzelfde blijft behalve door de grotere bibliotheek. De profieldimensies richting, plek, moment en zintuig worden niet apart opgeslagen: richting is de gekozen wereld, de rest is de ronde waarin een beeld zit (`kind` in het venster), met de tags van de beelden als spectrum.

**Gratis is geen filter meer**: een getypt "gratis" in de vrije tekst beperkt de kosten niet meer (`parseMustHaves` leest het niet; de tekst gaat nog wel als wens naar de schrijver). Het budget bepaalt de kostengrens. Alleen een oude opgeslagen budgetwaarde `free` (de wizard biedt hem niet meer aan) werkt nog als klasse 0.

Het harnas meldt "boeken waarin alle 7 niveaus voorkomen" en de uitvoerbaarheid van niveau 1 en 2 (`docs/eval/`).
