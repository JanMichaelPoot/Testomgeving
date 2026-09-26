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
| Niet filterbaar | Rolstoeltoegankelijk, hondvriendelijk, dieet of allergie, alcohol, kinderen: geen data in de bibliotheek, dus elk zaad krijgt een `verify`-vlag zodat het niet verloren gaat. De generatie behandelt de vrije tekst al als harde eis. |

Tijd en zoekafstand zijn bewust géén harde filters: de duur in de bibliotheek is een typische
sessielengte en veel hobby's zijn "doorlopend", dus dat zou te veel wegfilteren.

## Diversiteit en herhaling

- Maximaal twee ideeën per wereld en niet twee uit één subdomein. Liever een zwakkere verbinding
  dan een derde idee uit dezelfde wereld (`firstFit`).
- Thema's stapelen niet: een idee dat zijn bruggen deelt met al gekozen ideeën scoort lager
  (vier wandelingen achter elkaar is geen spreiding).
- **Herhaling**: wat de bezoeker in de laatste twee sessies zag (`history`) komt niet terug,
  behalve wat hij of zij opnieuw kiest. De geschiedenis komt uit het optionele apparaatgeheugen
  (zie hieronder); zonder geheugen is `history` leeg.
- De wildcard heeft een voorkeur voor werelden die de bezoeker nog nooit zag.

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
- Gewichten en drempels staan bovenaan `select.ts` en `graph.ts` (`BRIDGE_MIN`, de banden voor
  "aangrenzend", `target` voor stretch).
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
