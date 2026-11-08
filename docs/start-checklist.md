# Startchecklist: zorgen dat klanten hun boek krijgen

Opgesteld op 5 november 2026 na een controle vanaf de werkmap (niets aangepast bij Resend, Stripe of Vercel). Vier dingen, in deze volgorde. Zet er een vinkje bij en zeg "klaar", dan controleer ik wat controleerbaar is.

## Wat ik heb gecontroleerd (gemeten, niet aangenomen)

| Onderdeel | Uitkomst |
|---|---|
| Migratie 0022 (herhaalhaak, prijstest; de cadeaubon is eruit) | **Niet uitgevoerd.** De kolommen `payments.followup_consent_at`, `payments.price_variant` en `window_plans.followup_email` bestaan niet in de database achter `.env.local`. Migraties 0017 t/m 0021 zijn wel uitgevoerd. |
| Stripe-webhook (testmodus) | **Geen enkel eindpunt** aangemaakt (de testsleutel in `.env.local` geeft een lege lijst). Betalingen blijven daardoor op "pending" in de database. |
| Resend, DNS van `windowinto.nl` en `vantagelabs.nl` | Beide hebben een DKIM-record (`resend._domainkey`). De records op `send.<domein>` zijn **niet** die van Resend: de MX wijst naar `feedback.forge.rmta.net` en de SPF noemt andere IP-adressen. Resend verwacht daar een MX naar `feedback-smtp.<regio>.amazonses.com` en een SPF met `include:amazonses.com`. Dit wijst op een domein dat niet op "Verified" staat. De echte status kan ik niet zien (de Resend-sleutel mag alleen mails sturen). |
| Lokale instellingen | `EMAIL_FROM` is `onboarding@resend.dev` (werkt alleen naar jouw eigen adres), `STRIPE_WEBHOOK_SECRET` en `CRON_SECRET` zijn leeg, `NEXT_PUBLIC_SITE_URL` is localhost. De PostHog-sleutel staat wel lokaal. Wat er op Vercel staat kan ik niet zien: dat zie je in `/admin` onder "Instellingen van deze deployment". |

## 1. Resend: het verzenddomein verifiëren (belangrijkste)

Zonder dit krijgt alleen jij je boek per mail.

1. Ga naar resend.com/domains en kijk welk domein je daar hebt (windowinto.nl of vantagelabs.nl) en de status.
2. Klik het domein open. Resend toont drie records die er moeten staan: een **TXT** `resend._domainkey` (staat er al), een **MX** op `send` en een **TXT** op `send` met `v=spf1 include:amazonses.com ~all`.
3. Pas bij je domeinhost (Vimexx) de records op `send` aan zodat ze exact gelijk zijn aan wat Resend toont. Is er al een record op `send` van een ander doel, dan botst dat: vraag Resend welk subdomein je kunt gebruiken (je kunt een ander subdomein kiezen bij het toevoegen van het domein).
4. Klik in Resend op "Verify DNS Records" en wacht tot de status **Verified** is (minuten tot een paar uur).
5. Zet in Vercel (Production en Preview) `EMAIL_FROM` op `WINDOW <hello@jouwdomein.nl>`. Het adres hoeft niet te bestaan, het domein moet het verifieerde domein zijn.
6. Redeploy.

Controle door mij: geef me een e-mailadres dat niet het jouwe is. Ik stuur dan een echte testmail met dezelfde code als de bevestigingsmail en lees het resultaat af.

## 2. Migratie 0022 uitvoeren

1. Open Supabase, het project, **SQL Editor**, nieuwe query.
2. Plak de volledige inhoud van `supabase/migrations/0022_followup_pricing.sql` en klik Run.
3. Zeg "klaar". Ik controleer dat de kolommen er zijn.

## 3. Stripe-webhook

Het eindpunt is `https://<jouw-adres>/api/stripe/webhook`. De code handelt deze gebeurtenissen af: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired` en `charge.refunded`. (`charge.refunded` markeert een terugbetaalde betaling als `refunded`.)

Zolang je met bekenden test:
1. Stripe, zet **Test mode** aan, Ontwikkelaars, Webhooks, **Eindpunt toevoegen**.
2. URL: het adres van je testomgeving plus `/api/stripe/webhook`. Selecteer de vijf gebeurtenissen hierboven.
3. Kopieer het **Signing secret** (`whsec_...`).
4. Vercel, die omgeving (testomgeving of Preview), `STRIPE_WEBHOOK_SECRET` = dat secret. Redeploy.
5. Voor echte klanten later hetzelfde in live-modus met de livesleutel (stappen in `docs/live-gaan.md`).

Controle: doe een testbetaling; de betaling in de database moet op `succeeded` komen te staan (ik kan dat uit de database lezen).

## 4. Meten en beveiligen in Vercel

In Vercel, Environment Variables, voor de omgeving die bezoekers zien:
- `NEXT_PUBLIC_POSTHOG_KEY` (de projectsleutel `phc_...`) en `NEXT_PUBLIC_POSTHOG_HOST` = `https://eu.i.posthog.com`. Lokaal staat de sleutel al; controleer of hij ook op Vercel staat. Het is een `NEXT_PUBLIC_`-variabele: pas na een **redeploy zonder buildcache** actief.
- `CRON_SECRET` = een lange willekeurige tekenreeks (bijvoorbeeld 40 tekens). Zonder deze waarde zijn de twee dagelijkse mailroutes (herinnering na twee dagen en de herhaalhaak) voor iedereen aan te roepen.
- Controle: `/admin`, blok "Instellingen van deze deployment": Resend, `EMAIL_FROM`, Stripe-modus, webhook, PostHog en cron moeten allemaal groen staan. Stuur me een screenshot of de tekst, dan lees ik mee.

## Daarna

Een volledige testbestelling met een ander e-mailadres dan het jouwe: betaling, boek, mail met PDF, webhook. Pas als die slaagt is het veilig om bekenden uit te nodigen (`docs/testen-met-bekenden.md`).
