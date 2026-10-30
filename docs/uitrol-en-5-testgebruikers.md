# Uitrol in stappen en vijf testgebruikers (Fase 5)

Opgesteld op 30 oktober 2026. Dit is een draaiboek, geen meting: er zijn nog geen echte bezoekers gemeten, dus
**er staan bewust geen drempelpercentages in die ik zou moeten verzinnen**. Waar een grens nodig is, staat een
voorstel gemarkeerd als **[Advies]**; jij beslist.

## 1. Wat er gemeten wordt

Alle events staan in `docs/analytics-events.md`. Voor deze fase telt dit:

| Vraag | Event(s) | Let op |
|---|---|---|
| Hoeveel mensen maken een venster af? | `intake_started` → `window_completed {images, panes}` | `window_completed` komt zodra het profielscherm opent |
| Hoeveel mensen willen betalen? | `checkout_pay_clicked` | op het profielscherm, met de twee vinkjes aan |
| Hoeveel betalen echt? | `payment_succeeded` (server) | niet aan dezelfde bezoeker te koppelen: vergelijk dagtellingen |
| Komen ze bij het resultaat? | `plan_viewed` | |
| Welk niveau trekt? | `idea_opened {level}` (1 Vertrouwd … 7 Onontdekt) | 0 = boek van vóór de niveaus |
| Doen ze er iets mee? | `idea_liked`, `one_thing_committed`, `plan_pdf_downloaded`, share-events | |
| Wat vonden testers? | `test_feedback_submitted` + tabel `test_feedback` | alleen met `NEXT_PUBLIC_TEST_FEEDBACK=1` |

De namen uit de opdracht (`results_viewed`, `level_opened`, `inspiration_saved`, `unlock_clicked`) bestaan niet als
aparte events: ze zijn dezelfde handeling als `plan_viewed`, `idea_opened`, `idea_liked` en `checkout_pay_clicked`
en zouden dubbel tellen. De vertaaltabel staat in `docs/analytics-events.md`.

**Privacy.** `payment_succeeded` verlaat de server zonder toestemming van de cookiebanner, zonder persoon (alleen de
willekeurige sessie-id, geen e-mail, geen locatie) en telt dus alleen mee als aantal. **Laat juridisch controleren**
of dat past bij de tekst van de cookiebanner ("pas na jouw toestemming") en de privacyverklaring. Wil je liever
strikt zijn, dan is de enige aanpassing het verwijderen van de `after(() => trackServerEvent(...))`-aanroep in
`src/app/plan/data.ts`; dan telt alleen de database (`payments`) de betalingen.

## 2. Vooraf: dit moet staan voordat er iemand uitgenodigd wordt

- [ ] `NEXT_PUBLIC_POSTHOG_KEY` (project-sleutel `phc_…`) in Vercel, Production en Preview. Zonder sleutel is er geen
      meting en blijft elke vergelijking hieronder leeg.
- [ ] `STRIPE_WEBHOOK_SECRET` en een webhook naar `/api/stripe/webhook`, anders blijft `payments.status` op
      "pending" en klopt de omzet in de admin niet.
- [ ] Resend: het domein van `EMAIL_FROM` is geverifieerd (anders komt de mail alleen aan op jouw eigen adres, zie
      Stap 102).
- [ ] Migraties 0014 t/m 0021 uitgevoerd.
- [ ] `NEXT_PUBLIC_WINDOW_PRICE_CENTS` staat op het bedrag dat je wilt testen; testversie: `NEXT_PUBLIC_TEST_FEEDBACK=1`.
- [ ] `CRON_SECRET` gezet (de herinneringsroute staat anders open).
- [ ] De drie aangeleverde beelden (`hero-fan/hero.jpg`, `outdoor/situation.jpg`, `outdoor/openness.jpg`) hebben een
      bevestigde herkomst en de gebruiksvoorwaarden van Google voor gegenereerde beelden zijn gecontroleerd voor
      commercieel gebruik (`src/lib/imageProvenance.json`).
- [ ] De juridische teksten zijn gelezen door iemand die dat mag beoordelen: de samengevoegde betaalpagina (Stap 108),
      de veiligheidsnotities bij schieten en risicosporten (Stap 79, 88, 105) en het apparaatgeheugen (Stap 57).

## 3. Eerst vijf testgebruikers (kwalitatief)

Doel: vinden wat een klein getal niet verbergt, namelijk **waar iemand vastloopt of iets niet snapt**. Vijf mensen
zeggen niets over percentages; ze laten blokkades zien.

**Wie.** Vijf mensen die jij kent maar die het product niet kennen, bewust verschillend: iemand die op een telefoon
zit, iemand van boven de 55, iemand die iets cadeau wil doen, iemand met weinig tijd, iemand die zelden activiteiten
buiten de deur doet. Minstens twee op een echte telefoon (de testbrowser is geen echte telefoon).

