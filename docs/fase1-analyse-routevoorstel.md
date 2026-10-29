# Fase 1: analyse en routevoorstel (één route, generatief venster, zeven niveaus)

Opgesteld op 29 oktober 2026 voor de opdracht "WindowInto: gerichte verbetering". **Alleen analyse en een voorstel: er is niets in de code, de database of de configuratie gewijzigd en er zijn geen betaalde aanroepen gedaan.** Alles komt uit de code in deze map (ook de nog niet gecommitte Stap 108) en uit eerdere metingen in `CLAUDE.md`.

Labels: **[Feit]** in de code gecontroleerd · **[Aanname]** redelijk maar niet bewezen · **[Advies]** mijn voorstel.

## 0. Wat dit voorstel verandert ten opzichte van wat er al ligt

Er bestaat al een plan (`docs/verbeterplan-windowinto.md`) en een deel is gebouwd (Stap 108: zes beeldschermen, "Praktisch" en "Met wie" samen, betalen op het profielscherm, "gratis" als budgetkeuze weg). Deze nieuwe opdracht wijkt op vier punten af. **Deze vier wil ik van je bevestigd hebben, want ze keren eerdere keuzes om:**

| # | Nieuw in deze opdracht | Eerder besloten | Gevolg |
|---|---|---|---|
| 1 | Resultaten per niveau zijn **gratis** zichtbaar vóór het betaalmoment (Fase 4) | D6 (gratis voorproef) heb je niet overgenomen; Stap 108 zet het betalen op het profielscherm, vóór elk resultaat | Het betaalmoment verhuist van "voor het boek" naar "na de gratis resultaten" |
| 2 | **Eén route** voor iedereen | Het eerdere plan had twee routes ("Verras me" en "Ik zoek iets concreets"); die is niet gebouwd | Route B vervalt; geen tweede formulier |
| 3 | Zeven **niveaus** met andere namen (Vertrouwd, Praktisch, Verwant, Inspirerend, Verrassend, Uitdagend, Onontdekt) | Zeven "vensters" met andere namen en een drieluik | Ik gebruik de namen uit deze opdracht en laat het drieluik als presentatie vallen tenzij je het terug wilt |
| 4 | Het **venster** wordt een generatief object met een roedestructuur; max. 3 schermen | Het huidige venster is een vast boogkozijn met vier ruiten | Nieuw component, zie Fase 2; de bestaande `WindowFrame` wordt vervangen, niet uitgebreid |

## 1. Huidige route tegenover het voorstel

**Huidig (met Stap 108) [Feit]:** landing → `/intake` met 6 schermen → wachtscherm → `/plan`.

| # | Scherm | Verplichte invoer | Bron |
|---|---|---|---|
| 1 | Richting (kaarten van 10 van de 18 richtingen) | min. 1 richting of "Verras me" | `AssociationWizard` |
| 2 | Plek (9 beelden) | min. 1 beeld | idem |
| 3 | Moment (9 beelden) | min. 1 beeld | idem |
| 4 | Zintuig (9 beelden) | optioneel | idem |
| 5 | Situatie (plaats, tijd, budget, gezelschap; "Meer opgeven") | plaats, tijd, budget, gezelschap | `vensterPages.ts` |
| 6 | Profiel + bestelblok | twee juridische vinkjes, dan betalen | `ProfileStep`, `CheckoutPanel` |

Totaal: 6 schermen, ± 5 verplichte keuzes plus 4 praktische velden, daarna betalen, daarna pas resultaat.

**Voorstel [Advies], 3 schermen na de landing:**

| # | Scherm | Wat | Verplicht | Bron/hergebruik |
|---|---|---|---|---|
| 1 | **Kies** | één raster met gemengde beelden (richting, plek, moment, zintuig door elkaar) naast het venster dat zich live vult; onder het raster één compacte rij "Praktisch" met voorinvulling | minimaal 5 beelden (of "Verras me") en **één veld: plaats**; tijd, budget en gezelschap staan voorgevuld ("halve dag", "tot €100", "maakt niet uit") en zijn aanpasbaar | `AssociationWizard` wordt gesplitst; bestaande sampler, `LocationAutocomplete` |
| 2 | **Resultaten** (gratis) | het voltooide venster; daaronder de zeven niveaus als compacte rij kaarten (titel, foto, waarom, drie chips); het profielportret als korte tekst | geen | motor (`selectSeeds`), `profileStory`, `IdeaMore`-kaarten; **geen API-kosten** (alleen de motor, zie sectie 8, risico 4) |
| 3 | **Uitwerking** (betaald) | "Werk deze selectie uit" opent het bestelblok; na betaling het wachtscherm en `/plan` met de concrete uitwerking per idee | twee juridische vinkjes | `CheckoutPanel`, wachtscherm, `PlanReveal` |

