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

- Accent (interactief, knoppen): walnoot `#5B3F2F`, donker-accent/hover +
  primaire-knopvulling `#3C2920`, secundair accent `#A98262`. Goud alleen
  als terughoudend hover-/focus-accent: `#B08A4A` (`#D2B77A` lichter).
  Achtergrond `#F7F5F0`, kaarten/oppervlakken `#FFFDFA`, tekst `#202020`
  (warmgrijs, niet hard zwart), gedempte tekst `#77736C`, randen `#DED8CE`,
  geselecteerde/actieve vulling `#F2ECE1`. **Bijgewerkt in Stap 26** —
  vervangt het teal/zwarte "Clean Premium Hybrid"-palet van Stap 24-25 door
  een warmer walnoot/goud/crème-palet ("Warm Walnut"), op expliciet verzoek
  na feedback dat teal/zwart nog niet warm/premium genoeg aanvoelde. Zelfde
  variabelenamen als Stap 24 (`--color-accent`, `--color-ink`, `--color-
  cream`, …) — alleen de hex-waarden zijn vervangen, dus dit kleurt
  automatisch door op elk scherm dat de tokens gebruikt, ook de niet
  expliciet in Stap 26 herziene schermen (Idea Book-viewer, admin, generating-
  screen).
- Serif voor landingspagina-headlines (Google Font "Newsreader"); overal
  elders — inclusief Intake- en Checkout-koppen, die bewust géén serif
  zijn — een strakke sans-serif ("Plus Jakarta Sans") met lichte negatieve
  tracking op koppen. Ongewijzigd sinds Stap 24 — Stap 26 was uitsluitend
  een kleur-/radius-wijziging, geen typografiewissel.
- Border-radius als vast systeem: `8px` (kleine elementen), `12px`
  (knoppen), `18px` (kaarten, panelen, inputs — bewust zachter/ronder dan
  Stap 24's `6px`/`8px`, via `--radius-sm/-md/-lg`-tokens die Tailwinds
  eigen `rounded-sm/-md/-lg`-schaal overschrijven). `9999px` blijft voor
  pil-badges (bv. de "Stap X van Y"-indicator). 8px-spacinggrid
  (8/16/24/32/48), ongewijzigd.
- Geen zware schaduwen of "AI-glow"-effecten (geen blurred gloeiende
  cirkels) — een subtiele 1px-rand (`#DED8CE`) is het standaardmiddel om
  een vlak van zijn omgeving te onderscheiden. Uitzondering: de primaire
  knop krijgt bij hover een klein, zacht schaduweffect + een dunne gouden
  randkleur — de enige plek waar goud bewust wordt ingezet, verder nergens
  als vulling of body-tekstkleur.
- Terugkerend visueel motief: het venster-frame (het `WindowMark`-icoon,
  en het patroon van "vensters"/panelen die verschillende mogelijkheden
  tonen) — blijft, ook na Stap 24.

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

