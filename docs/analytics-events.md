# Analytics-events: wat WINDOW meet en waar je het ziet

Dit is het overzicht van alles wat de app naar PostHog stuurt. De lijst staat ook in code
(`src/lib/analyticsEvents.ts`) en een test (`analyticsEvents.test.ts`) controleert dat de code, de
lijst en dit document hetzelfde zeggen: een event of eigenschap die hier niet staat kan niet
ongemerkt worden toegevoegd.

## De regel

Een event bevat alleen **id's, aantallen, tijden, ja/nee-waarden en vaste woorden**. Nooit wat iemand
zelf heeft geschreven of wat over iemand is geschreven: geen vrije tekst, geen titels van kaarten of
ideeën, geen plaats, naam, leeftijd of e-mailadres. Eigenschappen die met `has_` beginnen zijn
ja/nee ("heeft iemand iets ingevuld?"), nooit de tekst zelf.

De vrije tekst van de testvragenlijst ("Waar twijfelde je?") staat **alleen** in Supabase, in de
tabel `test_feedback` (niet leesbaar vanuit de browser).

## Wat PostHog bewust niet doet

PostHog stelt in zijn eigen projectinstellingen dingen aan die in de browser terechtkomen (sessie-opnames,
autocapture van klikken met knoptekst, enquêtes, heatmaps). De app zet die allemaal **uit**, wat het
project ook zegt (`POSTHOG_CONFIG` in `src/lib/posthog/client.ts`, met een test): alleen de events uit
deze lijst gaan weg. Zonder dat zouden opnames de tekst op het scherm (profiel, titels van ideeën,
plaatsen) bevatten en zouden klikken de tekst van de knop meesturen. Je hoeft dus geen `$autocapture`- of
opnames in PostHog te verwachten. Zet gerust ook in het project zelf Session replay en Autocapture uit.

## Waar je het ziet

1. **Sleutel instellen** (eenmalig): `NEXT_PUBLIC_POSTHOG_KEY` is de *project*-sleutel van PostHog
   (begint met `phc_`; die is bedoeld om in de browser te staan). Zet hem lokaal in `.env.local` en
   in Vercel bij Environment Variables (Preview en Production). Een persoonlijke API-sleutel
   (`phx_…`) heb je hier niet voor nodig en hoort er niet in. Zonder sleutel verstuurt de app niets.
   **Regio**: de app praat standaard met de EU-server van PostHog (`eu.i.posthog.com`, ook zo toegestaan in de
   beveiligingsregels). Staat jouw project op de Amerikaanse server (`us.i.posthog.com`), zeg het dan:
   dan moet `NEXT_PUBLIC_POSTHOG_HOST` aangepast en die toestemming in `src/proxy.ts` uitgebreid worden,
   anders blokkeert de browser het versturen.
2. **Toestemming**: events gaan pas weg nadat de bezoeker in de cookiebanner "accepteren" koos. Wie
   weigert, wordt niet gemeten (ook jijzelf niet bij een testrun: accepteer eerst).
3. **PostHog → Activity** (of Live events): na een testrun staan de events er binnen een minuut.
   Klik een event open om de eigenschappen te zien.
4. **Tijdens ontwikkelen** staat elk event ook in de browserconsole:
   `window.__windowEvents` (alleen met `npm run dev`, ook zonder sleutel en toestemming).

## Alle events

`wizard_variant` is `associations` (de beeld-intake, de huidige standaard), `cards` of `legacy`.
`planId` is het id van het boek, `ideaKey` is `idea-0` … `idea-5` of `wildcard`.

