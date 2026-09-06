# WINDOW — bouwopdracht voor Claude Code

Plak dit als eerste prompt in een nieuwe Claude Code-sessie in dit project, of sla het op als `CLAUDE.md` in de projectroot zodat Claude Code het automatisch als context leest.

---

## Project

Ik bouw **WINDOW**, een digitale possibility-discovery app. Gebruikers vullen
een rijk persoonsprofiel in (situatie, doel, wie ze zijn, waar ze zijn, en een
reeks dial-achtige voorkeuren); de app genereert direct via AI 6-7
gepersonaliseerde mogelijkheden plus één expliciet gekaderde "wildcard"-optie
— geen los browse/like-scherm meer. Voor een klein bedrag (€2–5) levert
WINDOW dit als een gepersonaliseerd, meerpagina's "Idea Book" (PDF).

**Doel van dit traject:** een lean MVP live binnen 8 weken, om te testen of
mensen ervoor betalen, het delen en er iets mee doen — niet het volledige
platform bouwen. Houd de scope strikt (zie "Buiten scope" hieronder).

**Tagline:** "A Window Into What Could Be"
**Kernbelofte:** "You don't need another answer. Sometimes you need to see
another possibility."
**Toon van de UI-copy:** intelligent, nieuwsgierig, warm, licht ondeugend —
dichter bij een premium reismagazine dan een productiviteitsdashboard.
De site-UI is standaard Nederlands, met een Engelse toggle (zie
`src/lib/i18n/dictionaries.ts`) — beide taalversies moeten die toon
raken. Code, comments en commit messages blijven in het Engels.
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
OPEN → CONTEXT (rijk profiel) → BETALEN → PLAN (Idea Book PDF)
```

Er is geen apart divergentie/convergentie-scherm meer: de intake genereert
direct het volledige, betaalde eindproduct — niets wordt eerst "gekozen" uit
een lijst kaarten.

## Kernschermen (bouw niet meer dan dit voor de MVP)

1. **Landing** — kernbelofte + één duidelijke CTA ("Open a Window"), met de
   taal-toggle (NL/EN) in de header op elke pagina
2. **Intake** — visuele profiel-wizard, max. 5 pagina's met gegroepeerde
   vragen en een passende illustratie per pagina: situatie + doel +
   doel-afhankelijke vervolgvraag; leeftijd + locatie + zoekafstand;
   vijf voorkeurs-dials als sliders (praktisch↔wild, verrassingsniveau, tijd,
   budget, inzet); gewenste type-mogelijkheden (multi-select) + must-haves +
   preferences; gezelschap. Geen aparte taalvraag meer — de site-brede
   taalkeuze bepaalt ook de taal van het Idea Book.
3. **Checkout** — disclaimer + verplichte herroepingsrecht-checkbox, CTA
   "Make this real" → Stripe Checkout (geen kandidaat-selectie meer)
4. **Idea Book** — het betaalde resultaat: profielsamenvatting, 6-7
   gepersonaliseerde mogelijkheden, en één apart gekaderde "wildcard".
   Meerpagina's-PDF (cover, profiel, per-idee pagina's, wildcard-pagina) en
   per e-mail, in de door de gebruiker gekozen taal.

---

## Databaseschema (startpunt — pas aan waar nodig, maar bespreek grote afwijkingen)

```sql
users            (id, email, created_at, marketing_opt_in)
sessions         (id, user_id nullable, created_at, status)
intake_answers   (id, session_id, topic, time_available, budget,
                   desired_surprise, company, raw_json)
                   -- raw_json bevat het volledige rijke profiel; de losse
                   -- kolommen zijn legacy en blijven ongebruikt staan
ideas            (id, session_id, lens, title, description, status)
                   -- ongebruikt sinds het Idea Book-model; bewust niet
                   -- gedropt (zie migratie 0005_idea_book.sql)
window_plans     (id, session_id, title, language, profile_summary,
                   must_haves, preferences, ideas_json, wildcard_json,
                   labels_json, pdf_url, created_at)
payments         (id, session_id, stripe_payment_id, amount, currency,
                   status, created_at)