- [x] Stap 15 — Start van Fase 1 uit het gepubliceerde "WINDOW
      Ervaringsontwerp"-artifact: de vijf quick-wins, geïmplementeerd
      binnen de bestaande 5-pagina-wizard (geen herbouw naar het
      aspirationele 18-schermenmodel uit dat ontwerp — dat hoort bij
      Fase 2's structurele wijzigingen).
      **Antwoordkaarten i.p.v. kale opties**: de `chips`- en
      `multi-chips`-velden in `IntakeWizard.tsx` (doel, gezelschap,
      type-mogelijkheden) zijn omgezet van kleine `rounded-full`-pilletjes
      in een `flex-wrap`-rij naar grotere `rounded-2xl`-kaarten (44px+
      tikgebied, subtiele schaduw, accent-rand + lichte accent-vulling bij
      selectie i.p.v. een volle kleurvulling) in een responsive 1-/2-
      koloms grid — exact het patroon uit het designsysteem-hoofdstuk van
      het ontwerp. Sliders (de dial-achtige velden) blijven ongewijzigd
      sliders, zoals het ontwerp ook expliciet aangeeft.
      **Gesegmenteerde voortgang**: bleek al aanwezig (de voortgangsbalk
      rendert al één segment per pagina, niet één doorlopende
      percentagebalk) — geen wijziging nodig, alleen bevestigd tijdens het
      testen.
      **Zachte lege-staat-copy**: de eerste vraag ("Wat speelt er?") is nu
      officieel optioneel (`optional: true` op het `situation`-veld) in
      plaats van een verplicht veld dat de wizard blokkeert — met een
      nieuwe, alleen-bij-leeg getoonde regel "Dat mag ook. We werken dan
      met wat je hierna nog vertelt." (`dict.intake.situation.
      optionalHint`), letterlijk de copy uit het ontwerp. `purpose` en
      `purposeFollowUp` blijven bewust wél verplicht — dat is een
      specifiekere vraag dan het ontwerp als "skipbaar" bedoelde.
      **Fout- en laadstatussen**: `PlanNotReadyError`
      (`src/app/plan/data.ts`) draagt nu een `reason: "unpaid" |
      "generating"` in plaats van beide gevallen hetzelfde te behandelen.
      Bij `"generating"` toont `/plan` niet langer de rode foutbox met een
      handmatige "Vernieuwen"-link, maar een nieuwe
      `GeneratingScreen`-component (`src/components/window/
      GeneratingScreen.tsx`): roterende statusregels (exact de vier uit
      het ontwerp: "Je situatie wordt gelezen…" → … → "Je Idea Book wordt
      opgemaakt…") plus een automatische `router.refresh()` elke 5
      seconden tot de generatie klaar is — geen volledige page-reload,
      dus geen scroll-/state-verlies. De `"unpaid"`-tak (geen
      betaalreferentie gevonden) behoudt de bestaande foutbox-stijl, want
      dat is een echte actie-vereisende situatie, geen wachtmoment.
      **Persoonlijker resultaat**: de systeemprompt in
      `generateIdeaBook.ts` instrueert `why_it_fits` nu expliciet als een
      directe terugverwijzing naar wat de gebruiker zelf aangaf ("Je
      vermeldde...", "Omdat je op zoek bent naar...") in plaats van een
      generieke onderbouwing — "moet lezen als bewijs dat er geluisterd
      is, geen marketingtekst".
      Getest: volledige wizard doorlopen in de browser (antwoordkaarten
      op zowel 1- als 2-koloms breedte, lege-staat-hint verschijnt en
      verdwijnt correct bij typen) en een volledige testgeneratie via de
      bestaande test-bypass — de gegenereerde `why_it_fits`-teksten lazen
      inderdaad als directe terugverwijzingen ("Je wilde alleen iets
      nieuws proberen dit weekend, en dit is nieuw zonder overweldigend
      te zijn."). De nieuwe `GeneratingScreen` zelf is bevestigd via
      code-/typecontrole en de ongewijzigde staat van de rest van de
      `/plan`-pagina (de "generating"-tak wordt alleen bereikt bij een
      gelijktijdige tweede aanvraag terwijl een eerdere generatie nog
      loopt, wat lastig te forceren is via losse browseracties) — nog niet
      apart met een race-conditie live gereproduceerd. `tsc --noEmit`/
      `eslint .`/`npm run build` schoon.

- [x] Stap 16 — Start van Fase 2 uit het "WINDOW Ervaringsontwerp"-artifact:
      de Idea Book op `/plan` is niet langer één lange scrollpagina met alle
      ideeën onder elkaar, maar een echt "boek" — één scherm tegelijk, met
      navigatie, exact het "Idea Book-layout als boek"-item uit de roadmap
      (must, de grootste structurele wijziging van Fase 2).
      Nieuw `src/components/window/IdeaBookViewer.tsx` (client component):
      bouwt intern een schermenlijst — profiel, voorkeurenoverzicht (alleen
      als er daadwerkelijk moet-haves/voorkeuren zijn — anders overgeslagen,
      conform het ontwerp), één scherm per idee (hergebruikt de bestaande
      `IdeaDetail`, nu met een "Idee X van 6"-teller erboven), een apart
      gekaderd wildcard-scherm (eigen kadering/achtergrond, de intro-zin
      "Dit stellen we normaal niet zomaar voor — maar bij jou past het
      toch.", en "Ik durf het aan"/"Nee, laat maar" als afsluitende
      acties — beide voeren gewoon door naar het laatste scherm, er is geen
      inhoudelijk verschil, maar de copy geeft de niet-veroordelende framing
      die het ontwerp vroeg), en een laatste "opslaan/delen"-scherm
      (hergebruikt de bestaande PDF-downloadlink en `ShareButton`). Een
      gesegmenteerde voortgangsbalk bovenaan (zelfde visuele patroon als de
      intake-wizard) plus Terug/Verder-navigatie eronder.
      `src/app/plan/page.tsx` is fors ingekort: de handmatige rendering van
      profiel/voorkeuren/ideeën/wildcard/acties is vervangen door één
      `<IdeaBookViewer />`-aanroep met de plandata als props.
      **Metadata per idee** en **opslaan/delen op boek-niveau** stonden ook
      als Fase 2-items op de roadmap, maar waren feitelijk al gebouwd (de
      Actionability Layer resp. de Fase A-deelfunctie) — nu automatisch ook
      zichtbaar per boek-scherm in plaats van in de oude lange lijst.
      **Eerste-actie als apart moment**: bewust NIET als een volledig eigen
      scherm per idee gebouwd (dat zou het aantal schermen verdubbelen) —
      blijft de bestaande, apart omkaderde call-out binnen elk idee-scherm,
      wat de kern van dat ontwerp-item (visuele nadruk, geen aparte
      keuzevraag) al dekt.
      **Bewust ongewijzigd**: `/shared/[id]` (de publieke deel-preview)
      blijft de platte, scrollbare lijst — dat is een expres andere
      leesvorm voor iemand die een boek toegestuurd kreeg en het in één
      oogopslag wil kunnen beoordelen, niet de eigenaar die het net heeft
      gekocht.
      Onderweg een bug gevonden en gefixt vóórdat 'm live kon gaan: het
      importeren van `IdeaDetail`/`IdeaBookViewer` in een client-component-
      boom trok via `DIFFICULTY_LABELS` (geïmporteerd uit
      `generateIdeaBook.ts`) ook de Anthropic-client-initialisatie
      (`src/lib/anthropic.ts`) de browserbundel in — die weigert te
      draaien in een browseromgeving (bewuste SDK-veiligheidscheck tegen
      het lekken van de API-key) en gaf een runtime "It looks like you're
      running in a browser-like environment"-crash op `/plan`, ondanks een
      groene `npm run build`. Simpele `import type`-scheiding loste dit
      niet op omdat `DIFFICULTY_LABELS` een echte runtime-waarde is, niet
      een type. Opgelost door de types/constante te verplaatsen naar een
      nieuw, bewust server-vrij bestand
      (`src/lib/claude/ideaBookTypes.ts`, geen enkele runtime-import) —
      `generateIdeaBook.ts` re-exporteert alles daarvandaan voor de
      bestaande server-only aanroepers, terwijl `IdeaDetail`/
      `IdeaBookViewer` nu rechtstreeks uit het veilige bestand importeren.
      Getest: de volledige wizard opnieuw doorlopen en een testgeneratie
      gedraaid — het boek doorlopen van profiel → voorkeuren → alle 6
      ideeën (met correcte "Idee X van 6"-teller en persoonlijke
      why-it-fits-teksten) → wildcard (met de afwijkende kadering en
      "Ik durf het aan") → het afsluitende download/deel-scherm, inclusief
      de volledig gevulde voortgangsbalk. `tsc --noEmit`/`eslint .`/
      `npm run build` schoon ná de fix.

- [x] Stap 17 — Start van Fase 3 uit het "WINDOW Ervaringsontwerp"-artifact:
      op verzoek alleen de eerste-actie-herinnering per e-mail (de overige
      Fase 3-items — geschiedenis/meerdere Idea Books, leren van eerdere
      ideeën, feedback na uitvoering, samen kiezen — vragen om een account-
      systeem, een notificatiekanaal of raken de expliciet uitgesloten
      "Window for Two"-feature, en zijn bewust niet gebouwd zonder eerst de
      gebruiker daarover te laten kiezen; zie de vraag die hieraan
      voorafging).
      Nieuwe geplande job `src/app/api/cron/first-action-reminder/route.ts`
      (aangeroepen door Vercel Cron, geconfigureerd in het nieuwe
      `vercel.json` op elke dag 09:00 UTC): stuurt precies één e-mail per
      Idea Book, 2 tot 9 dagen na het aanmaken, met de titel en
      `first_action` van het eerste idee, naar wie het boek destijds
      daadwerkelijk ontving (koper of cadeau-ontvanger). Optioneel
      beveiligd met een `CRON_SECRET`-omgevingsvariabele (Vercel stuurt
      deze automatisch mee als `Authorization: Bearer`-header zodra de
      env var op het project staat — zonder die variabele draait de route
      gewoon open, voor lokaal testen).
      Migratie `0007_first_action_reminder.sql` (**nog handmatig uit te
      voeren**, zoals eerdere migraties) voegt twee kolommen toe aan
      `window_plans`: `recipient_email` (vastgelegd in
      `getOrCreateWindowPlan` op het moment van genereren — bewust niet
      achteraf uit Stripe herleid, want dat zou de cron-job per boek een
      losse Stripe-aanroep kosten en van Stripe's bereikbaarheid laten
      afhangen) en `first_action_reminder_sent_at` (voorkomt dubbel
      versturen bij een volgende cron-run). Test-Idea Books (via de
      betaal-bypass) krijgen nooit een `recipient_email` en worden dus
      vanzelf overgeslagen. Nieuwe `src/lib/email/reminder.ts`
      (`sendFirstActionReminderEmail`) volgt hetzelfde Resend-patroon als
      de bestaande aankoopbevestigingsmail.
      Getest: `tsc --noEmit`/`eslint .`/`npm run build` schoon, inclusief
      de nieuwe route in de build-output. Een echte end-to-end test (een
      verzonden herinnering, met een reëel verlopen wachttijd van dagen)
      kon in deze sessie niet uitgevoerd worden — vereist migratie 0007
      tegen de echte Supabase-database én minstens twee dagen wachten na
      een echte betaling. Nog te doen door de gebruiker: migratie 0007
      draaien, en optioneel `CRON_SECRET` instellen op zowel Vercel als in
      `.env.local`.

- [x] Stap 18 — "Quiet luxury"-restyle van de Idea Book-PDF, op expliciet
      verzoek: een gedempt goud/diep-emerald printthema, losstaand van het
      paars/crème-merk van de live site (dat blijft ongewijzigd — dit raakt
      alleen `src/lib/pdf/ideaBook.ts`). Belangrijke kanttekening die vooraf
      is gedeeld: pdf-lib kent geen gaussian blur of gradient-fill-tekst, dus
      "glassmorphism" en "metallic gradient" zijn hier benaderd met gelaagde
      transparante vlakken en tweekleurige tekst-offsets, niet met echte
      blur/gradients.
      Nieuw kleurenpalet (alleen in dit bestand): warm bijna-zwart voor
      inkt, diep emerald voor de donkere banners/randen/labels (was paars),
      gedempt antiek goud voor accenten/badge/foil (was paars-accent), en
      een warme ivoor paginakleur. De per-stijl `panelTint` uit de Style
      Engine wordt hier bewust genegeerd ten gunste van één samenhangende
      "frosted" ivoorkleur, ongeacht welke van de 6 Style Engine-stijlen de
      gebruiker koos — zes verschillend gekleurde vlakken zouden de
      gevraagde eenduidige "quiet luxury"-sfeer ondermijnen.
      **Sfeerbeelden niet opnieuw gegenereerd**: in lijn met de expliciete
      eis "edit, geen nieuwe generatie" krijgen de bestaande Style
      Engine-beelden (cover, moods, wildcard) een emerald+amber
      kleurgrading-laag overheen (`applyMoodColorGrade`, gelaagde
      transparante rechthoeken) in plaats van dat ze via Gemini opnieuw
      gegenereerd worden — een echte render-time "edit" van het bestaande
      beeld, geen nieuw beeld.
      **Badge**: laag-op-laag opgebouwd (schaduwcirkel → goudbasis →
      lichtere hooglicht-cirkel → dunne contourlijn) voor een metallic-
      munt-achtig effect, cijfer nu in inkt i.p.v. wit voor een gegraveerde
      look.
      **"Eerste stap"-callout**: een zachte, laag-opaque schaduw-rechthoek
      achter de box plus een dubbele goudrand (dikkere buitenrand, dunne
      lichtgouden binnenrand) in plaats van de vlakke enkele rand.
      **Typografie**: een nieuwe `drawTrackedLine`-helper tekent labels
      letter voor letter met handmatige tracking (pdf-lib heeft geen
      ingebouwde letter-spacing) — toegepast op alle kleine hoofdletter-
      labels (eyebrows, "Vereisten"/"Voorkeuren", "Stappen"). De cover- en
      wildcard-titel krijgen een `foil`-modus: twee keer getekend
      (donkergoud licht verschoven, dan lichtgoud erbovenop) voor een
      zachte metallic-schijn-illusie.
      Getest: een losse testrender met mock-data via de PyMuPDF-rasterizer
      (niet gecommit, opgeruimd na controle) — cover, profiel, een
      idee-pagina en de wildcard-pagina pagina voor pagina met ingezoomde
      crops van de badge en de callout-box gecontroleerd; nog steeds exact
      9 pagina's, geen afkapping, geen lay-outregressie. `tsc --noEmit`/
      `eslint .`/`npm run build` schoon.

- [x] Stap 19 — Style Engine verwijderd, vervangen door één vaste
      "vrolijke luxe"-beeldset, op expliciet verzoek. De 6-stijlenkeuze uit
      Stap 12 (bloom/warm/bold/edge/calm/vivid, 24 afbeeldingen, een aparte
      wizard-pagina) is volledig verwijderd — er is geen stijlkeuze meer,
      elk Idea Book gebruikt voortaan dezelfde vaste illustratieset.
      **Nieuwe beelden**: 4 nieuwe afbeeldingen (cover + 3 sfeerbeelden)
      gegenereerd via Gemini met een expliciete "vrolijk + luxueus"-prompt
      (stralend goudlicht, edelsteen-tinten emerald/saffier/koraal met
      gouden bladgoud-accenten, "uplifting en celebratory" maar verfijnd) —
      bewust gekozen boven het hergebruiken van een van de 6 bestaande
      stijlen, na overleg. Opgeslagen als
      `public/illustrations/idea-book/{cover,mood-1,mood-2,mood-3}.jpg` via
      het nieuwe `scripts/generate-idea-book-illustrations.ts` (vervangt
      `generate-style-illustrations.ts`, dat samen met de oude 24
      afbeeldingen en `src/lib/styleEngine.ts` is verwijderd). De
      goud/emerald "quiet luxury"-chrome uit Stap 18 (badge, kaders,
      banners) blijft bewust ongewijzigd — expliciet zo gekozen toen
      hierover gevraagd is — en het resultaat past er verrassend goed bij:
      de vrolijke, edelsteenkleurige illustraties met bladgoud-details
      sluiten naadloos aan op de gedempte goud/emerald PDF-kaders.
      **Opgeschoond**: `IntakeAnswers.styleId` en de bijbehorende
      "style-cards"-veldsoort, wizard-pagina-item, `dict.intake.style`- en
      `EMPTY_ANSWERS.styleId`-verwijzingen zijn allemaal verwijderd;
      `renderIdeaBookPdf()` heeft geen `styleId`-parameter meer en laadt de
      vaste afbeeldingen rechtstreeks. De laatste wizard-pagina ("Laatste
      stap") toont nu alleen nog de gezelschapsvraag.
      Getest: de volledige wizard doorlopen — geen stijlkeuze meer
      zichtbaar op de laatste pagina — en een echte testgeneratie zowel
      lokaal als op productie (windowinto.nl) gedraaid; de gedownloade
      PDF's cover-, idee- en wildcard-pagina's tonen overal consequent de
      nieuwe vaste vrolijke-luxe-beelden, nog steeds exact 9 pagina's.
      `tsc --noEmit`/`eslint .`/`npm run build` schoon.

- [x] Stap 20 — Technische best-practices-audit uitgevoerd en drie van de
      vier gekozen categorieën geïmplementeerd (security headers, SEO/
      deel-previews, toegankelijkheid); de vierde (tests/error-monitoring)
      bewust niet gestart, en een vijfde, apart aangedragen wens
      (fotorealistische "vrolijke luxe"-restyle van de hele website) staat
      nog open, in afwachting van gerichte vervolgvragen.
      **Security headers**: nieuwe `src/proxy.ts`-logica (Next 16's naam
      voor middleware) genereert per request een CSP-nonce en zet die zowel
      als `x-nonce`-requestheader (zodat Next's eigen React-hydration-
      scripts hem automatisch krijgen) als in de `Content-Security-Policy`-
      responseheader, naast `'strict-dynamic'`. Dit was geen triviale
      toevoeging: een simpele statische `script-src 'self'` in
      `next.config.ts` bleek **live** de hele intake-pagina te breken
      (Next.js' eigen inline hydration-scripts werden geblokkeerd,
      geconstateerd via een echte production-server-test op poort 3001,
      niet alleen `next dev`, omdat dev-mode een andere CSP-realiteit heeft
      dan productie). Twee specifieke, inhoudelijk vaste Next.js-
      bootstrapscripts kregen zelfs mét het nonce-mechanisme geen nonce
      toegewezen (vermoedelijk een randgeval in Next 16.3.4's eigen
      CSP-ondersteuning) — opgelost met twee expliciete `sha256`-hash-
      allowlist-entries (geverifieerd stabiel over meerdere reloads, dus
      geen `'unsafe-inline'`-omweg). `next.config.ts` zelf bevat nu alleen
      nog de headers die geen per-request nonce nodig hebben:
      X-Frame-Options, X-Content-Type-Options, Referrer-Policy,
      Permissions-Policy.
      **SEO & deel-previews**: `metadataBase`, Open Graph- en Twitter-Card-
      metadata toegevoegd aan de root layout (hergebruikt de nieuwe
      Idea Book-omslagillustratie als voorlopige deel-afbeelding) — en,
      belangrijker, expliciet ook aan `/shared/[id]`, want zonder een eigen
      `openGraph`-blok daar erft die pagina alleen de generieke titel/
      afbeelding van de root layout (Next.js' metadata-merging vervangt
      geneste objects niet automatisch met kind-informatie) — precies de
      pagina die je eigen deel-functie (Fase A) bedoeld is om te delen.
      Nieuwe `src/app/robots.ts` en `src/app/sitemap.ts`: `/plan`,
      `/checkout`, `/intake` en `/shared/[id]` staan expliciet op
      disallow/buiten de sitemap — `/shared/[id]` bevat iemands persoonlijk
      gegenereerde Idea Book en hoort niet doorzoekbaar te worden voor
      Google, ook al is de link zelf openbaar deelbaar.
      **Toegankelijkheid**: de `PillSlider` bleek bij inspectie al correct
      (`role="slider"`, volledige aria-value-attributen, pijltjestoetsen/
      Home/End) — geen wijziging nodig. De echte gaten zaten in
      `IntakeWizard.tsx`: visuele `<p>`-labels zijn vervangen door echte
      `<label htmlFor>` (tekst-/locatievelden) resp. `role="group"` +
      `aria-labelledby` (chip-/multi-chipgroepen), zodat een screenreader
      elk veld daadwerkelijk aan zijn label koppelt. `LocationAutocomplete`
      kreeg een optionele `id`-prop plus een lichte ARIA-combobox-behandeling
      (`role="combobox"`, `aria-expanded`, `role="listbox"`/`role="option"`
      op de suggestielijst) — bewust geen volledige toetsenbord-navigatie
      door de suggesties, dat is een grotere, aparte uitbreiding.
      **Opruiming**: vier ongebruikte default Next.js-scaffold-SVG's uit
      `public/` verwijderd (`file.svg`, `globe.svg`, `next.svg`,
      `vercel.svg`, plus het eveneens nergens gebruikte `window.svg`).
      **Bewust niet gestart**: geautomatiseerde tests en error-monitoring
      (Sentry o.i.d.) — een grotere, nieuwe investering die apart is
      teruggelegd bij de gebruiker in plaats van er zomaar een keuze in te
      maken (testframework, scope van dekking, wel/niet Sentry).
      Getest: een echte **production**-server (`npm run build && npm run
      start`, niet `next dev`) op een aparte poort, omdat CSP-gedrag tussen
      dev en productie wezenlijk verschilt — responseheaders gecontroleerd
      via `curl -I`, en de intake-pagina in een verse browsertab volledig
      doorlopen (chip-selectie, label-koppeling via
      `document.getElementById`) zonder consolefouten. `robots.txt`,
      `sitemap.xml` en de Open Graph-tags met `curl` opgehaald en
      inhoudelijk gecontroleerd. `tsc --noEmit`/`eslint .`/`npm run build`
      schoon.

- [x] Stap 21 — De hele live website (niet alleen de PDF) naar dezelfde
      emerald/goud "vrolijke luxe"-identiteit gebracht, op expliciet
      verzoek na Stap 20's audit: fotorealistische beelden i.p.v. de
      bestaande aquarel-illustraties, én de merkkleur zelf van paars naar
      emerald/goud.
      **Nieuwe fotorealistische beelden**: `scripts/generate-illustrations.
      ts` (de landingspagina-hero + de 5 wizard-stapillustraties)
      hergebruikt dezelfde scène-omschrijvingen als voorheen, maar met een
      volledig nieuwe, expliciet fotografische stijl-prefix ("Photorealistic,
      cinematic photograph... deep emerald and warm gold... no illustration
      or painterly style") i.p.v. de oude aquarel/editorial-stijl — een
      bewuste mediumwissel, niet alleen een kleurwissel. De eerste
      hero-generatie viel te amber-gedomineerd uit vergeleken met de andere
      vijf (die sterk emerald+goud troffen, zoals een emerald bankierslamp
      met messing en een kamer vol boekenkasten); opnieuw gegenereerd met
      een sterker op emerald gerichte prompt tot het resultaat zichtbaar
      aansloot bij de rest van de set.
      **Merkkleur zelf verschoven**: `src/app/globals.css`'s twee bestaande
      Tailwind-tokens (`--color-accent`, `--color-accent-dark`) zijn
      herzien van paars naar emerald, plus een nieuw `--color-gold`-token
      — omdat dit via CSS-variabelen loopt (precies waarom `CLAUDE.md` al
      vanaf het begin tokens i.p.v. losse hex-codes voorschreef) kleurde de
      hele site in één keer mee, zonder de 14 bestandsherverwijzingen naar
      `accent`/`accent-dark` één voor één te hoeven aanpassen. Gouden
      accenten bewust beperkt tot twee betekenisvolle, contrastveilige
      plekken in plaats van overal: een subtiele goudrand op de primaire
      knop (`Button.tsx`, "foil edge"-gevoel op het meest herhaalde
      interactie-element) en een dikkere goudrand op het wildcard-kader in
      `IdeaBookViewer.tsx` (echoot de goudframing van de wildcard-pagina in
      de PDF). Bewust géén goud voor body-tekst of knopvulling — onvoldoende
      contrast tegen crème voor WCAG AA, zoals ook expliciet toegelicht bij
      het kiezen van de kleurwaarden.
      `CLAUDE.md`'s eigen "Merk & visuele identiteit"-sectie (onderdeel van
      de oorspronkelijke bouwopdracht, niet alleen het voortgangslogboek)
      is bijgewerkt naar de nieuwe kleurwaarden, met een verwijzing naar dit
      stap-nummer — anders zou dat brondocument voortaan feitelijk onjuist
      zijn.
      Getest: een echte productie-server opnieuw opgestart na de
      kleurwijziging (`npm run build && npm run start`), en de live
      dev-preview doorlopen — landingspagina (nieuwe hero, emerald CTA-knop
      met zichtbare goudrand), intake-wizard (nieuwe stap-foto, emerald
      geselecteerde kaarten, emerald voortgangsbalk) pagina voor pagina
      gecontroleerd. Alle zes nieuwe beelden zijn stuk voor stuk visueel
      geïnspecteerd vóór ze werden geaccepteerd. `tsc --noEmit`/`eslint .`/
      `npm run build` schoon.

- [x] Stap 22 — Volledige visuele herbouw van de Idea Book-PDF, op basis
      van een aangeleverd mockup-beeld ("Blind Date With Your Partner":
      full-bleed foto, donkere gradient, goud-badge rechtsboven, frosted
      glass-kaarten, gouden CTA-pil). Vooraf afgestemd wat wél en niet kon:
      geen uniek per-idee-beeld (blijft bij de bestaande 4 vaste
      sfeerbeelden, live per-idee-generatie zou de wachttijd en kosten per
      aankoop te veel verhogen) en geen pixel-exacte iconen/dot-indicator
      (geen vector-icoonsysteem in pdf-lib) — het mockup is gebruikt als
      sfeer/richting, niet als exacte spec.
      **Volledig nieuwe pagina-opbouw** (`src/lib/pdf/ideaBook.ts`, vrijwel
      het hele bestand herschreven): elke inhoudspagina (profiel, 6 ideeën,
      wildcard) is nu full-bleed — het sfeerbeeld vult de hele pagina
      (`coverFitSize`, een "background-size: cover"-achtige berekening;
      overloop buiten de MediaBox wordt door elke PDF-viewer vanzelf
      afgesneden, de standaardtechniek voor bleed-afbeeldingen), met een
      egale donker-emerald wash plus een onderaan opgebouwde gradient
      (`drawBottomGradient`, gestapelde, steeds transparanter wordende
      banden — pdf-lib kent geen echte gradient-fill) voor leesbare tekst.
      Een idee-pagina heeft nu: een gouden "munt"-badge met nummer
      rechtsboven (was linksonder op de zijkolom), titel/intro/why-it-fits
      over de foto, een frosted glass-paneel met stappen/praktisch/
      locatie/vereisten, en een volledig ondoorzichtige gouden actiebalk
      onderaan voor de eerste stap (verving de oude witte kaart-met-rand
      `drawCallout`). De oude zijkolom-layout (`drawSideColumn`,
      `SIDE_COL_WIDTH`/`TEXT_COL_X`) is volledig verwijderd.
      **Zichzelf aanpassend glas-paneel**: de eerste testrender liet een
      duidelijk probleem zien — bij kortere content (weinig vereisten, geen
      locatie) bleef het glas-paneel op een vaste, royale hoogte staan en
      oogde het grootste deel gewoon leeg. Opgelost met een "dry run"-
      meettechniek: een nieuwe module-brede `dryRun`-vlag laat elke
      teken-helper (`drawParagraph`, `drawBulletList`, `drawNumberedList`,
      `drawMetaLine`) de `y`-cursor nog steeds normaal verplaatsen maar de
      daadwerkelijke `page.draw*`-aanroepen overslaan; de paneel-inhoud
      wordt zo eerst één keer "droog" gerenderd om de werkelijk benodigde
      hoogte te meten, dan wordt het glas-paneel op precies die hoogte
      getekend, en pas daarna wordt dezelfde inhoud-tekenfunctie nog een
      keer echt aangeroepen — één bron van waarheid voor lay-out in plaats
      van een losse, makkelijk-uit-sync-rakende meetfunctie. De
      profielpagina slaat het paneel zelfs volledig over als er geen
      moet-haves/voorkeuren zijn opgegeven, in plaats van een lege kaart
      te tonen.
      **Voetnoot-/tekstkleuren omgedraaid**: omdat elke pagina nu een
      donkere foto als achtergrond heeft in plaats van het crème
      paginavlak, zijn labels/body-tekst/voettekst overal omgezet van
      donkere naar lichte tinten (`GOLD_LIGHT`/`CHAMPAGNE_LIGHT`/`WHITE`
      i.p.v. `ACCENT_DARK`/`INK`/`MUTED`).
      Getest: eerst een losse testrender met mock-data (kort/lang, met/
      zonder vereisten en locatie) via de PyMuPDF-rasterizer om het
      leeg-paneel-probleem te reproduceren en daarna te bevestigen dat het
      opgelost was; daarna een echte, betaalde testgeneratie via de
      bestaande test-bypass met een "cadeau voor een kunstliefhebber in
      Haarlem"-profiel — de echte Claude-output (incl. een verwijzing naar
      het Frans Hals Museum) rendert overal correct, inclusief een idee
      zonder locatie waarbij die regel netjes wegvalt. Nog steeds exact 9
      pagina's. `tsc --noEmit`/`eslint .`/`npm run build` schoon.

- [x] Stap 23 — Volledige visuele herbouw van de Idea Book-PDF naar een
      rustige, lichte "vensters met vitrage"-stijl, op basis van een echt
      aangeleverd achtergrondbeeld (`Achtergrond.jpeg`, door de gebruiker
      zelf aangedragen als projectbestand). Vervangt het donkere
      goud/emerald "quiet luxury"-thema uit Stap 18-22 volledig — expliciet
      zo gekozen na een gerichte vraag, niet als hybride ernaast.
      **Vaste, echte achtergrondfoto i.p.v. AI-gegenereerde sfeerbeelden**:
      het aangeleverde beeld is gekopieerd naar
      `public/illustrations/idea-book/background.jpg` en wordt nu als
      full-bleed achtergrond gebruikt op alle 7 inhoudspagina's (profiel +
      6 ideeën) — met een lichte, per-pagina horizontale pan-variatie
      (`BACKGROUND_PANS`) zodat dezelfde foto niet zeven keer pixel-
      identiek oogt. Cover en wildcard/slotpagina krijgen elk een nieuw,
      apart gegenereerd beeld in dezelfde zachte/luchtige/fotorealistische
      sfeer (`scripts/generate-idea-book-illustrations.ts` herschreven —
      genereert nu alleen nog `cover.jpg`/`closing.jpg`, de achtergrond is
      geen AI-beeld meer). De 3 oude `mood-*.jpg`-bestanden zijn
      verwijderd.
      **Nieuw kleurenpalet, volledig losstaand van het vorige**: warm
      houtskoolzwart voor de kaartvulling, warme ivoor/room voor primaire
      tekst, een zachte taupe/greige als enige accentkleur (vervangt
      goud volledig) — gekozen omdat dit beeld overwegend licht is, en de
      eigen instructie expliciet vroeg om dan een donkere transparante
      overlay te gebruiken voor leesbaarheid, in plaats van per plek te
      moeten inschatten of de achtergrond licht of donker is.
      **Echt afgeronde kaarten**: pdf-lib's `drawRectangle` kent geen
      radius-optie; opgelost met een nieuwe `roundedRectPath()`-functie
      (een met de hand opgebouwd SVG-rondedhoeken-path) getekend via
      `page.drawSvgPath()` — geverifieerd dat pdf-lib's eigen Y-as-flip
      (het commentaar in de pdf-lib-broncode zelf: "SVG path Y axis is
      opposite pdf-lib's") de verwachte positionering oplevert door het
      eerst in een render te controleren vóór het overal te gebruiken.
      **Van drie kaarten naar twee, consolidatie i.p.v. decoratie**: de
      oude driedelige opbouw (los kop-blok zonder kader, glas-paneel,
      volledig ondoorzichtige gouden actiebalk uit Stap 22) is vervangen
      door precies twee afgeronde, semi-transparante kaarten per
      idee-/wildcardpagina: één hoofdkaart (titel, intro, waarom-dit-past,
      stappen, praktische info, vereisten) en één compacte eerste-actie-
      kaart — beide zelf hun hoogte bepalend via dezelfde dry-run-
      meettechniek uit Stap 22 (nu consistent toegepast op alle kaarten,
      inclusief de eerste-actie-kaart, die dat in Stap 22 nog niet had).
      De gouden badge/foil-teksteffecten zijn volledig verwijderd — een
      minimale glazen cirkel-badge (zelfde visuele taal als de kaarten)
      voor het idee-nummer is het enige decoratieve accent dat overblijft.
      Het volledige-paginakader om de wildcard-pagina (Stap 22) is ook
      geschrapt — die pagina onderscheidt zich nu alleen nog via zijn
      eigen beeld en copy, niet via een extra decoratief element.
      Onderweg een echte bug gevonden en gefixt: een eerste testrender
      liet op de profielpagina een leeg vierkantje zien i.p.v. een
      ster-badge — het gebundelde Noto Sans Bold-lettertype bevat geen
      "★"-glyph. Opgelost door de badge op de profielpagina helemaal weg
      te laten (een profiel heeft toch geen volgnummer nodig) in plaats
      van naar een ander glyph te zoeken.
      Getest: een losse testrender met mock-data (met/zonder vereisten en
      locatie, een idee met een lange titel) via de PyMuPDF-rasterizer —
      afgeronde hoeken, kaart-transparantie en de zelf-aanpassende
      kaarthoogtes stuk voor stuk gecontroleerd, inclusief de hierboven
      genoemde badge-bugfix; daarna een echte, betaalde testgeneratie via
      de bestaande test-bypass met een Utrecht-profiel — de echte
      Claude-output (met een verwijzing naar Landgoed Amelisweerd en de
      Kromme Rijn) rendert overal correct in de nieuwe stijl. Nog steeds
      exact 9 pagina's. `tsc --noEmit`/`eslint .`/`npm run build` schoon.

- [x] Stap 24 — "Clean Premium Hybrid" UI/UX-redesign van Landing, Intake
      en Checkout, op basis van een gedetailleerde eigen specificatie.
      Uitsluitend visueel/structureel (typografie, spacing, componentontwerp,
      layout) — geen enkele wijziging aan state, server actions, routes,
      velden of het datamodel.

      **Voorafgaand: codebase-drift geconstateerd en veiliggesteld.** Bij het
      oppakken van deze stap bleek de werkmap fors afgeweken te zijn van wat
      deze sessie's eigen Stap-log beschreef — commits `43c292a` en
      `f8f5c59` (beide door de projecteigenaar zelf, niet door deze sessie)
      plus een grote hoeveelheid ongecommit werk voor een parallel,
      "WindowInto master-prompt"-gedreven traject met een eigen
      "Fase 1-7"-nummering (Open Doors/Serendipity Engine, karakterprofiel,
      een `/admin`-auditlog-omgeving, idee-feedback, Unsplash-gebaseerde
      fotografie i.p.v. de eigen Gemini-illustraties). Dat bleek geen
      vreemde/ongeautoriseerde wijziging maar werk van de gebruiker zelf in
      een aparte, parallelle sessie op dezelfde repository. Uit
      voorzorg is dat ongecommitte werk (~3300 regels, o.a. `src/app/admin/`,
      `src/lib/characterProfile.ts`, `src/lib/discoveryProfile.ts`,
      `src/lib/possibilityMap.ts`, `src/lib/auditLog.ts`, de audit-log- en
      idee-feedback-migraties) eerst in een eigen commit vastgelegd voordat
      deze stap begon — puur een veiligheidsmaatregel tegen dataverlies bij
      gelijktijdig bewerken van dezelfde bestanden, geen inhoudelijke
      wijziging. Deze stap raakt bewust geen van die bestanden, noch
      `dictionaries.ts`, `generateIdeaBook.ts`, `ideaBookTypes.ts`,
      `IdeaBookViewer.tsx`, `GeneratingScreen.tsx` of `IdeaDetail.tsx` — die
      staan actief in ontwikkeling in dat andere traject.

      **Design tokens** (`globals.css`): `--color-accent` verschoven van
      emerald naar diep teal (`#0F766E`/`#115E59`), `--color-ink` naar
      `#111827`, `--color-cream`/`--color-paper` naar `#FAFAFA`/`#FFFFFF`,
      plus twee nieuwe tokens `--color-border` (`#E5E7EB`) en
      `--color-surface-active` (`#F9FAFB`) — dezelfde truc als Stap 21:
      centrale tokens aanpassen kleurt automatisch de hele site mee, zonder
      elk bestand apart te hoeven aanpassen. `--color-gold` blijft
      gedefinieerd (ongewijzigd) omdat de niet-geraakte schermen
      (Idea Book-viewer, generating-screen) er nog naar verwijzen.
      **Typografie**: Fraunces/Inter vervangen door Newsreader (serif,
      alleen landing-headlines) en Plus Jakarta Sans (sans, overal elders +
      body) via `next/font/google` in `layout.tsx`. Intake- en
      Checkout-koppen zijn expliciet omgezet van `font-serif` naar
      `font-sans font-semibold tracking-[-0.02em]`, conform de eigen
      specificatie dat alleen de landingspagina de serif-koppen behoudt.
      **Componenten**: `Button.tsx` van volle pillen (`rounded-full`) naar
      `rounded-md` (6px), de gouden "foil"-knoprand verwijderd, primaire
      knop nu een vlakke inkt-vulling (geen schaduw/glow). `PillSlider.tsx`
      volledig herbouwd van een sleep-thumb-op-een-trackje naar een
      segmented control (rij knoppen in één `role="radiogroup"`, actieve
      stap inkt-gevuld) — rechtstreeks de gevraagde oplossing voor het
      "faded/onduidelijk contrast"-probleem, met dezelfde
      toetsenbordnavigatie (pijltjes/Home/End) als voorheen.

      **Landing**: de 2x2-fotocollage-in-een-donker-frame
      (`WindowIllustration`) vervangen door één rustige, afgeronde
      productmockup-kaart met een subtiele rand (geen zware schaduw).
      Primaire/secundaire CTA's staan nu naast elkaar zonder afleidende
      onderschrift-tekst direct eronder — de prijsvermelding is verplaatst
      naar het eyebrow-badge boven de headline. "Wat je krijgt"-kaarten,
      testimonial-kaarten en de sluitings-CTA-banner zijn meegenomen naar
      hetzelfde tokens-systeem (8px-radius, `border-border`, geen
      blurred-gloed-cirkels achter de banner meer).
      **Intake** (`IntakeWizard.tsx`): de linker full-bleed sfeerfoto met
      donkere overlay (desktop-only split-layout) is volledig verwijderd
      — nu één centrale kaart op elke breedte. De losse segmented-
      voortgangsbalk + mobiele "Stap X van Y"-tekst zijn vervangen door één
      "Stap X van Y"-pilbadge (altijd zichtbaar) plus een dunne (2px)
      geanimeerde voortgangsbalk eronder. Chip-/multi-chipkaarten hebben nu
      een consistente `ChipOption`-component: bij selectie een 2px
      inkt-rand + lichte vulling (`--color-surface-active`) + een
      vinkje-icoon, in plaats van een kleurverzadigde accent-rand zonder
      icoon. De nu ongebruikte `image`-velden (`PageConfig`/`buildPages`,
      `INTAKE_STOCK_PHOTOS`) zijn opgeruimd i.p.v. dode code achter te
      laten.
      **Checkout**: van één kolom naar een 2-koloms lay-out (linker
      besteloverzicht met prijs + stappen, rechter paneel met cadeau-
      toggle/disclaimer/waiver/CTA — stort samen tot één kolom onder
      `lg:`). De groene genummerde cirkels zijn vervangen door een echte
      verticale tijdlijn met verbindingslijn en afgevinkte iconen. De
      opvallende gele test-mode-blokkade midden in het paneel is eruit
      gehaald; een nieuwe, losse `TestModeBanner.tsx` (dezelfde
      `skipPaymentForTesting`-server-action) toont 'm nu als een smalle,
      niet-opdringerige balk direct onder de header, boven de rest van de
      pagina.
      Getest: volledige wizard doorlopen in de browser (alle 5 pagina's,
      chip-selectie met vinkje, segmented sliders klikken + toetsenbord,
      draft-persistence ongemoeid), checkout in 2-koloms en (375px)
      1-koloms weergave, en een volledige echte testgeneratie via de
      bestaande test-bypass — de bestaande, ongewijzigde `/plan`-pagina
      rendert daarna probleemloos mee in de nieuwe teal/zwart-kleurstelling
      (bevestigt dat de tokens-aanpak geen van de niet-geraakte schermen
      breekt). `tsc --noEmit`/`eslint .`/`npm run build` schoon.

- [x] Stap 25 — Zes nieuwe fotorealistische "luxe magazine"-stillevens
      toegevoegd aan Landing, alle 5 Intake-pagina's en Checkout, op
      expliciet verzoek na feedback dat Stap 24's minimalisme "niet
      aantrekkelijk en professioneel" oogde. Herstelt bewust een deel van de
      fotorijkdom die Stap 24 had weggehaald, maar dan passend bij de
      Clean Premium Hybrid-vormtaal (geen donkere overlay, geen tekst over
      de foto — de foto is een decoratief, op zichzelf staand beeld naast
      de content, niet een achtergrond eronder).
      **Nieuwe beelden**: `scripts/generate-luxury-illustrations.ts`
      (nieuw script, zelfde `generateIllustration()`-patroon als de
      bestaande generatiescripts) genereert zes vaste stillevens —
      kompas-op-landkaart, leren kledinghanger, analoog mengpaneel
      (aluminium/walnoot), vensterkozijn met uitzicht op een zonnige
      binnenplaats, glazen prisma met lichtstraal, marmeren schaal met
      strijklicht — met een eigen `STYLE_PREFIX` (warme neutrale tinten,
      Kinfolk/Cereal-achtige editorial-fotografie) losstaand van de
      bestaande emerald/goud-stijlprefix in `generate-illustrations.ts`,
      bewust omdat deze set de nieuwe, terughoudender teal/zwart-identiteit
      ondersteunt in plaats van een eigen kleur op te dringen — de
      omringende UI draagt het accent, de foto's blijven neutraal.
      Opgeslagen onder `public/illustrations/luxury/`, geëxporteerd via
      nieuwe `LUXURY_ILLUSTRATIONS`- en `INTAKE_LUXURY_PHOTOS`-constanten in
      `src/lib/illustrations.ts`.
      **Toewijzing per pagina** (zelf gekozen op thematische klik, zoals
      gevraagd): het vensterkozijn-met-uitzicht op de landing-hero (een
      letterlijke weergave van het eigen "venster"-motief) én, als bewuste
      callback/bookend, nogmaals — breder bijgesneden — op checkout, boven
      het besteloverzicht. Kompas-op-landkaart op Intake-pagina 1
      ("Jouw situatie" — richting bepalen), leren kledinghanger op pagina 2
      ("Over jou"), het mengpaneel op pagina 3 ("Jouw stijl" — de letterlijk
      dichtstbijzijnde klik: knoppen/schuiven verstellen, exact wat de
      sliders op die pagina doen), het prisma op pagina 4 ("Waar je voor
      openstaat" — licht dat in meerdere richtingen uiteenvalt, past bij
      meerdere soorten mogelijkheden), de marmeren schaal op pagina 5
      ("Laatste stap" — rustige afsluiting).
      **Layout**: `IntakeWizard.tsx` heeft de linkerkolom-foto (verwijderd
      in Stap 24) teruggekregen — desktop-only, `md:w-2/5`, zonder de oude
      donkere overlay/koptekst-over-de-foto van vóór Stap 24; alle tekst
      blijft in de rechterkolom, de foto is nu puur decoratief. `page.tsx`
      (landing) en `checkout/page.tsx` gebruiken dezelfde
      `LUXURY_ILLUSTRATIONS.windowView` op twee plekken met verschillende
      `aspect-*`-crops (`aspect-4/3` groot op landing, `aspect-[16/9]`
      compact op checkout) in plaats van een los zevende beeld te
      genereren voor checkout.
      **Opgeschoond**: de nu volledig ongebruikte oude
      `LANDING_HERO_ILLUSTRATION`/`WIZARD_PAGE_ILLUSTRATIONS`-constanten
      (Stap 8/21, hadden al geen enkele aanroeper meer sinds de "Figma Make
      prototype"-commit de site op Unsplash-stockfoto's zette) en
      `HERO_WINDOW_PANELS`/`INTAKE_STOCK_PHOTOS` (dat Unsplash-stockfoto's
      set, overbodig zodra de landing/wizard weer eigen, self-hosted
      beelden gebruiken) zijn verwijderd uit `src/lib/illustrations.ts`.
      `IDEA_HERO_PHOTOS`/`ideaHeroPhoto` (nog actief gebruikt door
      `IdeaDetail.tsx`, onderdeel van het andere, parallelle traject) is
      bewust ongemoeid gelaten.
      Getest: alle 6 nieuwe beelden individueel visueel geïnspecteerd vóór
      gebruik; de volledige wizard doorlopen in de browser (elke pagina
      toont het juiste, bedoelde beeld, inclusief een korte controle dat
      mobiel — 375px — de foto-kolom netjes verbergt in plaats van een
      kapotte layout te geven) en checkout met de hergebruikte
      vensterfoto. `tsc --noEmit`/`eslint .`/`npm run build` schoon.

- [x] Stap 26 — "Warm Walnut"-kleur-/radius-restyle van dezelfde drie
      schermen (Landing, Intake, Checkout), op verzoek na feedback dat de
      teal/zwarte Stap 24-25-uitstraling nog niet warm/premium genoeg
      aanvoelde. Alleen tokens + `Button.tsx` aangepast — geen enkele
      layout-/componentwijziging (die kwam al in Stap 24-25 goed uit de
      verf), geen nieuwe beelden nodig (de 6 lokale foto's uit Stap 25 —
      leer, walnoot, marmer, messing — passen al perfect bij dit warmere
      palet).
      **Belangrijke kanttekening vooraf gedeeld**: de drie door de
      gebruiker bijgevoegde referentiebeelden (gevonden op eigen initiatief
      in `Downloads/`, na het zoeken op de genoemde bestandsnamen) bleken
      zelf vrijwel pixel-identieke screenshots van de bestaande site te
      zijn (dezelfde teal/zwart/wit-opzet, met wat kleine icoontjes
      toegevoegd) — geen walnoot/goud-sfeer zoals de begeleidende tekst
      beschreef. De zeer expliciete, hex-exacte tekstbrief is als leidend
      genomen in plaats van de beelden zelf.
      **Tokens** (`globals.css`): dezelfde variabelenamen als Stap 24
      (`--color-accent`, `--color-accent-dark`, `--color-ink`,
      `--color-cream`, `--color-paper`, `--color-border`, `--color-
      surface-active`, `--color-gold`) behouden hun rol maar krijgen nieuwe
      hex-waarden — walnoot/warmgrijs/crème i.p.v. teal/koelgrijs/wit —
      plus twee nieuwe tokens (`--color-walnut-light`, `--color-gold-
      light`, `--color-muted`) voor de secundaire accenten uit de
      specificatie. Nieuwe `--radius-sm/-md/-lg`-tokens (8/12/18px)
      overschrijven Tailwinds eigen `rounded-sm/-md/-lg`-schaal, dus elke
      bestaande `rounded-md`/`rounded-lg`-className in de app (knoppen,
      kaarten, inputs, panelen) wordt in één keer zachter/ronder — exact
      dezelfde "verander het token, niet elk bestand"-aanpak als steeds dit
      traject.
      **`Button.tsx`**: primaire knop nu een vlakke walnoot-donker-vulling
      (`--color-accent-dark`) met een dunne gouden randkleur en een zacht
      schaduweffect bij hover (conform de aangeleverde CSS), secundaire
      knop een crème-vulling met een walnoot-hoverrand, een goud-getinte
      focus-ring i.p.v. de vorige accentkleur-ring, en een consistente
      `min-h-12`(48px)/`min-h-11`(44px) op alle knopgroottes zodat
      Terug/Verder-paren altijd op dezelfde hoogte staan. De landingspagina's
      sluitings-CTA-banner (voorheen `bg-ink`) is naar `bg-accent-dark`
      (walnoot-donker) gezet voor eenzelfde warme, premium paneelvulling als
      de knoppen — alle overige donkere/geselecteerde elementen (chip-
      selectie, sliders, checkout-tijdlijn) blijven bewust op `ink` staan,
      niet walnoot, conform "gebruik walnoot/goud met mate".
      Getest: volledige wizard + checkout opnieuw doorlopen in de browser
      (elke pagina, alle 5 foto's, geselecteerde/niet-geselecteerde
      knopstaten, focus-/hoverstaten) en de landingspagina — alles warm,
      samenhangend, en de bestaande Stap 25-fotografie sluit er naadloos
      op aan. `tsc --noEmit`/`eslint .`/`npm run build` schoon.

- [x] Stap 27 — De 5 Intake-foto's uit Stap 25 (indoor walnoot/leer-set:
      kompas, kledinghanger, mengpaneel, prisma, marmeren schaal) vervangen
      door een nieuwe "outdoor adventure"-set, op een zeer gedetailleerde,
      per-pagina eigen specificatie (sage/mos/terracotta/lucht-blauw,
      geen mensen/tekst/logo's). De landingspagina-hero + checkout-bookend
      (`LUXURY_ILLUSTRATIONS.windowView`) zijn **expliciet niet aangepast**,
      conform de uitdrukkelijke instructie — dat ene beeld blijft het venster
      met de zonnige binnenplaats uit Stap 25.
      **Nieuwe beelden**: `scripts/generate-outdoor-illustrations.ts`
      (nieuw script, eigen `STYLE_PREFIX` losstaand van het indoor-neutrale
      prefix in `generate-luxury-illustrations.ts`) genereert 5 vaste
      stillevens onder `public/illustrations/outdoor/`: een vensterbank met
      een mistig bospad erachter, kompas/verrekijker/kaartrol
      (`situation.jpg`, Intake-pagina 1), een outdoor-gearkapstok met
      regenjas/rugzak/wandelschoenen i.p.v. de kledingrek-hanger
      (`about.jpg`, pagina 2), een houten tuintafel met veldnotitieboekjes/
      kompas/gedroogde bloemen (`dials.jpg`, pagina 3 — de sliders-pagina),
      een picknickkleed-flatlay met een cadeau/aquarelsetje/kruiden
      (`openness.jpg`, pagina 4), en een tuinbank met boeken/mokken in
      warm avondlicht (`final.jpg`, pagina 5).
      **Eén bewuste vereenvoudiging, expliciet afgeweken van de specificatie**:
      voor pagina 5 vroeg de specificatie om een letterlijke 3-panelen-
      collage (picknickkleed + tuinbank + tuinstoel als drie aparte
      deelbeelden) — deze pagina rendert technisch gezien altijd één
      enkele foto (geen collage-compositing-infrastructuur in het project),
      dus is in plaats daarvan één samenhangende tuinbank-scène gegenereerd
      die de sfeer van alle drie de elementen vangt (boeken, mokken, warm
      licht, groen) in één beeld.
      **Opgeruimd**: de 5 nu volledig ongebruikte Stap 25-bestanden
      (`compass.jpg`, `hanger.jpg`, `mixer.jpg`, `prism.jpg`,
      `marble-bowl.jpg`) zijn verwijderd uit `public/illustrations/luxury/`
      — alleen `window-view.jpg` blijft daar staan. `src/lib/
      illustrations.ts`'s `LUXURY_ILLUSTRATIONS`-object bevat nu alleen nog
      `windowView`; `INTAKE_LUXURY_PHOTOS` wijst naar de nieuwe
      `outdoor/`-set. `scripts/generate-luxury-illustrations.ts` zelf is
      bewust laten staan (documenteert nog hoe `window-view.jpg` gemaakt
      is), ook al genereert een herrun ervan nu overbodige bestanden.
      Getest: alle 5 nieuwe beelden individueel visueel geïnspecteerd;
      de volledige wizard doorlopen in de browser (elke pagina toont het
      juiste nieuwe beeld) en de landingspagina expliciet gecontroleerd op
      een ongewijzigde hero. `tsc --noEmit`/`eslint .`/`npm run build`
      schoon.

- [x] Stap 28 — De landing-hero alsnog vervangen door de fan-collage uit de
      referentie (Stap 27 liet 'm expliciet ongewijzigd; hier expliciet
      omgedraaid op verzoek), plus twee Intake-foto's vervangen door
      eigen aangeleverde bestanden.
      **Hero volledig vereenvoudigd**: eerdere pogingen bouwden de fan als
      zes losse foto's met CSS `clip-path`-wiggen rondom een gedeeld
      draaipunt (`HeroFanCollage.tsx`) — technisch werkend, maar met
      wiggen van sterk ongelijke zichtbare oppervlakte (een wig die naar de
      dichtstbijzijnde rand van de container wijst, heeft simpelweg veel
      minder ruimte dan een wig die naar de verre kant wijst), wat ondanks
      meerdere pogingen met hoek-herverdeling nooit een gebalanceerde fan
      opleverde. Overbodig geworden zodra bleek dat de gebruiker één al
      volledig samengestelde fan-afbeelding aanleverde (`hero.jpeg`,
      gevonden in `Downloads/` op eigen initiatief, zelfde patroon als
      eerdere sessies) — `HeroFanCollage.tsx` is teruggebracht tot een
      simpele `<Image>`-weergave van dat ene bestand
      (`public/illustrations/hero-fan/hero.jpg`), zonder kaartrand/
      achtergrondvlak: de foto's eigen witruimte rond de waaiervorm oogt al
      vrijwel naadloos tegen de crème paginakleur, en de bruin/crème-tinten
      in het beeld zelf sluiten toevallig al goed aan bij het "Warm
      Walnut"-palet. De 6 losse, nu volledig ongebruikte wig-foto's
      (koffie/berg/tuin/markt/atelier/ruïnes) en het bijbehorende
      `scripts/generate-hero-fan-illustrations.ts` zijn verwijderd.
      **Twee Intake-foto's vervangen door eigen bestanden**: de gebruiker
      leverde ook `Foto1.jpeg` (vensterbank/bospad, vervangt Intake-pagina 1
      "Jouw situatie") en `Foto4.jpeg` (picknickkleed/aquarelsetje, vervangt
      pagina 4 "Waar je voor openstaat") aan — beide zijn eigen,
      net-iets-anders gecomponeerde varianten van dezelfde motieven als de
      Stap 27-Gemini-beelden. Simpele bestandsvervanging op exact dezelfde
      paden (`public/illustrations/outdoor/situation.jpg` en
      `openness.jpg`) — geen codewijziging nodig, `INTAKE_LUXURY_PHOTOS`
      wees al naar die bestandsnamen.
      **`src/lib/gemini.ts`** kreeg voor deze stap's (achteraf overbodig
      gebleken) fan-wiggen-experiment een uitgebreide `aspectRatio`-union
      (`"3:4" | "2:3" | "1:1"` toegevoegd naast `"4:3"/"3:2"`) en een
      optionele `imageSize: "1K" | "2K"`-parameter — blijft staan, want
      Stap 27's outdoor-set is met dezelfde uitbreiding ook opnieuw
      gegenereerd in portret/2K (zie hieronder) en dat blijft bruikbaar
      voor toekomstige portret-generaties.
      **Zijdelings ook gedaan**: op verzoek ("hoge resolutie verticaal")
      zijn de 5 Stap 27-Intake-illustraties opnieuw gegenereerd in
      portretoriëntatie op 2K (was landschap/1K) via dezelfde
      `scripts/generate-outdoor-illustrations.ts` — pagina's 2, 3 en 5
      gebruiken nog steeds deze hogere-resolutie hergeneraties;
      pagina 1 en 4 zijn met de zojuist genoemde eigen bestanden
      overschreven.
      Getest: hero en beide vervangen Intake-foto's stuk voor stuk visueel
      gecontroleerd in de browser (Stap 1 en Stap 4, via een
      sessionStorage-geïnjecteerde draft om snel bij pagina 4 te komen).
      `tsc --noEmit`/`eslint .`/`npm run build` schoon.

- [x] Stap 29 — De hero opnieuw via Gemini gegenereerd (i.p.v. het
      aangeleverde bestand uit Stap 28) en ~1,5x vergroot, op expliciet
      verzoek.
      **Generatie**: nieuw `scripts/generate-hero-illustration.ts` — één
      Gemini-call die de hele waaiercompositie in één beeld aanvraagt
      (zes wig-vormige foto's rond een gedeeld draaipunt: koffie-bij-het-
      raam, besneeuwd bergpad, moestuin, kleurrijke markt, schrijfbureau,
      antieke ruïne, plus het kleine gekantelde raam-met-vaas-inzetfoto op
      het draaipunt) met expliciet `#F7F5F0` als achtergrondkleur — exact
      de hex van `--color-cream` — zodat het gegenereerde beeld zonder
      verdere bewerking naadloos in de paginaondergrond overloopt. Dit
      werkte verrassend goed in één keer: Gemini leverde zes visueel
      gelijkmatige wiggen (waar de eerdere, met de hand met CSS
      `clip-path` opgebouwde waaier uit hetzelfde Stap 28-traject juist
      last had van sterk ongelijke wig-oppervlaktes) — bevestigt dat het
      laten genereren van de hele compositie in één keer hier robuuster
      was dan zelf de geometrie proberen te berekenen.
      **Vergroting**: de hero-sectie in `page.tsx` ging van `max-w-6xl` +
      een gelijke 2-koloms grid naar `max-w-[90rem]` +
      `lg:grid-cols-[1fr_1.5fr]` — bewust zo gekozen dat de tekstkolom
      ongeveer even breed blijft als voorheen (~504px) terwijl de
      beeldkolom naar ~1,5x haar oude breedte (~504px → ~780px) groeit,
      in plaats van simpelweg de bestaande 50/50-verdeling breder te
      trekken (wat de tekstkolom ook onnodig zou vergroten). Alleen de
      hero-sectie werd verbreed; de overige secties op de landingspagina
      (wat je krijgt/testimonials/sluitings-CTA) bleven op `max-w-6xl`.
      Onderweg tegengekomen: Next.js' image-optimizer-cache in dev-mode
      bleef de oude hero tonen nadat het bronbestand overschreven was
      (zelfde URL/query, dus dezelfde cache-sleutel) — opgelost door
      `.next/cache/images` te verwijderen; dit deed zich niet voor bij
      eerdere beeldvervangingen deze sessie omdat die telkens een nieuwe
      bestandsnaam kregen.
      Getest: desktop (1600px, duidelijk grotere/gebalanceerdere waaier,
      naadloze overgang beeld↔pagina-achtergrond) en mobiel (375px, nette
      stapeling, geen overflow). `tsc --noEmit`/`eslint .`/`npm run build`
      schoon.

- [x] Stap 30 — De hero nogmaals via Gemini geregenereerd, deze keer om
      dichter bij de scherpe "pinwheel/ninja-star"-vorm van de eigen
      referentieafbeelding te komen (Stap 29's versie had een zachtere,
      afgeronde regenboogboog-silhouet in plaats van scherpe punten), en
      naar ~2x vergroot (was ~1,5x in Stap 29).
      **Prompt bijgesteld**: `scripts/generate-hero-illustration.ts`'s
      `STYLE_PREFIX`/`PROMPT` expliciet herschreven om scherpe,
      driehoekige wiggen te vragen die in punten samenkomen (i.p.v. een
      afgeronde waaier), panelen die direct tegen elkaar aan liggen zonder
      gekleurde randlijn (alleen een dun wit lijntje ertussen, zoals de
      referentie), én — voor het eerst deze sessie voor gegenereerde
      beelden — een persoon toegestaan (een schilder van achteren gezien,
      gezicht niet zichtbaar, exact zoals de referentie) plus kleine,
      niet-herkenbare figuren op de marktfoto, omdat de gebruiker voor de
      tweede keer expliciet dezelfde referentie met een persoon erin
      aanleverde. Resultaat in één keer een vrijwel exacte match van de
      gevraagde scherpe pinwheel-vorm.
      **Vergroting naar ~2x**: hero-sectie in `page.tsx` van `max-w-[90rem]`
      + `lg:grid-cols-[1fr_1.5fr]` naar `max-w-[110rem]` +
      `lg:grid-cols-[1fr_2fr]` — zelfde rekenmethode als Stap 29 (tekstkolom
      blijft ongeveer op haar oorspronkelijke breedte, alleen de beeldkolom
      groeit, nu naar ~2x i.p.v. ~1,5x).
      **Cache-probleem dieper dan Stap 29 gedacht**: het wissen van enkel
      `.next/cache/images` (Stap 29's fix) bleek deze keer niet genoeg — de
      draaiende dev-server had blijkbaar ook een in-memory-cache die een
      map verwijderen niet raakt zolang het proces leeft. Pas na het
      volledig stoppen van de dev-server, `.next` in zijn geheel wissen
      (niet alleen de `images`-submap) en een verse server starten, toonde
      de browser het nieuwe beeld. Voor toekomstige beeldvervangingen: bij
      een hardnekkig verouderd beeld ondanks een gewijzigd bronbestand,
      eerst de dev-server zelf herstarten vóór dieper te zoeken naar de
      oorzaak.
      Getest: desktop (1700px, scherpe pinwheel-vorm, zichtbaar ~2x groter,
      naadloze crème-overgang) en mobiel (375px, nette stapeling). `tsc
      --noEmit`/`eslint .`/`npm run build` schoon.

- [x] Stap 31 — De hero teruggezet naar een eigen aangeleverd bestand
      (`Hero_goed.jpeg`, gevonden in `Downloads/` op eigen initiatief) —
      de afgeronde waaiervorm uit Stap 28, niet de scherpe pinwheel-vorm
      uit Stap 29-30. Zelfde bestandsnaam/pad
      (`public/illustrations/hero-fan/hero.jpg`) overschreven, aspect-ratio
      in `HeroFanCollage.tsx` teruggezet naar `1255/848` (dit bestands
      exacte pixelmaten, gelijk aan Stap 28's origineel). Grootte

      (`max-w-[110rem]`/`lg:grid-cols-[1fr_2fr]` uit Stap 30) ongewijzigd
      gelaten.
      **Cache-les uit Stap 30 direct toegepast**: dev-server gestopt,
      volledige `.next`-map gewist (niet alleen `.next/cache/images`), en
      pas daarna een verse `npm run build` + nieuwe dev-server gestart —
      geen hardnekkig verouderd beeld dit keer, in één keer goed
      zichtbaar.
      Getest: desktop (1700px) en mobiel (375px) — beide tonen direct het
      nieuwe bestand. `tsc --noEmit`/`eslint .`/`npm run build` schoon.

- [x] Stap 32 — De op de live site gemelde rand rond de hero weggehaald en
      het beeld kleiner/beter geproportioneerd gemaakt, op verzoek.
      **Oorzaak van de rand**: niet de achtergrondkleur (`hero.jpg`'s hoek-
      pixel `#F8F5EE` bleek al vrijwel identiek aan `--color-cream`
      `#F7F5F0`, met `sharp` losstaand van de app geverifieerd) maar de
      `drop-shadow`-CSS-filter uit Stap 28-29 op `HeroFanCollage.tsx`: een
      `drop-shadow` op een ondoorzichtige JPEG (geen alfakanaal) werpt een
      schaduw rond de hele **rechthoekige** afbeeldingsgrens, niet rond de
      zichtbare waaiervorm — precies de rand die zichtbaar was. Filter
      volledig verwijderd; geen Gemini-regeneratie nodig, dit was een
      zuivere CSS-fix.
      **Kleiner/beter geproportioneerd**: hero-sectie in `page.tsx` van
      `max-w-[110rem]` + `lg:grid-cols-[1fr_2fr]` (Stap 30's ~2x) terug
      naar `max-w-[84rem]` + `lg:grid-cols-[1fr_1.3fr]` — een gematigder
      ~1,3x t.o.v. de oorspronkelijke 50/50-verhouding uit Stap 28, in
      plaats van de eerder gevraagde 2x.
      Getest: desktop (1600px, `getComputedStyle(...).filter === "none"`
      expliciet gecontroleerd, geen rand meer zichtbaar) en mobiel (375px).
      `tsc --noEmit`/`eslint .` schoon.

- [x] Stap 33 — De Idea Book-PDF omgezet naar hetzelfde "Warm Walnut"-palet
      en dezelfde fotografische stijl als de website (Stap 26-32), op
      verzoek nadat de PDF nog de oudere, losstaande "sheer curtain
      window"-stijl uit Stap 23 had — de twee waren visueel uit elkaar
      gegroeid. Vooraf afgestemd via twee keuzevragen: (1) ja, aansluiten
      bij de website-uitstraling, niet iets anders bedoeld met "de kaarten
      daarvoor"; (2) nieuwe beelden laten genereren in dezelfde stijl,
      geen hergebruik van bestaande website-bestanden.
      **Palet** (`src/lib/pdf/ideaBook.ts`): de 7 kleurconstanten
      (`PANEL_FILL`/`PANEL_BORDER`/`TEXT_LIGHT`/`TEXT_MUTED`/`ACCENT`/
      `CREAM`/`SHADOW_TINT`) rechtstreeks overgenomen van de site's eigen
      design-tokens (`--color-accent-dark`/`--color-gold`/`--color-paper`/
      `--color-gold-light`/`--color-cream`) — walnoot-donkere glaskaarten,
      een antiek-gouden randkleur/labels i.p.v. de vorige neutrale
      taupe/houtskool-combinatie. Uitsluitend deze 7 constanten gewijzigd —
      de rest van het bestand (dry-run-kaartmeting, `roundedRectPath`,
      de "Fase 3/5"-Possibility Map-pagina met deur-groepering die intussen
      door het andere, parallelle traject aan dit bestand is toegevoegd)
      bewust volledig ongemoeid, conform het patroon van elke eerdere
      PDF-restyle dit traject (Stap 18/19/22/23): alleen kleuren/beelden,
      nooit de laag-architectuur.
      **Nieuwe beelden**: `scripts/generate-idea-book-illustrations.ts`
      herschreven met een nieuwe `STYLE_PREFIX` (dezelfde "premium
      travel-magazine, warme walnoothout-tinten"-taal als
      `generate-outdoor-illustrations.ts`/`generate-hero-illustration.ts`)
      en genereert nu voor het eerst ook zelf de gedeelde achtergrond —
      Stap 23's aanpak (de eigen `Achtergrond.jpeg` van de gebruiker als
      vaste achtergrond) is hiermee losgelaten, expliciet akkoord bevonden
      in de keuzevraag vooraf. Cover: een walnoot-schrijftafel met
      leren dagboek, kompas en koffie bij een zonnig raam. Achtergrond
      (gedeeld over profiel + mogelijkheden-kaart + alle 6 idee-pagina's):
      een walnoot vensternis met linnen gordijnen, boeken en een
      olijftakje. Sluiting/wildcard: een walnoot tuinbank in gouden-uur-
      licht met mokken en boeken — bewust eenzelfde soort scène als
      Intake-pagina 5's `final.jpg`, voor herkenbare samenhang tussen boek
      en site zonder letterlijk hetzelfde bestand te hergebruiken.
      **Bijgevangen bug, niet door mij veroorzaakt**: tijdens het
      testrenderen bleek de "✦"-marker op de (door het andere traject
      toegevoegde) Possibility Map-pagina als een lege tofu-box te
      renderen — exact dezelfde soort ontbrekende-glyph-bug als de "★" uit
      Stap 23, ditmaal in het gebundelde NotoSans-Bold-lettertype. Opgelost
      volgens hetzelfde precedent: de marker weggehaald in plaats van een
      vervangend glyph te zoeken (de lichtere tekstkleur onderscheidt de
      "One Thing"-pick al voldoende).
      Getest: een losse testrender met mock-data (kort/lang, met/zonder
      locatie en vereisten) via de PyMuPDF-rasterizer, pagina voor pagina
      gecontroleerd — cover, profiel, possibility-map (glyph-fix
      bevestigd), idee-pagina's (incl. de zelf-aanpassende kaarthoogte bij
      kortere content) en de wildcard-pagina. Nog steeds exact 10 pagina's
      (cover, profiel, possibility map, 6 idee-pagina's, wildcard — de
      possibility-map-pagina zelf is een toevoeging van het andere
      traject, niet van deze stap). `tsc --noEmit`/`eslint .`/`npm run
      build` schoon.

- [x] Stap 34 — Idee-inhoud van generiek naar concreet en uitvoerbaar
      gemaakt, op verzoek: geen "zoek een pottenbakkerij" meer, maar
      "Open steckutrecht.nl en boek een plek bij Ceramics of the Night".
      **Belangrijke kanttekening vooraf gedeeld en samen opgelost**: de
      bestaande systeemprompt verbood tot nu toe expliciet dat Claude
      concrete bedrijfsnamen/adressen verzint (sinds Stap 11, herbevestigd
      in Stap 14 toen bewust voor "geen live web-grounding, veilige
      Maps-links" gekozen werd) — omdat het model zonder actuele databron
      niet kan weten of een verzonnen naam echt bestaat. In plaats van die
      waarborg te laten varen is er nu een echte databron aan toegevoegd:
      Claude's live web-search tool.
      **Nieuwe research-pas vóór generatie**: `researchGroundedOptions()`
      (`src/lib/claude/generateIdeaBook.ts`) doet een eigen Claude-aanroep
      mét de `web_search_20250305`-tool (max. 8 zoekopdrachten, met
      `user_location` op de opgegeven stad + land NL voor relevantere
      resultaten) die op basis van een verkorte profielweergave
      (`formatProfileForResearch`) een compact "research brief" teruggeeft:
      per relevant thema 2-3 echte, actuele bedrijven/venues/platforms/
      routes met stad, korte beschrijving en URL — expliciet alleen wat
      daadwerkelijk in de zoekresultaten stond, nooit gegokt. Faalt zacht:
      als de zoekopdracht om wat voor reden dan ook faalt, gaat de
      generatie gewoon door met een lege brief (idee-generatie valt dan
      terug op generieke, gegarandeerd-echte platforms als Google Maps/
      Meetup i.p.v. te crashen op een onderzoeksstoring in een product dat
      al betaald is).
      **Idee-generatie hergebruikt de brief, verzint niets voorbij haar
      grenzen**: de hoofdprompt in `generateIdeaBook.ts` kreeg een nieuw
      `options`-veld (2-3 concrete, echte alternatieven per idee — naam,
      one-line detail, url), en de bestaande `location`/`details`/
      `first_action`-regels zijn herschreven om expliciet te verwijzen naar
      de meegegeven research brief: namen/locaties/URL's mogen alleen uit
      die brief komen, nooit uit het eigen geheugen van het model. `details`
      moet nu lezen als een kant-en-klare handleiding (exact welke site/app
      te openen, wat te zoeken/klikken) i.p.v. een vage suggestie, en
      `first_action` moet binnen 60 seconden uitvoerbaar zijn met een
      exacte instructie. Nieuw `IdeaOption`-type in
      `src/lib/claude/ideaBookTypes.ts`, met eigen schema/normalisatie
      (`OPTION_SCHEMA`, `normalizeOption(s)`) op dezelfde defensieve manier
      als de bestaande `location`/`practical`-velden.
      **Weergave**: `IdeaDetail.tsx` (gedeeld door `/plan` en
      `/shared/[id]`) toont de concrete opties nu als een lijst met naam,
      detail en klikbare link. `src/lib/pdf/ideaBook.ts` hergebruikt de
      bestaande `drawMetaLine`-helper (naam als label, detail als waarde,
      url als klikbare linkannotatie) onder een nieuwe "Concrete opties"-
      kop, op zowel de idee- als de wildcard-pagina — geen nieuwe
      layout-machinerie nodig, de bestaande dry-run-kaartmeting uit Stap 22
      schaalt vanzelf mee. Nieuw `optionsFallback`-label toegevoegd aan
      `pdfChrome` in `src/lib/i18n/dictionaries.ts` (nl/en).
      Getest: een losse, niet-gecommitte testrun tegen de echte Claude API
      (`scratch/test-grounded-idea-book.ts`, verwijderd na controle) met
      een Utrecht-profiel (pottenbakken, kunst, koffie, buiten) — de
      research-pas vond en gebruikte daadwerkelijk bestaande, verifieerbare
      zaken (Steck Utrecht, Museumcafé Centraal, KOR Utrecht, DagjeSuppen.nl,
      ArtPub Rotsoord) met working URL's, en elke stap/eerste-actie was
      exact en direct uitvoerbaar. De gerenderde PDF (pagina voor pagina
      gecontroleerd via de PyMuPDF-rasterizer, incl. een idee met 3 opties)
      toonde de nieuwe "Concrete opties"-sectie overal correct, zonder
      overloop of afkapping — nog steeds exact 10 pagina's. `tsc --noEmit`/
      `eslint .`/`npm run build` schoon.

- [x] Stap 35 — Het `WindowMark`-lijnicoon overal vervangen door een nieuw,
      voluit-gekleurd "WindowInto"-beeldmerk (twee overlappende, omgekrulde
      afgeronde vierkanten in een oranje-naar-blauw verloop), plus de
      site-header/footer-wordmark van "WINDOW" naar "WindowInto", op
      aangeleverd referentiebeeld (een logo-vel-screenshot, geen los
      bronbestand). Drie keuzevragen vooraf beantwoord: bronbestand →
      nabouwen met Gemini (i.p.v. zelf uitknippen of wachten op een
      aangeleverd bestand); header-variant → icoon + volledige
      "WindowInto"-wordmark (niet alleen "Window", niet icoon-only);
      bereik → overal, inclusief favicon.
      **Icoon opnieuw gegenereerd, niet uitgeknipt**: het aangeleverde
      beeld was een 1024×224px screenshot van een logo-presentatievel — het
      icoontje zelf was daarin maar ~40×40px, te weinig voor een scherpe
      favicon. `scripts/generate-logo-icon.ts` (nieuw, eenmalig) laat
      Gemini de compositie navertellen (twee afgeronde vierkanten, achterste
      effen oranje-naar-geel, voorste met een diagonaal oranje→blauw
      verloop en een omgekrulde rechteronderhoek) op een vlakke witte
      achtergrond, op basis van uit het origineel gesamplede hex-waarden —
      in één poging een zeer close match qua vorm/kleur.
      **Transparantie: flood-fill i.p.v. een globale kleurdrempel**:
      `scripts/process-logo-icon.ts` (nieuw, eenmalig) maakt de witte
      achtergrond transparant via een flood-fill vanaf de beeldrand
      (`isBackgroundish`, laag-verzadigd + helder genoeg) in plaats van elk
      pixel dat op wit lijkt simpelweg transparant te maken — het icoon
      heeft zelf een bijna-wit gevouwen-hoek-hooglicht dat bij een globale
      drempel ook zou worden weggegumd. Omdat flood-fill alleen pixels
      raakt die daadwerkelijk verbonden zijn met de buitenrand, blijft dat
      ingesloten hooglicht intact terwijl zowel de achtergrond als het
      icoon's eigen (ongewenste, niet-overdraagbare) zachte slagschaduw wel
      verdwijnen.
      **Twee echte sharp-bugs gevonden en omzeild tijdens het bouwen van
      dit script** (beide pas zichtbaar na expliciet ruwe pixelwaarden op
      elke tussenstap te controleren, niet alleen op `metadata()` te
      vertrouwen): (1) `removeAlpha().joinChannel(alphaBuffer,
      {raw:{...}}).ensureAlpha().png()` leek een alfakanaal toe te voegen
      (`metadata()` toonde `hasAlpha:true`), maar een pixel met bewust
      alpha=0 kwam er na `.png()`-encoding alsnog als alpha=255 uit —
      `joinChannel` registreert de nieuwe band kennelijk niet als "dit is
      alfa", en de daaropvolgende `.ensureAlpha()` voegt dan een eigen,
      volledig ondoorzichtige band toe die de echte waarden overschrijft.
      Opgelost door de hele keying+feathering-stap binnen één rauwe
      RGBA-buffer te doen met gewone JavaScript (een handgeschreven
      scheidbare box-blur op alleen het alfa-kanaal), en pas daarna één
      keer naar een echte PNG te encoderen — geen `joinChannel`/
      `ensureAlpha` meer nodig. (2) apart daarvan bleek het chainen van
      `.resize()`-aanroepen op dezelfde nog-niet-gematerialiseerde
      sharp-pipeline bij één van twee doelgroottes alsnog het alfakanaal
      te laten vallen; opgelost door tussen elke stap eerst echt naar een
      PNG-buffer te encoderen (`.png().toBuffer()`) vóórdat een volgende
      sharp-instantie daarop verder bouwt, in plaats van dezelfde
      pipeline te clonen.
      **Wordmark**: nieuw `src/components/window/Wordmark.tsx` — "Window"
      in inkt (lichte achtergrond) of wit (donkere achtergrond, via een
      `onDark`-prop), "Into" met een `bg-clip-text`-verloop in exact de
      oranje/blauw-eindkleuren van het icoon zelf. Gebruikt in
      `SiteHeader.tsx` (was "WINDOW" in het serif-merklettertype) en
      `SiteFooter.tsx` (was "WINDOW" in wit-serif) — beide vervingen ook
      hun eigen ad-hoc icoon+tekst-opmaak door dezelfde twee componenten.
      De losstaande `WindowMark`-icoonplekken die geen wordmark tonen
      (`GeneratingScreen`, `IdeaBookViewer`'s profielbadge, de deel-banner
      op `/shared/[id]`, de kleine "Stap X van Y"-badge in de wizard)
      kregen automatisch hetzelfde nieuwe icoon mee, zonder tekstwijziging
      — dat zijn decoratieve hergebruiken van het venstermotief, geen
      merklockups.
      **`WindowMark.tsx`**: van een inline `currentColor`-SVG naar een
      simpele `<img src="/logo/icon-128.png">` (met een
      `eslint-disable @next/next/no-img-element` — elke aanroepplek zet de
      grootte puur via Tailwind-hoogte/breedteklassen zonder gepositioneerde
      wrapper, wat `next/image`'s `fill`-modus overal zou vereisen).
      **Favicon/appicon**: `src/app/icon.png` (512×512, Next.js' eigen
      App Router-conventie, automatisch opgepikt in de `<head>`) en
      `src/app/apple-icon.png` (180×180, ondoorzichtig op het
      crème-token geflatterd — iOS rondt zelf af, transparantie zou een
      zwart vierkant achter het icoon opleveren). `src/app/favicon.ico`
      is ook echt vervangen (niet alleen aangevuld) — handmatig
      samengesteld als een "PNG-in-ICO"-bestand (16/32/48/256px, sinds
      IE9/Vista overal ondersteund) omdat sharp zelf geen ICO kan
      schrijven; geverifieerd door de bestandsstructuur (offsets/groottes
      per icoon-entry) na te rekenen en `/favicon.ico` in de draaiende
      dev-server rechtstreeks op te vragen.
      Getest: volledige homepage, footer en intake-wizard doorlopen in de
      browser — het icoon rendert scherp en zonder wit kader/schaduwvlek op
      zowel de crème header als de walnoot-donkere footer (expliciet
      gecontroleerd via een sharp-gecomponeerde vergelijking naast elkaar,
      nadat een eerdere versie daar wél een duidelijk zichtbaar wit blok
      liet zien — precies de sharp-bug hierboven); de drie
      `<link rel="icon">`-varianten (favicon.ico, icon.png, apple-icon.png)
      gecontroleerd via `document.querySelectorAll` in de browser, en
      `/favicon.ico` rechtstreeks opgevraagd om te bevestigen dat de
      draaiende server het nieuwe, grotere bestand serveert. `tsc
      --noEmit`/`eslint .`/`npm run build` schoon.

- [x] Stap 36 — Vier gerichte verbeteringen aan de test-/generatieflow en de
      Idea Book-PDF, op verzoek na een screenshot van de opgeschoonde
      idee-kaart-styling.
      **(1) Zandloper-pagina bij "Betaling overslaan"**: `getOrCreateWindowPlan`
      en `getOrCreateTestWindowPlan` (`src/app/plan/data.ts`) deden voorheen
      de hele trage Claude/PDF-pijplijn synchroon binnen één request — de
      testbypass liet daardoor tot nu toe een blanco tab zien tot de hele
      generatie (60-100+s) klaar was, in plaats van de al bestaande
      `GeneratingScreen` te tonen. De functies zijn gesplitst in
      `startPlanGeneration` (snel: legt een `pending`-rij vast) en
      `finishPlanGeneration` (traag: Claude, PDF-render, upload, e-mail) —
      het snelle deel wordt synchroon afgewacht, het trage deel draait in
      Next.js' `after()` (`src/app/plan/page.tsx` kreeg `export const
      maxDuration = 120` zodat dat achtergrondwerk genoeg tijd krijgt binnen
      dezelfde serverless-invocation; op een Vercel Hobby-plan blijft dit
      alsnog op 60s gekapt, ongeacht deze waarde). De functie gooit meteen
      na het starten `PlanNotReadyError` met reden `"generating"`, dus
      `/plan` toont vanaf de allereerste aanvraag al de zandloper-pagina in
      plaats van pas bij een gelijktijdige tweede aanvraag.
      **(2) Test-bevestigingsmail**: `getOrCreateTestWindowPlan` stuurt nu,
      uitsluitend in testmodus, de échte aankoopbevestigingsmail
      (`sendIdeaBookEmail`) naar een vast e-mailadres
      (`TEST_MODE_EMAIL_RECIPIENT`, niet een environment variable — een
      hardcoded developer-gemak voor dit ene project) met een duidelijk
      gelabeld placeholder-`order`-object (`orderNumber: "TEST"`), zodat
      precies te zien is wat een echte koper in zijn inbox krijgt zonder
      een echte betaling nodig te hebben.
      **(3) PDF-idee-/wildcardpagina's herbouwd naar de webkaart-stijl**: op
      verzoek bleek de bijgevoegde referentieafbeelding een screenshot van
      de bestaande `/plan`-webkaart (`IdeaDetail.tsx`) te zijn — losstaand
      geverifieerd via een keuzevraag vooraf. `src/lib/pdf/ideaBook.ts`'s
      idee- en wildcardpagina's (niet de cover/profiel/possibility-map-
      pagina's, die hun Stap 33 "quiet luxury"-fotostijl behouden) zijn
      volledig herbouwd naar een fotobanner boven + een lichte "paper"-body
      eronder, met dezelfde onderdelen als de webkaart: een tan
      "waarom dit bij jou past"-callout, genummerde bruine cirkel-stappen,
      lichte kosten-/vereisten-vakken naast elkaar, een locatieregel met
      kaartlink, en een donkere "begin hiermee"-actiebalk (goud-omrand en
      lichter getint voor de wildcard, conform de webkaart's eigen
      `isWildcard`-variant). Geen aparte eyebrow-regel meer boven de titel
      — exact als de webkaart toont de banner alleen "N. Titel" (of alleen
      de titel + een "wildcard"-pil voor de wildcard). Content wordt eerst
      "droog" gemeten (dezelfde dry-run-techniek als de rest van dit
      bestand) en vervolgens verticaal gecentreerd in de beschikbare
      bodyruimte in plaats van altijd bovenaan te beginnen — zonder dat zou
      een kort ingevuld idee (2 stappen, korte velden, per de bestaande
      schemalimieten) een grote, ongebalanceerde lege strook onderaan de
      pagina overhouden.
      **(4) Foto per idee matcht nu het echte onderwerp**: de oude
      `IDEA_HERO_PHOTOS`-pool (7 generieke Unsplash-foto's, puur op
      volgorde-index gecycled, zonder enige relatie tot de inhoud — de
      bron van het gemelde "mistig bos bij een kunstroute"-mismatch) is
      vervangen door een eigen, eenmalig gegenereerde gecategoriseerde
      fotobibliotheek (12 categorieën × 2 varianten = 24 foto's,
      `scripts/generate-idea-category-illustrations.ts`,
      `public/illustrations/idea-book/categories/`) — gekozen na een
      keuzevraag boven live per-idee AI-generatie, om de bestaande
      kosten-/snelheidsafweging (Stap 12/19/22) niet te doorbreken. Elk
      gegenereerd idee krijgt nu een eigen `photo_category`-veld
      (`src/lib/claude/ideaBookTypes.ts`/`generateIdeaBook.ts`) dat Claude
      zelf invult op basis van een expliciete, per-categorie omschreven
      lijst in de systeemprompt (bv. "art_culture: kijken naar kunst, niet
      zelf maken" vs. "creative_workshop: zelf iets maken") — een eerste
      testgeneratie liet zien dat de kale enum-namen zonder die
      omschrijvingen tot verkeerde categorieën leidden (een museumbezoek
      kreeg tweemaal de pottenbak-workshopfoto in plaats van een
      kunstgalerie-foto); na het toevoegen van de omschrijvingen bleven
      alleen nog overtuigende matches over. `ideaCategoryPhoto()`
      (`src/lib/illustrations.ts`) kiest per idee tussen de twee varianten
      van zijn categorie via een per-categorie-telling (niet de paginapositie
      in het boek), zodat twee ideeën met dezelfde categorie in hetzelfde
      boek niet toevallig dezelfde foto tonen. `IdeaDetail.tsx` (het gedeelde
      webcomponent van `/plan` en `/shared/[id]`) gebruikt dezelfde functie,
      dus de mismatch is op web én in de PDF tegelijk opgelost. De oude
      vaste `closing.jpg` (voorheen alle wildcard-pagina's) is verwijderd —
      de wildcard krijgt nu net als elk ander idee zijn eigen
      categoriefoto.
      Getest: de volledige testbypass-flow end-to-end doorlopen in de
      browser — de zandloper verscheen nu meteen (in plaats van een
      blanco tab), rouleerde door de bestaande statusregels, en de pagina
      ververste zichzelf automatisch naar de voltooide Possibility Map
      zodra de achtergrondgeneratie (~90s) klaar was. Twee volledige echte
      testgeneraties bekeken (een eerste met de kale enum-namen, die de
      categorie-mismatch bevestigde; een tweede na de promptverbetering,
      waarbij alle 7 foto's — 6 ideeën + wildcard — overtuigend bij hun
      onderwerp pasten, incl. een jazzavond-idee met een kunstgalerie-foto
      en een teken-workshop-wildcard met een penselenfoto). De gedownloade
      PDF (10 pagina's: cover, profiel, possibility map, 6 idee-pagina's,
      wildcard) pagina voor pagina gecontroleerd via de PyMuPDF-rasterizer —
      geen afkapping, correcte voorwaardelijke rendering (kosten-only vs.
      kosten+vereisten, met/zonder locatie), en zichtbaar gebalanceerde
      verticale centrering bij kortere content. `tsc --noEmit`/`eslint .`/
      `npm run build`/`npx vitest run` (25 tests) allemaal schoon. De
      test-bevestigingsmail zelf kon niet rechtstreeks geverifieerd worden
      (geen toegang tot de pootjm@hotmail.com-inbox vanuit deze sessie) —
      de verzendcode volgt exact hetzelfde, al eerder geverifieerde
      Resend-pad als de echte aankoopbevestigingsmail.

- [x] Stap 37 — Oneindige stille herpogingen na een harde generatiefout
      gefixt, gemeld via een screenshot waarin het Anthropic-account zonder
      credits kwam te zitten ("Your credit balance is too low..."). Niet de
      credits zelf (een account-/billingkwestie, buiten de code om) maar de
      manier waarop de app daarop reageerde was het probleem: een
      `failed`-rij in `window_plans` werd door `resolveExistingPlan`
      (`src/app/plan/data.ts`) behandeld als "veilig om opnieuw te
      genereren" — waardoor elke automatische `GeneratingScreen`-refresh
      (om de 5s) een gloednieuwe, gegarandeerd weer mislukkende generatie
      startte, voor onbepaalde tijd, zonder ooit een zichtbare foutmelding.
      `resolveExistingPlan` retourneert nu een expliciete `"failed"`-status
      i.p.v. die stil als `null` te behandelen; `getOrCreateWindowPlan`/
      `getOrCreateTestWindowPlan` gooien daarop een `PlanNotReadyError` met
      reden `"failed"` (nieuwe derde waarde naast `"unpaid"`/`"generating"`).
      `/plan` toont bij die reden nu een nieuwe `FailedState` (duidelijke
      foutmelding + een echte "Probeer opnieuw"-knop) i.p.v. stil te blijven
      doorproberen. Die knop post naar een nieuwe server action
      `retryPlanGeneration` (`src/app/plan/actions.ts`, werkt ook zonder
      client-JS) die alleen de rij verwijdert die op dat moment nog
      daadwerkelijk `"failed"` is (niet zomaar "de rij die deze pagina
      zag") en daarna terug redirect naar `/plan` — zodat een gelijktijdig
      wél geslaagde generatie nooit per ongeluk weggegooid kan worden.
      Nieuwe dictionary-teksten `plan.errorFailed`/`plan.retryButton`
      (nl/en) — bewust niet de al aanwezige, ongebruikte
      `errorPdfGenerationFailed`-tekst hergebruikt, want die belooft een
      automatische herpoging-en-melding die niet bestaat (vermoedelijk voor
      iets anders bedoeld in het andere, parallelle traject).
      Getest: rechtstreeks op de daadwerkelijk vastgelopen sessie uit de
      gemelde screenshot — eerst bevestigd dat `/plan` nu de duidelijke
      `FailedState` toont in plaats van oneindig te blijven verversen, dan
      op "Probeer opnieuw" geklikt. Op dat moment bleek het account alweer
      van credits voorzien (buiten deze sessie om), dus die herpoging
      leverde meteen een volledig, correct Idea Book op — een complete
      end-to-end bevestiging van de hele reparatie-cyclus (vastlopen →
      duidelijke fout → expliciete herpoging → succes). `tsc --noEmit`/
      `eslint .`/`npm run build`/`npx vitest run` (25 tests) allemaal
      schoon.

- [x] Stap 38 — Een echte race condition gevonden en gefixt terwijl een
      gemelde "mislukt"-screenshot werd onderzocht. De screenshot zelf
      bleek een verouderde, niet-ververste browsertab te zijn (bevestigd
      door de exacte pagina opnieuw te laden: toonde meteen het al
      geslaagde boek) — maar de rechtstreekse databasecontrole die daarbij
      hoorde (per de vaste projectgewoonte "bij een fout die blijft
      terugkomen, rechtstreeks tegen de database verifiëren", zie Stap 12)
      legde een echt, kostenverhogend probleem bloot: dezelfde
      test-sessie had **drie losse `"ready"`-rijen** in `window_plans` —
      drie volledige, betaalde-tier Claude+PDF-generaties voor wat één
      aankoop had moeten zijn.
      **Oorzaak**: `getOrCreateWindowPlan`/`getOrCreateTestWindowPlan`
      deden hun "bestaat er al een plan?"-check en de daaropvolgende
      "pending"-insert niet atomair — twee gelijktijdige `/plan`-aanvragen
      voor dezelfde sessie (twee open tabbladen, of een handmatige
      herlaad die net samenviel met `GeneratingScreen`'s eigen 5s-poll)
      konden allebei onafhankelijk "nog geen plan" concluderen en allebei
      hun eigen volledige generatie starten.
      **Oplossing**: nieuwe migratie
      `0012_prevent_concurrent_plan_generation.sql` (**nog handmatig uit
      te voeren in de Supabase SQL Editor**, zoals eerdere migraties) voegt
      een partial unique index toe op `window_plans(session_id)` waar
      `status in ('pending','ready')` — een tweede gelijktijdige insert
      voor dezelfde sessie faalt daardoor nu met een unique-violation
      i.p.v. stil te slagen. `src/app/plan/data.ts` vangt die specifieke
      fout (`ConcurrentGenerationError`, Postgres-foutcode `23505`) op in
      een nieuwe `resolveAfterConcurrentInsert()`-helper: de "verliezende"
      aanvraag stopt niet met een harde fout, maar herleest gewoon wat de
      andere aanvraag inmiddels heeft opgeleverd (een `ready`-rij wordt
      direct teruggegeven, anders de vertrouwde "nog bezig"-wachtstatus).
      **Ook opgeruimd**: `resolveAfterConcurrentInsert` behandelt een
      inmiddels-`"failed"`-rij van de andere aanvraag bewust niet als
      terminaal voor déze aanvraag (dat zou een verkeerde toeschrijving
      zijn) — gewoon als "nog bezig", zodat een volgende poll vanzelf de
      echte staat oppikt.
      Getest: de exacte sessie uit de melding rechtstreeks tegen de
      database gecontroleerd (drie `ready`-rijen bevestigd, met
      `created_at`/`generated_at` die de overlappende generaties duidelijk
      laten zien) en de betrokken browsertab opnieuw geladen (toont nu
      correct het geslaagde boek, geen "mislukt"-melding meer — bevestigt
      dat het gemelde probleem zelf een verouderde tab was, niet een
      lopende fout). `tsc --noEmit`/`eslint .`/`npm run build`/
      `npx vitest run` (25 tests) allemaal schoon. Nog te doen door de
      gebruiker: migratie 0012 handmatig uitvoeren in de Supabase
      SQL Editor — tot die tijd blijft de onderliggende race
      technisch mogelijk (de code-kant van de fix vangt 'm pas op zodra
      de database daadwerkelijk een unique-violation teruggeeft).

- [x] Stap 39 — Migratie 0012 daadwerkelijk uitgevoerd en de hele fix
      end-to-end geverifieerd, plus een tweede, verwant probleem gevonden
      en gefixt dat de eerste poging tot uitvoeren blokkeerde.
      **Eerste poging faalde, terecht**: `create unique index` gaf
      `ERROR: 23505: could not create unique index ... Key (session_id)=
      (...) is duplicated` — de tabel bevatte al dubbele actieve rijen (de
      race die de index juist moet voorkomen, had al meermaals
      toegeslagen vóór de fix). Rechtstreeks tegen de database opgezocht:
      9 sessies met dubbele `"ready"`-rijen (één sessie zelfs met 13
      losse volledige generaties), en al die rijen bleken `payment_id =
      null` te hebben — dus uitsluitend test-bypass-data, geen echte
      betaalde bestelling ooit geraakt. Migratie 0012 uitgebreid met een
      opschoonstap vooraf: per sessie de meest recente actieve rij
      behouden, de rest naar `"failed"` (nooit verwijderd, voor het
      audit-spoor).
      **Tweede, apart probleem gevonden tijdens die opschoning**: één
      verouderde `"pending"`-rij (van een gecrashte/afgebroken poging)
      stond nog steeds als `"pending"` geregistreerd — onder de nieuwe
      index zou zo'n rij voor altijd élke nieuwe poging voor die sessie
      blokkeren, want `resolveExistingPlan` behandelde een verouderde
      pending-rij weliswaar als "veilig om opnieuw te genereren", maar
      liet de rij zelf ongemoeid op status `"pending"` staan. Opgelost:
      `resolveExistingPlan` (`src/app/plan/data.ts`) is nu async en zet
      zo'n verouderde rij expliciet op `"failed"` zodra hij 'm als
      "stale" herkent, zodat die zijn plek in de partial unique index
      daadwerkelijk vrijgeeft. Dezelfde opruimlogica (rn > 1 OF een
      verouderde pending-rij) is ook in migratie 0012 zelf verwerkt, voor
      de al bestaande rij.
      **Live, functioneel geverifieerd — geen aanname**: rechtstreeks via
      de Supabase REST API (niet alleen "de migratie gaf geen foutmelding
      terug") een echte duplicate-insert-test gedraaid: een eerste
      `window_plans`-insert voor een verse testsessie lukte, een tweede
      insert met dezelfde `session_id` en status `"ready"`/`"pending"`
      faalde daadwerkelijk met `duplicate key value violates unique
      constraint "window_plans_session_active_unique"` — exact de fout
      die `ConcurrentGenerationError` in de code opvangt. Een derde
      insert met status `"failed"` voor diezelfde sessie lukte wél,
      wat bevestigt dat een mislukte rij terecht buiten de index valt
      (nodig voor `retryPlanGeneration`). Testrijen (zowel in
      `window_plans` als de bijbehorende `sessions`-rij) daarna weer
      verwijderd. Ná de opschoning: 107 → 77 actieve rijen, 0 sessies met
      duplicaten, 0 verouderde pending-rijen. `tsc --noEmit`/`eslint .`/
      `npm run build`/`npx vitest run` (25 tests) allemaal schoon.

- [x] Stap 40 — Een derde, subtielere variant van dezelfde racefamilie
      gevonden en gefixt, gemeld via een live foutmelding in de
      server-terminal: `duplicate key value violates unique constraint
      "window_plans_session_active_unique"` — ditmaal geworpen door
      `finishPlanGeneration`'s eigen "zet op ready"-update, niet door
      `startPlanGeneration`'s insert (Stap 38-39 dekten alleen die kant).
      **Oorzaak**: de 90s-`PENDING_TIMEOUT_MS` uit Stap 11 bleek te krap
      t.o.v. de echte, gemeten generatieduur (Claude + web-search-
      researchpas + PDF-render loopt regelmatig tegen de 90-120s aan).
      Verloopt een generatie net iets te lang, dan bestempelt een
      volgende `/plan`-aanvraag (een `GeneratingScreen`-poll of
      handmatige herlaad) de rij als "verouderd/mislukt" en start een
      nieuwe — maar de óórspronkelijke generatie loopt gewoon door, en
      probeert bij voltooiing alsnog zijn eigen rij op `"ready"` te
      zetten. Op dat moment bezet de nieuwe rij (nog `pending` of al
      `ready`) alweer de unique-index-plek voor die sessie, dus knalt de
      oorspronkelijke poging op exact dezelfde constraint als Stap 38-39
      — nu vanaf de andere kant van dezelfde race. Rechtstreeks tegen de
      database gecontroleerd: de gemelde sessie had hierdoor een
      cascade van twee mislukte pogingen vóór een derde het uiteindelijk
      wél redde (zelf-herstellend, maar met twee weggegooide, volledig
      betaalde-tier Claude-aanroepen).
      **Twee maatregelen, geen losse lapmiddelen**:
      (1) `PENDING_TIMEOUT_MS` (`src/app/plan/data.ts`) omhoog van 90s
      naar 150s — bewust ruim boven `plan/page.tsx`'s eigen
      `maxDuration = 120`: een rij die nog `"pending"` is ná 150s kán
      niet meer bij een echt nog lopende taak horen, want het platform
      zou die taak allang hebben afgekapt op de 120s-grens. Dat maakt
      "verouderd" weer een betrouwbare indicator voor "daadwerkelijk
      dood", in plaats van een slordige gok die een gewoon-trage-maar-
      levende generatie kan raken.
      (2) Als vangnet voor de resterende, principieel nooit volledig uit
      te sluiten rand van deze race: `finishPlanGeneration`'s eigen
      "zet op ready"-update herkent nu specifiek diezelfde
      unique-violation (`23505`) en gooit een nieuwe, onderscheiden
      `SupersededGenerationError` in plaats van de generieke foutmelding
      — deze rij niet nogmaals op `"failed"` overschrijven (een andere,
      recentere poging bezit die rij inmiddels al, mogelijk via zijn
      eigen schrijfactie) en geen alarmerende `console.error`, maar een
      rustige `console.log` ("superseded door een nieuwere poging"). Dit
      voorkomt niet alleen verwarrende logs maar ook een dubbele
      bevestigingsmail: de "verliezende" poging stuurt nu helemaal geen
      e-mail meer, de "winnende" poging (die de sessie daadwerkelijk
      succesvol afrondt) doet dat al.
      Getest: de exacte gemelde sessie rechtstreeks tegen de database
      gecontroleerd — bevestigd dat de derde poging alsnog `"ready"` was
      geworden (zelf-herstellend gedrag, dus geen acute gebruikersimpact,
      maar wel de bevestiging dat de race echt plaatsvond). Daarna een
      volledig verse testgeneratie gedraaid met de fix actief: ~100
      seconden, geen enkele collision-fout in de serverlogs, in één keer
      een compleet Idea Book. `tsc --noEmit`/`eslint .`/`npm run build`/
      `npx vitest run` (25 tests) allemaal schoon.

- [x] Stap 41 — Generatietijd en Claude-kosten inzichtelijk gemaakt en
      verlaagd, op verzoek ("de pdf generatie duurt veel te lang" + "niet
      teveel credits gebruiken").
      **Meten vóór aanpassen**: permanente timing-/usage-logging toegevoegd
      aan elke stap van de pijplijn (`WINDOW: ...`-regels in
      `src/lib/claude/generateIdeaBook.ts` en `src/app/plan/data.ts`:
      research-pas, hoofdgeneratie, PDF-render, storage-upload — elk met
      tijdsduur en, voor de Claude-aanroepen, de volledige
      `usage`-JSON van de API). Een echte testgeneratie gedraaid om
      werkelijke cijfers te hebben i.p.v. te schatten: 109s totaal, waarvan
      research-pas 45.2s (41%) en hoofdgeneratie 47.0s (43%) — samen 92.1s
      Claude-tijd — plus PDF-render 1.8s en storage-upload 15.2s. Kosten
      berekend met actuele Sonnet 5-prijzen ($2/$10 per MTok in/uit,
      $0,01 per websearch): research-pas $0,174 (74% van de Claude-kosten,
      grotendeels door 46.847 input-tokens — elke zoekopdracht binnen die
      pas herverwerkte de hele groeiende context tegen vol tarief, want er
      werd nergens `cache_control` gezet), hoofdgeneratie $0,061 — totaal
      ~$0,235 (~€0,22) per Idea Book, ~6-7% van de verkoopprijs van €3,50.
      **Drie maatregelen gekozen (via een keuzevraag) uit een geïdentificeerde
      lijst — het volledig laten vervallen van de research-pas (grootste
      hefboom, ~74% van de kosten) is bewust NIET gekozen, want dat zou de
      Stap 34-verbetering (échte, geverifieerde bedrijfsnamen) terugdraaien**:
      (1) **Prompt caching aan** op de research-pas: het systeemprompt-blok
      kreeg `cache_control: {type: "ephemeral"}` (system omgezet van platte
      string naar een array met dat blok) — web_search is een server-side
      tool, dus één aanroep kan intern meerdere zoek-rondes bevatten, en
      zonder cache-breakpoint werd bij elke ronde de hele groeiende context
      opnieuw tegen vol tarief verwerkt. (2) **Effort omlaag**:
      `output_config: {effort: "medium"}` toegevoegd (was impliciet "high",
      Sonnet 5's standaard) — zoeken-en-noteren heeft niet dezelfde
      redeneerdiepte nodig als creatief schrijfwerk. (3) **Max.
      zoekopdrachten omlaag**: `max_uses` van 8 naar 4 (de eerste meting
      gebruikte er zelf al maar 4) — zet een plafond op de kostbaarste
      variabele zonder het gangbare geval te raken.
      Getest: een tweede, verse testgeneratie gedraaid met alle drie de
      maatregelen actief en de resultaten rechtstreeks vergeleken met de
      eerste meting (niet aangenomen dat het zou helpen): research-pas
      45.2s → 25.2s (-44%), totale Claude-tijd 92.1s → 70.7s (-23%), totale
      wachttijd 109.1s → 79.7s (-27%), kosten €0,22 → €0,13 per Idea Book
      (-39%) — de cache-velden in de API-respons bevestigen dat caching
      daadwerkelijk actief is (`cache_creation_input_tokens`/
      `cache_read_input_tokens` niet langer 0). De gegenereerde inhoud
      bleef ongewijzigd van kwaliteit: nog steeds 6 concrete ideeën +
      wildcard met geverifieerde locaties. De timing-/kostenlogging is
      bewust blijven staan (niet weer verwijderd na het meten) zodat
      toekomstige generaties op dezelfde manier gevolgd kunnen worden.
      `tsc --noEmit`/`eslint .`/`npm run build`/`npx vitest run`
      (25 tests) allemaal schoon.

- [x] Stap 42 — De idee-/wildcardpagina's van de Idea Book-PDF herbouwd naar
      een extern aangeleverd designprofiel, "PossibilityPageA4" — een
      Claude Design System-artifact
      (https://claude.ai/artifact/RjoS7G6YeDZQJWRdn8RVyT) met een volledige
      tokens.json (kleuren/typografie/spacing/radius), CSS en
      referentievoorbeelden. Cover/profiel/possibility-map-pagina's zijn
      bewust ongemoeid gelaten — dat designsysteem is zelf expliciet
      geschaald op "één possibility-pagina", hetzelfde scopingpatroon als
      Stap 33/36 al hanteerden.
      **Drie bewuste afwijkingen van de spec, elk toegelicht in de code**:
      (1) **Lettertypen**: de spec noemt Lora + Inter; hergebruikt in
      plaats daarvan de al gebundelde Noto Serif/Sans (zelf-gehost,
      al geverifieerd voor Nederlandse accenten sinds Stap 8) i.p.v. twee
      nieuwe lettertypefamilies toe te voegen voor dezelfde
      serif-kop/sans-body-combinatie; gewicht 600 (body-strong) valt terug
      op Bold (700), gewicht 500 (caption) op Regular (400) — de twee
      gewichten die dit project niet heeft. (2) **Geen buitenste
      afgeronde kaart + rand**: de spec's eigen preview toont de hele
      pagina als een afgeronde kaart met een dunne rand (bedoeld voor de
      eigen browser-preview van het designsysteem) — weggelaten omdat dit
      een écht printbare A4-pagina is en elke andere pagina in dit boek al
      full-bleed is zonder kaart-op-achtergrond-effect. (3) **Geen
      "Concrete opties"-paneel**: dat vraagt een losse naam +
      beschrijvingszin die `IdeaBookEntry` niet meer heeft — Stap 36
      verwijderde het meervoudige `options`-veld juist om generatiekosten
      te besparen, en Stap 41 sneed daar nog verder in; het opnieuw
      toevoegen zou daartegen ingaan, en het tonen vanuit `location` zou
      gewoon de locatieregel eronder herhalen.
      **Eenheidsomrekening**: elke pixelwaarde in de spec is 96dpi, PDF-
      punten zijn 72dpi — dus elke maat in de implementatie is de
      spec-pixelwaarde × 0,75 (geverifieerd: de spec's eigen 794px
      paginabreedte × 0,75 = 595,5pt, nagenoeg exact de bestaande
      PAGE_WIDTH van 595,28pt — bevestigt dat de omrekenfactor klopt).
      **Iconen als vectoren, niet als tekstglyphs**: de pin (locatieregel)
      en spark (naast "BEGIN HIER") zijn met de hand als eenvoudige
      lijnvormen getekend i.p.v. Unicode-glyphs te gebruiken — dezelfde
      aanpak die dit project al eerder nodig had voor ✦/★ (Stap 23/33).
      Tijdens het testen bleek de spec's eigen "→"-pijl (na "bekijk op
      kaart") ditzelfde probleem te hebben — het gebundelde NotoSans-
      lettertype mist glyph U+2192, bevestigd met `fonttools`
      (`0x2192 in cmap` → `False`) i.p.v. alleen op een screenshot te
      vertrouwen. Opgelost met een kleine met de hand getekende
      pijlvorm (twee lijnen als punt, i.p.v. de pijl gewoon weg te laten
      zoals bij eerdere ontbrekende-glyph-bugs, omdat de klikaffordance
      hier de moeite waard is om te behouden).
      **Bewust weggevallen, expliciet gemeld**: het designprofiel kent
      geen "Vereisten"-sectie — `idea.requirements`-data (bv. "oude
      kleding meenemen") wordt hierdoor niet meer getoond op de nieuwe
      pagina's, in ruil voor pagina-getrouwheid aan het aangeleverde
      profiel i.p.v. het zelf uit te breiden met een sectie die de spec
      niet vraagt.
      Getest: eerst het voorbeeldscript (geen locatiedata) gerenderd en
      pagina voor pagina gecontroleerd via de PyMuPDF-rasterizer — hero,
      "waarom dit past"-paneel met accent-rand, genummerde stappen,
      kosten-chip, donkere CTA-paneel met spark-icoon, wildcard-badge
      — allemaal zichtbaar correct. Daarna een echte, betaalde
      testgeneratie via de bestaande test-bypass (Rotterdam-profiel,
      kunst+jazz) om de locatieregel met échte data te controleren — trof
      daarbij de ontbrekende-pijl-bug in de praktijk aan (niet in de mock-
      data zichtbaar, die had geen `location`) en loste 'm op. Een los,
      niet-gecommit testscript met mock-locatiedata (verwijderd na
      controle) bevestigde de fix zonder een tweede betaalde generatie
      nodig te hebben. Nog steeds exact 10 pagina's. `tsc --noEmit`/
      `eslint .`/`npm run build`/`npx vitest run` (25 tests) allemaal
      schoon.

- [x] Stap 43 — "Verleiding" Fase 1 (eerlijke landing): de drie verzonnen
      testimonials (Marieke V./Thomas K./Sofie D.) zijn van de landingspagina
      verwijderd, samen met de dictionary-keys `landing.testimonialsHeading`/
      `landing.testimonials` (type + nl + en). Vervangen door een eerlijk
      blok (`landing.honestHeading/honestBody/honestLinkLabel`, nl + en):
      "We zijn net begonnen, dus nog geen reviews. Liever zelf oordelen?
      Blader door een compleet Idea Book." met een knop naar
      `/examples/idea-book-${locale}.pdf`. Het sectie-anker `#voorbeelden`
      blijft bestaan. De navigatie-optie "Over ons" (`header.navAbout`,
      `/#over-ons`) is uit `SiteHeader` en de dictionary verwijderd — de
      brief noemde het anker niet-bestaand, maar `SiteFooter` heeft wél
      `id="over-ons"`; gekozen voor verwijderen omdat er geen echte
      over-ons-inhoud is om naartoe te verwijzen (het footer-`id` is
      ongemoeid gelaten). Getest: in de browser is de sectie zichtbaar, de
      link wijst naar de NL-PDF, de header-nav toont nog "Hoe het werkt" en
      "Voorbeelden", geen horizontale scroll, en geen verzonnen namen meer
      op de pagina. `tsc --noEmit`/`eslint .`/`npm run build`/`npx vitest
      run` (25 tests) schoon.

- [x] Stap 44 — "Verleiding" Fase 2 (onthulling op `/plan`): de twee-schermen-
      stepper (`IdeaBookViewer`, verwijderd) is vervangen door één scrollpagina
      `src/components/window/PlanReveal.tsx` (`main` van `max-w-2xl` naar
      `max-w-6xl`): (A) Download PDF + Deel-knop rechtsboven, (B) echo-kop
      "Je zei: ‘{situation}’ Hier zijn zeven ramen die open kunnen." met
      "Gemaakt op basis van"-chips (locatie, tijd, budget, gezelschap als
      dictionary-labels; lege situatie → "Zeven ramen, alleen voor jou.",
      >90 tekens → afgekapt op woordgrens met "…"; alleen op `/plan`, nooit op
      `/shared/[id]`), (C) "Als je er maar één kiest" (`pickOneThingIndex`) als
      grote kaart met foto, deurlabel, meta-chips, why-it-fits en donker
      eerste-stap-blok, (D) vier deuren (`#deuren`) met nieuw `DoorIcon`
      (raamkozijn waarvan het raam per deur verder openstaat, warmer licht),
      compacte kaarten met hartje (= bestaande "up"-feedback via
      `submitIdeaFeedback`, geen tweede systeem) en "Lees het idee" dat een
      native `<dialog>` (`IdeaDialog.tsx`) opent met de volledige `IdeaDetail`,
      `IdeaFeedback` (op/neer) en "Bekijk als PDF-pagina", (E) verzegelde
      wildcard (open-status in `sessionStorage` via `useSyncExternalStore`),
      (F) afsluitband. Bestaande `IdeaFeedback` kreeg een optionele `onChange`
      (hartje en dialoog blijven gelijk), `ShareButton` een optionele
      `className`. `getIntakeEchoForSession` in `plan/data.ts` + pure helpers
      in `src/lib/planEcho.ts`; toegang tot deze pagina blijft via
      checkout-/test-sessie, de echo leest uit de sessie van het plan zelf.
      **Backend**: migratie `0013_committed_idea.sql` (`committed_idea_key`,
      `committed_at`), server action `commitToIdea` (zelfde eigenaarschapscheck
      als `submitIdeaFeedback`; geeft een resultaat i.p.v. te gooien), en de
      cron `first-action-reminder` kiest nu via `pickReminderIdea`
      (`src/lib/reminderIdea.ts`) het gekozen idee (of wildcard), anders het
      eerste idee zoals voorheen. Gedeelde sleutelhelpers in
      `src/lib/ideaKeys.ts`. PostHog: `plan_viewed`, `one_thing_committed`,
      `idea_opened`, `idea_liked`, `wildcard_revealed`, `plan_pdf_downloaded`
      (bestaande events onveranderd).
      **Bewuste keuzes**: (1) wie het boek opent via de mail-link zonder
      sessiecookie kan alles lezen maar ziet de hartjes en "Dit ga ik doen"
      niet (`canInteract` = cookie ↔ `plan.session_id`; dezelfde beperking als
      bij feedback); (2) "Dit ga ik doen" staat ook in het ideevenster, zodat
      "Liever een andere deur" zin heeft; (3) de ontwerptekst "je volgende Idea
      Book leert daarvan" en "verdergaat waar dit ophield" zijn weggelaten —
      dat kan het product (nog) niet waarmaken; (4) een deur zonder idee toont
      "Deze deur blijft nu dicht."; (5) de cadeau-knop uit het ontwerp is
      op verzoek niet gebouwd.
      **Gevonden onderweg**: de productiedatabase miste migraties 0007
      (`recipient_email`, `first_action_reminder_sent_at`) en 0009
      (`feedback_json`) — de herinneringsmail kon daardoor nooit werken;
      `plan/data.ts` schrijft `recipient_email` bovendien zonder de fout te
      controleren, waardoor dat stil mislukte. Alles inmiddels uitgevoerd door
      Jan. Resend meldt daarnaast nog dat het verzenddomein niet geverifieerd
      is (mails komen dus niet aan) — open.
      Getest: bestaand boek (`?test_session_id=`) zonder cookie — echo, deuren,
      dialoog (Esc, focus terug), wildcard-onthulling, geen hartjes; daarna een
      vers testboek in deze browser (≈€0,13): hartjes en "Dit ga ik doen"
      staan direct in `feedback_json`/`committed_idea_key` in de database en
      blijven na verversen; hartje ↔ dialoog blijven gesynchroniseerd; tikdoelen
      44px; geen horizontale scroll. `/shared/[id]` ongewijzigd, zonder echo.
      Niet live gedraaid: de cron zelf (vereist `recipient_email` + betaalrij
      en 2 dagen wachten) — alleen de selectiefunctie is met vitest gedekt.
      `tsc --noEmit`/`eslint .`/`npm run build`/`npx vitest run` (46 tests)
      schoon.
