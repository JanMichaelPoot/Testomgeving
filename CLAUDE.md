# WINDOW — bouwopdracht voor Claude Code

Plak dit als eerste prompt in een nieuwe Claude Code-sessie in dit project, of sla het op als `CLAUDE.md` in de projectroot zodat Claude Code het automatisch als context leest.

---

## Project

Ik bouw **WINDOW**, een digitale possibility-discovery app. Gebruikers delen kort
context over hun situatie of stemming; de app genereert via AI meerdere
uiteenlopende mogelijkheden (praktisch, ongewoon, ambitieus, speels), laat de
gebruiker erop reageren en verfijnen, en convergeert daarna naar 1–3 concrete
opties. Voor een klein bedrag (€2–5) zet WINDOW de gekozen mogelijkheid om in
een gepersonaliseerd, uitvoerbaar "Window Plan".

**Doel van dit traject:** een lean MVP live binnen 8 weken, om te testen of
mensen ervoor betalen, het delen en er iets mee doen — niet het volledige
platform bouwen. Houd de scope strikt (zie "Buiten scope" hieronder).

**Tagline:** "A Window Into What Could Be"
**Kernbelofte:** "You don't need another answer. Sometimes you need to see
another possibility."
**Toon van de UI-copy:** intelligent, nieuwsgierig, warm, licht ondeugend —
dichter bij een premium reismagazine dan een productiviteitsdashboard.
Schrijf alle gebruikersgerichte teksten in het Engels (zoals in de
meegeleverde mockup); code, comments en commit messages ook in het Engels.
Praat tegen mij in het Nederlands.

---

## Techstack (vastgesteld — niet wijzigen zonder overleg)

| Onderdeel | Keuze |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| Styling | Tailwind CSS |
| Hosting | Vercel |
| Database + auth | Supabase (Postgres) |
| Betalingen | Stripe (Checkout, geen zelf opgeslagen kaartgegevens) |
| AI / possibility engine | Claude API (Anthropic) |
| E-mail | Resend |
| Analytics | PostHog |
| Domeinnaam | extern geregeld (Vimexx/TransIP) — niet relevant voor de code |

---

## De kernloop

```
OPEN → CONTEXT → DIVERGE → INTERACT → CONVERGE → BETALEN → PLAN
```

## Kernschermen (bouw niet meer dan dit voor de MVP)

1. **Landing** — kernbelofte + één duidelijke CTA ("Open a Window")
2. **Intake** — max. 5 vragen: situatie, tijd, budget, gewenste verrassing, gezelschap
3. **Ideeën-scherm** — 8–12 kaarten, met reacties: like / skip / "make it weirder" / "make it more practical"
4. **Convergentie + betaalscherm** — 1–3 kandidaten met korte uitleg waarom ze passen, CTA "Make this real" → Stripe Checkout
5. **Window Plan** — het betaalde resultaat: gekozen idee, waarom het past, concrete stappen, eerste actie, kosten-/tijdsindicatie. Ook als PDF en per e-mail.

---

## Databaseschema (startpunt — pas aan waar nodig, maar bespreek grote afwijkingen)

```sql
users            (id, email, created_at, marketing_opt_in)
sessions         (id, user_id nullable, created_at, status)
intake_answers   (id, session_id, topic, time_available, budget,
                   desired_surprise, company, raw_json)
ideas            (id, session_id, lens, title, description, status
                   -- status: generated | liked | skipped | refined)
window_plans     (id, session_id, chosen_idea_id, title, why_it_fits,
                   steps_json, first_action, cost_estimate, time_estimate,
                   pdf_url, created_at)
payments         (id, session_id, stripe_payment_id, amount, currency,
                   status, created_at)
```

Houd persoonsgegevens zoveel mogelijk los van gedragsdata: koppel
`intake_answers` en `ideas` aan een los `session_id`, niet direct aan
`users.email`, zodat we conform AVG zo min mogelijk herleidbare data
bewaren.

---

## Betalingen & juridisch — bouw dit mee, niet als los addertje achteraf

- Stripe Checkout in test- én livemodus; nooit kaartgegevens zelf opslaan.
- **Verplicht vóór checkout afronden:** een expliciete checkbox/bevestiging
  dat de gebruiker begrijpt dat door directe levering van het digitale
  Window Plan het wettelijke 14-dagen herroepingsrecht vervalt. Sla deze
  bevestiging (tijdstempel + sessie-ID) op bij de betaling.
- Disclaimer zichtbaar vóór het eerste betaalmoment: WINDOW geeft geen
  medisch, therapeutisch, financieel of juridisch advies.
- Cookiebanner/analytics-toestemming (PostHog) conform AVG, ook in de
  testfase.
