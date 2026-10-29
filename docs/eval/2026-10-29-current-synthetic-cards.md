# Evaluatie: engine `current`, seeds-only

Gemaakt op 2026-10-29. Profielen: synthetische kaartenbezoekers, n = 500, seed ke-1. 500 profielen, 3500 ideeën.
Alleen de selectiemotor (gratis, deterministisch): geen tekst geschreven, geen API-kosten.

## Harde regels (moeten 0 zijn)

| E1 harde eisen | E3 herhaling | E4 één wildcard | E5 sociale keuze | E6 toezicht |
|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 0 |

Controles: **0 fouten**, 0 waarschuwingen.

## Zachte criteria van de motor

| Maat | Aandeel profielen |
|---|---|
| seedsAtLeastSix | 100.0% |
| fourDomains | 100.0% |
| maxTwoPerDomain | 99.6% |
| allDirections | 96.6% |
| nicheOwnWorld | 100.0% |
| unexpectedHasBridge | 99.7% |
| noRelaxation | 79.2% |

## Diversiteit en betrouwbaarheid

| Maat | Waarde |
|---|---|
| Werelden per boek | 5.97 |
| Subdomeinen per boek | 6.66 |
| Fotocategorieën per boek (van 12) | 5.14 |
| Soorten beleving per boek (van 10) | 4.80 |
| Boeken met een paar ideeën met ≥ 2 gedeelde niet-algemene tags | 49.6% |
| Boeken met twee ideeën in één subdomein | 28.4% |
| Boeken waarin een richting versoepeld werd | 20.8% |
| Ideeën met `verify`-vlaggen | 26.5% |
| Ideeën met toezichtsplicht (tier 2) | 3.3% |
| Ideeën met onbekende kosten | 1.4% |
| Boeken met budget *gratis* die zo'n idee bevatten | 18 / 94 |
| Aandeel "social" in alle ideeën | 22.1% |
| Boeken waarin alle 7 niveaus voorkomen | 94.8% |
| Uitvoerbaarheid (0-1) van niveau 1 Vertrouwd / niveau 2 Praktisch | 0.83 / 0.91 |
| Verschillende activiteiten gebruikt | 467 |
| Populairste activiteit | wandelen in 6.8% van de boeken |
| Top 10 activiteiten, aandeel van alle plekken | 7.8% |
| "Als je er maar één kiest" per deur | unexpected 71%, natural 23%, discovery 6%, stretch 0% |

Notities van de motor (hoe vaak een terugvaloptie nodig was): direction_relaxed 136, worlds_only 41, filled 43, surprise_me 59, no_picks 73, pool_small 1

