# Evaluatie: engine `current`, seeds-only

Gemaakt op 2026-10-27. Profielen: synthetische kaartenbezoekers, n = 500, seed ke-1. 500 profielen, 3500 ideeën.
Alleen de selectiemotor (gratis, deterministisch): geen tekst geschreven, geen API-kosten.

## Harde regels (moeten 0 zijn)

| E1 harde eisen | E3 herhaling | E4 één wildcard | E5 sociale keuze | E6 toezicht |
|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 0 |

Controles: **1 fouten**, 0 waarschuwingen.

## Zachte criteria van de motor

| Maat | Aandeel profielen |
|---|---|
| seedsAtLeastSix | 100.0% |
| fourDomains | 100.0% |
| maxTwoPerDomain | 99.6% |
| allDirections | 97.0% |
| nicheOwnWorld | 100.0% |
| unexpectedHasBridge | 99.7% |
| noRelaxation | 75.8% |

## Diversiteit en betrouwbaarheid

| Maat | Waarde |
|---|---|
| Werelden per boek | 6.01 |
| Subdomeinen per boek | 6.68 |
| Fotocategorieën per boek (van 12) | 5.02 |
| Soorten beleving per boek (van 10) | 4.66 |
| Boeken met een paar ideeën met ≥ 2 gedeelde niet-algemene tags | 41.2% |
| Boeken met twee ideeën in één subdomein | 27.2% |
| Boeken waarin een richting versoepeld werd | 24.2% |
| Ideeën met `verify`-vlaggen | 23.9% |
| Ideeën met toezichtsplicht (tier 2) | 2.4% |
| Ideeën met onbekende kosten | 1.6% |
| Boeken met budget *gratis* die zo'n idee bevatten | 23 / 91 |
| Aandeel "social" in alle ideeën | 23.0% |
| Verschillende activiteiten gebruikt | 389 |
| Populairste activiteit | schrijven in 8.8% van de boeken |
| Top 10 activiteiten, aandeel van alle plekken | 9.8% |
| "Als je er maar één kiest" per deur | unexpected 72%, natural 22%, discovery 6%, stretch 0% |

Notities van de motor (hoe vaak een terugvaloptie nodig was): direction_relaxed 160, surprise_me 48, worlds_only 61, no_picks 73, filled 41

## Bevindingen

| Profiel | Ernst | Controle | Waar | Melding |
|---|---|---|---|---|
| p400 | error | spread:categories |  | only 2 photo categories in one book (minimum 3) |

