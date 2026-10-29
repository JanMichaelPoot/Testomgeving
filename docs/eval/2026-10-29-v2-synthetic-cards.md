# Evaluatie: engine `v2`, seeds-only

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
| noRelaxation | 79.4% |

## Diversiteit en betrouwbaarheid

| Maat | Waarde |
|---|---|
| Werelden per boek | 5.98 |
| Subdomeinen per boek | 6.67 |
| Fotocategorieën per boek (van 12) | 5.16 |
| Soorten beleving per boek (van 10) | 4.81 |
| Boeken met een paar ideeën met ≥ 2 gedeelde niet-algemene tags | 31.4% |
| Boeken met twee ideeën in één subdomein | 27.0% |
| Boeken waarin een richting versoepeld werd | 20.6% |
| Ideeën met `verify`-vlaggen | 25.3% |
| Ideeën met toezichtsplicht (tier 2) | 3.0% |
| Ideeën met onbekende kosten | 0.7% |
| Boeken met budget *gratis* die zo'n idee bevatten | 0 / 94 |
| Aandeel "social" in alle ideeën | 21.9% |
| Boeken waarin alle 7 niveaus voorkomen | 94.8% |
| Uitvoerbaarheid (0-1) van niveau 1 Vertrouwd / niveau 2 Praktisch | 0.84 / 0.92 |
| Verschillende activiteiten gebruikt | 469 |
| Populairste activiteit | tai-chi in 6.8% van de boeken |
| Top 10 activiteiten, aandeel van alle plekken | 8.0% |
| "Als je er maar één kiest" per deur | natural 71%, unexpected 20%, discovery 5%, stretch 4% |

Notities van de motor (hoe vaak een terugvaloptie nodig was): direction_relaxed 133, worlds_only 41, filled 43, surprise_me 59, no_picks 73, pool_small 1

