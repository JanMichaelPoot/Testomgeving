# Testversie op een Vercel-preview ("Het venster", fase 8)

Doel: één link die je met 5–10 testers deelt, met echte generatie en Stripe-testbetalingen,
terwijl `main`/Production ongewijzigd blijft. Zet sleutels alleen in Vercel, nooit in code of chat.

## 1. Branch pushen
Maak branch `venster`, commit de wijzigingen en push. Vercel maakt automatisch een Preview
Deployment; de URL staat in Vercel onder *Deployments* (en bij de commit op GitHub).

## 2. Database (Supabase SQL Editor), vóór het delen
Voer uit, in deze volgorde, als dat nog niet gebeurd is:
- `supabase/migrations/0014_local_research_cache.sql`
- `supabase/migrations/0015_discovery_history.sql`
- `supabase/migrations/0016_progress_stage.sql`
- `supabase/migrations/0017_test_feedback.sql`

Let op: de preview gebruikt dezelfde Supabase als Production (er is geen aparte testomgeving).
Testboeken komen dus in dezelfde tabellen; ze zijn herkenbaar aan Stripe-testbetalingen.

## 3. Environment variables in Vercel, scope alleen *Preview*
*Settings → Environment Variables → Add*, vink alleen **Preview** aan (eventueel beperkt tot branch `venster`):

| Variabele | Waarde |
|---|---|
| `STRIPE_SECRET_KEY` | je `sk_test_…` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | je `pk_test_…` |
| `STRIPE_WEBHOOK_SECRET` | het `whsec_…` van de test-webhook uit stap 4 |
| `NEXT_PUBLIC_ASSOCIATION_WIZARD_PERCENT` | `100` (iedereen krijgt de beeld-intake en de venster-landing) |
| `NEXT_PUBLIC_WINDOW_PRICE_CENTS` | `600` |
| `NEXT_PUBLIC_TEST_FEEDBACK` | `1` (testbanner met testkaart + vragenlijst onder het boek) |
| `NEXT_PUBLIC_SITE_URL` | de preview-URL (anders wijzen deel- en Stripe-terugkeerlinks naar Production) |

Anthropic-, Resend-, PostHog- en Supabase-sleutels: zelfde als Production (staan ze nu alleen op
*Production*, vink dan ook *Preview* aan). Na het aanpassen: *Redeploy* van de preview.

## 4. Stripe-webhook voor de preview (Stripe in **testmodus**)
1. Stripe Dashboard → schakel *Test mode* aan → *Developers → Webhooks → Add endpoint*.
2. Endpoint-URL: `<preview-URL>/api/stripe/webhook`.
3. Events: dezelfde als de Production-webhook (minimaal `checkout.session.completed`).
4. Kopieer de *Signing secret* (`whsec_…`) naar `STRIPE_WEBHOOK_SECRET` (Preview) en redeploy.
5. Controle: één testbetaling met kaart `4242 4242 4242 4242`, elke toekomstige datum, elke CVC.
   In Stripe moet het event met status 200 binnenkomen; het boek verschijnt daarna op `/plan`.

## 5. Deployment Protection
Staat *Vercel Authentication* aan voor Previews, dan kunnen testers zonder Vercel-account niet in. Kies:
- **Shareable link** (aanbevolen): op de deployment *Share* → link met bypass-token; werkt per deployment, dus na een nieuwe push opnieuw delen.
- Of *Settings → Deployment Protection* uit voor Previews (dan is elke preview openbaar).

## 6. Fluid compute
*Settings → Functions*: controleer dat Fluid compute aan staat. Dan mag een functie tot 300 s
draaien (ook op Hobby); de generatie duurt 1–2 minuten.

## 7. Kosten per test
Volgens `docs/discovery-api-costs.md`: ≈ $0,14–0,15 per boek via de beeld-intake (onderzoek met
Haiku + schrijven met Sonnet), bij een lege cache. **10 tests ≈ $1,50 (± €1,40)**, plus wat extra
als testers opnieuw genereren. Stripe-testbetalingen kosten niets. Resend: binnen het gratis tegoed.

## 8. Wat testers zien
- Landing met "Open je venster" en "Geef een venster cadeau".
- Bovenaan de betaalpagina: *"Testversie · betaal met testkaart 4242 4242 4242 4242, er wordt niets afgeschreven."*
- Onder het boek drie vragen (gevoel 1–5, zou je €6 betalen, waar twijfelde je). Score en
  betaalantwoord gaan naar PostHog (`test_feedback_submitted`), de vrije tekst alleen naar de
  tabel `test_feedback` (lezen in Supabase → Table editor).

## 9. Klaar als
Je zelf op je telefoon via de preview-link een volledige run hebt gedaan: testbetaling, echte
plekken in je buurt, PDF in de mail. Pas daarna de link delen.

## Let op: "Betaling overslaan"
De bestaande knop *Betaling overslaan* in de testbalk werkt op elke omgeving, ook Production:
iedereen die hem ziet krijgt een gratis boek (en het kost jou de API-kosten). Haal hem weg of zet
hem achter een omgevingsvariabele voordat je echt live gaat; voor de preview is hij handig.