```

Houd persoonsgegevens zoveel mogelijk los van gedragsdata: koppel
`intake_answers` aan een los `session_id`, niet direct aan `users.email`,
zodat we conform AVG zo min mogelijk herleidbare data bewaren.

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
- Bredere meertaligheid dan Nederlands/Engels — de site-UI én de
  gegenereerde Idea Book-inhoud delen nu één taalinstelling
  (`src/lib/language.ts`, `src/lib/i18n/dictionaries.ts`), maar beperkt tot
  nl/en; geen bredere schrift-ondersteuning (Cyrillisch, CJK,
  Arabisch/Hebreeuws met RTL) voor nu

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

- [x] Stap 7 — Idee-flow vervangen door "Idea Book": op verzoek de hele
      intake → ideeën → convergentie → betaling → plan-flow vervangen door
      een rijker profiel-intake die direct doorstroomt naar betaling en een
      meerpagina's PDF, zonder los like/skip/convergentie-scherm.
      `IntakeWizard` (herschreven) heeft nu 17 stappen (situatie, doel +
      doel-afhankelijke vervolgvraag, gender, leeftijd, locatie +
      zoekafstand, praktisch↔wild, verrassingsniveau, tijd, budget, inzet,
      type-mogelijkheden als multi-select, must-haves, preferences,
      gezelschap, taal — de taalstap is voorgeselecteerd op basis van de
      `Accept-Language`-header, zie `src/lib/language.ts`).
      `src/app/intake/actions.ts` slaat het hele profiel op in
      `intake_answers.raw_json` en redirect naar het nieuwe `/checkout`
      (vervangt `/converge`; geen kandidaat-selectie meer, alleen
      disclaimer + herroepingsrecht-checkbox). `src/lib/claude/
      generateIdeaBook.ts` genereert in één Claude tool-use-call het hele
      boek: profielsamenvatting, must-haves/preferences, 6-7 ideeën, en een
      apart gekaderde "wildcard" — met expliciete MOET (hard constraint) vs
      LIEFST (zachte voorkeur) afhandeling in de systeemprompt, en output
      in de door de gebruiker gekozen taal. `src/lib/pdf/ideaBook.ts`
      rendert dit met `pdf-lib` + `@pdf-lib/fontkit` en gebundelde Noto
      Sans/Serif-fonts (`src/lib/pdf/fonts/`, SIL OFL) voor correcte
      accenten buiten het Engels — nodig omdat `pdf-lib`'s ingebouwde
      standaardfonts alleen WinAnsi ondersteunen. `src/app/plan/data.ts`
      en `page.tsx` herschreven voor de nieuwe inhoud (geen `chosen_idea_id`
      meer); migratie `0005_idea_book.sql` herstructureert `window_plans`
      en laat de nu ongebruikte `ideas`-tabel bewust ongemoeid. Oude
      bestanden (`src/app/ideas/`, `src/app/converge/`, `IdeasBoard.tsx`,
      `ConvergeBoard.tsx`, `claude/ideas.ts`, `claude/converge.ts`,
      `claude/plan.ts`, `pdf/windowPlan.ts`) verwijderd. Getest: volledige
      wizard doorlopen in de browser (alle vraagtypes: tekst, chips,
      doel-afhankelijke copy, multi-select-validatie, taalkeuze), en een
      los testscript (niet gecommit) dat de PDF-renderer met een
      Nederlandstalig mock-boek rendert — 9 pagina's zoals verwacht
      (cover, profiel, 6 ideeën, wildcard), inclusief correct gerenderde
      accenten (café, naïef, Müller, garçon). Een echte, betaalde
      end-to-end test vereist werkende Supabase/Stripe/Anthropic-
      credentials in `.env.local`.

- [x] Stap 8 — Intake en Idea Book visueel herontworpen: op verzoek de
      17-stappen-wizard teruggebracht tot maximaal 5 visuele pagina's, met
      gegroepeerde vragen, sliders voor ordinale keuzes en een passende
      illustratie per pagina; de PDF zelf ook visueel verrijkt met
      fotografische beelden.
      `IntakeWizard` (herschreven) groepeert de 17 velden op 5 pagina's
      (situatie, over jou, dials, openheid, laatste stap) — zelfde
      `IntakeAnswers`-vorm, alleen de presentatie verandert. Nieuw
      component `src/components/ui/PillSlider.tsx`: een klikbare/sleepbare
      "pil-track"-slider (geen native `<input type="range">`) voor de
      7 ordinale velden (leeftijd, zoekafstand, praktisch↔wild,
      verrassing, tijd, budget, inzet), elk met het meest neutrale
      antwoord als standaardwaarde in plaats van leeg. Elke pagina toont nu
      een bijpassende illustratie (`src/lib/illustrations.ts`:
      `WIZARD_PAGE_ILLUSTRATIONS`).
      `scripts/generate-illustrations.ts` uitgebreid met 10 nieuwe
      eenmalige Gemini-generaties (5 voor de wizard-pagina's in
      `public/illustrations/`, 5 voor de PDF in het nieuwe
      `src/lib/pdf/images/`) — de nu volledig ongebruikte oude
      lens-illustraties (`practical`/`unusual`/`ambitious`/`playful`)
      verwijderd. `src/lib/pdf/ideaBook.ts` visueel herontworpen: crème
      paginaomslag i.p.v. wit, een full-bleed omslag- en wildcard-banner
      met een donkere titelband, een tweekolomslayout op de profiel- en
      idee-pagina's (gecycled sfeerbeeld + genummerd accent-badge naast de
      tekst), stappen nu als echte genummerde lijst (`details` is
      `string[]` geworden i.p.v. één alinea, zowel in het Claude-schema
      als in de PDF-renderer), en een pagina-voettekst
      (paginanummer + wordmark) op elke pagina behalve de omslag.
      Twee bugs onderweg gevonden en gefixt: (1) de gebundelde
      Noto-fonts stonden als `.woff` opgeslagen — geen geldig
      PDF-lettertypeformaat; sommige renderers (waaronder de tool waarmee
      dit is getest) laadden ze daardoor niet en vielen terug op een
      fallback-font zonder de juiste ligatuur-glyphs ("effort" toonde als
      "e ort"). Omgezet naar rauwe `.ttf`-bestanden
      (`src/lib/pdf/fonts/`), wat het probleem volledig oploste. (2) de
      omslag-/wildcard-banner had te weinig ruimte tussen het kleine
      "eyebrow"-label en de grote titel, waardoor de tekst overlapte —
      gefixt door de verticale marge te vergroten. Ook
      `generateIdeaBook.ts` iets robuuster gemaakt tegen een enkele keer
      misvormde Claude-output (`ideas` niet als array) door dat expliciet
      te detecteren en een duidelijke, opnieuw-proberen-foutmelding te
      tonen in plaats van een onduidelijke crash.
      Getest: volledige wizard doorlopen in de browser (alle 5 pagina's,
      sliders klikken/slepen/toetsenbord, standaardwaarden, per-pagina
      validatie, illustraties), en meerdere volledige Idea Books
      gegenereerd via de test-bypass (Engels en Nederlands) — de
      gerenderde PDF's zijn pagina voor pagina gecontroleerd (omslag,
      profiel, idee-pagina's, wildcard-pagina, voettekst) via een lokaal
      geïnstalleerde PDF-rasterizer (poppler/pdftoppm ontbrak in deze
      omgeving; PyMuPDF gebruikt als alternatief).

- [x] Stap 9 — Gender-vraag verwijderd, site standaard Nederlands met
      Engelse toggle, PDF teruggebracht naar precies 6 pagina's:
      **(1) Gender weg**: de "Hoe omschrijf je jezelf?"-vraag is verwijderd
      uit pagina 2 van de wizard, uit `IntakeAnswers` en uit het
      Claude-profiel. **(2) Taal**: de bestaande, aparte 7-talige
      "in welke taal moet je Idea Book"-stap in de wizard is samengevoegd
      met een nieuwe, site-brede taalkeuze — er is nu nog maar één
      taalinstelling (nl/en) die zowel de site-UI als de gegenereerde
      Idea Book-inhoud stuurt. `src/lib/locale.ts` bevat de
      client-veilige constanten (`SUPPORTED_LOCALES`, `Locale`);
      `src/lib/language.ts` voegt daar de server-only `getLocale()` aan
      toe (leest het `window_locale`-cookie, standaard `"nl"` — niet
      langer browser-gedetecteerd). `src/app/actions/locale.ts` is de
      `setLocale`-server action achter de nieuwe `LanguageToggle`
      (`src/components/window/LanguageToggle.tsx`), zichtbaar in
      `SiteHeader` op elke pagina. Alle UI-tekst (landing, wizard,
      checkout, plan, privacy/terms, e-mail) staat nu in
      `src/lib/i18n/dictionaries.ts` (`nl`/`en`), met per pagina het
      patroon `const locale = await getLocale(); const dict =
      getDictionary(locale);`. Chip/slider-opties slaan een stabiele,
      taal-onafhankelijke waarde op (`{value, label}` i.p.v. kale
      strings) zodat het wisselen van taal nooit de opgeslagen
      antwoorden verandert. De taal die bij het invullen actief was,
      wordt server-side vastgelegd in `intake_answers.raw_json` (niet
      meer als wizard-antwoord) zodat een latere taalwissel een
      lopende generatie niet beïnvloedt (`StoredIntake` in
      `src/app/intake/actions.ts`). **(3) PDF naar 6 pagina's**: het
      aantal ideeën staat nu vast op 6 (was 6-7) met precies 3 stappen
      per idee (was 3-5), zodat de paginastructuur voorspelbaar is:
      omslag, profiel, drie pagina's met elk twee ideeën, wildcard.
      `src/lib/pdf/ideaBook.ts` is herschreven zodat elke pagina altijd
      volledig gevuld oogt: een zijkolom-afbeelding op haar natuurlijke
      beeldverhouding (nooit uitgerekt) gecombineerd met een
      lavendelkleurig vlak dat de rest van die kolom opvult tot aan de
      onderkant — en diezelfde truc ook toegepast op elke tekstkolom
      zodat een kort ingevuld profiel of kort idee nooit als "leger"
      oogt dan zijn buurpagina. Getest: de wizard doorlopen in het
      Nederlands én Engels (taalwissel via de header-toggle, direct
      zichtbaar effect, gender-vraag afwezig), en twee volledige Idea
      Books gegenereerd via de test-bypass — beide exact 6 pagina's,
      pagina voor pagina gecontroleerd (met en zonder ingevulde
      must-haves/preferences) op volledige paginadekking.

- [x] Stap 10 — Top-5 quick wins uit de conversieaudit geïmplementeerd:
      **(1) Prijs zichtbaar vóór checkout**: nieuwe `formatPrice(locale)`
      in `src/lib/pricing.ts` (handmatig geformatteerd — "€3,50" / "€3.50"
      — i.p.v. `Intl.NumberFormat`, die in nl-NL een spatie na het
      symbool invoegt). Getoond als microcopy onder de landing-CTA
      (`dict.landing.ctaCaption`), verwerkt in de checkout-kop
      (`dict.checkout.heading`, nu met een `{price}`-token dat op de
      pagina wordt vervangen), en als een uitklapbare "Wat kost het?"-FAQ
      in `SiteFooter` (native `<details>`, geen nieuwe route nodig).
      **(2) "Wat er in jouw venster zit"**: nieuwe sectie op de homepage
      (`src/app/page.tsx`) met 3 kaarten uit `dict.landing.whatYouGetItems`
      — geen nieuwe illustraties, hergebruikt de bestaande kaartstijl.
      **(3) 1-2-3-stappenuitleg op de bevestigingspagina**: `dict.checkout.
      steps` (3 zinnen, eerste met het prijs-token) gerenderd als
      genummerde lijst tussen de subcopy en het `CheckoutPanel` in
      `src/app/checkout/page.tsx`. **(4) Klikbare voorbeeld-chips**: het
      `text`-veldtype in `IntakeWizard.tsx` heeft nu een optionele
      `suggestions`-lijst — een rij kleine chips die bij een klik de
      bijbehorende textarea vullen (overschrijfbaar, geen aparte opslag).
      Toegevoegd aan "Wat speelt er?" (stap 1) en aan de dealbreakers-/
      voorkeuren-velden (stap 4), die ook zijn herbenoemd naar de
      "harde grens vs. voorkeur"-metafoor uit de audit, met een nieuwe
      introductie-alinea (`dict.opennessIntro`) bovenaan die pagina.
      **(5) Privacy/Voorwaarden niet langer placeholders**: `Dictionary
      ["legal"]` is omgebouwd van één placeholder-paragraaf naar een
      intro + een array van `{heading, body}`-secties (6 stuks per
      pagina), inhoudelijk exact aansluitend op wat er technisch gebeurt
      (sessie-gekoppelde antwoorden, e-mail pas ná betaling, Stripe voor
      betaalgegevens). `src/app/privacy/page.tsx` en `terms/page.tsx`
      renderen deze nu als losse kopjes i.p.v. één tekstvak. Contactadres
      `hello@windowinto.nl` is een aanname — vervang door het echte adres
      zodra dat vaststaat. Getest: volledige wizard doorlopen (chips vullen
      het veld, `opennessIntro` en herbenoemde labels tonen correct),
      checkout-pagina met prijs in kop + stappenlijst, privacy/terms in
      beide talen, `tsc --noEmit` / `eslint .` / `npm run build` allemaal
      schoon.

- [x] Stap 11 — Fase 1 van het productverbeterplan (zie het gepubliceerde
      "WINDOW Verbeterplan"-artifact): de must-have-items die geen nieuwe
      externe dienst/API-keuze vereisen.
      **Actionability Layer + concrete-ideeën-structuur**:
      `IdeaBookEntry` (`src/lib/claude/generateIdeaBook.ts`) uitgebreid met
      `first_action`, een gestructureerd `practical` (`estimated_cost`,
      `duration`, `difficulty`, `preparation`) i.p.v. het vrije-tekstveld
      `practical_info`, `location` (naam/adres/plaats, of `null` — de
      systeemprompt verbiedt expliciet verzonnen exacte adressen/prijzen/
      openingstijden, conform de kritische kanttekening in het
      verbeterplan) en `requirements`. `src/lib/pdf/ideaBook.ts` en
      `src/app/plan/page.tsx` renderen deze velden nu allebei conditioneel
      (geen locatieregel zonder `location`, geen "wat heeft u nodig" zonder
      `requirements`) vanuit dezelfde databron — dat lost meteen op dat de
      webpagina eerder veel minder toonde dan de PDF. Layout blijft bewust
      binnen de bestaande vaste 6-pagina/halve-pagina-structuur (de
      contentafhankelijke paginavulling uit het verbeterplan is Fase 2).
      **Generatiestatus tegen dubbele generatie**: nieuwe kolom
      `window_plans.status` (`pending`/`ready`/`failed`, migratie
      `0006_plan_status_and_actionability.sql` — **nog handmatig uit te
      voeren in de Supabase SQL Editor**, zoals eerdere migraties).
      `src/app/plan/data.ts` schrijft nu een `pending`-rij vóór de trage
      Claude/PDF-stap begint en zet 'm pas op `ready` ná succes (of
      `failed` bij een fout); een pagina-herlaad binnen 90s tijdens een
      lopende generatie toont nu een "we zijn nog bezig, ververs zo"-
      melding in plaats van een volledig dubbele, kostenverhogende
      generatie te starten — dit gedrag zelf live gereproduceerd tijdens
      het testen van de betaalflow eerder deze sessie. **Retry**:
      `generateIdeaBook` doet nu 1 automatische herpoging (met korte
      backoff) specifiek op een misvormde-maar-succesvolle Claude-respons
      (lege ideeën-array) — dat is de faalmodus die de ingebouwde SDK-retry
      niet dekt. **PostHog daadwerkelijk actief**: nieuwe
      `ConsentBanner` (`src/components/window/ConsentBanner.tsx`,
      hydration-veilig via `useSyncExternalStore`) in `layout.tsx` op elke
      pagina; `initPostHog()` wordt nu voor het eerst ergens aangeroepen,
      uitsluitend ná expliciete toestemming (of meteen bij een eerder
      "granted"-bezoek), en no-opt nog steeds veilig zolang
      `NEXT_PUBLIC_POSTHOG_KEY` leeg is. Een nieuwe `trackEvent()`-helper
      verstuurt nu een `intake_page_completed`-event per wizard-pagina-
      overgang, om drop-off per stap zichtbaar te maken zodra er een echte
      PostHog-key is. **Sliders op mobiel**: `PillSlider`'s klik-/tikzone
      vergroot van 8px naar 44px hoog (de visuele track blijft even dun),
      zelf gemeten vóór en ná op een 375px-viewport. Getest: `tsc
      --noEmit`/`eslint .`/`npm run build` schoon; een losse testrender van
      `renderIdeaBookPdf` met een mock-boek dat alle nieuwe velden gebruikt
      (met en zonder `location`/`requirements`) gecontroleerd pagina voor
      pagina via de PyMuPDF-rasterizer — voorwaardelijk renderen werkt, nog
      steeds exact 6 pagina's; consent-banner en slider-tikzone
      geverifieerd in de browser. De volledige checkout→plan-flow met een
      echte database kon in deze stap niet end-to-end getest worden: de
      test-bypass faalde live met "Could not find the 'status' column of
      'window_plans'" — migratie 0006 stond op dat moment nog niet
      uitgevoerd tegen de Supabase-database.

- [x] Stap 12 — Style Engine + locatie-autocomplete (de twee Fase 1-items
      die bewust waren uitgesteld tot na een gebruikerskeuze).
      **Style Engine**: nieuw `src/lib/styleEngine.ts` met 6 vaste,
      vooraf gegenereerde stijlpresets (`bloom`/`warm`/`bold`/`edge`/
      `calm`/`vivid`), elk met een eigen paginategenkleur (`panelTint`,
      vervangt de eerder vaste lavendel `PANEL_TINT`) en een eigen
      beeldenset (1 cover- + 3 sfeerbeelden). Bewust géén live per-
      gebruiker AI-beeldgeneratie (zie de kritische kanttekening in het
      verbeterplan) — alle 24 beelden zijn eenmalig gegenereerd via het
      nieuwe `scripts/generate-style-illustrations.ts` (zelfde patroon als
      het bestaande `generate-illustrations.ts`) en gecommit onder
      `public/illustrations/styles/<stijl>/`. `src/lib/gemini.ts` kreeg
      hiervoor een optioneel `stylePrefix`-argument. De oude vaste PDF-
      beelden (`src/lib/pdf/images/pdf-*.jpg`) en hun generatie-targets
      zijn verwijderd — volledig vervangen door de stijlmatrix.
      `IntakeWizard.tsx` heeft een nieuw `style-cards`-veldtype (visuele
      kaarten met een echte thumbnail per stijl, niet alleen tekst) op de
      laatste pagina, vóór de gezelschapsvraag; `IntakeAnswers.styleId`
      wordt opgeslagen als het gebruikelijke stabiele `{value,label}`-veld
      en standaard voorgeselecteerd op `"warm"`. `renderIdeaBookPdf` kreeg
      een `styleId`-parameter; `src/app/plan/data.ts` geeft
      `profile.styleId` door. Bewust géén styling-verandering op de
      `/plan`-webpagina zelf — de opdracht vroeg expliciet om de stijl
      zichtbaar te maken in de PDF, de webpagina blijft in de vaste
      WINDOW-merkstijl. **Locatie-autocomplete**: nieuwe route
      `src/app/api/location-suggest/route.ts` proxyt de gratis, sleutelloze
      PDOK Locatieserver (Nederlandse overheidsdienst), beperkt tot
      woonplaats/gemeente-resultaten (nooit exacte adressen, conform de
      bestaande intake-copy "stad of regio is genoeg"). Nieuw
      `src/components/ui/LocationAutocomplete.tsx` (gedebouncet, degradeert
      stil naar een gewoon tekstveld als PDOK traag/onbereikbaar is) via
      een nieuw `location`-veldtype in de wizard.
      Onderweg een echte, ontbrekende `GEMINI_API_KEY` gevonden en
      hersteld: de sleutel in `.env.local` gaf een 403 ("unregistered
      caller") — de gebruiker heeft een nieuwe sleutel aangeleverd, die
      eerst los geverifieerd is met een test-generatie vóór 'm op te slaan
      (conform de vaste projectgewoonte "verifieer tokens vóór vertrouwen
      erin te stellen"). Onderweg ook geleerd: `scripts/generate-
      illustrations.ts`-achtige scripts lezen `.env.local` NIET automatisch
      in wanneer ze los via `npx tsx` gedraaid worden (dat is puur
      Next.js-gedrag) — de env var moet expliciet op de commandoregel
      meegegeven worden, exact zoals het bestaande script al in zijn eigen
      kop-commentaar documenteerde.
      Getest: alle 24 stijlbeelden succesvol gegenereerd; volledige wizard
      doorlopen tot en met de stijlkaarten (visuele selectie, thumbnails,
      correcte standaardselectie); `/api/location-suggest` geeft echte
      PDOK-suggesties terug voor een geteste zoekopdracht; drie losse
      testrenders van `renderIdeaBookPdf` met verschillende `styleId`'s
      (`bloom`/`bold`/`edge`) pagina voor pagina gecontroleerd — cover,
      paginategenkleur en sfeerbeelden zijn per stijl duidelijk en correct
      verschillend.

      Migratie 0006 kostte drie pogingen om echt door te laten dringen —
      eerst leek de eerdere "kolom bestaat niet"-fout een PostgREST-
      schemacache-probleem (opgelost geacht met `NOTIFY pgrst, 'reload
      schema'`), maar een rechtstreekse REST-call naar Supabase (los van de
      app, met de service-role-key) liet zien dat de kolom op dat moment
      écht niet bestond (Postgres-foutcode `42703`, niet slechts een
      cache-symptoom) — de conclusie "het is de cache" was voorbarig,
      getrokken zonder het zelf te verifiëren. Pas na een derde poging
      (die botste op "constraint bestaat al" — een teken dat een eerdere
      poging alsnog was geslaagd) bevestigde diezelfde rechtstreekse
      REST-call dat de kolom er nu daadwerkelijk stond. Les: bij een
      databasefout die na een fix blijft terugkomen, altijd rechtstreeks
      tegen de database verifiëren (buiten de applicatiecode om) in plaats
      van op de meest voor de hand liggende verklaring te vertrouwen.

      Met de kolom bevestigd aanwezig, de volledige flow opnieuw doorlopen
      met stijl `vivid` geselecteerd: intake → checkout →
      test-bypass → `/plan` toonde de rijke Actionability Layer-content
      met échte Claude-output (kosten/duur/moeilijkheid, locatie zonder
      verzonnen adres, materialenlijst, "Do this first"-callout) — en de
      gedownloade PDF's omslag was zichtbaar en correct in de gekozen
      `vivid`-stijl (verzadigde kleuren, energieke compositie), niet de
      standaard `warm`-stijl. Fase 1 van het verbeterplan is hiermee
      volledig end-to-end geverifieerd, inclusief de twee optionele
      Style Engine- en locatie-autocomplete-uitbreidingen.

