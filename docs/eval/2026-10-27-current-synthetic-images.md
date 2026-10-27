# Evaluatie: engine `current`, seeds-only

Gemaakt op 2026-10-27. Profielen: synthetische beeldbezoekers, n = 500, seed ke-1, met schuiven. 500 profielen, 3497 ideeën.
Alleen de selectiemotor (gratis, deterministisch): geen tekst geschreven, geen API-kosten.

## Harde regels (moeten 0 zijn)

| E1 harde eisen | E3 herhaling | E4 één wildcard | E5 sociale keuze | E6 toezicht |
|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 0 |

Controles: **1 fouten**, 0 waarschuwingen.

## Zachte criteria van de motor

| Maat | Aandeel profielen |
|---|---|
| seedsAtLeastSix | 99.8% |
| fourDomains | 100.0% |
| maxTwoPerDomain | 100.0% |
| allDirections | 99.8% |
| nicheOwnWorld | 100.0% |
| unexpectedHasBridge | 100.0% |
| noRelaxation | 85.0% |

## Diversiteit en betrouwbaarheid

| Maat | Waarde |
|---|---|
| Werelden per boek | 6.18 |
| Subdomeinen per boek | 6.64 |
| Fotocategorieën per boek (van 12) | 5.25 |
| Soorten beleving per boek (van 10) | 4.87 |
| Boeken met een paar ideeën met ≥ 2 gedeelde niet-algemene tags | 45.8% |
| Boeken met twee ideeën in één subdomein | 31.2% |
| Boeken waarin een richting versoepeld werd | 15.0% |
| Ideeën met `verify`-vlaggen | 18.4% |
| Ideeën met toezichtsplicht (tier 2) | 4.3% |
| Ideeën met onbekende kosten | 2.8% |
| Boeken met budget *gratis* die zo'n idee bevatten | 43 / 116 |
| Aandeel "social" in alle ideeën | 24.3% |
| Verschillende activiteiten gebruikt | 393 |
| Populairste activiteit | wandelen in 10.6% van de boeken |
| Top 10 activiteiten, aandeel van alle plekken | 11.5% |
| "Als je er maar één kiest" per deur | unexpected 88%, natural 9%, discovery 3% |

Notities van de motor (hoe vaak een terugvaloptie nodig was): direction_relaxed 75, surprise_me 50, pool_small 1, direction_missing 3, filled 2

## Bevindingen

| Profiel | Ernst | Controle | Waar | Melding |
|---|---|---|---|---|
| a376 | error | spread:categories |  | only 2 photo categories in one book (minimum 3) |

