# Live gaan: checklist voor Stripe en het adres van de site

Wat de code al doet (Fase 1): de modus staat in `STRIPE_MODE` (`test` of `live`); de geheime sleutel moet daarbij passen, anders weigert de site een betaling te starten (er wordt dus nooit stilletjes in de verkeerde modus afgerekend). De banner "Testversie · testkaart 4242…" verschijnt alleen in testmodus. Het adres van de site komt uit één plek (`src/lib/siteUrl.ts`): op production nooit een `*.vercel.app`-adres.

## Wat jij moet doen (Stripe en Vercel)

1. **Stripe-dashboard, live-modus** (rechtsboven "Test mode" uit): bedrijfsgegevens en uitbetaalrekening compleet (VantageLabs, KvK 42198388).
2. **Betaalmethoden**: Instellingen, Betaalmethoden: zet **iDEAL** en **Kaarten** aan voor de live-modus. De code geeft bewust geen lijst mee; Checkout toont alles wat aan staat (EUR).
3. **Live-sleutels** (Ontwikkelaars, API-sleutels): `sk_live_…` en `pk_live_…`.
4. **Webhook (live)**: Ontwikkelaars, Webhooks, eindpunt `https://www.windowinto.nl/api/stripe/webhook`, gebeurtenissen `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` en `checkout.session.expired` (kijk in `src/app/api/stripe/webhook/route.ts` welke de code afhandelt), en kopieer het `whsec_…`.
5. **Vercel, project, Environment Variables, alleen Production**:
   - `STRIPE_MODE` = `live`
   - `STRIPE_SECRET_KEY` = `sk_live_…`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = `pk_live_…`
   - `STRIPE_WEBHOOK_SECRET` = `whsec_…` van stap 4
   - `NEXT_PUBLIC_SITE_URL` = `https://www.windowinto.nl` (of het adres zonder www, als dat het hoofdadres is; staat er een `vercel.app`-adres, dan negeert de site dat op production)
   - Preview blijft op `STRIPE_MODE=test` en test-sleutels.
6. **Redeploy** zonder buildcache.
7. **Controle** (`/admin`, blok "Instellingen van deze deployment"): `STRIPE_MODE` toont LIVE zonder PROBLEEM, `NEXT_PUBLIC_SITE_URL` toont het echte adres.
8. **Eén echte betaling** van €7,50 met je eigen kaart en iDEAL, daarna in het Stripe-dashboard terugboeken. Controleer: geen testbanner, de mail komt aan, het boek verschijnt.

**Gratis testboeken zonder Stripe-pagina** (Stap 206, sinds Stap 232 standaard UIT): alleen met `FREE_TEST_ORDERS=1` én Stripe in testmodus slaat de betaalknop Stripe over en start het boek meteen (`src/lib/freeTest.ts`). Met een live-sleutel staat dat vanzelf uit; `FREE_TEST_ORDERS=0` zet het ook in testmodus uit, om de echte Stripe-testbetaling te proberen.

## Nog open vóór echte verkoop (buiten deze fase)
- Btw-nummer in `src/lib/company.ts` (staat er nog niet).
- Resend-domein verifiëren, anders komt de bevestigingsmail niet aan bij klanten.
- Juridische controle van voorwaarden, herroepingsrecht en privacyverklaring.

---

# Live gaan met 20 echte testers (23 nov 2026)

De technische stappen staan hierboven (Stripe, sleutels, webhook). Dit deel is de volgorde, de bewaking en de meting.

## Fase A: klaarzetten (jij, ±1 dag; niets daarvan kost modelgeld)