**Hoe.** Elk apart, ± 20 minuten, jij kijkt mee (scherm delen of ernaast zitten), zegt niets voor, en schrijft op.
Gebruik de testversie met testkaart en de vragenlijst onder het boek. Geef alleen: "Open windowinto.nl en kijk of er
iets voor je bij zit."

**Wat je let op** (één regel per tester):

| Moment | Vraag aan jezelf |
|---|---|
| Landing | Snapt iemand wat er gebeurt zonder uitleg? Wat lezen ze eerst? |
| Beelden kiezen | Aarzelen ze? Missen ze een keuze? Valt een beeld op door het verkeerde (te vreemd, te veel van hetzelfde)? |
| Venster | Zien ze dat het venster zich vult? Snappen ze waarom? |
| Situatie en profiel | Klopt het portret, in hun eigen woorden? Lezen ze de schuiven? |
| Betaalblok | Snappen ze wat gratis is en wat ze kopen? Twijfelen ze bij de prijs? |
| Wachten | Blijven ze kijken of haken ze af? Hoe lang duurt het echt? |
| Boek | Welk idee openen ze eerst? Welk niveau? Doen ze iets met "Begin klein"? |
| Mail en PDF | Komt de mail aan (let op het domein)? Is de PDF logisch? |

**Wat je vastlegt per tester:** tijd van begin tot boek (uit PostHog of de admin), waar ze stopten of terugkeerden,
hun score en opmerking uit `test_feedback`, en jouw eigen aantekening. Haal na afloop `door_pick` en `door_kind` op:
welk soort deur zou deze persoon echt gaan doen.

**Wanneer is het goed genoeg om door te gaan?** **[Advies]** Geen van de vijf liep vast zonder dat ze het zelf
oplosten (geen onbegrijpelijke fout, geen betaalprobleem, geen wachttijd waarbij iemand wegging), en minstens vier
konden in eigen woorden zeggen wat ze zouden kopen. Eén herhaalde blokkade bij twee of meer mensen is een reden om te
herstellen vóór je meer mensen uitnodigt.

## 4. Daarna geleidelijk meer mensen

Er zijn al drie varianten van de intake (`legacy`, `cards`, `associations`) en een instelling voor het aandeel dat de
beeld-intake krijgt: `NEXT_PUBLIC_ASSOCIATION_WIZARD_PERCENT` (nu standaard 100, zie Stap 68). De andere varianten
blijven bestaan, dus een geleidelijke uitrol is mogelijk zonder code. `wizard_variant` staat op de intake-events zodat
de groepen naast elkaar te zetten zijn.

| Stap | Instelling | Wie | Wat je afwacht |
|---|---|---|---|
| 0 | `…_PERCENT=0` of een preview | alleen jijzelf | de checklist hierboven is af |
| 1 | vijf testgebruikers (sectie 3) | 5 bekenden | geen herhaalde blokkade |
| 2 | testlimiet aan (`TEST_MAX_BOOKS_PER_IP=2`), ± 50 bekenden in golven van 15-20 (`docs/testen-met-bekenden.md`) | bekenden | genoeg events om de funnel te lezen; kwalitatief rapporteren tot er enkele tientallen zijn |
| 3 | `…_PERCENT=25`, dan 50 | echt publiek, de rest krijgt de oudere variant | vergelijk `window_completed` en `checkout_pay_clicked` per variant |
| 4 | `…_PERCENT=100`, testlimiet weg, `NEXT_PUBLIC_TEST_FEEDBACK` weg | iedereen | `payment_succeeded` per dag |

**Terugdraaien** kan op elk moment door de variabele op `0` te zetten en opnieuw te deployen; opgeslagen concepten en
boeken blijven bewaard. Let op: `NEXT_PUBLIC_*` wordt bij de build vastgelegd, dus een nieuwe build is nodig.

**Beslisregels per stap** (**[Advies]**, zonder getallen die ik niet kan onderbouwen): ga alleen naar de volgende stap
als (1) de checklist klopt, (2) er geen betaling is gelukt zonder boek of mail (vergelijk `payments` met
`window_plans` in de admin), (3) `generation_stalled` zeldzaam is, en (4) een vergelijking met de oudere varianten niet
duidelijk slechter is op `window_completed`. Een duidelijk verschil vraagt enkele tientallen sessies per groep; bij
minder is elk verschil ruis.

## 5. Wat dit nog niet beantwoordt

- Of mensen **terugkomen** of het boek na een week gebruikt hebben: de herinneringsmail (Stap 17) wordt nog niet gemeten
  en vraagt een echte betaling plus twee dagen.
- Of de ideeën **kloppen met de werkelijkheid** (bestaan de plekken, zijn ze open): dat meten de events niet; kijk bij
  elke testbestelling zelf naar twee of drie plekken.
- Een **gratis voorproef** is bewust niet gebouwd (jouw besluit); er is dus niets dat de prijs apart test. Een prijstest
  vraagt een tweede prijs naast de bestaande, en dat is nu niet gebouwd.