Stappen van landing tot boek: van 8 (6 + wachtscherm + boek) naar 4 (kies, resultaten, bestellen, boek). Pagina's: `/intake` en `/plan` blijven, er komt één resultatenpagina bij (werknaam `/venster`), `/checkout` blijft alleen als doorverwijzing.

**Aannames [Aanname]:** (a) de landing telt niet mee in de "max. 3 schermen"; (b) "plaats" blijft verplicht omdat de echte plekken (onderzoek) zonder plaats niet kunnen; (c) "Verras me" blijft bestaan als weg voor wie niets wil kiezen.

## 2. Wat vervalt of samengaat

| Onderdeel | Voorstel | Reden |
|---|---|---|
| Aparte schermen Richting, Plek, Moment, Zintuig | **vervallen**, samen in één gemengd raster | de vier zijn profieldimensies, geen vragen |
| Aparte invoer per dimensie (de rondes met eigen kop en kicker) | vervalt; de dimensie volgt uit de tags van de gekozen beelden | zie sectie 3 |
| Scherm "Situatie" | wordt een rij onder het raster | alleen plaats is echt nodig |
| Profielscherm met schuiven en uitklapblok "Bekijk en stuur bij" | portret blijft (kort) op de resultatenpagina; de vier schuiven worden optioneel achter "Stuur bij" | de schuiven zijn gebruikt maar niet nodig om te beginnen |
| `/checkout` | blijft alleen als redirect (Stripe `cancel_url`) | het bestelblok zit op de resultatenpagina |
| Drieluik en Route B | niet gebouwd | zie sectie 0 |

## 3. Hoe beelden en activiteiten nu getagd zijn, en wat ontbreekt

**Beelden (189 associatiekaarten) [Feit]:** elk heeft `round` (places, moments of senses, 63 per ronde = 21 families van 3 varianten), 2–4 `tagWeights` over de 42 bruggen (gemiddeld 3,9), vier `axes` (sociaal, energie, binnen/buiten, nieuwheid), een `status` (alle 189 `concept`). De richtingen zijn 18 domeinkaarten zonder eigen tags (de tags komen van de activiteiten in dat domein).

**Activiteiten (455) [Feit]:** `domain` (18) en `sub` (57), `tags` (2–5 van 42; 7 daarvan zijn "stemming" en tellen nooit als brug), `formats` (7 sociale vormen), `intensity` 0–3, `level` 0–2, `cost` 0–3, `duration` 1–4, `setting` (binnen, buiten, beide), `months` (seizoen, bij 25+ activiteiten), `supply` (common, regional, rare), `safety.tier`, `entry`, `status` (alle `concept`).

**Wat de vier profieldimensies nu zijn [Feit]:** alleen de ronde waaruit een beeld komt (richting, plek, moment, zintuig) en de vier assen. Het profiel is een tagprofiel plus vier gemiddelden, geen waarde per dimensie.

| Dimensie | Wat er is | Wat ontbreekt om hem uit tags af te leiden |
|---|---|---|
| **Richting** | `domain` en `sub` op de activiteit | niets wezenlijks; wel een koppeling van een beeld aan een richting (nu alleen via tags) |
| **Plek** | `setting` (3 waarden) | een soort plek: natuur, water, atelier, podium, museum, stad, thuis, online (± 8–10 waarden) op beelden én activiteiten |
| **Moment** | `duration` en `months` | dagdeel en gelegenheid: ochtend, middag, avond, weekend, regendag, seizoen, samen vieren (± 6–8 waarden) |
| **Zintuig** | verspreid in bruggen als `sound`, `color`, `food`, `rhythm` | een eigen kleine lijst: zicht, geluid, geur, smaak, tast, beweging (± 6) |
| Thema, sfeer, gezelschap | `domain`/`sub`/tags; 7 stemmingstags; `formats` | sfeer is dun (7 tags, niet bruikbaar als brug) |
| Uitvoerbaarheid | `supply`, `cost`, `duration`, `entry`, `safety`; echte plekken worden pas bij het schrijven onderzocht | niet per activiteit vastgelegd of er een beginnersinstap bestaat |
| **Ontdekkingsniveau** | **niet opgeslagen**: de motor berekent per persoon `direction` (5 waarden), `door` (4 + wildcard), `fit`, `reasons` | een afgeleid niveau 1–7 per resultaat (zie sectie 4) |