1. **Migratie 0027** (`supabase/migrations/0027_discount_codes.sql`) in de SQL-editor draaien, daarna `npx tsx --env-file=.env.local scripts/discount-smoke.ts`: dat controleert tabel, uitgeven, tegelijk vasthouden en opruimen, en ruimt zijn eigen testrij op. Zonder migratie draait alles gewoon door, alleen zonder kortingscodes.
1b. **Migraties 0028 en 0029** (`supabase/migrations/0028_discount_compensation.sql` voor de compensatiecodes uit de admin, `0029_discount_friend_codes.sql` voor de drie vriendcodes in de mail): in de SQL-editor, in die volgorde. Daarna `npx tsx --env-file=.env.local scripts/friend-code-smoke.ts` (veilig op elk moment, raakt alleen zijn eigen testrijen). Zonder 0029 gaat de mail zonder vriendblok uit en meldt het admin-overzicht dat in amber. Draai `scripts/discount-smoke.ts` alleen vóór het eerste verstuurde boek: het weigert zelf als de nieuwste bestelling al een echte code heeft.
2. **Resend-domein verifiëren** (DNS-records bij je domeinhost) en `EMAIL_FROM` op een adres van dat domein zetten. Zonder dit gaat een mail alleen naar het adres van het Resend-account: testers krijgen hun boek en code dan niet. Controle: laat een boek naar een gewoon hotmail- of gmail-adres gaan.
3. **Stripe live** volgens de stappen hierboven (bedrijfsgegevens, iDEAL en kaarten, live-sleutels, webhook met `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired` en `charge.refunded`, variabelen op Production, redeploy zonder buildcache). Zet in Stripe ook je logo en kleuren (Instellingen, Branding), je supportadres en "klantmails over betalingen" aan.
4. **Testlimiet**: `TEST_MAX_BOOKS_PER_IP=2` in Vercel (twee boeken per verbinding) en je eigen adres in `TEST_QUOTA_EXEMPT_IPS`. Dan blijft een verdwaalde link of een dubbele klik binnen je budget.
5. **Uitgavenplafonds buiten de code**: een maandlimiet in de Anthropic-console (bijvoorbeeld $50), een budgetmelding op de Google-sleutel (staat op $5 voorgesteld in `docs/google-places-instellen.md`), en kijk of Vercel een uitgavenlimiet heeft. Reken: 20 testers x 2 boeken x ±$0,40 is ±$16, de harde grens per boek is $0,50.
5b. **Capaciteitsrem** (Stap 237, `src/lib/capacity.ts`): de betaalknop sluit vóór de betaling bij het dagmaximum (`WINDOW_DAILY_BOOK_LIMIT`, standaard 40 boeken per Nederlandse dag; "0" of "off" = geen maximum), bij `WINDOW_CHECKOUT_PAUSED=1` (met de hand dicht, bijvoorbeeld als het Anthropic-saldo bijna op is) en automatisch als de laatste drie boeken achter elkaar mislukten. Zet het maximum op wat je tegoed aankan: aantal boeken x ±$0,40 moet onder je Anthropic-saldo blijven. Een wijziging in Vercel werkt pas na een nieuwe deploy. De stand staat in het admin-overzicht ("Bestellen staat open: N boeken vandaag") en in `/api/health` (`ordering`: open, daily, paused of failing). Jij zelf, ingelogd in /admin, wordt nooit tegengehouden.
6. **Btw-nummer** in `src/lib/company.ts` en een juridische controle van voorwaarden, herroepingsrecht en privacyverklaring. **De voorwaarden moeten de kortingscode noemen** (eenmalig, geldig 90 dagen, niet inwisselbaar voor geld, niet te combineren): de mail belooft dat al.
7. **Bewaking aanzetten**: een gratis pinger op `https://www.windowinto.nl/api/health` (mailt jou bij een niet-200), en kijk in de Vercel-logs naar `"event":"request_error"`. `NEXT_PUBLIC_TEST_FEEDBACK=1` laat de mail om de vragenlijst vragen.
8. **Twee echte betalingen van jezelf**: één met iDEAL, één met kaart. Controleer per betaling: geen testbanner, bevestigingsmail met PDF **en kortingscode**, boek in beeld, in Stripe één regel met de betaling, in `/admin` de bestelling op "succeeded". Gebruik daarna de code voor een tweede, echte bestelling: Stripe moet €2,50 korting tonen en €5,00 rekenen, en de code staat daarna op "gebruikt" (een tweede poging moet "al gebruikt" zeggen). Boek beide terug in Stripe; `charge.refunded` zet de bestelling op "refunded". (Een code van een terugbetaalde bestelling blijft geldig: bewust niet gebouwd.)

## Fase B: de test met 20 testers (2 weken)

**Wie**: 20 mensen die je niet dagelijks spreekt, gemengd: ±15 Nederlandstalig en ±5 Engelstalig, voor zichzelf of voor iemand anders, verschillende plaatsen (ook buiten de Randstad: daar valt de plekkendekking het eerst tegen).

**Hoe betalen**: echt, met iDEAL of kaart. Dat test de hele keten en laat zien waar mensen afhaken. Zeg vooraf: "je krijgt je €7,50 terug nadat je de vragen hebt ingevuld" (terugboeken in Stripe). Het meet de betaalstroom, niet hoeveel ze zouden willen betalen: dat vraag je in de vragenlijst (de vier Van Westendorp-prijsvragen; die staan nog niet in het formulier). Een korting van 100% laat de betaalstroom onbewezen en geeft geen prijssignaal.

**Volgorde**:
1. **Dag 1 (kanarie)**: 3 vertrouwde testers. Kijk dezelfde dag in de Vercel-logs (`request_error`), in `/admin` (mislukte of blijven-hangende boeken) en laat de plekken van hun boeken controleren met `npx tsx scripts/places-audit.ts --since <datum>`.
2. **Dag 3 tot 7**: de overige 17, in twee golven. Een fout die je in golf 1 ziet, los je op voor golf 2.
3. **Dag 7 tot 14**: terugboeken, de vragenlijst en eventueel een korte videocall met 3 testers; kijk of de kortingscode wordt gebruikt.

