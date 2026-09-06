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