- Simpele, statische pagina's voor privacyverklaring en algemene
  voorwaarden (content volgt later — bouw de pagina's en routes nu alvast,
  met placeholder-tekst die duidelijk als placeholder herkenbaar is).

---

## Merk & visuele identiteit

- Accent: `#6C3CE9` (paars), donker-accent `#4B2AA6`, inkt-tekst `#1A1A2E`,
  achtergrond crème `#F5F3EE`, wit `#FFFFFF`.
- Serif voor headlines (bv. Google Font "Fraunces" of "Playfair Display"),
  clean sans-serif voor body (bv. "Inter").
- Terugkerend visueel motief: het venster-frame (zie meegeleverde
  landingspagina-mockup als referentie) — meerdere "vensters"/panelen die
  verschillende mogelijkheden tonen.
- Rounded pill-buttons, veel witruimte, zachte schaduwen — premium SaaS/
  reismerk-gevoel, geen corporate dashboard-stijl.

---

## Buiten scope voor de MVP (bouw dit niet, ook niet "vast even")

- Live wereld-data (evenementen, weer, locaties)
- Native mobiele app
- "Window for Two" en uitgebreide social-/deelfeatures (behalve een simpele
  deel-link)
- Complexe, afgeleide profielopbouw — alleen expliciete voorkeuren opslaan
- Meertaligheid — alleen Engelse UI-copy voor nu

---

## Werkwijze binnen deze sessie

1. Begin met projectfundament: Next.js-project opzetten, Tailwind
   configureren, Supabase-client koppelen, basis folder-structuur,
   `.env.example` met alle benodigde variabelen (Supabase, Stripe, Claude
   API, Resend, PostHog).
2. Bouw daarna incrementeel, scherm voor scherm, in de volgorde van de
   kernloop hierboven. Lever na elk blok iets werkends en testbaars op.
3. Vraag om bevestiging voordat je aan een volgend blok begint als er een
   ontwerpkeuze is die niet expliciet in dit document staat.
4. Houd componenten klein en herbruikbaar; gebruik Tailwind-tokens die
   overeenkomen met de merkkleuren hierboven in plaats van losse hex-codes
   door de hele codebase.
5. Schrijf voor elk nieuw databaseonderdeel ook de bijbehorende Supabase
   migratie.

**Start nu met stap 1: het projectfundament.**

---

## Voortgang

- [x] Stap 1 — Projectfundament: Next.js (App Router, TS) + Tailwind v4,
      brand tokens (`accent`, `accent-dark`, `ink`, `cream`, `paper`) en
      fonts (Fraunces/Inter) in `globals.css`/`layout.tsx`, Supabase
      client/server/middleware helpers, Stripe/Anthropic/Resend/PostHog
      clients in `src/lib/`, `.env.example`, initiële Supabase-migratie
      (`supabase/migrations/0001_init.sql`) + handmatige database-types
      (`src/types/database.ts`), placeholder privacy/terms-pagina's.
- [x] Stap 2 — Landing screen: header (`SiteHeader`) + hero met serif
      headline, subcopy, pill-CTA "Open a Window" (`Button` component,
      herbruikbaar) en een eigen SVG-vensterframe-illustratie
      (`PossibilityWindow`) met 4 panelen als visueel motief — geen externe
      afbeeldingen. Footer met privacy/terms-links. CTA linkt naar
      `/intake` (stub-pagina, wordt in stap 3 uitgewerkt).
- [x] Stap 3 — Intake screen: `IntakeWizard` (client component) met 5 stappen
      (topic/tijd/budget/verrassing/gezelschap), voortgangsbalk, chip-select
      en vrije tekst, Back/Continue-navigatie. Server action `submitIntake`
      (`src/app/intake/actions.ts`) maakt een `sessions`-rij aan, slaat de
      antwoorden op in `intake_answers`, zet een `window_session_id`
      httpOnly-cookie (`src/lib/session.ts`) en redirect naar `/ideas`
      (stub). Fouten (bv. Supabase onbereikbaar) tonen een nette
      foutmelding in de UI i.p.v. te crashen — getest door de laatste stap
      daadwerkelijk in te vullen en te submitten.