**Wat je meet** (PostHog en de database):
- De trechter: `landing_viewed`, `intake_started`, `profile_viewed`, `checkout_pay_clicked`, `payment_succeeded`, `plan_viewed`; per stap hoeveel afhaken.
- Techniek: aantal mislukte of blijven-hangende boeken (`/admin`), mailbezorging (`email_sent_at`), de duur tot het boek klaar is, kosten per boek (`progress_meta.cost`).
- Kwaliteit: `scripts/places-audit.ts` (dekking en werkende links per idee), de vragenlijst (stroom, profiel, plekken, "zou je €7,50 betalen").
- Korting: hoeveel testers de code gebruiken binnen twee weken.

**Vooraf vastgelegd wanneer het slaagt** (stel dit zelf bij, maar leg het vóór de start vast):
- 0 betalingen die technisch mislukken; 100% van de betaalde boeken wordt geleverd (scherm én mail) binnen 3 minuten.
- Plekkendekking minstens 90% van de ideeën met een werkende link.
- Gemiddelde stroomscore minstens 4 van 5, en minstens de helft zegt "ja" of "misschien" op €7,50.
- Minstens 3 van de 20 gebruiken de kortingscode (een teken dat een tweede boek bij hen leeft).

**Stoppen**: een kritieke fout (verkeerde bedragen, dubbele afschrijving, boeken zonder mail) legt je meteen stil door in Vercel `STRIPE_MODE` terug te zetten of de betaalknop te laten falen; boek alle open betalingen terug in Stripe. Hou een lijstje met de mailadressen van de testers bij zodat je ze kunt bereiken.

## Kortingscode (Stap 230)
Na elke betaalde bestelling krijgt de koper in de mail een eenmalige code (`WI-XXXX-XXXX`) voor €2,50 korting op één volgend boek, 90 dagen geldig. Bij de bestelling is er een stil "Heb je een kortingscode?" onder de vinkjes. De code wordt vastgehouden zodra de betaling bij Stripe start, verbruikt als Stripe de betaling bevestigt (webhook) en komt vrij als de betaling mislukt of verloopt; een Stripe Checkout met code duurt hoogstens een uur. Elke betaalde bestelling levert opnieuw een code op, ook een bestelling met korting. Een bestelling gaat nooit mis door de code: zonder de tabel krijgt de mail gewoon geen codeblok.

## Als de betaling niet start (Stap 231)
De betaalknop zegt dan "We konden de betaling niet starten. Er is niets afgeschreven." en het scherm blijft staan. De oorzaak staat in de Vercel-logs als een regel met `"event":"checkout_start_failed"` (Stripe-type, -code en korte melding); ben je zelf ingelogd op `/admin` in dezelfde browser, dan staat de oorzaak ook achter de melding op het scherm. Meest voorkomend bij live gaan: de sleutel is niet de `sk_live_`-sleutel, `STRIPE_MODE` en de sleutel verschillen, het Stripe-account is nog niet geactiveerd voor live betalingen, of de wijziging is nog niet opnieuw gebouwd (een nieuwe waarde in Vercel geldt pas voor een nieuwe deploy). **Zie je nog "gratis in de testfase" of de testbanner, dan draait die omgeving nog in testmodus**: controleer in `/admin` (blok "Instellingen van deze deployment") of `STRIPE_MODE` op LIVE staat zonder PROBLEEM, en bouw opnieuw zonder buildcache.

## Staat de kortingscode in de mail? (Stap 234)
Alleen als migratie `0027_discount_codes.sql` is gedraaid. Controleer `https://www.windowinto.nl/api/health`: `"discountCodes":true`. Zonder de tabel gaat een bestelling gewoon door maar de mail heeft geen codeblok, en `/admin` meldt dat in rood. Bestellingen van vóór de migratie krijgen alsnog een code met `npx tsx --env-file=.env.local scripts/discount-backfill.ts --issue` (zonder `--issue` een proefrun); het script verstuurt niets, de codes worden afgedrukt.

## Een plek klopt niet: compensatiecode sturen (Stap 235)
De startpagina belooft: mail naar `info`vantagelabs.nl` en je krijgt een extra kortingscode van €2,50. Zo stuur je hem: open in `/admin/orders` de bestelling van de koper (zoek op het ordernummer), ga naar het blok "Kortingscodes en compensatie", noteer eventueel de reden (alleen voor jezelf), vink "Ik wil deze mail nu naar de koper sturen" aan en klik "Mail extra kortingscode van €2,50". De mail gaat naar het adres van de bestelling, in de taal van het boek; antwoorden komen bij `info`vantagelabs.nl` binnen. Hoogstens 3 per bestelling. Eenmalig te draaien in de Supabase SQL-editor, na 0027: `supabase/migrations/0028_discount_compensation.sql`; zonder die migratie meldt het formulier dat hij ontbreekt.

