# Meten: de baseline van de huidige wizard

Doel: vóór er iets aan de wizard verandert weten hoe lang mensen erover doen en waar ze
afhaken, zodat de nieuwe kaartenwizard eerlijk vergeleken kan worden (acceptatiecriteria
U1, U3 en U4 in het ontwerprapport).

## Eenmalig aanzetten

1. Maak (of gebruik) een PostHog-project (EU-regio) en kopieer de project-API-sleutel.
2. Zet in `.env.local` **en** in Vercel:
   - `NEXT_PUBLIC_POSTHOG_KEY=<sleutel>`
   - `NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com` (mag leeg; dit is de standaard)
3. Deploy. Events worden alleen verstuurd na toestemming in de cookiebanner ("Prima"); dat
   is bewust zo (AVG). Metingen zonder toestemming bestaan dus niet: de cijfers gaan over de
   bezoekers die toestemming gaven.

Zonder sleutel gebeurt er niets (de code slaat dan alles stil over). In `npm run dev`
kun je toch controleren wat er zou worden verstuurd: open de console en lees
`window.__windowEvents`.

## De events (alleen ids, indexen en tijden, nooit antwoordtekst)

| Event | Wanneer | Belangrijke eigenschappen |
|---|---|---|
| `landing_viewed` | Startformulier op de homepage getoond | |
| `landing_start_submitted` | Klik op "Begin" | `has_text` |
| `intake_started` | Wizard geopend | `wizard_variant`, `restored` (concept hersteld) |
| `intake_page_viewed` | Een wizardpagina getoond | `page` (situation, about, dials, openness, final), `index`, `of` |
| `intake_page_completed` | "Verder" op een pagina | `page`, `index`, `duration_ms` (tijd op de pagina) |
| `intake_page_back` | "Terug" | `page`, `index` |
| `intake_submitted` | "Maak het echt" op de laatste pagina | `total_ms` (sinds openen), `pages` |
| `intake_submit_failed` | Serverfout bij versturen | |
| `checkout_viewed` | Betaalpagina getoond | |
| `checkout_pay_clicked` | Betaalknop, voor de doorverwijzing naar Stripe | `is_gift` |
| `plan_viewed` | Idea Book geopend na betaling | (bestond al) |

`wizard_variant` is nu `legacy`. De nieuwe kaartenwizard krijgt een eigen waarde, zodat beide
naast elkaar vergeleken kunnen worden (A/B via een PostHog-feature flag).

## Insights om aan te maken in PostHog

1. **Funnel "Van landing tot betaling"**: `landing_viewed` → `landing_start_submitted` →
   `intake_started` → `intake_page_viewed` (page = about) → (page = dials) → (page = openness)
   → (page = final) → `intake_submitted` → `checkout_viewed` → `checkout_pay_clicked` →
   `plan_viewed`. Uitval per stap = het verschil tussen twee opeenvolgende stappen.
2. **Invultijd per pagina**: gemiddelde en mediaan van `duration_ms` op `intake_page_completed`,
   uitgesplitst naar `page`. (Let op: een pagina waar iemand terugkeert telt meerdere keren.)
3. **Totale invultijd**: mediaan en 90e percentiel van `total_ms` op `intake_submitted`.
4. **Terugklikken**: aantal `intake_page_back` per pagina; veel terugklikken op een pagina
   betekent dat de vorige pagina onduidelijk was.

## Wat je pas kunt zeggen na een week echte data

Zolang er weinig bezoekers zijn zeggen de cijfers weinig; pas vanaf ruwweg 100 voltooide
wizards is een mediaan stabiel. Leg de baseline vast (screenshot van de drie insights) vóór
de kaartenwizard live gaat; de acceptatiecriteria U1 en U3 vergelijken daartegen.