- [x] Stap 4 — Ideeën-scherm (divergentie): `src/lib/claude/ideas.ts` roept de
      Claude API aan (tool-use met een geforceerde tool voor betrouwbare
      structured output) om 10 mogelijkheden te genereren, verdeeld over de
      4 lenzen (practical/unusual/ambitious/playful) op basis van de
      intake-antwoorden. `IdeasBoard` (client component) toont de kaarten
      met like/skip/"make it weirder"/"make it more practical". Server
      actions in `src/app/ideas/actions.ts` controleren dat een idee bij de
      huidige sessie hoort voor élke mutatie. `/ideas` (server component)
      genereert ideeën eenmalig per sessie, hergebruikt bestaande rijen bij
      een herbezoek, en toont een nette foutmelding + "Try again"-link als
      Claude/Supabase niet bereikbaar zijn i.p.v. te crashen. CTA "See what
      fits" (actief vanaf 1 like) linkt naar `/converge` (stub). Getest via
      een tijdelijke preview-route met mock-data (niet gecommit) — alle
      interacties (like/skip optimistisch, reshape met laad- en
      foutstatus) werken zoals bedoeld; echte generatie/persistence vereist
      een geldige `ANTHROPIC_API_KEY` en Supabase-credentials.
- [x] Stap 5 — Convergentie + betaalscherm: `src/lib/claude/converge.ts`
      kiest via Claude tool-use 1-3 kandidaten uit de geliked ideeën en
      schrijft per kandidaat een "why it fits"-tekst. `ConvergeBoard` laat
      de gebruiker er één selecteren, toont de verplichte disclaimer (geen
      medisch/therapeutisch/financieel/juridisch advies) en de verplichte
      checkbox voor het herroepingsrecht — de "Make this real"-knop blijft
      disabled tot beide voorwaarden voldaan zijn. Server action
      `createCheckoutSession` (`src/app/converge/actions.ts`) verifieert
      opnieuw sessie-eigenaarschap, maakt een Stripe Checkout Session aan,
      slaat een `payments`-rij op (status `pending`, met
      `withdrawal_waiver_confirmed_at` als tijdstempel + het gekoppelde
      `session_id`) en redirect naar Stripe. Webhook
      `src/app/api/stripe/webhook/route.ts` verifieert de Stripe-signature
      en zet betaling/sessie op `succeeded`/`failed`/`paid` — genereert nog
      geen Window Plan-inhoud, dat is stap 6. `src/lib/stripe.ts` maakt de
      Stripe-client lazy (de SDK valideert de API key anders al bij de
      build, vóórdat runtime env vars beschikbaar zijn). `/plan` (stub)
      is het succes-doel van de checkout. Getest via een tijdelijke
      preview-route met mock-kandidaten (niet gecommit): selectie,
      checkbox-gating en foutafhandeling werken; een echte Stripe-betaling
      vereist jouw eigen Stripe test-sleutels en webhook-secret.
- [x] Stap 6 — Window Plan: `src/lib/claude/plan.ts` genereert via Claude
      tool-use het definitieve plan (titel, why-it-fits, 4-7 concrete
      stappen, eerste actie, kosten-/tijdsindicatie). `src/lib/pdf/
      windowPlan.ts` rendert dit met `pdf-lib` naar een PDF (brand-kleuren,
      geen externe dependencies). `src/app/plan/data.ts`
      (`getOrCreateWindowPlan`) haalt de Stripe Checkout Session op en
      verifieert zelf `payment_status === "paid"` (niet vertrouwen op de
      query param alleen), genereert het plan eenmalig per sessie, uploadt
      de PDF naar de nieuwe publieke Supabase Storage-bucket
      `window-plans` (migratie `0002_storage.sql`), koppelt het
      Stripe-opgegeven klant-e-mailadres aan een `users`-rij (pas ná
      betaling — dus nog steeds los van de gedragsdata ervoor) en stuurt
      de PDF per e-mail via Resend. `/plan` toont het resultaat met
      download-link. Zowel Stripe- als Resend-clients zijn lazy
      geïnitialiseerd (zelfde build-time-key-validatie-probleem als
      eerder). Fout- en foutafhandelingsbug gefixt: server-component-render
      errors (ideas/converge/plan) lekten eerst rauwe interne foutmeldingen
      (incl. een deel van de Stripe-key) naar de gebruiker — nu altijd een
      veilige generieke melding, met de echte fout alleen server-side
      gelogd. Getest via een tijdelijke PDF-testroute (niet gecommit) en
      de `/plan`-foutstaten (ontbrekende/ongeldige checkout-sessie).

**Alle 6 kernschermen uit de bouwopdracht zijn nu gebouwd.** Wat nog
ontbreekt voor een werkend end-to-end systeem: echte Supabase/Stripe/
Anthropic/Resend/PostHog-credentials in `.env.local`, de migraties
uitgevoerd tegen een echt Supabase-project, en een Stripe-webhook die naar
`/api/stripe/webhook` wijst (lokaal via `stripe listen --forward-to
localhost:3000/api/stripe/webhook`, of in productie via het Stripe
dashboard).

Zie ook `.env.example` voor alle benodigde environment variables (Supabase,
Stripe, Claude API, Resend, PostHog).
