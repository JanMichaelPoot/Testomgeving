# Evaluatieharnas (kennisengine, B1)

Het harnas vergelijkt versies van de selectie- en generatiemotor op **dezelfde invoer**, zodat een verbetering een meting is en geen mening. Het hoort bij `WINDOW_Bouwopdracht_Kennisengine.md` (stage B1) en `docs/knowledge-engine-audit.md` (de nulmeting).

## Onderdelen

| Wat | Waar |
|---|---|
| 20 vaste profielen (JSON, 17 beeld-intake, 3 kaartenwizard, 4 randgevallen, 2 cadeaus) | `scripts/eval/profiles/P01.json` … `P20.json` |
| Opdrachtregel | `scripts/eval/run.ts` |
| Blinde A/B-sheet | `scripts/eval/blind-sheet.ts` |
| Bibliotheek (profielen laden, engines, metingen, controles, rapport, sheet) | `src/lib/discovery/eval/` |
| Tests (draaien in `npm test`, gratis) | `src/lib/discovery/eval/eval.test.ts` |
| Momentopname van de huidige motor voor de 20 profielen | `scripts/eval/baseline/current.json` |
| Rapporten | `docs/eval/<datum>-<engine>[-<set>].md` met een `.json` ernaast |

## Gebruik

```bash
npx tsx scripts/eval/run.ts --engine current
```

Draait de 20 profielen op de huidige motor, **alleen de selectie** (`--seeds-only`, de standaard): gratis, deterministisch, geen API-aanroep. Schrijft `docs/eval/<datum>-current.md` en `.json`. Elk profiel heeft een vaste `seed` en `month`, dus het resultaat hangt niet af van de dag van de run.

```bash
npx tsx scripts/eval/run.ts --engine current --profiles synthetic-cards  --n 500 --seed ke-1
npx tsx scripts/eval/run.ts --engine current --profiles synthetic-images --n 500 --seed ke-1 --overrides
```

De 500 synthetische bezoekers van de nulmeting. Met dezelfde `--seed` komen exact de cijfers uit het auditrapport terug (zie de rapporten van 2026-10-27).

```bash
npx tsx scripts/eval/run.ts --engine current --full
```

**Betaald, daarom vergrendeld.** Zonder `--confirm-cost` toont het commando alleen wat een run zou kosten (20 boeken ≈ $4,60 bovengrens) en stopt met exitcode 2. Pas met `--confirm-cost <bedrag>` dat de schatting dekt worden boeken echt geschreven. Een `--full`-run gebruikt de maand van vandaag (de schrijfpijplijn kent geen vaste maand), dus die run is niet bit-voor-bit herhaalbaar.

`--engine v2` bestaat nog niet en wordt geweigerd met een duidelijke melding.

## Wat er gemeten en gecontroleerd wordt

- **Harde regels** (moeten 0 zijn): E1 harde eisen, E3 herhaling, E4 één wildcard, E5 sociale keuze, E6 toezicht. Het orakel (`engine/evaluate.ts`) schrijft ze opnieuw uit de invoer, zodat een fout in de motor zichzelf niet kan verbergen.
- **Duplicaten**: dezelfde activiteit twee keer, of twee activiteiten met dezelfde naam na het negeren van hoofdletters, accenten en leestekens.
- **Spreiding**: minstens 4 werelden en 3 fotocategorieën per boek.
- **Boeken** (alleen `--full`): `first_action` aanwezig (fout) en concreet (waarschuwing); een exacte prijs, openingstijd of straat zonder bron in het onderzoek van dat idee is een **fout**.
- **Maten**: de diversiteits- en betrouwbaarheidscijfers van het auditrapport (§3.2), plus welke deur "Als je er maar één kiest" wint.

Een regressiecheck in `npm test` houdt de seeds van de huidige motor vast. Verandert de motor of de bibliotheek **bewust**, ververs dan de momentopname:

```bash
npx tsx scripts/eval/run.ts --engine current --write-baseline --no-write
```

## Blinde vergelijking

```bash
npx tsx scripts/eval/blind-sheet.ts docs/eval/<datum>-current.json docs/eval/<datum>-v2.json --seed ronde-1
```

Maakt `blind-ronde-1.html` (voor Jan en de testers: per persoon twee voorstellen in willekeurige volgorde, vijf rubricvragen per kant, export naar CSV) en `blind-ronde-1.key.json` (welke kant welke versie was; niet delen). Tellen na afloop:

```bash
npx tsx scripts/eval/blind-sheet.ts --tally docs/eval/blind-ronde-1.key.json antwoorden-jan.csv antwoorden-sam.csv
```

Met `--seeds-only`-bestanden ziet de beoordelaar de zeven gekozen activiteiten met hun deur; met `--full`-bestanden de geschreven boeken.