- [x] Stap 13 — PDF-tekstafkapping en bladvulling gefixt: op basis van een
      screenshot van een echt gegenereerd idee bleek `intro`/`why_it_fits`
      midden in een woord afgekapt te worden met "…", en de "Wat heeft u
      nodig"-regel deed hetzelfde bij meer dan één item. Oorzaak: Stap 12
      propte de volledige Actionability Layer-inhoud (stappen, praktische
      info, locatie, materialenlijst, eerste stap) nog in de oude
      halve-pagina-sloten uit Stap 9 (twee ideeën per pagina) met krappe
      `maxLines`-caps — precies de spanning die het verbeterplan zelf al
      als kritiek punt benoemde ("rijkere ideeën passen niet meer in de
      vaste 6-pagina-lay-out"), nu voor het eerst zichtbaar met échte,
      volledige-lengte Claude-output.
      Oplossing: `src/lib/pdf/ideaBook.ts` toegewezen van twee ideeën per
      pagina naar **één volledige pagina per idee** (`drawIdeaSlot` →
      `drawIdeaPage`) — het boek is nu 9 pagina's (cover, profiel, 6
      idee-pagina's, wildcard) in plaats van vast 6. Grotere, comfortabelere
      typografie (titel 21pt, intro/why/stappen 12pt i.p.v. 15.5/10/9.5pt),
      `requirements` wordt nu als een echte bullet-lijst gerenderd
      (`drawBulletList`) in plaats van een enkele, potentieel afgekapte
      regel, en `first_action` krijgt dezelfde omkaderde call-out-behandeling
      als de wildcard-pagina al had. De wildcard-pagina's banner is
      verkleind (360→260pt, afbeelding 230→170pt) om ruimte vrij te maken
      voor dezelfde rijkere content die nu ook op die pagina moet passen.
      `generateIdeaBook.ts`'s systeemprompt is bijgewerkt: de "vaste
      6-pagina-PDF"-beschrijving is vervangen door "één volledige pagina
      per idee", woordlimieten voor intro/why_it_fits/stappen/eerste stap
      zijn expliciet en strakker gemaakt (max ~18/~18/~16/~16 woorden i.p.v.
      vage "one-sentence"-instructies die in de praktijk tot te lange,
      samengestelde zinnen leidden), en `requirements` is begrensd op
      maximaal 4 items (`maxItems: 4` in het schema).
      Getest: een losse testrender met opzettelijk lange, realistische
      tekst (die de exacte afkapping uit het screenshot reproduceerde)
      bevestigde eerst het probleem, en na de fix geen enkele afkapping
      meer op de idee- of wildcard-pagina, met het boek precies op de
      verwachte 9 pagina's (een eerste poging met de aanvankelijke
      wildcard-afmetingen liet een 10e overloop-pagina zien — opgelost door
      de wildcard-banner verder te verkleinen en de typografie daar gelijk
      te trekken met de idee-pagina's). `tsc --noEmit`/`eslint .`/`npm run
      build` schoon.

- [x] Stap 14 — Start van Fase 2 uit het verbeterplan: kaart-links,
      deel/referral-basis (Fase A) en de cadeau-optie. Twee andere
      Fase 2-items (web-grounding, premium-tier) bewust nog niet gebouwd —
      zie de kritische toelichting hieronder.
      **Kaart-links**: nieuwe `src/lib/maps.ts` (`mapsSearchUrl`) bouwt een
      sleutelloze Google Maps-zoeklink — geen verzonnen exact adres, het
      alternatief dat sectie 9 van het verbeterplan al aanraadde zolang er
      geen web-grounding is. Op `/plan` en `/shared/[id]` een gewone
      `<a>`-link; in de PDF een **echte klikbare link-annotatie**
      (`addLinkAnnotation` in `src/lib/pdf/ideaBook.ts` — pdf-lib heeft
      hier geen eigen API voor, dit is de standaardtechniek: een handmatig
      geregistreerd `/Subtype /Link`-annotatie-object). Geverifieerd met
      PyMuPDF's `page.get_links()`: de link-rect en URI kloppen exact, op
      zowel een idee-pagina als de wildcard-pagina.
      **Deel/referral Fase A** (bewust zonder korting, zie de kritische
      kanttekening in het verbeterplan over sectie 6): nieuwe publieke
      route `/shared/[id]` (`src/app/shared/[id]/`) toont een
      alleen-lezen versie van een Idea Book — wél alle ideeën + wildcard
      (de indrukwekkende, deelbare inhoud), bewust NIET
      `profile_summary`/`must_haves`/`preferences` (persoonlijke context).
      `IdeaDetail` is uit `plan/page.tsx` geëxtraheerd naar
      `src/components/window/IdeaDetail.tsx` zodat beide pagina's exact
      dezelfde weergave gebruiken. Nieuwe `ShareButton` (Web Share API met
      clipboard-fallback + bevestiging) op `/plan`, met UTM-parameters op
      de gedeelde link. Twee nieuwe PostHog-events
      (`idea_book_share_clicked`, `shared_idea_book_viewed`,
      `shared_idea_book_cta_clicked`) meten precies de funnel die Fase A
      vraagt: gedeeld → bekeken → doorgeklikt — zonder daar nu al een
      beloning aan te koppelen.
      **Cadeau-optie**: `CheckoutPanel` heeft een nieuwe, altijd zichtbare
      "dit is een cadeau"-toggle (bewust NIET gekoppeld aan de
      intake-vraag "voor wie is dit venster", die over gezelschap gaat,
      niet over cadeau-intentie — dat zou een te losse aanname zijn
      geweest) met een e-mailveld dat de "Maak het echt"-knop pas
      vrijgeeft bij een geldig e-mailadres. `createCheckoutSession` legt
      het ontvanger-adres vast in Stripe-metadata
      (`gift_recipient_email`); `getOrCreateWindowPlan` stuurt de e-mail
      met de PDF naar dat adres in plaats van naar de koper, terwijl de
      koper zelf gewoon zijn eigen Stripe-bon en het `users`-account-record
      houdt. Geverifieerd met een echte Stripe Sandbox-testbetaling (twee
      verschillende e-mailadressen: koper vs. ontvanger) — rechtstreeks bij
      Stripe's API opgevraagd en bevestigd dat `gift_recipient_email` en
      `customer_details.email` correct gescheiden bleven.
      **Bewust nog niet gebouwd**: web-grounding (sectie 9, wachtte op een
      keuze — gebruiker koos "nu overslaan, veilige Maps-links zijn
      genoeg") en de premium-tier (sectie 7, vraagt eerst een prijsopgave
      van de gebruiker, geen technische beslissing). Ook de "praktische
      vervolgstappen + QR-deelpagina" (sectie 10/11) en iconen/
      kleurcodering in de PDF (sectie 11) staan nog open.
      Getest: volledige wizard + een echte Stripe Sandbox-betaling met het
      cadeauvakje aangevinkt; deel-knop (clipboard-fallback bevestigd);
      `/shared/[id]` met een echte en een niet-bestaande id (nette
      "bestaat niet"-pagina); PDF-linkannotaties gecontroleerd met
      PyMuPDF. `tsc --noEmit`/`eslint .`/`npm run build` schoon.
