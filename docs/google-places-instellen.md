# Google-scores van plekken: de Places API instellen

WindowInto kan bij de plekken in een boek de echte Google-score (sterren en aantal reviews) zetten. De zoekopdracht van het onderzoek ziet die score zelden, de Places API geeft hem wel. Dit is optioneel: zonder sleutel wordt het boek gewoon gemaakt, zonder score.

## Wat het kost

Een opzoeking is één *Text Search* van de Places API (New) met de velden `rating` en `userRatingCount`. Dat valt onder de SKU **Text Search Enterprise**: de eerste **1.000 per maand zijn gratis**, daarna **$35 per 1.000** (3,5 cent per opzoeking). Prijslijst van Google, gelezen op 14 november 2026: <https://developers.google.com/maps/billing-and-pricing/pricing>.

De app houdt dat zelf in de hand:

- Elke opzoeking haalt eerst een ticket uit een maandteller in de database (migratie 0025). De teller stopt bij `GOOGLE_PLACES_FREE_PER_MONTH` (standaard **900**, onder de gratis 1.000). Daarna zijn er geen opzoekingen meer tot de volgende maand, en wordt het boek gewoon zonder score gemaakt.
- Alleen `GOOGLE_PLACES_ALLOW_PAID=1` haalt die grens weg. Zet dat **niet** aan zolang het totaal per boek onder de $0,40 moet blijven: dan kost een opzoeking echt geld (maximaal 8 per boek is $0,28).
- Per activiteit hoogstens twee opzoekingen, en de eerste stopt de zoektocht als de plek 4,3 of hoger heeft uit minstens 15 reviews. Per boek hoogstens `GOOGLE_PLACES_MAX_PER_BOOK` (standaard 8).
- Het antwoord (een score, of dat er geen is) wordt bij de plek in de onderzoekscache bewaard. Een plek wordt dus één keer per maand opgezocht, niet bij elk boek.
- Alleen de naam van de plek en de plaats gaan naar Google, geen persoonsgegevens.

## Stappen (eenmalig, door jou)

1. **Migratie 0025 draaien** in de Supabase SQL-editor (`supabase/migrations/0025_places_usage.sql`). Controleer daarna dat de tabel `places_usage` en de functie `places_usage_take` bestaan. Zonder deze migratie doet de app geen opzoekingen.
2. In de Google Cloud Console: een project kiezen (of maken) met een betaalaccount eraan, **Places API (New)** inschakelen.
3. Onder *APIs en services, Inloggegevens*: een **API-sleutel** maken en die beperken tot alleen *Places API (New)*. (Een IP-beperking kan op Vercel niet vast, dus de beperking tot die ene API is wat telt.)
4. Een **budgetmelding** zetten in *Facturering, Budgetten en meldingen* (bijvoorbeeld $5), als extra vangnet naast de teller.
5. In Vercel (Production en Preview): `GOOGLE_PLACES_API_KEY` = de sleutel, dan opnieuw deployen. De andere instellingen in `.env.example` hoef je niet te zetten.
6. In `/admin`, onder *Instellingen van deze deployment*, moet `GOOGLE_PLACES_API_KEY` nu op "aanwezig" staan.

## Controleren

Na een proefboek staat in het logboek van Vercel (of in de uitvoer van `scripts/persona-books.ts`) een regel `google places ratings: N lookups (list price $…)`. De kostenmeters tellen die opzoekingen mee tegen de **lijstprijs**, ook al zijn ze binnen het gratis tegoed gratis. Het verbruik van de maand staat in de tabel `places_usage` (kolom `lookups`).
