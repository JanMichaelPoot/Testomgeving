# Import of the reference library into the app

Written by `npx tsx scripts/reference-library/import-to-app.ts --write` (step 1 of the plan to implement the reference library). No API calls.

## What happened

- reference library: 550 activities (411 exact, 8 close, 131 new)
- new in the app: 0 (hidden: concept + image_pending), merged into existing: 7
- source links added: 0, alias changes: 0, register lines added: 0
- per domain: -

New activities are `concept` and `image_pending`: visitors and the engine do not see them until their photos exist and the flag is removed (`npm run taxonomy:check --images` tells which).

## Merged into an activity the app already has

- RA-009 -> `borduren-weven` (names: Borduren met de hand; Hand embroidery)
- RA-401 -> `nestkast-bouwen` (names: Een bijenkast bouwen; Building a bee hive box)
- RA-081 -> `straatfeest` (names: Een buurtevenement organiseren; Organising a neighbourhood event)
- RA-376 -> `tekenen` (names: Tekenen leren voor beginners; Learning to draw for beginners)
- RA-523 -> `coderen` (names: Programmeren leren met Python; Learning to program with Python)
- RA-494 -> `tuinieren` (names: Een moestuin op balkon of dakterras; A vegetable garden on a balcony or roof terrace)
- RA-064 -> `nieuwkomers` (names: Taalmaatje voor een nieuwkomer; Language buddy for a newcomer)

## New activities per domain

