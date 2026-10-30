# Fase 4: technische opzet van de twee beeldpagina's

Opgesteld op 30 oktober 2026; akkoord van Jan ("ga door met Fase 4"). **Stand: 4a, 4b en het grootste deel van 4c zijn gebouwd (Stap 117); 4d is deels open.** Hoort bij `docs/plan-twee-beeldpagina-s.md`.

## 1. Wat er al ligt

Register per activiteit en familie (`register.json`, Fase 0-1), 102 families / 306 kaarten en 524 activiteiten met foto (Fase 2-3), de motor met seeds, niveaus en harde regels E1-E6, het seed-mechanisme van de sampler, `windowLayout` voor het venster, en de bestaande beeld-intake (`AssociationWizard`, 6 schermen).

## 2. De nieuwe variant: `images2`

Naast de huidige beeld-intake, niet erin: `?wizard=images2`, en een percentage `NEXT_PUBLIC_IMAGES2_PERCENT` (standaard 0, dus niemand ziet hem tot jij het aanzet). De oude flow blijft de terugval. Schermen: **beelden** (pagina 1), **concreet** (pagina 2), **situatie**, **profiel + bestellen**. Richting vervalt. Hoofdstukken in de stepper: Jouw beelden (pagina 1 en 2), Jouw situatie, Jouw venster.

## 3. Pure functies (nieuw bestand `src/lib/discovery/twoPages.ts`, allemaal met tests, zonder AI of netwerk)

| Functie | Doet | Regels |
|---|---|---|
| `sampleBalancedBatch(cards, {seed, refresh, seen, keep})` | 18 kaarten voor pagina 1 | gemengd uit plek, moment en zintuig in willekeurige volgorde; minstens 4 per register, rest vrij; op elke as minstens 2 tegenpolen (hergebruikt `ENOUGH_PER_SIDE`); één variant per familie; "Andere beelden" geeft een set zonder herhaling (tot 3 keer, daarna is de pool op); gekozen kaarten blijven staan; zelfde seed geeft dezelfde set |
| `registerMix(chosenCards)` | verdeling van de gekozen beelden over de vier registers | alleen een getal per register, nooit opgeslagen als label |
| `composeConcretePage(activities, {mix, tagProfile, month, seed, refresh, keep})` | 18 activiteiten voor pagina 2 | dichtst bij de gekozen beelden (gedeelde tags); vloer van **2 van 18 per register** en minstens **een derde buiten het meest gekozen register**; 3 verkenplekken buiten wat je koos; minstens 4 richtingen, niet twee uit één subgroep; alleen wat in deze maand kan (`inSeason`); toezichtsactiviteiten alleen als de schuif niet "voorspelbaar" zegt (die schuif staat dan nog niet vast: zie punt A) |
| `explainDroppedPicks(picks, constraints)` | welke gekozen activiteit door een harde grens afvalt, en waarom | gebruikt `passesConstraints`; voedt een regel op het profielscherm |

De vloer is 2 per register in plaats van de 20% uit het plan: vier keer 20% is 80% van de pagina en laat geen ruimte voor smaak (zie Stap 113).

## 4. Data en motor

- `IntakeAnswers`: nieuwe waarde `intakeVariant: "images2"`. `associations` blijft (pagina 1: assen, tagprofiel, venster, verhaal), `interests` zijn nu **de echte keuzes van pagina 2** (opgeschoond tegen echte, zichtbare id's, zoals `sanitizeDiscoveryAnswers` al doet). `interestDomains` volgt uit die keuzes. Geen register of geslacht in de opslag.
- `applyImageIntake`: voor `images2` worden interesses **niet meer afgeleid** maar gelezen; de motor krijgt ze als expliciete keuze (zoals de kaartenwizard). Daardoor is "Je koos X" waar, en kan `HONEST_ORIGIN_RULE` voor die ideeën vervallen.
- Boek: `fit`, `reasons` en `chain` blijven; een gekozen activiteit krijgt `picked` als reden.
- Evaluatie: `scripts/eval` krijgt een profielsoort voor `images2` (synthetische beelden + picks) en meet: harde regels E1-E6 = 0, vloer gehaald in 100% van 1000 bezoekers, aandeel buiten het eigen register, werelden per boek niet lager dan nu (5,8).

## 5. Schermen en venster

- **Afwijking van de opzet:** de twee schermen zijn geen losse componenten geworden maar horen bij `AssociationWizard` via een `flow`-prop (`pagesFor`, `chapterOf` in `vensterPages.ts`): de situatie- en profielschermen, het venster, de onderbalk, de betaling en het concept zijn dan gedeeld en kunnen niet uit de pas lopen. Het concept heeft wel een eigen sleutel.
- Venster: twee soorten ruiten (`images`, `picks`) naast de vier oude, zodat oude boeken, de PDF-omslag en de deelpreview blijven werken. De indeling (`layoutWindow`) hoeft niet te veranderen.
- Concept in sessionStorage: `DRAFT_VERSION` 4 met eigen paginalijst per variant; een bestaand concept van de oude variant blijft die flow volgen (geen migratie nodig, wel een test).
- Teksten nl en en in `dict.venster`; de bestaande test op "geen 'wereld' in zichtbare tekst" blijft gelden.
- Events zonder tekst: `images_page_completed {selected, refreshes, n_expressive, n_nurturing, n_technical, n_nature}` en `concrete_page_completed {selected, refreshes, explore_picked, n_expressive, ...}`; de catalogus en `docs/analytics-events.md` volgen.

## 6. Wat verder meeverandert

Profielportret (noemt nu ook de concrete keuzes), de draad "Zo kwamen we hierop" (jouw keuze → deur), "Wijzig"-links op het bestelblok, PDF-omslag en deelpreview (vier ruitlabels worden twee), cadeauflow (zelfde twee pagina's met naam), e2e-tests op 375/390/412 px.

## 7. Volgorde van bouwen (elk deel eigen commit, €0)

1. **4a** `twoPages.ts` met tests en een meting op 1000 synthetische bezoekers (vloer, buiten-register-aandeel, geen herhaling bij verversen).
2. **4b** Data, `applyImageIntake`, motorpad, evaluatieprofielen en meting van E1-E6.
3. **4c** Schermen, venster, concept, teksten, events, variant achter het percentage.
4. **4d** Profiel, draad, PDF-omslag, deelpreview, e2e.

## 8. Beslissingen die ik van je nodig heb

**A. Volgorde van situatie en concrete pagina.** Het plan zegt: beelden, concreet, situatie. Dan weet pagina 2 het budget, de tijd en de plaats nog niet, en kan een gekozen activiteit daarna door een harde grens afvallen. Aanbeveling: **volgorde uit het plan houden** en afvallers niet stil weggooien maar op het profielscherm tonen ("Je koos X; dat past niet bij je budget, hier is wat we er dichtbij vonden"), met `explainDroppedPicks`. Alternatief: situatie vóór pagina 2, dan kan pagina 2 op budget filteren, maar de keten van "wat ik zie → wat ik kies" wordt onderbroken door een zakelijk scherm.

**B. Vloer:** 2 van 18 per register plus minstens een derde buiten het meest gekozen register. Akkoord?

**C. Standaardpercentage 0** voor `images2` (alleen via `?wizard=images2` te zien tot jij hem aanzet). Akkoord?