**Advies [Advies]:** drie kleine, gesloten lijsten (plek, moment, zintuig) toevoegen aan `vocabulary.json`, op alle 455 activiteiten en alle beelden zetten (door mij opgesteld, door de validator gecontroleerd, status "afgeleid" tot jij het bekijkt), en per beeld `dims` bewaren. Het ontdekkingsniveau blijft een **berekende** waarde per persoon, geen vaste eigenschap.

## 4. De zeven niveaus en de motor

De motor kiest nu altijd zeven zaden in vijf richtingen: 2 vertrouwd, 2 aangrenzend, 1 onverwacht, 1 uitdaging, 1 wildcard [Feit, `select.ts`]. Dat past op jouw zeven:

| Niveau | Motor-slot | Regel |
|---|---|---|
| 1 Vertrouwd | familiar, eerste | de eigen keuze of een directe buur (`fit` ≥ 0,8) |
| 2 Praktisch | familiar, tweede | **selectieregel, geen afstand**: zelfde richting, maar gekozen op uitvoerbaarheid (`supply` common, binnen budget, korte duur, laagste inspanning, een `entry` bestaat) |
| 3 Verwant | adjacent, eerste | ≥ 2 gedeelde bruggen met een keuze |
| 4 Inspirerend | adjacent, tweede | 1 sterke brug, nieuwe subgroep |
| 5 Verrassend | unexpected | curated combinatie of keten via een middenstap |
| 6 Uitdagend | stretch | meer inspanning of durf, nog haalbaar |
| 7 Onontdekt | wildcard | zeldzaam, uit een richting die je niet koos |

**Kanttekening [Advies]:** in het eerdere plan noemde ik "Praktisch" geen trede, omdat het over uitvoerbaarheid gaat en niet over nieuwheid. Jouw as loopt van *concreet naar vernieuwend*, dus "Praktisch" hoort bij het concrete eind. Dat werkt zolang het als **selectieregel** is gedefinieerd (zoals hierboven) en niet als een apart soort activiteit. Er is dan één echte aanpassing in de motor: het tweede vertrouwde slot kiest op uitvoerbaarheid in plaats van op rang. De harde regels E1–E6 blijven ongewijzigd; ik meet ze opnieuw.

## 5. "Gratis" als filter of keuze

**[Feit] Wat er al weg is (Stap 108):** de budgetkeuze "gratis" (alleen "tot €25", "tot €100", "maakt niet uit"), de chip "Gratis" bij harde grenzen (R1.2).

**[Feit] Wat er nog zit en weg moet:**

| Plek | Wat | Voorstel |
|---|---|---|
| `engine/constraints.ts:40,68` | vrije tekst met "gratis", "kosteloos", "free of charge" wordt een **harde grens** (`costCap = 0`) | verwijderen: de tekst wordt niet meer als filter gelezen |
| `engine/weights.ts` `strictFreeCost`, `evaluate.ts`, `synthetic*.ts`, `eval/*` | ondersteuning voor `budget: "free"` in motor en evaluatie | blijft voor oude sessies; in een tweede stap opruimen |
| `budgetOptions.ts` (`currentBudget`) | oud "free" wordt "25" | blijft |
| `venster.ts:514,1019` (`sill`) | label "Gratis"/"Free" voor oude data | blijft zolang oude boeken bestaan |
| prijs per activiteit (`cost: 0`) | "gratis" als **informatie** bij een activiteit | **blijft** (gevraagd) |

Productkeuze: er is al geen "gratis product" in de betaalflow. De gratis resultatenpagina is geen gratis variant van het product maar de voorproef (sectie 0, punt 1).

## 6. Betaalopties: inventaris en voorstel

**Wat er nu is [Feit, `checkout/actions.ts`, `CheckoutPanel.tsx`]:**