| Event | Wanneer | Eigenschappen |
|---|---|---|
| `landing_viewed` | landingspagina getoond | – |
| `landing_start_submitted` | startformulier op de landing verstuurd | `has_text` (ja/nee, nooit de tekst) |
| `intake_started` | een wizard geopend | `wizard_variant`, `editing`, `gift`, `restored` |
| `intake_page_viewed` | een wizardpagina getoond | `wizard_variant`, `page`, `index`, `of` |
| `intake_page_back` | op "Terug" gedrukt | `wizard_variant`, `page`, `index`, `stage` |
| `intake_page_completed` | een wizardpagina afgerond | `wizard_variant`, `page`, `index`, `duration_ms` |
| `intake_submitted` | de intake verstuurd | `wizard_variant`, `pages`, `total_ms`, `images` |
| `intake_submit_failed` | versturen mislukt | `wizard_variant` |
| `discovery_domain_toggled` | kaartenwizard: een wereld aan of uit | `wizard_variant`, `domain`, `on` |
| `discovery_card_toggled` | kaartenwizard: een activiteit aan of uit | `wizard_variant`, `activity_id`, `on`, `batch` |
| `discovery_more_clicked` | kaartenwizard: "Toon meer" | `wizard_variant`, `batches` |
| `discovery_skipped` | kaartenwizard: interessestap overgeslagen | `wizard_variant` |
| `discovery_stage_completed` | kaartenwizard: werelden of kaarten afgerond | `wizard_variant`, `stage`, `selected`, `surprise`, `batches_shown`, `duration_ms` |
| `association_round_completed` | een ronde beelden afgerond | `round`, `selected`, `mode`, `duration_ms` |
| `association_swipe` | swipe-modus: een beeld bewaard of gepasseerd | `id`, `liked` |
| `profile_viewed` | het scherm "Zo kijken wij door jouw venster" getoond | – |
| `profile_agreed` | "Klopt, open mijn venster" | `adjusted` (is er bijgestuurd?) |
| `profile_axis_changed` | een schuif op het profielscherm verplaatst | `axis` |
| `profile_reflection` | bij akkoord: is "Wat missen we nog?" ingevuld | `has_reflection` |
| `window_exported` | de afbeelding van het venster gedownload | `images` (aantal beelden) |
| `checkout_viewed` | betaalpagina getoond | – |
| `checkout_pay_clicked` | "Maak het echt" ingedrukt | `is_gift` |
| `generation_stalled` | wachtscherm langer dan 120 s | `stage`, `seconds` |
| `plan_viewed` | het boek geopend | `planId` |
| `idea_opened` | een idee geopend | `planId`, `ideaKey` |
| `idea_liked` | hartje of duim bij een idee | `planId`, `ideaKey`, `value` |
| `idea_feedback_given` | duim omhoog of omlaag in het ideevenster | `planId`, `ideaKey`, `value` |
| `one_thing_committed` | "Dit ga ik doen" | `planId`, `ideaKey`, `isOneThing` |
| `wildcard_revealed` | de wildcard opengemaakt | `planId` |
| `plan_pdf_downloaded` | de PDF geopend | `planId`, `source` |
| `idea_book_share_clicked` | "Deel je Idea Book" ingedrukt | `url` |
| `idea_book_share_whatsapp_clicked` | WhatsApp-link na het delen geklikt | – |
| `shared_idea_book_viewed` | een gedeeld boek bekeken | `planId` |
| `shared_idea_book_cta_clicked` | een knop op de gedeelde pagina geklikt | `planId` |
| `invite_card_opened` | het uitnodigingspaneel geopend | `source` |
| `invite_card_shared` | uitnodiging gedeeld, gedownload of gekopieerd | `format`, `method`, `source` |
| `test_feedback_submitted` | de testvragenlijst verstuurd | `flow_score`, `profile_score`, `doors_score`, `door_pick`, `door_kind`, `would_pay`, `has_doubt`, `stored` |

### De testvragenlijst (alleen op de testversie)

| Eigenschap | Vraag | Waarden |
|---|---|---|
| `flow_score` | Hoe voelde het om je venster te vullen? | 1–5 |
| `profile_score` | Voelde je je begrepen door "Zo kijken wij door jouw venster"? | 1–5 |
| `doors_score` | Snapte je waarom je deze deuren kreeg? | 1–5 |
| `door_pick` | Welke deur zou je echt gaan doen? | 1–6 de ideeën, 7 de wildcard (de volgorde waarin het boek ze toont), 0 = geen van deze |
| `door_kind` | de soort van die deur | `natural`, `discovery`, `unexpected`, `stretch`, `wildcard` |
| `would_pay` | Zou je de prijs betalen? | `yes`, `maybe`, `no` |
| `has_doubt` | is "Waar twijfelde je?" ingevuld | ja/nee |
| `stored` | is het antwoord ook in Supabase opgeslagen | ja/nee |

Dezelfde cijfers staan ook in Supabase (`test_feedback`: `flow_score`, `profile_score`, `doors_score`,
`door_pick`, `door_kind`, `would_pay`), zodat ze niet verloren gaan zolang de PostHog-sleutel
ontbreekt, plus de vrije tekst in `doubt`. De kolommen komen uit migratie `0020`; zonder die migratie
slaat de app alleen de oudere antwoorden op en meldt dat in de serverlog.

## Een testrun in één oogopslag

**Funnel** (PostHog → Product analytics → Funnel), in deze volgorde:
`landing_viewed` → `intake_started` → `profile_viewed` → `profile_agreed` → `checkout_viewed` →
`checkout_pay_clicked` → `plan_viewed` → `idea_opened` → `one_thing_committed`.
Filter eventueel op `wizard_variant = associations`.

**Waar haken mensen af?** Een tabel met `intake_page_completed`, uitgesplitst op `page`, met de
gemiddelde `duration_ms`.

**Wachtscherm**: tel `generation_stalled`, uitgesplitst op `stage`: dat is waar het hangt.

**Antwoorden van testers**: `test_feedback_submitted`, uitgesplitst op `would_pay`, met gemiddelde
`flow_score`, `profile_score` en `doors_score`; een staafdiagram op `door_kind` laat zien welke richting
mensen echt gaan doen. De vrije tekst lees je in Supabase: Table editor → `test_feedback` → kolom `doubt`.

**Delen**: `invite_card_shared` uitgesplitst op `method` (native, download, whatsapp, copy) en
`format`; `idea_book_share_clicked` voor het delen van een eigen boek.
