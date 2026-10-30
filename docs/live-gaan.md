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

## Nog open vóór echte verkoop (buiten deze fase)
- Btw-nummer in `src/lib/company.ts` (staat er nog niet).
- Resend-domein verifiëren, anders komt de bevestigingsmail niet aan bij klanten.
- Juridische controle van voorwaarden, herroepingsrecht en privacyverklaring.