| Optie | Stand |
|---|---|
| Product | één: het Idea Book (venster, zeven ideeën, PDF, e-mail, deelbare pagina) |
| Prijs | één bedrag, eenmalig, EUR, €3,50 (testversie €6,00) via `NEXT_PUBLIC_WINDOW_PRICE_CENTS`; geen abonnement, geen niveaus, geen kortingscode |
| Stripe | Checkout, `mode: "payment"`, één regel; geen accounts |
| Cadeau | schakelaar met e-mailadres van de ontvanger (ook de landingsknop `?for=gift`) |
| Bezorgadres | optioneel veld, anders het Stripe-adres |
| Herhalingsgeheugen | optionele schakelaar (privacy, geen betaaloptie) |
| Juridisch | twee losse vinkjes vóór de knop |
| Testbypass | "Betaling overslaan" voor de eigenaar en binnen de testlimiet |

Er zijn dus al geen concurrerende betaalopties. **[JAN: gewenst model]** staat open. Mijn advies:

| Variant | Wat | Advies |
|---|---|---|
| **A. Eén aankoop per plan** | zoals nu, maar het bestelblok staat op de resultatenpagina | **ja**: past bij "één eenvoudig model", niets nieuws te bouwen |
| B. A plus het venster als print of deelbare afbeelding | extra product | later, pas na een meting: print vraagt een leverancier en retourafhandeling |
| C. Iets anders (abonnement, tegoed) | | afgeraden zolang er geen gedragsdata is (0 echte betalingen tot nu toe) |

De deelbare afbeelding van het venster (geen print) is wel goedkoop: de bestaande afbeeldingsroute (`share-card`, `opengraph-image`) kan hem leveren. Dat is een Fase 2-beslissing.

## 7. Wat er nu gemeten wordt (voor Fase 5)

**Bestaande events [Feit, `analyticsEvents.ts`, 37 stuks, alleen ids, indexen en tijden, nooit tekst]:** `landing_viewed`, `landing_start_submitted`, `intake_started`, `intake_page_viewed/completed/back` (met duur), `association_round_completed`, `profile_viewed/agreed`, `checkout_viewed`, `checkout_pay_clicked`, `generation_stalled`, `plan_viewed`, `idea_opened`, `idea_liked`, `one_thing_committed`, `wildcard_revealed`, `plan_pdf_downloaded`, `idea_book_share_clicked`, `shared_idea_book_viewed`, `invite_card_*`, `test_feedback_submitted`. PostHog is zonder sessie-opnames of autocapture (Stap 82).

| Gevraagde maat | Nu mogelijk? |
|---|---|
| Afhaakpunt per scherm | ja (`intake_page_viewed/completed`) |
| Aantal schermen en verplichte invoer | af te leiden uit de code, niet als event |
| Tijd tot eerste bruikbaar idee | **nee**: er is geen "eerste resultaat getoond" |
| % sessies met een volledig venster | **nee**: geen event voor het aantal gekozen beelden bij afronden |
| Bewaarde of gedeelde ideeën | ja, maar alleen na betaling (`idea_liked`, share-events) |
| Betaalconversie | deels: `checkout_pay_clicked` bestaat, **maar geen event "betaling gelukt"** (staat alleen in de database via de webhook, die lokaal ontbreekt) |
| Gedragsdata van echte bezoekers | **geen**: 10 beeld-intakes en 0 echte betalingen in de database (uit het verbeterplan van vandaag; niet opnieuw geteld) |

**Nieuwe events die Fase 5 nodig heeft [Advies]:** `window_completed {images, panes}`, `results_viewed`, `level_opened {level}`, `inspiration_saved`, `unlock_clicked`, `payment_succeeded` (server-side), `window_exported`.

## 8. Wat het kost en wat het raakt

Te wijzigen (indicatief; niets is gedaan):

| Onderdeel | Bestanden |
|---|---|
| Route en schermen | `vensterPages.ts`, `AssociationWizard.tsx` (1029 regels: splitsen in raster en praktische rij), `ProfileStep.tsx`, `CheckoutPanel.tsx`, `intake/page.tsx`, `intake/actions.ts`, nieuwe `venster/page.tsx`, `checkout/page.tsx` |
| Venster (Fase 2) | `WindowFrame.tsx`, `vensterPanes.ts`, nieuw zuivere `windowLayout.ts`; **dezelfde indeling moet ook in de PDF-cover (`pdf/ideaBook.ts`) en in `shared/[id]/opengraph-image.tsx` en `share-card` getekend worden** (drie renderers) |
| Niveaus en motor | `engine/select.ts`, `engine/types.ts`, `possibilityMap.ts`, `PlanReveal.tsx`, `dictionaries.ts`/`venster.ts` |
| Tags | `vocabulary.json`, `associations.json`, `data/*.json`, `validate.ts`, `associationSampling.ts` |
| Gratis | `constraints.ts`, `weights.ts`, evaluatie |
| Meting | `analyticsEvents.ts`, `docs/analytics-events.md` |

**Risico's:**

1. **Het betaalmoment verschuift** (sectie 0, punt 1). Een gratis resultatenpagina kan de betaling kannibaliseren. Beperking: alleen titel, foto, reden en niveau; geen plek, stappen, prijsdetail of eerste actie. Dat is een meting waard, geen zekerheid.
2. **Een gemengd raster** vervangt drie gecontroleerde rondes (nu: negen van 21 families per ronde, met een evenwicht op de assen). De sampler moet opnieuw gebouwd en getest worden (E-regels, spreiding).
3. **Mobiel:** raster én live venster op één scherm vraagt een vast mini-venster of een uitklapbaar paneel (bij 390 px). Dit is het grootste ontwerprisico van Fase 2.
4. **Gratis resultaten zonder AI-tekst:** de reden per kaart komt uit `reasons` en `chain` (vaste zinnen). Die zijn goed genoeg voor een titel en één regel, niet voor meer.
5. **Tagging van 455 activiteiten en 189 beelden** is veel werk en door mij opgesteld, dus een eerste inschatting zonder beoordeling door een mens (net als de rest van de bibliotheek, alles staat op `concept`).
6. **Stap 108 is nog niet gecommit** (de werkmap heeft 24 gewijzigde en een paar nieuwe bestanden). Ik wil dat vastleggen voordat Fase 2 begint, zodat er één schone basislijn is.
7. **Het vlaggenwerk:** de blinde vergelijking van de kennisengine viel 2-2 uit; die vlaggen blijven uit en ik raak ze niet aan.

## 9. Beslissingen die ik van je nodig heb voordat ik doorga

1. **Akkoord op de vier omkeringen uit sectie 0** (vooral: gratis resultaten vóór het betalen).
2. **Betaalmodel** ([JAN]): A (één aankoop per plan, advies), B of C.
3. **Praktisch** als selectieregel op het tweede vertrouwde slot (sectie 4): ja of nee.
4. **Venster-regel** ([JAN], voor Fase 2): (A) aantal ruiten = aantal keuzes, of (B) de breedte van het profiel bepaalt de raamstijl. **Advies: B**, met het aantal vlakken tussen 3 en 24 en de sterkste keuzes in het bovenlicht. A geeft vooral een mozaïek van een wisselend aantal; B laat het venster iets zeggen over de persoon.
5. **Exporteren** ([JAN]): ja als afbeelding (goedkoop, hergebruikt `share-card`), print later.
6. **Praktische rij**: alleen plaats verplicht, de rest voorgevuld: akkoord?
7. Mag ik **Stap 108 committen** als basislijn?

## 10. Antwoorden van Jan (29 oktober 2026)

| # | Besluit |
|---|---|
| 1 | **Nee** op "gratis resultaten vóór het betalen": er komt geen gratis inspiratie of resultatenpagina. Gratis blijft alleen het venster (met het profielportret). De omkering in sectie 0, punt 1 vervalt daarmee. |
| 1 | Eén route, akkoord. |
| 1 | De nieuwe niveau-namen (Vertrouwd, Praktisch, Verwant, Inspirerend, Verrassend, Uitdagend, Onontdekt), akkoord. |
| 1 | Een dynamisch vormgegeven venster waarvan de ruiten zich dynamisch vormen: ja. |
| 2 | Betaalmodel **A**: één aankoop per plan (zoals nu). |
| 3 | "Praktisch" als selectieregel op het tweede vertrouwde slot: ja. |
| 4 | Venster-regel: "ja". **Aanname van mij:** advies B (de breedte van het profiel bepaalt de raamstijl), gecombineerd met "aantal ruiten = aantal keuzes" binnen 3 tot 24. Zeg het als je A bedoelde. |
| 5 | Exporteren als afbeelding: ja. |
| 6 | Praktische rij (alleen plaats verplicht, de rest voorgevuld): ja. |
| 7 | Stap 108 committen als basislijn: akkoord (commit `ba7ab64`, niet gepusht). |

**Gevolg voor de route:** Kies (gemengd beeldraster met live venster en praktische rij) → Jouw venster (afgerond venster, profielportret en bestelblok, betalen vóór de resultaten) → wachtscherm → `/plan` (zeven niveaus met concrete uitwerking). Wat daarvan nog niet gebouwd is staat in Stap 109.
