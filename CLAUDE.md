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
   vragen en een "Jouw venster"-paneel dat zich met de antwoorden vult (Stap 45; vervangt de foto's per pagina): situatie + doel +
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

- [x] Stap 45 — "Verleiding" Fase 3 (intake "jouw venster"): op expliciete
      bevestiging van Jan vervangt een donker walnootpaneel de losse foto's per
      wizardpagina (Stap 25/27). Nieuw `IntakeWindowPanel.tsx`: linkerkolom
      (desktop, `md:w-2/5`) "Jouw venster — Elk antwoord zet een ruit op zijn
      plek." met een raamkozijn van 2×4 ruiten (Wat speelt er, Waar, Op
      zaterdag, Verrassing, Tijd, Budget, Moeite, Stiekem willen); gevuld =
      lichte ruit met label + serifwaarde (fade-in bij wijziging), leeg =
      gestippelde gedimde ruit met "…"; onder het kozijn "{n} van 8 ruiten
      staan…". Het kozijn is `sticky` en heeft vaste ruithoogtes, zodat het
      niet uitrekt op de lange wizardpagina's. Op mobiel geen zijkolom maar een
      horizontaal scrollbare strip met de gevulde antwoorden boven de vragen
      (`IntakeAnswerStrip`). De stap-badge toont nu "Stap 3 van 5 · nog ± 2
      min" (vaste schatting per pagina, `minutesLeft`; laatste pagina "bijna
      klaar"). De afleiding van de ruitwaarden staat als pure functie in
      `src/lib/intakeWindow.ts` (met 8 vitest-tests): sliders hebben
      standaardwaarden, dus een slider-ruit telt pas als hij aangeraakt is
      óf afwijkt van zijn standaard (dat laatste dekt ook een herstelde draft,
      waar de `touchedSliders`-set weg is); "Wat speelt er" valt terug op de
      vervolgvraag van het doel zolang `situation` leeg is; vrije tekst wordt
      op woordgrens afgekapt. Er is niets aan `submitIntake`, validatie of
      draft-opslag veranderd. `image` is uit `PageConfig` verwijderd en de nu
      ongebruikte `INTAKE_LUXURY_PHOTOS` uit `illustrations.ts`; de
      beeldbestanden in `public/illustrations/outdoor/` en het
      generatiescript zijn bewust laten staan. Het paneel is `aria-hidden`
      (het herhaalt alleen wat het formulier al zegt). Nieuwe teksten in
      `intake.window` (type + nl + en).
      Getest: in de browser paneel leeg → gevuld bij typen, een slider
      aanraken op zijn standaard vult de ruit, een herstelde draft toont de
      juiste ruiten, teller en tijdbadge kloppen; op 375px geen zijkolom,
      chipstrip scrolt horizontaal en er is geen horizontale paginascroll.
      Opgemerkt maar niet aangepast (ouder dan deze stap): op 375px lopen de
      lange optielabels van de `PillSlider` op de dials-pagina door elkaar.
      `tsc --noEmit`/`eslint .`/`npm run build`/`npx vitest run` (54 tests)
      schoon.

- [x] Stap 46 — "Verleiding" Fase 4 (landing-hero): de twee losse knoppen zijn
      vervangen door een startformulier in de hero (`HeroStartForm.tsx`, een
      gewoon GET-formulier naar `/intake`, werkt ook zonder JS): label "Wat
      speelt er bij jou?", tekstveld (placeholder uit
      `intake.situation.placeholder`), primaire "Begin"-knop met pijl en drie
      voorbeeldchips (de eerste drie van `intake.situation.suggestions`, een
      chip vult alleen het veld). PostHog-event `landing_start_submitted` met
      alleen `has_text` (nooit de tekst). `IntakeWizard` leest `?situation=`
      eenmalig bij mount (max 500 tekens, getrimd) en past het alleen toe als
      er geen bestaande draft is. Eén eigen keuze: een draft die alleen
      "leeg" is (pagina 0, alle antwoorden standaard) telt niet als draft
      (`isBlankDraft`) — de wizard slaat namelijk al bij het openen een lege
      draft op, waardoor de tekst van de landingspagina anders bij een
      tweede bezoek verloren zou gaan; een draft met voortgang of antwoorden
      wint nog steeds. Badge nu "Nieuw · {price} · geen account nodig"
      (`landing.badge`), de H1 houdt drie regels met `headlineEmphasis`
      cursief in de accentkleur, nieuwe subcopy (nl + en). Rechts blijft
      `HeroFanCollage`, met eroverheen (vanaf `md`) een gekantelde kaart met
      een écht voorbeeldidee (`ExampleIdeaCard`, data in
      `src/lib/exampleIdea.ts`, letterlijk het eerste idee van het
      voorbeeld-Idea Book uit `scripts/generate-example-idea-book.ts`:
      "Pottenbakken zoals je stiekem wilde") en het bijschrift "Zo ziet één
      idee eruit — uit een voorbeeld-Idea Book." Let op: dat script hergebruikt
      de Nederlandse ideetekst ook voor de Engelse voorbeeld-PDF, dus de kaart
      toont in beide talen dezelfde Nederlandse tekst — hij spiegelt precies
      wat de PDF ernaast laat zien; alleen de labels (deur, "Eerste stap")
      zijn vertaald. "Hoe het werkt"-strip (`#hoe`) direct onder de hero: 3
      stappen (`landing.howSteps`, nl + en) plus het eerlijke voorbeeldblok uit
      Fase 1 (`id="voorbeelden"` behouden voor de footerlink); de aparte
      Fase 1-sectie en `landing.honestHeading` zijn daarmee vervallen. De
      bestaande "Wat je krijgt"-sectie blijft bewust staan (die beschrijft wat
      je krijgt, de strip hoe het werkt). `SiteHeader`/`SiteFooter` linken
      "Hoe het werkt" nu naar `/#hoe`; het header-label "Voorbeelden" is
      "Voorbeeld-Idea Book" ("Example Idea Book"). Vervallen keys:
      `landing.cta`, `secondaryCta`, `ctaCaption`, `honestHeading`. De
      cadeau-navigatie-optie is op verzoek niet gebouwd.
      Getest: desktop (1280) hero, kaart en strip; chip → veld → submit
      landt op `/intake?situation=…` met het veld én het venster-paneel
      gevuld; bestaande draft wint; lege draft + parameter wordt overschreven
      met de getrimde tekst; op 375px geen horizontale scroll, kaart
      verborgen, chips 44px hoog. `tsc --noEmit`/`eslint .`/`npm run
      build`/`npx vitest run` (54 tests) schoon. Fase 5 (teaser voor
      betaling) is bewust niet gebouwd (wacht op besluit over API-kosten voor
      niet-betalers en een PostHog-funnelcheck).

- [x] Stap 47 — De `PillSlider`-dials op de intake zijn op mobiel (en op
      desktop) leesbaar gemaakt: op 375px stonden de vijf lange optielabels van
      "Hou je het liever veilig, of mag het verrassen?" in vijf even smalle
      kolommen en liepen dwars door elkaar. `PillSlider` kiest nu de opmaak op
      basis van de optieset zelf (`pickLayout`), niet de viewport: maximaal 4
      opties met labels van ≤16 tekens blijven één rij (tijd, budget, zoekafstand);
      een lange reeks heel korte labels (leeftijdscategorieën) wordt een grid
      van 4 kolommen, en bij ≥448px containerbreedte 7 (Tailwind
      `@container`/`@md:`, omdat de formulierkolom op desktop smaller is dan de
      viewport door het "Jouw venster"-paneel); al het andere (praktisch↔wild,
      inzet) wordt een verticale lijst van volle-breedte-rijen met 44px
      tikdoelen. De begin-/eindlabels onder de balk verschijnen alleen nog bij
      de rij-opmaak (anders staat elke optie er al). Toetsenbord volgt nu het
      WAI-ARIA radiogroup-patroon: pijl omlaag/rechts = volgende, omhoog/links
      = vorige (voorheen was omhoog = volgende, wat in een verticale lijst
      verkeerd voelt). Getest in de browser op 375px en 1280px (aantal
      kolommen per dial, geen horizontale scroll, knoppen ≥44px hoog,
      pijltjestoetsen) en met een vitest-test voor de opmaakkeuze in nl en en
      (54 → 60 tests). `tsc --noEmit`/`eslint .`/`npm run build`/`npx vitest
      run` schoon.

- [x] Stap 48 — De Engelse voorbeeld-PDF is écht Engels: het
      voorbeeldscript hergebruikte de Nederlandse ideetekst voor
      `public/examples/idea-book-en.pdf`, waardoor de Engelse "Example Idea
      Book"-link (en de voorbeeldkaart in de landing-hero, Stap 46) Nederlandse
      tekst toonden. `scripts/generate-example-idea-book.ts` bevat nu een
      volledige vertaling (zes ideeën + wildcard: titels, intro's,
      why-it-fits, stappen, eerste acties, kosten/duur, vereisten); de
      profielsamenvatting, moet-haves en voorkeuren waren al Engels. De titel,
      why-it-fits en eerste actie van het eerste idee komen uit één bron,
      `src/lib/exampleIdea.ts` (`EXAMPLE_IDEAS` per taal), die zowel het script
      als de hero-kaart (`ExampleIdeaCard`, nu met een `idea`-prop) gebruikt —
      kaart en PDF kunnen daardoor niet meer uit elkaar lopen. Beide PDF's
      zijn opnieuw gegenereerd met `npx tsx scripts/generate-example-idea-book.ts`
      (de Nederlandse is inhoudelijk ongewijzigd). Getest: alle 10 pagina's van
      de Engelse PDF met PyMuPDF gelezen en de profiel-, idee- en
      wildcardpagina's bekeken (geen afkapping, Engelse chrome + inhoud);
      Engelse landingspagina toont de Engelse kaart, bijschrift en een link naar
      `/examples/idea-book-en.pdf`. `tsc --noEmit`/`eslint .`/`npm run
      build`/`npx vitest run` schoon.

- [x] Stap 49 — De idee- en wildcardpagina's van de Idea Book-PDF zijn
      herbouwd tot een compacte magazine-pagina, op expliciet verzoek (alleen de
      PDF; website, betaalflow, cover/profiel/kaartpagina en de
      generatieprompt zijn niet aangeraakt). Elke pagina heeft nu: een hero met
      deur-badge ("03 · ONTDEKKING", of "DE WILDCARD"), titel en subtitel (de
      bestaande `intro`); "Waarom dit bij jou past" (bestaande tekst plus
      maximaal één afgeleide zin over tijd/budget, alleen als het idee er
      aantoonbaar binnen past); een "in één oogopslag"-strook met lijn-iconen
      (tijd, niveau, gezelschap, plaats, type); een ervaringsprofiel (5
      dimensies, 1-5 bolletjes); "een mogelijke invulling" (3-4 relatieve
      stappen, geen kloktijden, dus geen schijn van een officiële planning);
      "wat je eraan overhoudt"; "maak het van jou" (aanvinkvakjes); praktische
      stappen 01-03 met daarnaast de kaarten "Jouw investering" (kosten +
      budgetstatus) en "Waar?" (naam, plaats, kaartlink); een klein
      redactioneel detail; en "Begin hier" met een groot, klikbaar webadres
      wanneer `first_action` er een bevat. Alles is gratis afgeleid uit
      bestaande data: `src/lib/pdf/ideaContent.ts` bevat de regels en de
      nl/en-contentbibliotheek (10 activiteitstypes op basis van
      `photo_category`; ervaringsscores uit baselines + `scores`/deur; budget-
      en tijdvergelijking met het profiel; vaste, deterministische keuze uit
      de bibliotheek op titel) — geen extra API-call, geen extra tokens, geen
      wijziging aan het Claude-schema. Ontbrekende data laat gewoon een blok
      weg (geen locatie → geen kaart; geen profiel → geen gezelschap/
      budgetstatus). Bewuste keuzes: het budget staat in de investeringskaart
      en niet óók in het raster (geen dubbele informatie); de derde stap komt
      uit `requirements` ("Nodig: …") — bestaande data, niets verzonnen;
      `renderIdeaBookPdf` kreeg een optioneel vierde argument
      (`IdeaBookPdfContext`: gezelschap, budget, tijd) dat `plan/data.ts` uit het
      profiel meegeeft; `PDF_VERSION` staat nu op 2. Paginavulling: alle
      blokken worden eerst gemeten; het rijkste van vier niveaus dat op één
      pagina past wordt getekend (achtereenvolgens vervalt het redactionele
      detail, daarna 2 i.p.v. 3 bullets, daarna hele rij overhouden/maak-het-
      van-jou), en de restruimte wordt verdeeld over de tussenruimtes en de
      hoogte van de hero; een te lange titel wordt eerst kleiner gezet
      (23→20→17,5pt) voor hij wordt afgekapt. De losse `pwa4Draw*`-helpers van
      de oude idee-pagina zijn verwijderd. Getest: mock-boek met korte/lange
      titels, met en zonder locatie/eisen/kosten/profiel, hoge kosten, een
      wildcard en een Engelse render — steeds exact 10 pagina's en elke idee-
      pagina op één pagina, zonder overloop; linkannotaties (kaart + webadres)
      gecontroleerd; beide voorbeeld-PDF's opnieuw gegenereerd. Nog niet
      gedaan: een echte, betaalde generatie met live Claude-output (kost ≈€0,13).
      `tsc --noEmit`/`eslint .`/`npm run build`/`npx vitest run` (77 tests)
      schoon.

- [x] Stap 50 — De nieuwe idee-pagina's (Stap 49) getest met een échte,
      betaalde generatie (test-bypass, Utrecht-profiel, ≈€0,13; `pdf_version`
      werd 2 in de database) en op basis daarvan drie echte problemen gevonden
      en gefixt die het mock-boek niet liet zien: (1) een lang webadres in het
      "Begin hier"-blok liep het paneel uit — het adres krimpt nu (15→10pt) en
      wordt anders met "…" afgekapt (de link zelf blijft volledig); tegelijk
      breekt `wrapText` nu een enkel woord dat breder is dan de regel af, zodat
      een lange URL midden in een zin nergens meer uit zijn vak loopt; (2)
      echte stappen zijn langer dan de mock-stappen en werden na 3 regels midden
      in een zin afgekapt — de stappenkolom is breder (44% i.p.v. 40%) en mag 4
      regels; (3) omdat vijf van de zes ideeën hetzelfde type hadden, kregen ze
      bijna dezelfde "wat je eraan overhoudt"- en "maak het van jou"-regels —
      `pickStable` kiest nu bij voorkeur regels die eerder in hetzelfde boek nog
      niet gebruikt zijn. Het boek is opnieuw gerenderd uit dezelfde opgeslagen
      data (dus zonder tweede betaalde generatie) en pagina 4-10 opnieuw
      bekeken: alles op één pagina, geen afkapping, klikbare kaart- en
      webadres-links aanwezig. Bekende beperking: de "mogelijke invulling"-regels
      zijn per type vast, dus ideeën van hetzelfde type delen die tekst.
      `tsc --noEmit`/`eslint .`/`npm run build`/`npx vitest run` schoon.

- [x] Stap 51 — Betaalflow (Stripe testmodus) en e-mail end-to-end getest.
      **Betaling**: een echte Stripe Checkout Session in testmodus (`sk_test_…`,
      `livemode: false`) — €3,50, betaald door Jan met de Stripe-testkaart (het
      kaartnummer is bewust niet door de assistent ingevuld). Bevestigd bij
      Stripe (`complete`/`paid`, klant-e-mail pootjm@hotmail.com, payment intent
      aanwezig) én in de database (`payments`-rij met ordernummer
      `WI-2026-000006` en het herroepingsafstand-tijdstempel vastgelegd bij het
      aanmaken van de sessie). De terugkeer naar `/plan` was mislukt omdat de
      lokale dev-server toen niet draaide; het openen van dezelfde
      succes-URL startte de generatie alsnog: plan `ready` met `pdf_version` 2,
      `payment_id` gekoppeld, `recipient_email` gezet, `email_sent_at` gezet en
      audit-log `email_delivered = true`. Lokaal blijft `payments.status`
      `pending` omdat er geen webhook draait (geen `STRIPE_WEBHOOK_SECRET`, geen
      Stripe-CLI) — op productie moet de webhook naar `/api/stripe/webhook`
      wijzen; de plan-generatie zelf controleert `payment_status === "paid"`
      rechtstreeks bij Stripe en heeft de webhook niet nodig.
      **Bug gevonden en gefixt**: `resend.emails.send()` gooit géén fout
      wanneer Resend een mail weigert (niet-geverifieerd domein, ongeldige
      sleutel, …) maar resolvet met `{ data: null, error }` — daardoor werd een
      geweigerde mail als "verzonden" geregistreerd (`email_sent_at`,
      audit-log). Nieuwe `sendEmail()` in `src/lib/resend.ts` gooit bij een
      fout, en beide verzendfuncties gebruiken die nu; met tests (mock van de
      SDK).
      **E-mail herbouwd**: de bevestigingsmail zat nog in het oude paarse
      palet, zonder duidelijke opbouw en met ongeëscapete AI-/gebruikerstekst in
      de HTML. Nu in het Warm Walnut-palet met gedeelde bouwstenen
      (`src/lib/email/layout.ts`: schil, knop, `escapeHtml`; tabel-layout met
      inline styles, tekst-wordmark i.p.v. een afbeelding zodat het ook zonder
      publiek bereikbare host werkt): kop "Je Idea Book staat klaar", samenvatting,
      grote knop "Bekijk je Idea Book online" met de opmerking dat de PDF
      bijgevoegd is, de zes ideeën + wildcard, "Je bestelling" (ordernummer,
      prijs, datum) en het juridische kleingedrukte. `buildIdeaBookEmail` is los
      van het verzenden testbaar; de herinneringsmail gebruikt dezelfde schil.
      Nieuwe teksten `email.readyHeading/attachmentNote/orderHeading` (nl + en).
      **Verstuurd naar pootjm@hotmail.com**: een testmail (ordernummer
      TEST-0001) en de echte orderbevestiging van WI-2026-000006, beide door
      Resend geaccepteerd; lokaal met afzender `onboarding@resend.dev` (Resend
      staat daarmee alleen versturen naar het adres van het eigen account toe;
      `EMAIL_FROM` in `.env.local` is daarvoor aangepast).
      **Open (buiten de code)**: (1) `windowinto.nl` moet in Resend geverifieerd
      worden en `EMAIL_FROM` op productie moet `WINDOW <hello@windowinto.nl>`
      worden — tot dan ontvangen klanten niets; (2) de mailfooter toont nog
      `[Bedrijfsnaam] · [KvK-nummer] · [Vestigingsadres] · [Btw-nummer]`
      (placeholder in `email.companyInfo`); (3) de PDF is ≈22 MB (volledige
      foto's ingebed) — als bijlage ≈29 MB na codering, boven de ≈20-25 MB die
      Outlook/Gmail accepteren, dus de mail kan bij klanten terugkomen; foto's
      verkleinen of een downloadlink i.p.v. bijlage is nodig.
      `tsc --noEmit`/`eslint .`/`npx vitest run` (86 tests) schoon.

- [x] Stap 52 — PDF-grootte opgelost: de Idea Book-PDF was ≈22 MB (de
      gegenereerde categoriefoto's zijn ≈2500px breed en 2-4 MB per stuk en
      werden ongewijzigd ingebed) — als mailbijlage ≈29 MB na base64-codering,
      boven wat Outlook/Gmail accepteren. Nieuw eenmalig, idempotent script
      `scripts/optimize-idea-book-images.ts` (sharp, mozjpeg q80) verkleint de
      26 beelden in `public/illustrations/idea-book/` in-place: categoriefoto's
      en achtergrond naar max. 1600px breed (≈190 dpi op een A4-paginabreed
      beeld), de cover op hoogte begrensd (1800px; een liggend beeld dat een
      staande pagina vult wordt door zijn hoogte beperkt, dus breedte-cap zou
      hem zacht maken — hij bleef 2400×1792). Totaal 72,6 MB → 4,4 MB. De
      originelen staan nog in git. Resultaat: het echte boek van de testbestelling
      opnieuw gerenderd = 2,35 MB (was 21,96 MB), beeldkwaliteit visueel
      gecontroleerd op cover en hero; de website profiteert mee (lichtere
      idee-foto's en Open Graph-cover ≈0,25 MB i.p.v. 2,4 MB). De voorbeeld-PDF's
      zijn opnieuw gegenereerd. Al eerder opgeslagen PDF's in de storagebucket
      blijven groot; alleen nieuwe generaties zijn klein.

- [x] Stap 53 — Discovery Engine, fase 0 (meten) en fase 1 (bibliotheek), na
      goedkeuring van het ontwerprapport ("Discovery Engine Ontwerp"). Nog geen
      wizard- of motorwijziging; die volgen in fase 2 en 3.
      **Fase 0, meten**: de wizard meldt nu `intake_started`,
      `intake_page_viewed`, `intake_page_completed` (met `duration_ms`),
      `intake_page_back`, `intake_submitted` (met `total_ms`) en
      `intake_submit_failed`, elk met `wizard_variant: "legacy"` zodat de
      kaartenwizard later ernaast vergeleken kan worden; landing meldt
      `landing_viewed`, de betaalpagina `checkout_viewed` en
      `checkout_pay_clicked`. Alleen ids, indexen en tijden, nooit
      antwoordtekst. In `npm run dev` worden alle events ook op
      `window.__windowEvents` gezet zodat meten te controleren is zonder
      PostHog-sleutel. Geverifieerd in de browser: hele wizard tot en met de
      betaalpagina doorlopen en de events gelezen. **Nog te doen door Jan**:
      `NEXT_PUBLIC_POSTHOG_KEY` invullen (lokaal én in Vercel) en de vier
      insights aanmaken, zie `docs/metrics-baseline.md`; zonder sleutel is er
      geen baseline en blijft acceptatiecriteria U1/U3 onmeetbaar.
      **Fase 1, bibliotheek** (`src/lib/discovery/`): 200 activiteiten in 10
      domeinen als gewone JSON (`data/<domein>.json`, `vocabulary.json`,
      `hybrids.json`), volledig NL en EN, met tags als bruggen (37, waarvan 7
      "stemming"-tags die nooit als brug tellen), sociale vormen, intensiteit,
      niveau, kosten, duur, binnen/buiten, veiligheidsklasse en instapvariant.
      Onbekend is `null` (4 kostenvelden). 15 activiteiten met toezichtsplicht
      hebben een verplichte, legale instapnotitie. Bewust uitbreidbaar (Jan
      verwacht de bibliotheek fors uit te breiden): ids voor domeinen/tags zijn
      strings gevalideerd tegen `vocabulary.json` (geen unions), een nieuw domein
      is één JSON-bestand plus één importregel (`library.test.ts` faalt bij een
      vergeten import), `status: retired` verbergt een activiteit zonder dat
      opgeslagen keuzes breken, en balanswaarschuwingen (domein onder 10 of boven
      15%) blokkeren niets. `validate.ts` handhaaft de regels (ids, tags,
      subdomein bij domein, tier-2-notitie, geen mensen in beeldomschrijvingen,
      minstens één echte brug per item) en vond meteen vier items die alleen
      stemmingstags hadden. `npm run taxonomy:check` / `taxonomy:report` /
      `taxonomy:images`; gids voor uitbreiden in `docs/discovery-taxonomy.md`.
      **Beelden**: `scripts/generate-discovery-illustrations.ts` maakt per
      activiteit en per domein een foto (Gemini, 4:3, 800px, JPEG), alleen wat
      ontbreekt (idempotent, `--only`, `--domain`, `--limit`, `--force`). Op
      verzoek van Jan meer contrast dan de bestaande stijl: elk domein heeft één
      verzadigde accentkleur (vermiljoen, framboos, groen, brons, saffraan, teal,
      violet, olijf, hemelsblauw, oudroze) die in het onderwerp zelf zit, op een
      warme walnoot/linnen basis, zonder mensen, gezichten of handen. Een eerste
      versie liet het accent te vaak als losse doek zien; de prompt is daarop
      aangescherpt (accent als deel van het onderwerp) en opnieuw getest voor de
      volledige run.
      **Beelden (compleet)**: alle 200 activiteitenfoto's en 10 domeinfoto's
      staan in `public/illustrations/discovery/` (4,7 MB voor de eerste 75, nu ca.
      12 MB in totaal) en zijn visueel gecontroleerd op mensen, verkeerde
      onderwerpen en samenhang. De eerste run liep na ~55 beelden vast op Gemini
      (429 uitgavenlimiet, daarna 402 negatief prepay-saldo; account-/billingzaak,
      opgelost doordat Jan €15 aan credits kocht). Twee correcties na review:
      het accent van Geschiedenis is van brons naar dieper oxbloedrood (#8E2A2A)
      gegaan omdat brons wegviel in de warme basis (Jan vroeg juist meer
      contrast), en de scenes van `genealogie` en `musea` mogen geen portretten
      meer tonen (kleine gezichten in ingelijste foto's kwamen door het
      "geen gezichten"-verbod heen). Bekende restanten: voorwerpen die van zichzelf
      tekst dragen (pubquiz-blad, mahjongstenen, een brief, een grafiek) tonen wat
      onleesbaar of gestileerd tekstachtig materiaal; dat is niet te voorkomen
      zonder die onderwerpen te schrappen. `npm run taxonomy:check -- --images`
      slaagt (0 ontbrekende foto's). Het script stopt bij de eerste 402/429 in plaats
      van tientallen aanvragen te blijven doen.
      **Goedkoper genereren (`--sheet 2x2|3x3`)**: op vraag van Jan een manier
      om de resterende beelden goedkoper te maken. Gemini rekent per beeld
      ($0,134 voor 1K én 2K), dus één 2K-beeld met een raster van 4 of 9 foto's kost
      evenveel als één foto. `sheetSlicer.ts` zoekt de witte goten (niet vaste
      coördinaten aannemen), knipt de tegels, snijdt ze op 4:3 en schaalt naar 800px;
      faalt het raster dan valt het script terug op losse foto's. Gedekt met 6
      vitest-tests op synthetische vellen (o.a. geen witte wand als goot aanzien,
      geen buitenmarge, licht-grijze goten, verkeerd aantal tegels). Bewust nog
      met een 2x2- en een 3x3-testvel op echte Gemini-uitvoer getest: beide
      sneden schoon, 3x3 is bij kaartgrootte nauwelijks zachter en dus gekozen.
      De rest (134 foto's) is met 14 vellen 3x3 + 2 vellen 2x2 gemaakt (het restant
      valt automatisch terug op een kleiner raster in plaats van losse foto's):
      16 aanvragen in plaats van 134, ongeveer €2 in plaats van €16.
      **Review**: een private reviewgalerij (artifact "Bibliotheek Review") met alle
      200 items, foto's, kenmerken en per item Aanpassen/Schrappen plus opmerking,
      met een knop die alles als tekst kopieert om terug te sturen.
      Getest: `vitest` (101 tests, waarvan 15 nieuw voor de bibliotheek en de
      validator zelf), `tsc --noEmit`, `eslint` schoon.

- [x] Stap 54 — Discovery Engine, fase 2: de visuele kaartenwizard achter een
      schakelaar. Vijf pagina's blijven; pagina 1-3 ongewijzigd. **Pagina 4**
      (`DiscoveryStep.tsx`) is nu eerst "Wat maakt je nieuwsgierig?" (10 werelden
      als fotokaarten met accentkleur, "Verras me", "Sla over") en dan "Wat
      spreekt je aan?" met 10 activiteitenkaarten per keer (8 uit de gekozen
      werelden, verspreid over subdomeinen en afwisselend per wereld, plus 2
      gestippelde "Misschien ook?"-kaarten uit niet-gekozen werelden), "Toon
      meer" (maximaal 4 rondes), een "i" per kaart met de instapvariant, een lijst
      met gekozen items die je met een klik weer weghaalt, "Zonder plaatjes"
      voor lage bandbreedte/screenreaders, en pijltjestoetsen door het raster.
      Kaartvolgorde komt uit een seed die met het concept wordt bewaard
      (`buildCardBatches`, deterministisch, getest), dus verversen of terugkeren
      toont dezelfde kaarten. Activiteiten met toezichtsplicht (tier 2) worden
      verborgen voor wie op de wildheidsschuif "voorspelbaar" koos. **Pagina 5**
      is "Hoe doe je dit het liefst?": sociale vorm (7 vormen + "maakt niet uit"
      + "hangt van de dag af", de laatste twee staan alleen), gezelschap, dan
      "Grenzen en wensen" (harde grenzen, voorkeuren, stiekem willen; verhuisd van
      de oude pagina 4) en "Ik sta ook open voor…" (de oude `solutionTypes`, nu
      optioneel en ingeklapt; leeg wordt `["activity"]`). "Jouw venster" toont
      "Wat trekt je" in plaats van "Op zaterdag".
      **Schakelaar**: `IntakeEntry.tsx` kiest per browsertab (sessionStorage,
      geen cookie): `?wizard=cards|legacy` forceert, anders een dobbelworp met
      `NEXT_PUBLIC_DISCOVERY_WIZARD_PERCENT` (standaard 0 = niemand ziet de nieuwe
      wizard). De klassieke wizard is ongewijzigd de terugval en het voorbeeld van
      `wizard_variant` in alle events.
      **Data**: `IntakeAnswers` kreeg optioneel `interests`, `interestDomains`,
      `socialFormats`, `surpriseMe` (oude sessies en concepten blijven geldig);
      `submitIntake` laat via `sanitizeDiscoveryAnswers` alleen echte ids door
      (de browser wordt niet vertrouwd omdat de ids in een prompt terechtkomen).
      De server stuurt alleen slanke kaartdata (één taal, `buildCardLibrary`), zodat
      de volledige bibliotheek niet in de browserbundel zit.
      **Generatie (klein, bewust)**: de gekozen interesses en de expliciete
      sociale voorkeur gaan als aparte regels in het profiel (`describeDiscoveryForPrompt`),
      met een regel dat minstens twee ideeën op de interesses moeten voortbouwen en
      dat sociale voorkeur uitsluitend uit het expliciete antwoord komt. De motor
      zelf komt in fase 3/4. **Besluit 6 doorgevoerd** (ook voor de klassieke
      wizard): sociale energie wordt niet meer uit gedrag afgeleid (vast 50) en
      staat niet meer in de prompt of in de "Jouw ontdekprofiel"-zinnen;
      nieuwsgierigheid meet breedte nu over de gekozen werelden.
      **Getest**: 129 tests (nieuw: kaartlogica, sanitizing/prompt, kaartenpaneel),
      `tsc`, lint, productiebuild; in de browser de hele kaartenwizard doorlopen op
      desktop en 375px (geen horizontale scroll, tikdoelen 44px, events, opslag in de
      database gecontroleerd) en één echte testgeneratie (≈€0,13): de gekozen
      escape room en "alleen komen, samen doen" zijn duidelijk terug te zien, maar
      een gekozen "lederwerk" haalde het boek niet (er was geen lokaal aanbod
      gevonden en het model verzon een uitleg): precies wat de selectiemotor van
      fase 3/4 moet afdwingen, zie het ontwerprapport.


- [x] Stap 55 — Discovery Engine, fase 3: de selectiemotor
      (`src/lib/discovery/engine/`, uitleg in `docs/discovery-engine.md`).
      Nog **niet aangesloten op de generatie** (dat is fase 4): fase 3 levert de
      motor, de regressietests en de evaluatie. De motor is deterministisch en
      maakt geen AI-aanroep. Uit de gekozen kaarten, de sociale keuze, de schuiven
      en de vrije-tekst-grenzen kiest hij zeven zaden: 2 vertrouwd (natural),
      1 onverwacht, 2 aangrenzend (discovery), 1 stretch en 1 wildcard, elk met een
      keten (`chain`/`via`) die uitlegt waarom, een gecureerde combinatie
      (`hybrid`) waar mogelijk, de sociale vorm om mee te openen en `verify`-vlaggen
      voor wat het onderzoek moet controleren. Onverwacht komt vóór aangrenzend zodat
      de partner van een gecureerde combinatie niet als gewone buur wordt opgesoupeerd.
      **Harde filters** alleen op een bekend conflict (onbekend laat door met vlag):
      budget, inspanning, toezichtsplicht bij "voorspelbaar", een expliciet gekozen
      sociale vorm (niet "maakt niet uit"), en uit de vrije tekst alleen wat
      betrouwbaar leesbaar is (één duidelijke wens buiten/binnen, "geen groepen",
      "gratis"; tegenstrijdig of onduidelijk wordt genegeerd); wat niet filterbaar is
      (rolstoel, hond, dieet, alcohol, kinderen) wordt als `verify` doorgegeven. Twee
      echte bugs door de tests gevonden en gefixt: samengestelde woorden ("Rolstoeltoegankelijk"
      is de eigen chip van de wizard, "hondvriendelijk" de placeholder) werden door
      `\b`-woordgrenzen gemist, en een gecureerde combinatie werd weggekaapt door de
      aangrenzend-stap. **Diversiteit**: max. 2 per wereld en niet twee uit één
      subdomein (liever een zwakkere verbinding dan een derde uit één wereld),
      thema's stapelen niet (bruggen met al gekozen ideeën kosten score),
      herhaling: wat in de laatste twee sessies getoond is komt niet terug, tenzij
      opnieuw gekozen (de geschiedenis zelf is fase 5). Bruggen wegen naar zeldzaamheid
      en stemmingstags tellen nooit mee.
      **Evaluatie** (`scripts/discovery-shadow.ts`, 200 synthetische profielen van
      zeven soorten, incl. tegenstrijdige): de harde criteria E1 (constraints), E3
      (herhaling over drie sessies), E4 (één wildcard), E5 (sociale keuze), E6
      (toezicht) hebben 0 schendingen, ook over 4 extra reeksen van 300 profielen.
      Zacht: zes ideeën 100%, ≥4 werelden 100%, ≤2 per wereld 98,5%, alle vier de
      richtingen 98%, niche krijgt 2 ideeën in de eigen wereld 100%, onverwacht is
      uitlegbaar 100%. Gemiddeld 5,8 werelden per boek, 186 van 200 activiteiten
      komen voor. Bekend: hubs (Creatief schrijven in 22% van de boeken, vooral bij
      sterk beperkte profielen) en een milde stretch bij sterk beperkte profielen
      (`direction_relaxed:stretch` bij ±20%). **Vergelijking met de huidige generatie**
      (`scripts/discovery-baseline.ts`, 93 bestaande testboeken, vooral van Jan zelf,
      dus indicatief): boeken met fotocategorie hebben gemiddeld 3,5 van 12
      categorieën, en dezelfde signaalwoorden keren steeds terug (speurtocht in 14
      van 93 boeken, keramiek 13, stilte/stille 13/13, heide 13); letterlijk dezelfde
      titel over verschillende boeken is zeldzaam (2%). Herhaling voor dezelfde
      bezoeker over sessies is niet te meten omdat de app geen bezoekeridentiteit
      heeft; de motor lost dat wel af zodra fase 5 de geschiedenis levert. Bewust niet
      gedaan: 200 boeken door Claude laten schrijven voor een blinde vergelijking
      (≈€26); die beoordeling hoort bij fase 4/6 met echte, geïntegreerde boeken.
      Getest: 152 tests (nieuw: 23 voor de motor, waaronder de E1-E8-regressie op twee
      reeksen van 200 profielen), `tsc`, lint.

- [x] Stap 56 — Discovery Engine, fase 4: de selectiemotor aan de generatie
      gekoppeld, na eerst te meten hoe de API-calls nu gebruikt worden en hoe
      groeperen ze goedkoper kan maken (uitgebreid in `docs/discovery-api-costs.md`).
      **Meting** (`scripts/measure-generation.ts`, echte calls): de klassieke
      pijplijn kost ≈$0,216 per boek (≈€0,19): researchpas met web search
      (Sonnet, ~36k tokens in de cache geschreven) ≈$0,16 (74%), hoofdgeneratie
      ≈$0,055; 80-110 s. De research was per boek (twee mensen in Utrecht die
      allebei pottenbakken willen betaalden allebei) en zat in de retry-lus.
      **Groeperen**: (1) alle seeds die nog geen antwoord hebben gaan in ÉÉN
      researchcall (`src/lib/claude/localResearch.ts`, JSON-antwoord per
      `activity_id`); (2) gedeelde cache per (activiteit × plaats × taal) in de
      nieuwe tabel `local_research_cache` (migratie `0014_local_research_cache.sql`,
      **nog handmatig uit te voeren in de Supabase SQL Editor**; zonder de tabel
      werkt alles, alleen zonder cache, met één waarschuwing in de log), 30 dagen
      voor gevonden opties, 7 voor "niets verifieerbaars"; (3) Haiku 4.5 voor de
      research (`WINDOW_RESEARCH_MODEL` overschrijft): ongeveer de helft van de
      prijs en 2× sneller, briefs van dezelfde soort. Bewust NIET gedaan: dynamic
      filtering (`web_search_20260209`) faalde met "tool use limit exceeded" en
      0 resultaten; één call per activiteit is niet goedkoper; de Batch API is
      alleen voor niet-live werk (evaluatieruns, cache vooraf vullen).
      Cache-simulatie (`scripts/simulate-research-cache.ts`): 5-9% treffers bij
      100-300 boeken, ±24% bij 1.000, ±43% bij 3.000 — bij lancering levert de
      cache dus nauwelijks iets op, de besparing komt dan van groeperen + Haiku.
      **Seed-pijplijn** (`src/lib/claude/generateFromSeeds.ts`): voor wie de
      interessestap gebruikte (`shouldUseEngine`: interesses, werelden of
      "verras me") kiest de motor de zeven seeds, wordt er in één call
      geresearcht en schrijft Claude alleen de tekstvelden per seed (dunner
      schema; deur, fotocategorie, scores en beeldscène komen van de motor:
      `engine/photo.ts`, `engine/scores.ts`). Resultaat krijgt `activity_id` en
      `chain` per idee. Achteraf controleert `checkEntry` een locatie tegen de
      research (onbekende locatie → weg) en meldt websites die nergens in de
      research staan. De klassieke pijplijn blijft voor iedereen zonder
      interessestap en als terugval als de seed-pijplijn faalt
      (`src/app/plan/data.ts`); in de klassieke pijplijn staat de research nu
      buiten de retry-lus (een mislukte poging betaalt niet opnieuw voor zoeken).
      **Motoraanpassing**: een kostenklasse is een bereik, dus "tot €25" liet
      pottenbakken (klasse 2) ten onrechte weg terwijl een proefles daar past;
      `"25"` staat nu op klasse 2, `"100"` op klasse 3, en zo'n activiteit gaat
      door met de vlag `cost_near_budget`, waarna de schrijver de goedkoopste
      instap noemt en zegt dat de prijs varieert. De evaluatie-oracle
      (`evaluate.ts`) is gelijk getrokken.
      **Eerste echte seed-boek** (kaartenwizard, Utrecht, kunst en klei; koude
      cache): research 15 s (Haiku, 5 zoekopdrachten, 7 seeds in één call),
      schrijven 35 s ($0,042), totaal ≈$0,14-0,15 tegen $0,216 (≈-30-35%) en
      ≈40% sneller; geen issues gemeld. Meetscript prijst nu per model.
      **Nog open**: één meting is een schatting, meer profielen meten; Haiku-
      kwaliteit alleen steekproefsgewijs bekeken, blinde vergelijking
      (≈$28 per 200 boeken, half via Batch) hoort bij fase 6; het percentage
      `unverified_website` over veel boeken; hub-bias van de motor.
      Getest: 176 tests (nieuw: 24 voor research/seed-pijplijn), `tsc`, lint.

- [x] Stap 57 — Discovery Engine, fase 5: optioneel herhalingsgeheugen en keuzes
      wijzigen vóór betaling (uitleg in `docs/discovery-engine.md`).
      **Herhalingsgeheugen (opt-in, besluit 3 uit het ontwerp)**: een schakelaar
      op de betaalpagina, standaard uit en los van de twee verplichte
      vinkjes. Aan = een willekeurige apparaatcode in een first-party cookie
      (`window_device_id`, httpOnly, 12 maanden); in de database staat alleen de
      SHA-256 ervan (`discovery_history`, migratie
      `0015_discovery_history.sql`, **nog handmatig uit te voeren in de
      Supabase SQL Editor**), nooit de code zelf en nooit een e-mailadres. De rij
      wordt bij het afrekenen gemaakt (`createCheckoutSession` kreeg een vierde
      parameter `rememberDevice`; de generatie draait later in `after()` zonder
      cookies), `finishPlanGeneration` leest wat de laatste twee boeken van het
      apparaat toonden (`loadShownBefore`) als `history` voor de motor en schrijft
      daarna de `activity_id`'s van het nieuwe boek (`recordShown`). Een betaald
      boek zonder ideeën telt niet als sessie; rijen ouder dan 12 maanden worden bij
      elke schrijfactie verwijderd (geen aparte cronjob). Uitzetten of
      "Vergeet dit apparaat" op de privacypagina (`forgetDevice`) verwijdert alle
      rijen van het apparaat en het cookie. Privacyverklaring (nl + en) kreeg een
      sectie "apparaatgeheugen" — **laat die tekst juridisch controleren**, zoals
      het ontwerp al vroeg. Alles is best effort: zonder tabel of bij een falende
      query wordt het boek gewoon zonder geheugen gemaakt (één waarschuwing in de
      log; live bevestigd). Alleen boeken uit de seed-pijplijn hebben
      `activity_id`'s, dus alleen die bouwen geheugen op. De testbypass
      ("Betaling overslaan") houdt een bestaande opt-in aan.
      **Keuzes wijzigen (besluit 7: alleen vóór betaling)**: de betaalpagina toont
      "Jouw keuzes" per wizardpagina (`src/lib/checkoutChoices.ts`), elk met een
      "Wijzig"-link naar `/intake?edit=1&page=N`; "Terug" opent ook de bewerkmodus in
      plaats van een lege wizard. De wizard start met de opgeslagen antwoorden en in
      de variant waarin ze gegeven zijn (legacy of kaarten); opnieuw versturen
      vervangt de antwoorden **in dezelfde sessie** (`replaceIntake` in
      `src/lib/intakeEdit.ts`): geen dubbele sessies. Wijzigen kan zolang er geen
      boek wordt gemaakt of klaar is en er geen betaalde bestelling is
      (`isSessionLocked`); anders start `submitIntake` een nieuwe sessie, zodat
      niemand invoer kwijtraakt, en toont `/intake?edit=1` een melding. Wijzigen ná
      betaling (één gratis herbouw) is bewust niet gebouwd: dat hangt samen met de
      prijsstrategie.
      **Getest**: 208 tests (nieuw: 32 voor hash/cookie/opslag/keuzesamenvatting/
      wijzigen, waaronder E3 met drie opeenvolgende boeken en echte geheugenlogica),
      `tsc`, lint, productiebuild. In de browser: hele flow met de kaartenwizard
      tot de betaalpagina met "Jouw keuzes", "Wijzig" opent pagina 4 met de
      opgeslagen keuzes en de melding, een gekozen activiteit weghalen en opnieuw
      versturen werkt de rij in de database bij (zelfde `session_id`, geen nieuwe
      rij), de privacypagina toont de knop alleen bij een cookie en wist dat.
      **Niet live getest**: opslaan en teruglezen van het geheugen tegen de
      database, omdat migratie 0015 nog niet is uitgevoerd (alleen met nagebootste
      Supabase-client getest). Zodra 0015 draait: twee testboeken achter elkaar met
      hetzelfde cookie en kijken of het tweede niets herhaalt.

- [x] Stap 58 — Intake opgeschoond en het "Jouw venster"-paneel beter gevuld voor
      de kaartenwizard, op verzoek van Jan.
      **Twee vragen uit de intake gehaald** (beide wizards): "En wat zou fijn zijn,
      maar is geen dealbreaker?" (`preferences`) en "Wat zou je stiekem wel vaker
      willen doen?" (`personalReflection`), omdat ze redundant zijn naast de
      harde grenzen en de gekozen interesses. Alleen de vragen zijn weg: de velden
      blijven bestaan in `IntakeAnswers` en `raw_json` (oude sessies, concepten en
      de generatieprompts blijven geldig en lezen dan "none stated"), en de lijst
      "voorkeuren" in het boek blijft leeg tenzij een oud antwoord er nog is. De
      introtekst op die pagina (`opennessIntro`, nl + en) sprak nog over "twee
      soorten wensen" en zegt nu dat het alleen om harde grenzen gaat; de sectiekop
      in de kaartenwizard heet "Harde grenzen" (was "Grenzen en wensen").
      **Paneel**: het paneel had voor de kaartenwizard lege of magere ruiten
      (o.a. "Stiekem willen", dat nu niet meer bestaat; "Wat trekt je" bleef leeg
      zolang alleen werelden gekozen waren en liet maar twee keuzes zien). Nu
      toont de kaartenwizard 7 ruiten op 8 cellen: "Wat trekt je" is een brede
      ruit (twee kolommen) met zoveel keuzes als er passen plus "+n", en toont de
      gekozen werelden zolang er nog geen activiteiten gekozen zijn; "Hoe & met
      wie" combineert de sociale vorm en het gezelschap van de laatste pagina;
      "Tijd & budget" combineert die twee schuiven. De klassieke wizard behoudt 8
      ruiten en krijgt "Met wie" in plaats van "Stiekem willen". Ruiten zijn iets
      hoger (108px) met 16px tekst zodat er drie regels in passen. Getest: 211
      tests (nieuw: paneellogica voor beide wizards), `tsc`, lint; in de browser de
      kaartenwizard met werelden alleen en met alle antwoorden bekeken (geen
      afkapping in de brede ruit).

- [x] Stap 59 — "Jouw venster" duidelijker en gekleurd, op verzoek van Jan
      ("heel veel keuzes leiden niet tot een wijziging in de zijruit"). Oorzaak:
      leeftijd, afstand, doel en de zaterdagvraag hadden geen ruit, en in de
      kaartenwizard waren losse antwoorden samengevoegd of weggevallen. Nu heeft
      **elk antwoord een eigen ruit** (kaartenwizard 14 ruiten: wat speelt er,
      doel, leeftijd, waar, afstand, op zaterdag, verrassing, moeite, tijd,
      budget, wat trekt je, hoe, met wie, harde grenzen; de klassieke wizard
      heeft "sta open voor" i.p.v. de kaartkeuzes), twee per rij of één brede
      ruit voor langere antwoorden. Leeftijd en afstand tellen mee als
      schuif-antwoord zodra ze zijn aangeraakt of afwijken van hun standaard.
      **Kleur**: elke wizardpagina heeft een eigen tint (zand, salie, terracotta,
      hemelblauw, pruim; nieuwe `--color-pane-*`-tokens in `globals.css`): een
      beantwoorde ruit heeft die tint met een gekleurde balk links, een lege ruit
      een gestippelde rand en label in de sterkere tint. **Duidelijker**: de
      ruiten van de openstaande pagina hebben een gekleurde omlijning, zodat te
      zien is waar een antwoord landt; de mobiele antwoordstrip krijgt dezelfde
      kleuren. Ruiten zijn 72px hoog met 14/15px tekst (twee regels).
      Getest: 214 tests (o.a. dat elk wizardantwoord een gevulde ruit oplevert),
      `tsc`, lint, productiebuild; in de browser de kaartenwizard op pagina 2 en
      pagina 5 bekeken. Bekend: de lange verrassingstekst ("Verras me volledig,
      neem me mee naar iets wilds") wordt in een smalle ruit op twee regels
      afgekapt.

- [x] Stap 60 — "Het venster" fase 0: eerlijk wachten
      (`WindowInto/WINDOW_Bouwopdracht_Venster_Fase0-8.md`). Het wachtscherm toont nu de
      echte stap van de generatie in plaats van roterende berichten: nieuwe kolom
      `window_plans.progress_stage` (`selected` → `researched` → `written` → `rendered`,
      migratie `0016_progress_stage.sql`, **nog handmatig uit te
      voeren in de Supabase SQL Editor**; zonder de kolom blijft alles werken, het scherm
      blijft dan op de eerste stap staan). `data.ts` schrijft de stap best effort
      (`setProgressStage`), de seed-pijplijn meldt `selected`/`researched` via een nieuwe
      `onProgress`-callback, `PlanNotReadyError` draagt de stap mee naar
      `GeneratingScreen` (vijf fases, `src/lib/progressStage.ts`). Copy: "1 à 2 minuten"
      in plaats van "minder dan een minuut" (wachtscherm en checkout-stappen, nl + en).
      De comment bij `maxDuration` in `plan/page.tsx` is bijgewerkt: met Fluid compute is
      het plafond 300 s, ook op Hobby. `maxDuration` (120) en `PENDING_TIMEOUT_MS` (150 s)
      bewust ongewijzigd; Jan controleert of Fluid compute aan staat.
      Getest: 217 tests (nieuw: fasemapping, geen minuutbelofte meer), `tsc`, lint.

- [x] Stap 61 — "Het venster" fase 1: de beelden als data, de vertaallaag en leeftijd in de
      selectie. **Vraag-audit** (`WindowInto/WINDOW_Vraag-audit_Fase1-1.md`, door Jan bevestigd
      met één wijziging: leeftijd blijft en moet ook de keuze sturen). **Data**: 27
      associatiekaarten in `src/lib/discovery/associations.json` (plekken, momenten, zintuigen,
      9 per ronde; `tagWeights`, assen `social/energy/setting/novelty`, Engelse scène zonder
      mensen of handen, `status: concept`, `image` wijst voorlopig naar een bestaande foto tot
      fase 2), gecontroleerd door `validateAssociations` (ook in `taxonomy:check`).
      **Vertaallaag**: `associationProfile.ts` (zuiver, ook in de browser: tagprofiel, assen,
      afgeleide schuiven, reflectiezin) en `associations.ts` (server: `associationsToEngineInput`,
      `imagesBehind`, promptregels). `applyImageIntake` (`imageIntake.ts`) draait in
      `submitIntake` voor `intakeVariant: "associations"`: interesses, `practicalToWild` en
      `effort` uit de beelden, niet-gevraagde velden leeg, correcties als voorkeuren, voornaam van
      de ontvanger bij een cadeau. Nieuwe optionele velden in `IntakeAnswers`: `intakeVariant`,
      `associations`, `associationCorrections`, `recipientName`. **Prompt**: lege velden heten nu
      "not stated" (geen verzonnen leeftijd meer), de gekozen beelden gaan mee met de instructie
      ze hooguit één keer per idee te noemen, per idee een regel "Image behind it", en bij een
      cadeau wordt het boek aan de ontvanger geschreven. **Leeftijd** (fase 1.5): zachte weging
      `agePenalty` in `select.ts` (nooit uitsluiten). **Chip-parser**: "geen vis/schaaldieren"
      telt nu als dieetwens. Shadow-run (500 beeldprofielen): E1-E6 0, 5,8 werelden per boek
      (kaartenwizard 5,8); tier-2-activiteiten bij 65+ 0,9% tegen 6,5% zonder leeftijd.
      Getest: 242 tests (nieuw: 25), `tsc`, lint.

- [x] Stap 62 — "Het venster" fase 2 (alleen de code): `scripts/generate-discovery-illustrations.ts`
      kreeg `--associations` (eigen beeldregie: een sfeer, plek, textuur of lichtval, geen
      hobby-opstelling, felle kleur die het onderwerp volgt, geen mensen of lichaamsdelen; 1000px
      breed, naar `public/illustrations/associations/<id>.jpg`; daarna wijst
      `associations.json` vanzelf naar het nieuwe beeld) en `--dry-run` (geen API-call, toont wat
      gemaakt wordt en de kosten). **Nog niet gedraaid**: kost geld en wacht op Jans akkoord.
      Kosten volgens de dry-run: `--sheet 3x3` 3 beelden ≈ $0,40; `--sheet 2x2` 9 beelden ≈ $1,21
      (27 is geen viervoud: 6 vellen + 3 losse; de bouwopdracht noemde $0,94). Tot dan tonen de
      rondes bestaande foto's als stand-in.

- [x] Stap 63 — "Het venster" fase 3 en 4: de beeld-intake en het venster.
      **Wizard** `AssociationWizard.tsx` als derde variant (`?wizard=associations`, of
      `NEXT_PUBLIC_ASSOCIATION_WIZARD_PERCENT`, standaard 0; `legacy` en `cards` ongewijzigd).
      Acht schermen in drie hoofdstukken: werelden (+ "Verras me"), plekken, momenten,
      zintuigen (optioneel), "Je venster krijgt vorm" (reflectiezin uit het tagprofiel, "Niet
      helemaal" voegt tot drie tags toe), "Waar en hoeveel ruimte?" (plaats met de bestaande
      PDOK-suggesties, reisafstand, tijd, budget), "Met wie?" (gezelschap → hoe, leeftijd,
      harde grenzen als chips + vrij veld) en één optionele vraag ("Wat zou je stiekem vaker
      willen doen?"). Swipe-modus op de telefoon (aanwijzer-gebaren, knoppen in de onderbalk).
      Cadeau: `/intake?for=gift` (de landingsknop), zelfde flow met andere woorden en een
      optionele voornaam. Copy in `src/lib/i18n/venster.ts` (`dict.venster`, nl + en). Concept in
      sessionStorage, wijzigen via `/intake?edit=1&page=N` (pagina's in `vensterPages.ts`).
      Events: `association_round_completed`, `association_swipe`, `association_reflection`
      plus de bestaande intake-events met `wizard_variant: "associations"`.
      **Venster** `WindowFrame.tsx`: boogkozijn met vier ruiten (werelden, plekken, momenten,
      zintuigen) die zich vullen met de gekozen foto's (collage met roedes), "Verras me" als
      gouden ruit, tekstantwoorden als vensterbank (`vensterPanes.ts`). In de intake (sticky
      paneel op computer, icoon + overlay op telefoon, groot op het reflectiescherm), op de
      betaalpagina en op het wachtscherm (ruiten openen één voor één).
      Getest: 255 tests (nieuw: ruiten, vensterbank, chips-parser in nl en en, paginalinks,
      gelijke copy-sleutels nl/en), `tsc`, lint; in de browser de hele intake op 390 en 1280 px
      (ook cadeau) doorgelopen met screenshots.

- [x] Stap 64 — "Het venster" fase 5: betaalpagina, prijs en onthulling. **Betaalpagina** voor
      de beeld-intake: links het venster als de bestelling (ruit = link naar die stap), titel,
      prijs, drie regels "wat je krijgt", wijziglinks; rechts `CheckoutPanel` ongewijzigd
      (juridische teksten letterlijk). **Prijs** configureerbaar via
      `NEXT_PUBLIC_WINDOW_PRICE_CENTS` (standaard 350; 600 voor de testversie), dezelfde waarde
      voor tekst, Stripe en de bestelrij. **Onthulling** (`PlanReveal`): echo "Je koos een stille
      bosrand, handen vol klei en houtgeur." met de beelden als miniaturen (+ "Je schreef …"),
      bij het uitgelichte idee de strook "Omdat je X koos" (`vensterReveal.ts`, via
      `imagesBehind`) en een kaartlink bij een echte plek. **Foto per idee**: boeken uit de motor
      tonen de eigen foto van de activiteit (`ideaPhoto`, alle 200 aanwezig) in plaats van de
      categoriefoto, op `/plan`, in de detailweergave en in de PDF; oude boeken houden de
      categoriefoto. Getest: 259 tests, `tsc`, lint.

- [x] Stap 65 — "Het venster" fase 6: de PDF in de merklijn. De PDF gebruikt nu dezelfde
      lettertypen als de site (Newsreader + Plus Jakarta Sans, SIL OFL, in
      `src/lib/pdf/fonts/`; de oude Noto-bestanden staan er nog maar worden niet meer gebruikt)
      en goud (#B08A4A) als accent. Elke tekst gaat eerst door `glyphFilter`: tekens die de
      lettertypen missen worden vervangen (→ wordt ->, ✓ wordt v) of weggelaten, zodat er nooit
      meer lege vakjes verschijnen. **Omslag voor de beeld-intake**: walnoot met het eigen venster
      van de koper (vier ruiten met de gekozen beelden, boogvorm, gouden rand), de vensterbank
      ("Laren · Een halve dag · Tot €100 · met een partner"), datum en de titel "Een venster
      voor jou" (cadeau: "Een venster voor {naam}"). Boeken uit de andere wizards houden de
      fotomslag. Idee-pagina's tonen de eigen activiteitsfoto (`ideaPhoto`). `PDF_VERSION` = 3.
      `scripts/render-sample-pdfs.ts` maakt drie voorbeeldboeken zonder API-call (beeld-intake,
      kaarten, klassiek): 2,4 / 1,0 / 2,1 MB, elk 10 pagina's, visueel gecontroleerd.
      Niet gebouwd uit de bouwopdracht: een miniatuur van het bronbeeld per idee-pagina en de
      nieuwe pagina's "één ding", klikbare kaart en slotpagina; de bestaande, gedetailleerde
      boekopbouw is bewust behouden. Getest: 258 tests (nieuw: tekenfilter), `tsc`, lint.

- [x] Stap 66 — "Het venster" fase 7: landing. Nieuwe hero `VensterHero.tsx`: de foto
      `landing-hero.jpg` in hetzelfde walnoten boogkozijn als het venster, H1 "Ontdek wat er
      mogelijk is *voor jou.*", badge "Nieuw · {prijs} · geen account" en twee knoppen: "Open je
      venster" (`/intake?wizard=associations`) en "Geef een venster cadeau" (`…&for=gift`). De
      stappenstrip toont de drie hoofdstukken van de beeld-intake; het eerlijke voorbeeldblok blijft.
      Alleen zichtbaar als `NEXT_PUBLIC_ASSOCIATION_WIZARD_PERCENT` 100 is (de testpreview) of met
      `?venster=1` (`src/lib/vensterLanding.ts`); daaronder blijft de klassieke landing, omdat een
      bezoeker die de klassieke wizard trekt anders in een andere flow belandt dan de pagina belooft.
      Eindcontrole: landing op 390/768/1280 (geen horizontale scroll) en de hele beeld-intake op
      390, 768 en 1280 px, zelf en cadeau, zonder consolefouten. Niet in de cloud te testen: versturen
      naar checkout en verder (vraagt echte Supabase/Stripe-sleutels).

- [x] Stap 67 — "Het venster" fase 8: testversie. Met `NEXT_PUBLIC_TEST_FEEDBACK=1` (alleen op de
      Vercel-preview) toont de testbalk op de betaalpagina "Testversie · betaal met testkaart 4242 …"
      en staat onder het boek een korte vragenlijst (`TestFeedback.tsx`: gevoel 1–5, "Zou je {prijs}
      betalen?", vrij veld). Score en betaalantwoord gaan als PostHog-event `test_feedback_submitted`
      (zonder vrije tekst); alles samen in de nieuwe tabel `test_feedback` (migratie
      `0017_test_feedback.sql`, **nog handmatig uit te voeren**; RLS aan zonder policies, alleen de
      server-action `submitTestFeedback` schrijft, met de service role, en weigert als de vlag uit
      staat). Stappenplan voor Jan in `docs/test-preview.md` (branch, migraties 0014–0017, Preview-
      variabelen, Stripe-testwebhook, Deployment Protection, Fluid compute, ≈$1,50 per 10 tests).
      Gevonden, niet aangepast: de knop "Betaling overslaan" werkt ook op Production (geeft een gratis
      boek); moet achter een vlag vóór de echte lancering. Getest: 263 tests, `tsc`, lint; het
      formulier bekeken op 390 px (geen horizontale scroll, keuzes zichtbaar geselecteerd).

- [x] Stap 68 — De beeld-intake ("Het venster") en de nieuwe landing staan nu standaard
      voor iedereen aan, op verzoek van Jan (die op windowinto.nl nog de oude landing zag
      omdat `NEXT_PUBLIC_ASSOCIATION_WIZARD_PERCENT` niet in Vercel bestond en de standaard
      0 was). Eén gedeelde helper in `src/lib/vensterLanding.ts`
      (`associationWizardPercent`, `DEFAULT_ASSOCIATION_WIZARD_PERCENT = 100`) wordt zowel door
      de landing (`showVensterLanding`) als door `IntakeEntry` gebruikt, zodat beide altijd
      samen aan of uit staan. Uitzetten: de variabele op `0` zetten (of een lagere waarde voor
      een geleidelijke uitrol; de landing blijft dan klassiek, `?venster=1` en
      `?wizard=associations` forceren nog steeds). De opslagsleutel van de gekozen variant is
      `v3`, zodat tabbladen met een eerder getrokken "cards"/"legacy" ook de nieuwe intake
      krijgen. Getest: 264 tests (landing en percentage), `tsc`, lint; lokaal toont `/` de
      nieuwe hero en een tabblad met een oude `v2`-keuze krijgt de beeld-intake.

- [x] Stap 69 — PDF: de lijnen over de foto's bovenaan de pagina's weggehaald. Oorzaak: de
      donkere overgang onder de foto was opgebouwd uit 8 (ideepagina's) of 40 (cover) gestapelde,
      halfdoorzichtige rechthoeken die elkaar 1 punt overlapten; die dubbel getekende punt gaf een
      donkere lijn op elke rand (bij 200 dpi zichtbaar op de ideepagina's; op de cover is de
      oorzaak dezelfde maar niet apart gemeten). Nu één afbeelding van 1×256 pixels met een
      alfaverloop (`src/lib/pdf/scrim.ts`, zelf geschreven PNG-encoder, ca. 1 KB, met
      interpolatievlag), op de ideepagina's met 78% en op de cover met 82% dekking. De harde
      grijze rechthoek achter het logo op de fotocover is dezelfde afbeelding, omgekeerd.
      Bestandsgrootte ongewijzigd (2,4 MB), foto's onaangeroerd. Getest: 268 tests (nieuw:
      `scrim.test.ts`), `tsc`, lint; voorbeeldboeken opnieuw gerenderd en de bovenkant bij 200 dpi
      bekeken. Daarnaast een voorstel gepubliceerd (artifact "Venster Beleving") over immersie,
      variatie, landing-richtingen en het algoritme; nog niets daarvan gebouwd.

- [x] Stap 70 — "Venster Beleving" P0: variatie in de beelden. Elke van de 27 associatiekaarten is nu
      een **familie** met drie varianten (de kaart zelf, `-b`, `-c`: zelfde ronde, tagwichten en
      assen, ander beeld en andere beschrijving), samen 81 kaarten. Een bezoeker ziet per ronde
      negen kaarten, precies één variant per familie, dus wat we uit een keuze lezen hangt nooit af
      van welke variant getoond werd. `associationSampling.ts` kiest de varianten per seed
      (deterministisch; verversen toont dezelfde kaarten), liefst varianten die deze browser nog niet
      zag (`associationSeen.ts`, localStorage, max. 150), anders de langst geleden geziene. Gekozen
      kaarten blijven staan. De volgorde hangt alleen van seed en ronde af, en elke familie beslist
      een gelijkspel met een eigen generator, zodat een keuze geen andere kaart laat verspringen
      (bij de browsercontrole bleek dat eerst wel te gebeuren; nu met een test vastgelegd). De
      "gezien"-lijst wordt bij het begin van de sessie in de draft vastgezet, anders gaf een
      verversing andere kaarten. De validator (`validate.ts`) eist 9 families per ronde, minstens 3
      varianten en gelijke ronde/tagwichten/assen per familie.
      **Landing**: een poel van 27 hero-foto's (`heroPool.json`, `heroPool.ts`, `randomHero()`),
      per bezoek een andere (de landing is dynamisch). **Beelden** (alles in één keer, Gemini, 3x3-
      vellen, ≈$1,61 voor 81 kaarten + 27 hero's, plus ≈$0,13 om 4 afgekeurde beelden opnieuw te
      maken: een baan met tekst en schaduwen van mensen, whiskyglazen, een merk-bordspel en iemand
      op een zeilboot): `public/illustrations/associations/` (81) en `hero-pool/` (27). Alle
      contactvellen zijn bekeken; de beelden staan nog op `status: concept` tot Jan ze goedkeurt.
      `scripts/generate-discovery-illustrations.ts` kreeg `--hero`. Bekend: hero-beelden komen uit
      3x3-vellen (±700 px bron), dus op retina iets zacht. Getest: 279 tests (nieuw: sampler,
      hero-poel), `tsc`, lint, productiebuild; in de browser: negen kaarten per ronde, een tweede
      sessie in dezelfde browser toont 0 van de 9 eerdere beelden, kiezen en verversen laten niets
      verspringen, de venstercollage gebruikt de nieuwe beelden, de hero wisselt per verzoek.

- [x] Stap 71 — "Route 1 + 2" P0-1: opties onderaan de beeld-intake onbereikbaar op telefoon
      (bouwopdracht `WINDOW_Bouwopdracht_Route1-2.md`). **Oorzaak**: de vaste balk (Terug + Verder)
      zat binnen `.animate-window-page-in`, waarvan de animatie met `forwards` de eindstand
      `transform: translateX(0)` behoudt. Een element met een transform is voor `position: fixed`-
      kinderen de containing block, dus de balk stond niet vast aan het scherm maar aan de onderkant
      van de inhoud, bovenop de laatste opties. Eerst gereproduceerd met Playwright: op elk scherm
      stond de balk 136 px boven de onderkant van het scherm (375, 390 en 412 px). **Fix**: nieuwe
      klas `.animate-window-page-fade` (alleen opacity, `backwards`) voor `AssociationWizard`; de oude
      klas blijft ongewijzigd voor `IntakeWizard` (legacy en cards, die niet aangeraakt mogen worden).
      Verder: onderpadding en balk houden rekening met `env(safe-area-inset-bottom)`, en
      `html { scroll-padding-bottom: 7rem }` houdt een gefocust veld boven de balk (**niet** bewezen
      door de test: die slaagt ook zonder, dus een voorzorg). **Tests**: Playwright (nieuw als
      devDependency, `npm run test:e2e`, `playwright.config.ts`, `e2e/intake-mobile.spec.ts`): 21
      tests (7 schermen x 3 telefoonformaten: balk vast aan het scherm, laatste optie boven de balk en
      niet bedekt, aanklikbaar) plus een toetsenbordtest op 390x420. Alleen Chromium, niet op een
      echte iPhone of Android. `tsc`, lint, 279 unit-tests, `npm run build` schoon.

- [x] Stap 72 — "Route 1 + 2" P0-2: het wachtscherm blijft niet meer hangen op een lege boog zonder
      vinkjes. **Twee oorzaken**, lokaal gereproduceerd met een nagemaakte `pending`-rij (geen
      generatie): (1) de ruiten van het venster bleven voor altijd onzichtbaar: `WindowFrame` gaf ze
      `motion-safe:animate-window-fade-in motion-safe:opacity-0`, maar Tailwind kent `motion-safe:`
      alleen voor eigen utilities, dus de animatie-klas genereerde geen CSS terwijl `opacity-0` dat
      wel deed (gecontroleerd in de gecompileerde stylesheet). Nu een gewone CSS-klas
      `.window-pane-open` (`backwards`, alleen bij `prefers-reduced-motion: no-preference`), met een
      test die het terugzetten van `motion-safe:opacity-0` afvangt. Bestond sinds Stap 63. (2) De
      database van de testomgeving miste migraties 0014-0017 (o.a. `progress_stage`), waardoor de
      stap nooit werd opgeslagen en het scherm op fase 1 bleef; Jan heeft ze gedraaid. **Verbeterd**:
      echte tellingen bij afgeronde stappen ("{n} deuren gekozen", "{n} plekken rond {plaats}
      gevonden"), alleen als de pijplijn ze kende (nieuwe kolom `progress_meta jsonb`, migratie
      `0018_progress_meta.sql`, **nog te draaien**; zonder de kolom wordt de stap nog gewoon
      opgeslagen, zonder getal, en loggen we een fout). Aantal plekken = unieke naam+plaats uit het
      lokale onderzoek van de zeven ideeën; geen getal bekend (klassieke pijplijn, 0 plekken) = alleen
      het vinkje. De teller loopt op echte tijd: de server rekent `created_at` van de rij om naar
      verstreken tijd en de client telt vanaf elke poll verder met `Date.now()`, dus een herlaad of
      tabwissel zet hem niet terug. **Vangnet**: na 120 s (`STALL_AFTER_MS`, gelijk aan `maxDuration`
      en dus niet de 150 s uit de opdracht, want op 150 s zet de server de rij zelf op `failed` en
      zag niemand de melding) toont het scherm "Het duurt langer dan normaal…", met een
      bestelreferentie als die er is (betaalde order: "We mailen je Idea Book zodra het klaar is";
      testrun zonder order: "Even geduld, je boek is nog onderweg", omdat we dan niets beloven over
      e-mail), het draaiende rondje stopt, en `generation_stalled { stage, seconds }` gaat naar
      PostHog (nooit tekst). Titel "Je Idea Book wordt samengesteld…" is "We openen je venster…" (en
      "Opening your window…"). Fouten bij het opslaan van de stap zijn nu `console.error` i.p.v.
      `warn`. Getest: 291 unit-tests (nieuw o.a. `phaseLabels`, `elapsedSince`, `isStalled`, nl + en),
      `tsc`, lint, build, 22 Playwright-tests, en in de browser drie nagemaakte rijen (net gestart,
      onderweg, vastgelopen op 122 s). **Echte testgeneratie** (testbypass, beeld-intake, ± €0,14,
      migratie 0018 gedraaid): ±55 s, de rij liep `selected` {ideas: 7} -> `researched` -> `ready`/
      `rendered` en het scherm sprong vanzelf naar het boek. Daarbij een eigen fout gevonden: elke
      stap *verving* `progress_meta`, dus na "researched" was `{ideas: 7}` weg (`{places: 10}` bleef).
      Nu worden de getallen samengevoegd (`mergeProgressMeta`, met tests); de samengevoegde weergave
      ("7 deuren gekozen", "10 plekken rond … gevonden") is met een nagemaakte rij gezien, **niet**
      opnieuw in een tweede betaalde run. De plaatsnaam in die regel toont nog "Laren, Laren,
      Noord-Holland" (dubbel; R1.2 ruimt dat op). De weergave in een browser die daadwerkelijk frames
      tekent is niet gezien (de testbrowser tekent niet zolang niemand kijkt).

- [x] Stap 73 — "Route 1 + 2" R1.1: titels, stepper en "Richting" in de beeld-intake (alleen tekst,
      geen API-kosten; besluit B2 stond nog OPEN, de standaard "Richting" is gebruikt). **Stepper**:
      "1 · Jouw beelden · 2 · Praktisch · 3 · Met wie · 4 · Jouw venster" (`dict.chapters`, ook de
      kleine labels boven de koppen en de landingsstrook). **Koppen** (zelf en cadeau): "Waar gaat je
      nieuwsgierigheid naartoe?", "Welk moment zou je vaker willen beleven?", "Wat raakt je
      zintuigen?", "Hoeveel ruimte maak je vrij?", "Met wie, en wat moet kloppen?", profielscherm
      "Zo kijken wij door jouw venster" (cadeau: "…door het venster van {name}", daarvoor kreeg
      `reflection` een `headingGift`); "Welke werelden…" is "Kies één tot vier richtingen. Of laat
      ons kiezen." (en "We kiezen de richtingen voor je"). **Ruitlabels** in het venster, de
      PDF-cover en op de betaalpagina: Richting · Plek · Moment · Zintuig (en Direction · Place ·
      Moment · Sense). **Puntjes** binnen stap 1 (Richting · Plek · Moment · Zintuig) laten zien waar
      je bent in het lange eerste hoofdstuk; op het profielscherm zijn ze alle vier afgerond.
      Interne namen (`interestDomains`, `dict.worlds`, paginanummers, bestandsnamen) zijn niet
      veranderd. De kaartenwizard houdt zijn eigen "Andere werelden kiezen" (die variant is niet
      aangeraakt). Het vierde stepper-hoofdstuk heet nu "Jouw venster" maar toont nog het
      optionele slotvraagscherm; R2.1 verplaatst het profielscherm daarheen (B4). Test
      `vensterCopy.test.ts`: geen zichtbare tekst meer met "wereld/world", gift-koppen houden
      `{name}`, zelf-koppen niet, nl en en hebben dezelfde vorm. 302 unit-tests, `tsc`, lint, build
      en 22 Playwright-tests schoon; in de browser bekeken op 390 px (stap 1, profielscherm als
      cadeau voor "Anna") en 1280 px (stap 2). Opgemerkt, niet aangepast: in het cadeau-profiel
      staat nog "het liefst op je eentje" (tweede persoon voor de ontvanger); het profielscherm
      wordt in R2.1 herbouwd.

- [x] Stap 74 — "Route 1 + 2" R1.2: kleine fixes in de beeld-intake. **(1)** De chip "Gratis" (en
      "Free of charge") is uit de harde grenzen: de budgetvraag ("Hou het gratis") dekt dat. Een zelf
      getypt "gratis" blijft door `parseMustHaves` als wens gelezen worden (test). **(2)** "Onder 18"
      verschijnt alleen als het venster een cadeau is (`ageOptionsFor`, `src/lib/ageOptions.ts`); voor
      jezelf begint de rij bij 18–24, maar een al gekozen "Onder 18" (oud concept, wijzigen) blijft
      zichtbaar. Het cadeaulabel is "Hoe oud is {name}?" (met "diegene" als er geen naam is); de
      opdracht noemde "hij/zij", maar een voornaamwoord raden doen we niet. **(3)** Plaatsnaam
      ontdubbeld in de weergave (`displayPlace`, `src/lib/place.ts`): "Laren, Laren, Noord-Holland"
      toont als "Laren, Noord-Holland" in de suggestielijst en (tot je zelf typt) in het veld, in het
      echo-chipje op `/plan` en op het wachtscherm. Opgeslagen waarde, `/api/location-suggest`, de
      onderzoekssleutel (`placeKey`) en de vensterbank (die toont al alleen het eerste deel) zijn
      ongewijzigd; `LocationAutocomplete` kreeg een opt-in `tidy`-prop zodat legacy en cards niet
      veranderen. **(4)** Een uitgeschakelde knop is nu platte greige (nieuwe tokens
      `--color-disabled`, `-border`, `-ink`, uit `Toestanden.dc.html`) met `cursor: not-allowed` en
      `aria-disabled`, niet meer dezelfde walnootvulling op halve dekking. Let op: `Button` is
      gedeeld, dus dit geldt voor alle schermen (ook legacy en cards), alleen voor het
      uitgeschakelde geval. **(5)** "Overslaan?" is "Overslaan". Tests: `place.test.ts`,
      `ageOptions.test.ts`, uitbreiding van `vensterCopy.test.ts`. 315 unit-tests, `tsc`, lint, build
      en 22 Playwright-tests schoon; in de browser op 390 px gezien: zelf zonder "Onder 18" en
      "Gratis", cadeau mét "Onder 18", de uitgeschakelde knop (computed: greige, not-allowed),
      suggestie "Laren, Noord-Holland" bij opgeslagen "Laren, Laren, Noord-Holland", en "Overslaan".

- [x] Stap 75 — "Route 1 + 2" R1.3: deelpreview voor `/shared/[id]` (WhatsApp, iMessage, Slack,
      LinkedIn, X, Facebook). De bestaande `opengraph-image.tsx` (coverfoto + paneel met titel en
      "één ding") is herbouwd volgens de opdracht: links het venster van de koper (de eerste foto
      van elk van de vier ruiten in het boogkozijn met gouden rand), rechts het logo (`windowinto-
      cream.png`) en één regel "7 deuren uit één venster" ("7 doors from one window"; de wildcard
      telt als deur, 6 + 1), in Newsreader op walnoot. Bij boeken van legacy en cards (of als er niets
      gekozen is) staat de vaste coverfoto in dezelfde boog; een verwijderde link krijgt een
      algemene kaart. **Privacy**: de kaart kent alleen welke beelden gekozen zijn
      (`getSharedWindowSource`, een smalle query die niets anders teruggeeft); geen open antwoord,
      plaats, leeftijd, profieltekst of naam. De "Een venster voor {voornaam}"-variant uit de
      opdracht is **niet** gebouwd: er bestaat geen schakelaar waarmee de gever dat aanzet, dus de
      kaart toont nooit een naam. **Grootte**: Satori levert een PNG van ± 450 KB (WhatsApp laat
      previews vaak vallen boven ± 300 KB), dus de kaart wordt met `sharp` naar JPEG omgezet:
      41-55 KB; lukt dat niet dan gaat de PNG mee. `sharp` is nu een eigen dependency in
      `package.json` (zat al in `node_modules` via Next en wordt door `sheetSlicer.ts` gebruikt;
      `npm install` tilde de sharp-familie in het lock-bestand van 0.35.4 naar 0.35.5). **Metadata**
      (`generateMetadata` per boek, in de taal van het boek, met het aantal deuren): `og:title`
      "Een venster vol mogelijkheden", `og:description` met de regel, `twitter:card =
      summary_large_image`, `og:image` (jpeg, 1200x630). **Deelknop**: staat nu ook op
      `/shared/[id]` (label "Deel dit Idea Book") naast die op `/plan`; waar de browser geen
      deelmenu heeft (computer) kopieert hij de link en toont een WhatsApp-link
      (`wa.me/?text=…`, event `idea_book_share_whatsapp_clicked`). Nieuwe pure helpers in
      `src/lib/shareCard.ts` (regel, metadata, veilige beeldpaden) met tests; 321 unit-tests, `tsc`,
      lint, build en 22 Playwright-tests schoon. Gezien lokaal: de kaart voor een beeld-intake-boek,
      voor een boek zonder venster (cover) en voor een niet-bestaande link; de meta-tags in de
      HTML; de WhatsApp-link na een klik zonder `navigator.share`. **Nog niet gezien**: de preview
      in echte WhatsApp (vraagt een publieke URL, dus de Vercel-preview of productie) en de
      Engelse kaart (geen Engels boek in de database).

- [x] Stap 76 — "Route 1 + 2" R2.1: het zoekprofiel aan het einde van de intake ("Zo kijken wij door
      jouw venster"). Besluiten B3 en B4 stonden nog OPEN; de standaarden zijn gebruikt. **Nieuwe
      volgorde** (7 schermen, `vensterPages.ts`): Richting, Plek, Moment, Zintuig, Praktisch, Met wie,
      Jouw venster (profiel) en dan de betaalpagina. Het oude profielscherm na de beeldrondes en het
      losse slotvraagscherm zijn vervallen; de slotvraag is "Wat missen we nog?" op het profiel
      (`personalReflection`). Het stepper-hoofdstuk "Jouw venster" toont nu echt dat scherm. Oude
      concepten (sessionStorage, zonder versie) worden op de nieuwe volgorde afgebeeld
      (`migrateDraftPage`: oud scherm 4 en 5 worden "Praktisch", 6 "Met wie", 7 profiel), nooit een
      crash; de betaalpagina krijgt een extra link "Profiel of schuiven bijsturen". **Het scherm**
      (`ProfileStep.tsx`, logica in `discovery/profileStory.ts`, alles deterministisch uit vaste
      zinsdelen in `dict.venster.profile`, geen AI-aanroep): het venster; miniaturen van de
      beelden die het zwaarst wegen (bij een spanningsveld altijd één van elke kant); een verhaal van
      3-4 zinnen (je koos X, Y en Z / daarin lezen we A en B / we zoeken dus iets … / daarbij houden
      we rekening met tijd, budget, plaats en gezelschap); "Wat opvalt": het spanningsveld (twee
      beelden die op één as minstens ±0,5 uit elkaar liggen, dan een zin per as), anders de sterkste as
      (|gemiddelde| ≥ 0,2), anders "wijzen niet één kant op"; vier schuiven (alleen-samen, rust-actie,
      binnen-buiten, vertrouwd-nieuw) op vijf standen, startend bij wat de beelden zeggen;
      "Dit zoeken we" (max. 3) en "Dit laten we weg" (max. 2), live meebewegend; "Wat missen we
      nog?" met drie startzinnen uit de eigen keuzes (combinaties als natuur + verhaal, anders per
      tag, bewust zonder ik-vorm zodat ze ook bij een cadeau kloppen); de teaser "Eén van je zeven
      deuren zal je verrassen"; "Klopt, open mijn venster" (naar de betaalpagina) en "Bijsturen"
      (extra tags, de oude "Niet helemaal"-chips). Op een telefoon staan schuiven en filters in het
      uitklapblok "Bekijk en stuur bij" (standaard dicht), op een computer altijd open en zonder
      sticky paneel. Cadeau: eigen zinnen met de naam, nooit "je koos" over de ontvanger.
      **Eerlijkheid**: elke "laten we weg"-regel hoort bij een filter dat echt actief is (test op
      `resolveConstraints`); tijd en afstand staan onder "zoeken" omdat ze het onderzoek en de tekst
      sturen, niet omdat de motor erop filtert. **`axesOverride`**: de schuiven zijn opgeslagen als
      `IntakeAnswers.axesOverride` (alleen aangeraakte assen, -1..1), server-side gesaneerd; ze
      vervangen per as wat de beelden zeggen, dus `effort` volgt energie en `practicalToWild`
      volgt nieuwheid (ook zonder gekozen beeld). **Gemeten**: shadow-run met `--overrides`
      (`scripts/discovery-shadow.ts`, 4 op de 10 bezoekers verschuiven 1-4 schuiven), 3 x 500
      profielen: E1-E6 telkens 0 schendingen; als test vastgelegd (300 profielen).
      **Events**: nieuw `profile_viewed`, `profile_agreed {adjusted}`, `profile_axis_changed
      {axis}`, `profile_reflection {has_reflection}` (nooit tekst, labels of plaats); het oude
      `association_reflection` is vervallen. `reflectionSentence` en de teksten van het oude scherm
      zijn verwijderd. Getest: 349 unit-tests (nieuw: 23 voor het profiel, 3 voor de schuiven in
      `applyImageIntake`, migratie van concepten, slider-regressie), `tsc`, lint, build, 22
      Playwright-tests (nu ook het profielscherm op 375, 390 en 412 px); in de browser op 390 en
      1280 px bekeken, een schuif live verplaatst, en een volledige run tot de betaalpagina waarbij
      `axesOverride`, `personalReflection` en de afgeleide `effort` in `raw_json` bleken te staan
      (testsessie opgeruimd). **Niet gezien**: een echte generatie met schuiven (geen betaalde
      aanroep gedaan), de Engelse versie van het scherm in de browser, een echte telefoon.

- [x] Stap 77 — "Route 1 + 2" R2.2: de draad per deur ("Zo kwamen we hierop"): jouw beeld, wat we
      erin lazen, de deur, de echte plek, elk met een klein onderschrift dat zegt waar het vandaan
      komt. **Data**: `associations.ts` kreeg `sourceTagsFor` (de hoogstens twee tags die zowel op de
      activiteit als op een gekozen beeld zitten; stemmingstags tellen half, net als in de motor),
      `buildAssociationSources`, `parseAssociationSources` en `AssociationSources`; `sourceTags`
      zit ook in het resultaat van `associationsToEngineInput`. `select.ts` en `graph.ts` zijn niet
      aangeraakt. Nieuwe kolom `window_plans.association_sources` (migratie
      `0019_association_sources.sql`, **nog handmatig uit te voeren**), formaat
      `{ version: 2, sources, sourceTags }` per activiteit; het oude platte formaat
      `{activiteit: [beelden]}` wordt nog gelezen; rommel of niets geeft geen draad.
      `finishPlanGeneration` slaat het bij het klaarzetten van het boek op (alleen voor de
      beeld-intake en alleen voor ideeën met een `activity_id`); ontbreekt de kolom nog (Postgres
      `42703`) dan wordt het boek gewoon zonder draad opgeslagen en staat er een foutregel in de
      log. **Weergave**: `components/plan/IdeaThread.tsx` (`<ol>`, miniatuur met het beeldlabel als
      alt-tekst; telefoon verticaal met verbindingslijn, computer horizontaal; een schakel die niet
      in de data zit valt weg, zonder beeld én zonder woorden geen draad); logica in
      `lib/ideaThread.ts` (`buildIdeaThreads`, `threadSentence`). Op `/plan`: bij "Als je er maar
      één kiest" in plaats van de strook "Omdat je X koos" (die blijft voor boeken zonder opgeslagen
      bronnen) en bij elke deur in het ideevenster. **Niet** op `/shared/[id]` (persoonlijke
      keuzes). **PDF**: één zin aan het eind van "Waarom dit bij jou past" ("Bij deze deur hoort
      het beeld ‘…’: daarin lazen we … en …"; zonder pijltje, dat glyph hebben de lettertypen niet);
      `PDF_VERSION` is 4. Teksten (`dict.venster.thread`, nl + en). Getest: 366 unit-tests (nieuw:
      17, o.a. dat elke genoemde tag aan beide kanten staat, het oude formaat, het onderdeel zonder
      data), `tsc`, lint, build, 22 Playwright-tests; het onderdeel op 390 en 1280 px bekeken met
      echte data (tijdelijke testpagina, verwijderd); een voorbeeld-PDF waarin de regel op alle 7
      ideepagina's staat zonder afkapping; een ouder boek op `/plan` werkt ongewijzigd.
      **Gecontroleerd in een echt boek** (migratie 0019 gedraaid): het testboek `38f24d5e-…` is
      aangevuld met `scratch/backfill-thread.ts`, dat dezelfde `buildAssociationSources` gebruikt
      als de generatie (de opgeslagen ideeën en gekozen beelden, geen nieuwe generatie, geen
      kosten). Vier deuren naast de data gelegd (de uitgelichte "Tellen tijdens je wandeling",
      begraafplaats, lasergamen, fietsroute); de beelden, woorden en de plek (Westerheideroute,
      Laren) klopten, ook op 390 px. **Daarbij een eerlijkheidsprobleem gevonden en gefixt**: de
      opgeslagen `sourceTags` komen uit álle gekozen beelden, maar de draad toont maar één beeld;
      "Proeven bij het theehuis" liet bij "Confetti na de grap" het woord *ontdekken* zien, dat
      van de bosrand kwam. `buildIdeaThreads` toont nu alleen woorden die het getoonde beeld zelf
      draagt (opgeslagen data ongewijzigd; test erbij). Dat het schrijfpad in `finishPlanGeneration`
      echt de kolom vult is **niet** live gezien (dat vraagt een nieuwe generatie); alleen de code
      en de terugval bij een ontbrekende kolom zijn gelezen en getypecheckt. Ook niet gezien: de
      Engelse weergave.

- [x] Stap 78 — "Route 1 + 2" R2.3: meer body per deur. **Eerst gerekend, daarna gebouwd** (Jan keurde
      beide voorstellen goed: B5 = maximaal +€0,03 per boek, en "gratis" alleen als de bron of de
      instapnotitie het steunt, geen afstanden zodat `localResearch.ts` ongewijzigd bleef).
      **Meting** (3 bestaande boeken, `count_tokens`, geen generatie): ±2.600 tokens uitvoer per boek
      (±370 per idee); schrijfcall ≈ $0,042, onderzoek ≈ $0,10, totaal ≈ $0,145 (€0,13), ±50 s.
      **Schatting nieuwe lagen**: +±1.600 uitvoertokens (+±400 invoer) = +$0,017 (≈ +€0,016, +12%) en
      +±18 s schrijftijd (±70 s totaal, onder de 120 s). De lagen "echte plekken" en "ook in deze
      richting" kosten niets (uit het onderzoek, resp. de relatiegraaf). **Nog niet gemeten met een echte
      generatie**: zie "Testgeneraties" hieronder, die vielen duurder en trager uit.
      **Wat er is**: per idee uit de motor optioneel `feels_like` (2 zinnen), `sizes` (precies drie:
      Proeven ±1 uur, Doen halve dag, Doorpakken weekend/cursus, elk titel + zin + kosten + duur),
      `next_step`, `places` (tot 3 plekken rechtstreeks uit het onderzoek, nooit door het model
      geschreven: naam, plaats, website, Maps-link; geen afstand) en `related` (tot 3 "ook in deze
      richting", `relatedActivities`/`relatedActivitiesIn` in `engine/related.ts`: leest alleen
      `graph.ts`, filtert met `passesConstraints`, sluit alle deuren van het boek uit en toont een
      activiteit hooguit één keer). Types, validatie en harde lengtegrenzen staan in
      `claude/ideaLayers.ts` (te lang of ontbrekend = die laag weg, nooit afgekapt; drie maten of
      geen). `generateFromSeeds.ts`: prompt + schema (de drie velden staan in het schema, zijn in het
      boek optioneel). Oude boeken en boeken uit de klassieke pijplijn hebben de lagen niet en tonen
      niets extra's. **Weergave** (`components/plan/IdeaMore.tsx`): op `/plan` in het ideevenster en bij
      "Als je er maar één kiest": op een computer altijd zichtbaar, op een telefoon achter de vouw
      "Meer over deze deur" (twee weergaven van dezelfde lagen, met CSS gewisseld). De drie maten zijn
      een veegrij met zichtbare volgende kaart waar weinig ruimte is en drie kolommen waar wel (een
      container query, dus ook in het venster); plekken als lijst met "Op de kaart" en "Website"
      (44px), "Ook in deze richting" als chips. **`/shared/[id]`** toont alleen de drie maten (geen
      draad, geen plekken, niets persoonlijks). **PDF**: een idee met lagen krijgt een tweede pagina
      ("Meer over deze deur", dunne foto, zelfde stijl; klikbare kaart- en websitelinks), de kaartpagina
      en de knop "Bekijk als PDF-pagina" gebruiken dezelfde paginanummering (`pdfPageNumbers`);
      een boek zonder lagen blijft precies 10 pagina's. De pagina meet alles vooraf en kiest de ruimste
      van vier spaties die boven de voettekst eindigt (bij alle velden op hun maximum: slankere
      fotostrook, strakkere ruimte, laatste redmiddel geen notities onder de plekken), dus niets loopt
      eroverheen. `PDF_VERSION` = 5. **Duur per stap**: `finishPlanGeneration` logt nu één regel
      "seconds per step" (`stageDurations`) en het totaal. Nieuwe copy (`dict.venster.more`, nl + en).
      **Afwijking van de bouwopdracht**: de lagen staan bij "Meer over deze deur" ná de bestaande
      blokken in plaats van ertussen (zo verdwijnt of verschuift niets dat er al was).
      Getest: 395 unit-tests (nieuw: o.a. de pijplijn met een nagebootst model en onderzoek: de lagen
      worden bewaard, plekken komen alleen uit het onderzoek, "ook in deze richting" bevat nooit een
      deur van het boek en geen dubbele, een kapotte laag laat het boek niet falen; `relatedActivities`;
      de paginatelling 10 / 12 / 17 en < 4 MB; `IdeaMore` zonder lagen / volledig / gedeeld),
      `tsc`, lint, `npm run build`, 22 Playwright-tests; in de browser op 390 en 1280 px met
      voorbeeldlagen op een testboek (daarna hersteld uit een back-up): vouw, veegrij, plekken,
      chips, venster in drie kolommen, gedeelde pagina alleen de drie maten, geen horizontale
      scroll (daarbij een eigen bug gevonden: de veegrij maakte de kaart breder dan het scherm, opgelost
      met `contain: inline-size`). Voorbeeld-PDF's (`scripts/render-sample-pdfs.ts`) in 17 / 17 / 10
      pagina's bekeken, ook met alle velden op hun maximum. **Niet gezien**: de Engelse weergave en een
      Engelstalige generatie.
      **Testgeneraties (twee echte, via de testbypass, Jan akkoord, ≈$0,41 samen)**: voor jezelf
      (Utrecht) en cadeau voor Judith (Haarlem), beide in `pdf_version` 5 met 17 pagina's (1,8 / 1,5 MB).
      *Voor jezelf*: onderzoek 19,5 s ($0,10), schrijven 67 s met 6.571 in / 5.980 uit ($0,073),
      totaal 91 s, ≈$0,174 (was ≈$0,145: +20%; de lagen kosten ≈$0,031 = ±€0,029, dus op de grens van B5
      = +€0,03); de uitvoer is +±2.900 tokens, bijna het dubbele van de schatting (+1.600).
      *Cadeau*: de schrijfcall liep **twee keer** (de eerste uitkomst is weggegooid; de reden stond niet
      in de log, nu wel: `writing attempt N failed: ...`), samen 129 s schrijven en 150 s totaal, ≈$0,235
      (dat gebeurde met één call voor alles; zie de aanpassing hieronder).
      Een herpoging passeert dus de 120 s van `maxDuration` en de 150 s van `PENDING_TIMEOUT_MS`.
      Inhoud: `feels_like` is bij alle 14 ideeën goed (zintuiglijk, 2 zinnen); `sizes` ontbrak bij 2 van
      de 7 ideeën van het cadeauboek (de validatie liet de laag weg; de reden wordt nu in `issues`
      gelogd als `ideaN:sizes_dropped (...)`); plekken komen uit het onderzoek (geen plek bij 5 van de 14
      ideeën); "ook in deze richting" is meestal passend, soms zwak (bv. "Zelf je fiets repareren" bij
      imkeren). Eerlijkheid: bij "Proeven" staat een paar keer "Gratis" voor een open dag zonder
      steun in het onderzoek, en het cadeauboek noemt het Noord-Hollands Archief (echt, maar niet uit het
      onderzoek); de controle in `checkEntry` ziet namen in `sizes`/`next_step` niet. Eén "Proeven" duurt
      3 uur (diorama).
      **Aanpassing na die testgeneraties (Jan koos optie A + aanscherping)**: (1) de lagen worden
      door een **tweede call** geschreven die tegelijk loopt met de call voor de ideeën
      (`writeLayers`, tool `create_layers`, eigen prompt `LAYERS_SYSTEM_PROMPT`; de drie laagregels
      zijn uit de kernprompt gehaald). De laagcall wordt niet herhaald en laat bij falen het boek
      zonder lagen (gelogd); de kern behoudt zijn ene herpoging, die de laagcall niet opnieuw doet.
      (2) De laagprompt is aangescherpt: noem een bedrijf, club, plek of website alleen als hij bij
      dat idee in de geverifieerde opties staat (nooit uit het geheugen, hoe bekend ook), "Gratis"
      alleen als die opties of de "Easy way in" het zeggen of er helemaal niets te kopen of te boeken
      valt (thuis stil zitten, een wandeling vanaf je eigen deur), anders "vanaf ±€x" met "prijs
      varieert", en "Proeven" duurt hooguit negentig minuten. (3) Een weggelaten maat wordt in
      `report.issues` gelogd als `ideaN:sizes_dropped (reden)`, een mislukte schrijfpoging als
      `writing attempt N failed: ... (ideas: n, wildcard: ja/nee)`. (4) `splitCoreAnswer`: in beide
      cadeauboeken werd het eerste antwoord van de ideeëncall weggegooid ("verkeerd aantal ideeën")
      en alles opnieuw betaald. Zeven items onder `ideas` zonder wildcard (het laatste is de wildcard)
      of zeven plus een wildcard (de gegeven wildcard telt) worden nu geaccepteerd; al het andere
      gaat nog naar de herpoging. Dat dit de werkelijke oorzaak van de weggegooide antwoorden is, is
      een aanname (de oorzaak stond niet in de log): bij de volgende generatie laat de log het zien.
      **Nieuwe testgeneratie** (cadeau Judith, Haarlem, vóór de splitCoreAnswer-aanpassing): geen
      enkele maat weggelaten (`issues: none`), alle 7 ideeën hebben alle lagen, geen verzonnen
      namen in de maten (de namen komen uit het onderzoek; "Gratis" staat alleen bij een wandeling
      en een gratis skeelerroute uit het onderzoek), Proeven hooguit 1,5 uur. Tijd 99,7 s totaal
      (onderzoek 23 s, schrijven 71 s met een herpoging van de kern: elke call ±35 s, de laagcall
      35 s tegelijk), dus zonder herpoging ±65 s. Kosten: onderzoek $0,105, kern 6.085 in /
      3.057-3.208 uit ($0,044 per call), lagen 5.106 in / 2.706 uit ($0,037); zonder herpoging
      ≈$0,187, met de herpoging ≈$0,229. Dat is +$0,042 (±€0,039, +29%) tegen de $0,145 van vóór
      R2.3, dus **boven de B5-grens van +€0,03** (de splitsing kost ≈$0,01 extra invoer); Jan kende dat
      verschil vooraf. Deze generatie is niet opnieuw met de nieuwe herpoging-afvanger gedaan. Jan heeft daarna de extra kosten (±€0,039 per boek) akkoord
      verklaard: de lagen blijven zoals ze zijn.
      Bekend (niet door deze stap): `vitest` meldt bij de zware associatietests ("Timeout calling
      onTaskUpdate") één werker-time-out; hij verschijnt ook zonder deze wijziging en alle tests slagen.

- [x] Stap 79 — Meer activiteiten en dynamischere richtingen en beelden, op verzoek van Jan (schietles,
      kleiduifschieten, escape-achtige opties, meer afwisseling bij de richtingen en associaties;
      akkoord op alle 14 voorgestelde activiteiten, de beeldkosten en de volgorde).
      **Bevinding vooraf**: van de 27 associatiekaarten droegen maar 1 `competition`, 1 `precision`,
      2 `teamwork` en 3 `suspense`: wie van schieten, karten of een escape room houdt kon dat met de
      beelden niet aangeven, dus de motor kwam er bijna nooit bij uit.
      **14 nieuwe activiteiten** (bibliotheek 200 -> 214, `taxonomy:check` 0 fouten en 0 waarschuwingen),
      NL + EN, `status: concept`: schietles (sportschieten), kleiduifschieten, 3D-boogparcours,
      bijlwerpen, karten, quad- of buggytocht, minigolf, via ferrata, wildwaterraften, zweefvliegen
      (proefvlucht), stadsspel of outdoor escape, escape-doos thuis, VR-arcade, simracen. Escape room,
      boogschieten en lasergamen bestonden al. Alles wat toezicht vraagt (schietles, kleiduifschieten,
      boogparcours, via ferrata, wildwaterraften, zweefvliegen) is tier 2 met een instapnotitie die
      alleen de begeleide, legale weg noemt ("erkende vereniging, met instructeur; de vereniging regelt
      leeftijd en wettelijke voorwaarden"); **laat de schiet-notities nog juridisch controleren**.
      Foto's: 14 stuks (2 vellen 3x3 + 1 los, ≈$0,40), allemaal bekeken: geen mensen, geen wapens (een
      schietschijf met gaatjes, schijven in de lucht, een 3D-schietdoel), ruim goed.
      **Associaties 27 -> 36 families (81 -> 108 kaarten)**: 9 nieuwe families voor spanning,
      precisie en samen winnen, elk met drie varianten: plekken (een lange baan met één doel, een arena
      vol licht, een circuit met banden en vlaggen), momenten (precies in de roos, het aftellen, het
      scorebord na een spannende ronde), zintuigen (het klikken van een mechanisme, het brullen van een
      motor, het drumroffel voor de start). 27 beelden (3 vellen 3x3, ≈$0,40) plus één opnieuw ($0,13,
      een mensvormig doel werd een rond doel). Per sessie ziet iemand nu **negen van de twaalf families
      per ronde** (`sampleRoundCards`/`chooseFamilies` in `associationSampling.ts`): de keuze hangt
      alleen van seed en ronde af (een gekozen kaart verschuift niets), en elke as houdt minstens twee
      gevoelens aan beide kanten (novelty: één), voor zover de pool ze heeft (getest op 300 seeds per
      ronde); in 200 sessies komt elke familie voor. De validator eist nu minstens 9 families per ronde.
      **Richtingen dynamischer**: elke richtingkaart toont per sessie 3 voorbeeldactiviteiten uit die
      richting (één per subgroep waar het kan, andere bij een nieuwe sessie, hetzelfde bij verversen), via
      `worldExamples` in `buildAssociationLibrary` en `sampleWorldExamples`. **Bewust niet gedaan: wisselende
      foto's per richting** (de 20 extra richtingfoto's uit het voorstel): het venster, de PDF-omslag en de
      deelpreview tonen de vaste richtingfoto, dus een gekozen variant zou daar niet terugkomen; dat zou
      "dit koos je" niet kloppend maken. De varianten `legacy` en `cards` zijn niet aangeraakt (de nieuwe
      activiteiten verschijnen wel vanzelf in hun kaartenstap, want de bibliotheek is gedeeld).
      **Bereikbaarheid** (`scratch/reach.ts`, 40 seeds per profiel): schietles komt in 16-17 van 40 boeken
      voor bij wie "baan/in de roos/klik" kiest (ook bij richting Sport), kleiduifschieten bij precisie +
      buiten (3/40), 3D-boogparcours 5/40, bijlwerpen 6-17/40, karten, simracen en VR-arcade bij
      spanning of racen. Per boek komt hooguit één van de drie schietvormen voor: ze delen één subgroep
      en de motor staat er maar één per subgroep toe. Wie op de schuif "voorspelbaar" koos, krijgt
      activiteiten met toezicht niet (bestaande regel). Shadow-run (500 beeldprofielen): E1-E6 nul
      schendingen, 210 van 214 activiteiten komen voor.
      Getest: 417 unit-tests, `tsc`, lint, `npm run build`, 22 Playwright-tests; in de browser de richtingen
      (verschillende voorbeelden per nieuwe sessie, geen horizontale scroll op 390 px) en een ronde met
      nieuwe kaarten.

- [x] Stap 80 — Algemene deelafbeelding om mensen naar de app uit te nodigen (Instagram-verhaal, WhatsApp-status
      of -chat), op verzoek van Jan: niet persoonlijk, alleen een uitnodiging. `src/app/share-card/[card]/route.tsx`
      maakt met `ImageResponse` (als de deelpreview) vier JPEG's bij de build: verhaal 1080x1920 en vierkant
      1080x1080, elk in NL en EN (`/share-card/story-nl`, ...; 83-130 KB): het boogkozijn met vier vaste
      foto's (bosrand, kleiwiel, arena, kaarslicht), de wordmark, "Ontdek wat er mogelijk is voor jou." en
      "Open je venster" met het adres (nooit localhost: dan windowinto.nl); bij het verhaal staat alles in
      de middenband, buiten de knoppen van de app. Er staat niets van een bezoeker op. `InviteShare.tsx`: op
      een telefoon "Deel de afbeelding" via het deelmenu van het toestel (Web Share met bestand: daar staan
      Instagram en WhatsApp in), overal "Download afbeelding", "Open WhatsApp met de link" en "Kopieer link"
      (de link is de landing met `utm_source=share_card&utm_medium=story|square`); de knop voor het
      deelmenu verschijnt alleen waar de browser dat kan. Plekken: de nieuwe pagina `/delen` (ook in de
      footer, en in de sitemap) en een knop "Deel een uitnodiging" onder de deelknoppen op `/plan`.
      Events `invite_card_opened`, `invite_card_shared {format, method, source}`, nooit tekst. Copy in
      `dict.venster.invite` (nl + en), pure helpers in `src/lib/shareInvite.ts`. Instagram rechtstreeks
      posten kan niet vanuit een website; het deelmenu is de route. Niet gezien: het echte deelmenu op een
      telefoon en hoe de afbeelding in Instagram of WhatsApp aankomt (de testbrowser heeft dat niet).
      Getest: 7 nieuwe tests (slugs, adres, copy, de component), kaarten opgehaald en bekeken, `/delen` en
      `/plan` op 390 px (tikdoelen 44-48 px, geen horizontale scroll).

- [x] Stap 81 — "Route 1 + 2" R2.4: testfeedback en meting (de laatste stap van de opdracht).
      **Vragenlijst** (`TestFeedback.tsx`, alleen met `NEXT_PUBLIC_TEST_FEEDBACK=1`): van drie naar zes
      vragen, alle optioneel: hoe de flow voelde (1-5), "Voelde je je begrepen door 'Zo kijken wij door jouw
      venster'?" (1-5), "Snapte je waarom je deze deuren kreeg?" (1-5), "Welke deur zou je echt gaan doen?"
      (de ideeën van jouw boek met nummer en titel, de wildcard als laatste, of "Geen van deze"), de
      betaalvraag en "Waar twijfelde je?". `plan/page.tsx` geeft de deuren door in dezelfde volgorde als de
      onthulling (`orderIdeasByDoor`, wildcard laatst). **PostHog** krijgt in `test_feedback_submitted`
      `flow_score`, `profile_score`, `doors_score`, `door_pick` (1-6 het idee, 7 de wildcard, 0 = geen),
      `door_kind` (natural, discovery, unexpected, stretch, wildcard; mijn toevoeging, zodat te zien is welke
      richting mensen kiezen), `would_pay`, `has_doubt`, `stored`: nooit een titel of tekst. **Supabase**:
      dezelfde cijfers staan ook in `test_feedback` (migratie `0020_test_feedback_scores.sql`, **nog
      handmatig uit te voeren**), zodat ze niet verloren gaan zolang er geen PostHog-sleutel is; de vrije
      tekst staat alleen in `doubt`. Zonder migratie 0020 slaat de actie de oudere antwoorden op.
      **Echte fout gevonden en gefixt**: de terugval bij een ontbrekende kolom herkende alleen Postgres-code
      `42703`, maar PostgREST geeft bij een schrijfactie met een onbekende kolom `PGRST204` ("Could not find
      the 'x' column ... in the schema cache"). Bij de eerste echte proef met de nieuwe vragenlijst bleek
      daardoor niets te worden opgeslagen (`stored: false`). Nieuw `src/lib/supabase/errors.ts`
      (`isMissingColumnError`, beide vormen) en toegepast op de vragenlijst én op de terugval van R2.2
      (`association_sources`, migratie 0019) in `plan/data.ts`: die zou op een database zonder die migratie
      het hele boek als mislukt hebben afgesloten in plaats van het zonder draad op te slaan. Beide met
      tests, en de vragenlijst daarna opnieuw live doorlopen (terugval werkt, `stored: true`).
      **Eventcatalogus** (`src/lib/analyticsEvents.ts`) met alle 37 events en hun toegestane eigenschappen,
      en een test (`analyticsEvents.test.ts`) die elke `trackEvent(...)`-aanroep in de broncode leest en
      faalt bij een event dat niet in de lijst staat, een eigenschap die niet is toegestaan, een
      eigenschapsnaam als tekst/titel/label/plaats/naam/leeftijd (booleans beginnen met `has_`), een event
      dat niets meer verstuurt, en een overzicht dat niet klopt (mutatie-proef: een `title`-eigenschap en een
      onbekend event laten de test falen). **Overzicht voor Jan**: `docs/analytics-events.md` (events,
      eigenschappen, wanneer, waar te bekijken, een funnel en een tabel voor één testrun; een tabelrij per
      event wordt door dezelfde test afgedwongen). De PostHog-sleutel is de *project*-sleutel (`phc_...`).
      **Gemeten** (browser, `npm run dev`, `window.__windowEvents`): uit R2.1 `profile_viewed`,
      `profile_axis_changed {axis}`, `profile_agreed {adjusted}`, `profile_reflection {has_reflection}`,
      daarna `intake_submitted` en `checkout_viewed`; uit P0-2 `generation_stalled {stage, seconds}` met een
      nagemaakte rij van 125 s; verder `plan_viewed`, `idea_opened`, `test_feedback_submitted`. Geen enkele
      eigenschap bevat tekst. In dev komen `intake_started` en `checkout_viewed` dubbel door React Strict
      Mode; in productie niet. **Verzenden**: met een nep-sleutel lokaal bevestigd dat zonder toestemming
      niets naar PostHog gaat (`denied`), en met toestemming de browser PostHog initialiseert en per
      gebatchte lading `https://eu.i.posthog.com/e/` aanroept (status 200); de inhoud van de berichten kon de
      testbrowser niet tonen. **Niet gezien**: dat events in jouw PostHog-dashboard aankomen (dat vraagt jouw
      sleutel en een testrun), de regio van jouw PostHog-project (de app en de beveiligingsregels gaan uit
      van EU, `eu.i.posthog.com`), het volledige invoegen met de nieuwe kolommen (migratie 0020 is nog niet
      uitgevoerd) en `checkout_pay_clicked` (vraagt een Stripe-sessie). Tijdelijke instellingen in
      `.env.local` (testvlag, nep-sleutel) zijn teruggezet, het testrijtje in `test_feedback` en de nagemaakte
      rij zijn verwijderd. 436 unit-tests, `tsc`, lint, build en 22 Playwright-tests schoon.

- [x] Stap 82 — PostHog met de echte sleutel gecontroleerd (Jan vulde `NEXT_PUBLIC_POSTHOG_KEY` in en draaide
      migratie 0020). **Gecontroleerd**: de sleutel is een geldige projectsleutel op de EU-server (`eu-assets`
      geeft 200, `us-assets` 404; `NEXT_PUBLIC_POSTHOG_HOST` is EU), dus de beveiligingsregel in `src/proxy.ts`
      past; migratie 0020 is live (alle vier de nieuwe kolommen leesbaar); een volledige proef met de
      vragenlijst schreef alle antwoorden weg (`flow_score`, `profile_score`, `doors_score`, `door_pick`,
      `door_kind`, `would_pay`, `doubt`), het testrijtje is daarna verwijderd. **Echte vondst**: PostHog
      stuurt zijn projectinstellingen mee naar de browser en in Jans project stonden **sessie-opnames en
      autocapture aan** (`/array/<sleutel>/config`: `sessionRecording` gevuld, `autocapture_opt_out: false`);
      de browser laadde daardoor `posthog-recorder.js` en `surveys.js`. Opnames bevatten de tekst op het
      scherm (profiel, ideeën, plaatsen) en autocapture stuurt de tekst van elke aangeklikte knop mee
      (ook titels van ideeën, zoals in de vragenlijst), precies wat de eventcatalogus uit R2.4 wil
      voorkomen en wat de cookiebanner niet belooft. `initPostHog` zet nu zelf alles uit
      (`POSTHOG_CONFIG` in `src/lib/posthog/client.ts`: `autocapture`, `disable_session_recording`,
      `disable_surveys`, `capture_heatmaps`, `capture_dead_clicks`, `rageclick`, `capture_pageleave`,
      `capture_performance`, `advanced_disable_flags` allemaal uit), met een test; daarna laadt de browser
      alleen nog `eu.i.posthog.com/e/` (geen config, recorder, surveys of flags). **Let op**: de proefrun
      van vóór die fix (± 16:59-17:10 UTC op 21 oktober, vanaf `localhost`) kan `$autocapture`-events en
      mogelijk een opname in Jans PostHog hebben achtergelaten; Jan kan die verwijderen. In `docs/
      analytics-events.md` staat een alinea "Wat PostHog bewust niet doet". **Niet gezien**: Jans PostHog-
      dashboard zelf (geen toegang).

- [x] Stap 83 — De testvragenlijst verscheen op Jans Vercel-testomgeving niet (screenshot van `/plan` zonder
      vragenlijst). **Oorzaak in de omgeving, niet in de code**: de variabelen `NEXT_PUBLIC_TEST_FEEDBACK` en
      `NEXT_PUBLIC_WINDOW_PRICE_CENTS` bestonden in het Vercel-project `testomgeving` nog niet (in de lijst
      stond er geen van beide); mijn eerdere antwoord had dat ten onrechte als "wel aanwezig" voorgesteld.
      `NEXT_PUBLIC_*` wordt bij de build vastgelegd, dus na het aanmaken is een redeploy zonder buildcache nodig.
      **Aangepast**: `testFeedbackEnabled` (`src/lib/testFeedback.ts`) accepteert nu ook `true`, `yes` en `on`
      en negeert spaties en aanhalingstekens (voorheen alleen exact `1`: een waarde als `"1"` of `true` zette
      de vlag stilletjes uit); test aangepast. `docs/test-preview.md` kreeg een lijstje veelgemaakte fouten
      (variabele bestaat niet, verkeerde omgeving, geen nieuwe build, waarde) en een controle (testbalk + €6,00
      op de betaalpagina). **Niet gezien**: of de vragenlijst nu op Jans deployment verschijnt; dat hangt van
      de variabelen en de redeploy daar af.

- [x] Stap 84 — Vier verbeteringen op verzoek van Jan (plan eerst voorgelegd, daarna gebouwd; geen enkele betaalde
      API-aanroep: de mailbeelden komen uit bestaande foto's, het profielportret is vaste tekst).
      **(1) Richtingenpagina** ("Waar gaat je nieuwsgierigheid naartoe?"): dezelfde raster en tegelvorm als de
      beeldrondes (`grid-cols-2 sm:grid-cols-3`, `aspect-[4/5]`, geen vierde kolom meer), dus even grote foto's;
      op de tegel staat alleen nog de titel, met een lichtere gradient. De voorbeeldactiviteiten (Stap 79) staan niet
      meer op elke tegel maar als één regel onder het raster bij de laatst aangetikte richting (`hintWorld`); de
      "Verras me"-tegel is breed zodat de laatste rij geen gat heeft. **(2) Plaatsvraag**: "Waar woon je
      ongeveer?" is "Vanaf welke plaats zoek je?" (cadeau: "…zoeken we voor {name}?"), toelichting "We zoeken echte
      activiteiten rond deze plaats in Nederland. Thuis, je werk of ergens anders: jij kiest.", placeholder "Typ een
      plaats, bijvoorbeeld Utrecht…" en "In mijn plaats" is "In deze plaats" (nl + en); opslag en suggesties
      ongewijzigd. **(3) Profielportret** ("Zo kijken wij door jouw venster", `profileStory.ts` + `dict.venster.profile`):
      geen opsomming meer van wat gekozen is (de miniaturen en de vensterbank tonen dat al) maar één kopzin
      ("Je zoekt gezelligheid zonder poespas, en het geduld van een echt vak.", uit een beeldzin per tag: `motifs`) en
      twee tot vier zinnen die de keuzes lezen: een zin voor een tagpaar dat samenhoort (16 paren, `reads`) of anders
      een zin per sterkste tag (`tagLines`, alle 37 tags), een zin die de keuzes naast wie er meegaat legt
      (gezelligheid terwijl iemand alleen gaat, of stilte met gezelschap) en de twee sterkste leunrichtingen in
      beeldtaal (`leanLines`, nu ook vertrouwd of nieuw). Wie er meegaat wint van wat de beelden zeggen, zodat "op eigen
      tempo, in eigen gezelschap" nooit naast "met een partner" staat. Alles is vaste, geteste tekst (geen AI-laag: die
      kon later nog, maar vraagt een afweging over kosten voor niet-betalers); gift-neutraal geschreven, zonder het
      woord "wereld". `ProfileInput.place` en de zin over het praktische kader zijn vervallen. **(4) E-mail**
      (`layout.ts`, `windowPlan.ts`, `reminder.ts`): een licht, vriendelijker ontwerp in de kleuren van het logo (oranje
      knop, blauwe accenten, witte kaart op lichtblauw-grijs) zonder walnootbruin; een kopbeeld met vier ramen
      (`public/email/header.jpg`), per deur een miniatuur (`public/email/thumbs/`, 240 px, uit bestaande foto's,
      gemaakt door `scripts/make-email-assets.ts`), een opening "Je venster staat open" met het aantal deuren, het
      profielcitaat "Zo lazen we je", een blok "Begin klein" met de eerste stap van het makkelijkste idee
      (dezelfde keuze als "als je er maar één kiest"), de wildcard als eigen kaartje en de bestelgegevens en
      juridische teksten klein onder de kaart. Afbeeldingen alleen bij een publiek https-adres (`emailImages`); op
      localhost of een preview-adres zonder publiek domein bouwt de mail zonder beelden en blijft goed leesbaar
      (genummerde bolletjes i.p.v. foto's). Er is nu ook een platte-tekstversie (`text`), en `color-scheme: light only`.
      **Skill**: de find-skills-skill van Vercel (`vercel-labs/skills`) staat nu in `.claude/skills/find-skills/SKILL.md`
      (rechtstreeks van GitHub gekopieerd na de tekst gelezen te hebben, zonder `npx` uit te voeren).
      Getest: 451 unit-tests (nieuw: portretregels, tags zonder beeld, mailbeelden/-tekst/-kleuren, `emailImages`),
      `tsc`, lint, `npm run build`, 22 Playwright-tests; in de browser de richtingenpagina (nieuwe tegels, hintregel),
      de plaatspagina en het profiel met een echte keuze, en de mail als HTML op 800 en 375 px, met en zonder beelden.
      **Niet gezien**: de mail in een echt mailprogramma (Hotmail/Outlook) en met de beelden van het live domein (die
      staan pas online na een deploy); een Engelse weergave van de drie schermen in de browser.
      Open: `windowinto.nl` is nog niet in Resend geverifieerd, en de mailvoet toont nog de placeholder
      `[Bedrijfsnaam] · [KvK-nummer] · …`.

- [x] Stap 85 — Alleen realistische opties: ze bestaan, en ze passen bij het seizoen van het moment van vragen
      (op verzoek van Jan). Er was nergens met een seizoen rekening gehouden: de motor kon in oktober zwemmen in
      open water voorstellen, en het onderzoek zocht niet naar wat nu open is.
      **Seizoen in de motor**: nieuw optioneel veld `months` (1-12) op een activiteit
      (`src/lib/discovery/types.ts`, gevalideerd in `validate.ts`), ingevuld voor 25 duidelijk seizoensgebonden
      activiteiten in de bibliotheek (o.a. zwemmen in open water juni-september, schaatsen oktober-maart,
      paddenstoelen zoeken september-november, kanoën/suppen mei-september, imkeren, kamperen, via ferrata; wat het hele
      jaar kan blijft zonder `months`). `passesConstraints` laat een activiteit buiten zijn maanden vallen, ook als de
      persoon hem zelf koos (`EngineInput.month`, `ResolvedConstraints.month`); zonder maand wordt niet op seizoen
      gefilterd (oudere aanroepen, tests). De maand is die van Nederland (`src/lib/discovery/season.ts`, zodat een server
      rond middernacht UTC geen dag ernaast zit). De kaartenwizard, de voorbeelden onder de richtingen en de uit de
      beelden afgeleide interesses tonen en kiezen alleen wat in de maand van vragen kan. Evaluatie: de synthetische
      profielen lopen nu over alle twaalf maanden en E1 controleert het seizoen, met 0 schendingen.
      **Onderzoek** (`localResearch.ts`): de prompt noemt de datum van vandaag en eist dat een optie in de komende vier
      weken te doen is (niet gesloten voor het seizoen, geen verlopen evenement) en geeft een einddatum (`until`) waar de
      bron die noemt; opties met een verstreken einddatum vallen af. De cache is per maand (`plaats|stad|2026-10`) en een
      vermelding leeft nooit langer dan de einddatum van een optie. **Bestaat het echt?** Elke website uit het onderzoek
      wordt vóór het opslaan met een gratis HTTP-controle bekeken (`verifyUrls.ts`): een host die niet bestaat of geen
      openbare website is laat de optie vallen (ook tegen SSRF: geen IP-adressen, localhost of redirects volgen), een
      verdwenen pagina op een bestaande site wordt de voorpagina, een time-out/403/429 telt niet als bewijs van het tegendeel.
      **Geen aanbod gevonden**: een idee dat iemands aanbod nodig heeft (kosten > 0 of toezicht) en waarvoor het
      onderzoek echt niets vond, wordt één keer vervangen (`EngineInput.exclude`); alleen de nieuwe activiteiten worden
      onderzocht (`researchSeeds({ known })`), en blijft de vervanging niet beter dan de eerste selectie, dan blijft die met
      een notitie `no_local_offer:<id>`. Een mislukte onderzoeksronde telt niet als "geen aanbod". **Schrijven**: beide
      pijplijnen (motor en klassiek) krijgen de datum en seizoensregels in de prompt (geen buiten-het-seizoen-scènes, geen
      evenement of markt dat niet in het onderzoek staat, een einddatum noemen als die bekend is).
      **Echt gemeten** (één onderzoeksaanroep, Haiku, drie zoekopdrachten, ± $0,06): op 25 oktober vond "zwemmen in open
      water" niets (en wordt dus ook niet voorgesteld), "schaatsen" gaf een openluchtbaan met einddatum 26 december en een
      winterstation met einddatum 3 januari plus een jaarronde kunstijsbaan, en bij pottenbakken ving de websitecontrole een
      verzonnen bedrijf (`dekleiloods.nl`, host bestaat niet) af dat het model wel had teruggegeven.
      Getest: 485 unit-tests (nieuw: seizoenen en maanden, de motor per maand en met `exclude`, de websitecontrole met een
      nagebootste fetch, de onderzoeksprompt en cache per maand, de vervangingsronde met een nagebootst model), `tsc`, lint.
      Kosten: geen vaste extra kosten; alleen als een idee zonder aanbod wordt vervangen komt er één extra, kleine
      onderzoeksaanroep bij (±$0,03-0,06). **Niet gedekt**: websites die het schrijfmodel in de tekst noemt maar die niet in
      het onderzoek staan worden nog alleen gemeld (`unverified_website`), niet verwijderd; en of een bestaande aanbieder in
      werkelijkheid ook echt open is volgt uit wat de zoekresultaten zeggen, niet uit een eigen controle.

- [x] Stap 86 — De Idea Book-PDF in een "luxe collectable"-look: Ivoor & goud, met een groter en sierlijker
      lettertype (op verzoek van Jan, na een keuze uit drie voorgelegde opties: Ivoor & goud, Nachtblauw & goud en
      Zon & hemel, elk met de echte renderer gerenderd; de andere twee zijn weer verwijderd). **Kleur**: een
      object `theme` in `src/lib/pdf/ideaBook.ts` met diep leisteenblauwe inkt (#1F2A3C) op warm ivoor, goudfolie-lijnen
      (#A8812F / #D6B866) en een kleurlaag over de warme profielfoto; het donkere "Begin hier"-blok is nu blauwgrijs
      i.p.v. walnoot. Geen bruin meer in de kleuren; de foto's bij de ideeën zijn van zichzelf warm en zijn niet
      ingekleurd. **Omslag**: ivoor met een fijne dubbele gouden lijn om de pagina, een groter en lichter venster
      (300 pt breed, verguld kozijn met een dunne gouden boog), een ruitje onder de titel en onderaan
      `windowinto.nl`; de titel is 52 pt (was 32). **Lettertype**: Cormorant Garamond SemiBold en SemiBold Italic
      (SIL OFL, `src/lib/pdf/fonts/`, licentie `OFL-Cormorant.txt`) voor alle titels en voor het "waarom dit bij jou
      past"-citaat, het profielcitaat, de "hoe het voelt"-scène en de slogan; Newsreader en Plus Jakarta Sans blijven
      voor kleine tekst en labels. Groottes: ideetitel 34 pt (was 23), omslagtitel 52 (was 32), kaartkop 31
      (was 21), prijs 23 (was 16), "waarom"-tekst 15 italic (was 10,5), staptekst 10,5 (was 9,75). Een titel die te
      lang is zakt eerst in grootte (34, 28, 24) voor hij wordt afgekapt. Daarbij twee overlappingen opgelost (de
      eyebrow viel over de grote kop op de profiel- en kaartpagina) en de klassieke fotocover begint hoger, omdat de
      grotere titel anders naar een tweede pagina liep (de paginatelling-tests vingen dat op). `PDF_VERSION` is 6.
      `scripts/render-sample-pdfs.ts` is weer zoals voorheen. Getest: de pdf-tests (34), `tsc`, lint, en de
      voorbeeldboeken (17 / 18 / 10 pagina's) pagina voor pagina bekeken. **Niet gedaan**: de tekst op de ideepagina's
      is slechts 0,75 pt groter; veel groter past niet zonder blokken te laten vallen, dus als de lopende tekst ook
      "flink groter" moet, is dat een aparte afweging (minder blokken per pagina).

- [x] Stap 87 — Een zin met een zelfcorrectie in een echt boek ("Open degelijk.nl... nee, ga naar https://degezel.nl/...")
      gevonden bij het bekijken van de eerste echte PDF in de nieuwe look, en twee dingen gedaan. **Prompt**: beide
      schrijfprompts (motor en klassiek) kregen de regel "alleen definitieve tekst": geen zelfcorrectie, aarzeling
      of alternatief in een stap of actie, en elk webadres vóór het schrijven controleren tegen de geverifieerde opties
      en één keer, goed, opschrijven. **PDF**: staat het adres groot in het "Begin hier"-blok, dan noemt de zin eronder het
      niet nogmaals maar zegt "het adres hierboven" / "the address above" (`replaceUrl` in `ideaContent.ts`, label
      `addressAbove`). Getest: unit-tests voor `replaceUrl`, de pdf- en claude-tests (109) en een nagemaakt boek waarin
      het adres één keer staat. **Niet gezien**: of het model de zelfcorrectie met deze regel voortaan echt nalaat; dat
      blijkt pas in de volgende echte boeken.

- [x] Stap 88 — Pakket B van het variatieplan: meer richtingen, meer activiteiten, meer beelden en een motor die de
      lange staart optilt (op verzoek van Jan: "meer dynamische opties voor richting, plek, moment en zintuig, ook
      escape rooms, schietles, meswerpen, cave diving, klimmen"; keuzes: pakket B, gevaarlijke dingen alleen via een
      erkende aanbieder met instructeur en verborgen voor wie op "voorspelbaar" staat, zeldzaam aanbod alleen tonen als
      het onderzoek een aanbieder binnen bereik vindt, alle nieuwe beelden meteen). Methode: eerst **divergeren** (ik
      bedacht per richting veel meer kandidaten dan ik wilde houden, langs vaste lenzen: werkwoord x omgeving x sociale
      vorm x intensiteit, "voor de kick", "stiekem toegankelijk", "een middag proberen", "wat doet het buitenland"), dan
      **convergeren** met vaste filters: dubbelingen eruit, bestaat het aanbod in Nederland, toezicht en wet (tier 2 met
      een notitie), seizoen, te fotograferen zonder mensen, nieuwe tagmix; vastgelegd in `docs/discovery-taxonomy.md`.
      Dat kostte geen API-geld: ik schreef de kandidaten zelf, de validator (`taxonomy:check`) filterde.
      **Bibliotheek 214 -> 423**: acht nieuwe richtingen (`adventure` Avontuur & adrenaline, `target` Mikken, werpen &
      precisie, `speed` Snelheid & vliegen, `mystery` Mysterie & speurwerk, `elements` Vuur & overleven, `food` Eten &
      proeven, `stage` Podium & show, `night` Avond uit; 25 nieuwe subgroepen, 5 nieuwe tags: speed, fire, performance,
      depths, chance) met 171 + 38 nieuwe activiteiten, dus 18 richtingen. Onder andere meswerpen, grotduiken, grotten
      verkennen, canyoning, abseilen, paragliden, kitesurfen, surfen, wadlopen, lockpicking, urbex-tour, bunkertocht,
      glasblazen, mes smeden, bushcraft, overlevingstraining, stand-up, goochelen, poker, pokeravond, silent disco, DJ-workshop.
      Alles wat toezicht vraagt (53 in totaal) heeft een tier-2-notitie "alleen via een erkende aanbieder of vereniging,
      met instructeur"; **laat die notities nog juridisch controleren** (schieten, boogparcours, bijl- en meswerpen,
      duiken, canyoning, parachute, kettingzaag, smeden, jetski). 20 curated combinaties erbij (`hybrids.json`, nu 50).
      **Nieuw veld `supply`** (`common`, `regional`, `rare`; `src/lib/discovery/types.ts`, gevalideerd): ook 43 bestaande
      activiteiten zijn gemarkeerd (nu 227 `common`, 167 `regional`, 29 `rare`). De generatie behandelt `regional` en `rare` nu als "heeft een aanbieder nodig"
      (`seedsWithoutSupply`): vindt het onderzoek niets binnen bereik, dan wordt het idee één keer vervangen; de motor
      zelf geeft `rare` een kleine straf (0,18) en `regional` een heel kleine (0,04), nooit voor wat de bezoeker zelf koos.
      Bewust niet gebouwd: de variant "als wildcard met 'dichtstbijzijnde …'": het vervangen is eenvoudiger en dekt
      dezelfde eerlijkheidseis; zeg het als je die variant toch wilt.
      **Beelden**: associatiekaarten 36 -> 63 families (189 kaarten; 27 nieuwe families voor spanning, kans, vuur,
      podium, diepte, dieren, miniatuur, verzamelen en nachtleven, elk met drie varianten), per ronde ziet iemand nog steeds
      negen uit nu 21 families (`chooseFamilies` repareert met wisselingen als het aantal families groot is, zodat elke
      as aan beide kanten minstens twee gevoelens houdt). **Richtingenpagina**: 10 van de 18 tegelijk, deterministisch
      per sessie, met "Andere richtingen tonen" (wat je koos blijft staan; `directionOrder`, `initialDirections`,
      `rotateDirections`). Voorbeeld-activiteiten onder elke richting komen vanzelf mee.
      **Motor** (alle harde regels ongemoeid): `Graph.rarity` (0..1, hoe ver een activiteit van de gangbare tagmix valt),
      een kleine bonus voor zeldzaam in elke richting en een grotere bij de wildcard (`RARE` in `select.ts`), de
      willekeur tussen bijna gelijke scores groter, en bij het lezen van de beelden telt een tag die de helft van de
      bibliotheek draagt minder (`tagIdf`) en krijgen zeldzame mixen een lift (`RARITY_LIFT`, `JITTER` in `associations.ts`).
      De grafiek onthoudt per paar de brug en gelijkenis (bij 423 activiteiten werd de unexpected-stap anders te traag).
      **Gemeten** (`scripts/discovery-variety.ts`, zelfde 300 synthetische profielen, oude en nieuwe code naast elkaar):
      beeld-intake (nu met 18 richtingen): populairste activiteit in 11% van de boeken (was 22%), top 10 neemt 12,3% van de
      plekken in (was 20,0%), 6,1 richtingen per boek (was 5,8), 366 verschillende activiteiten gebruikt; kaartenwizard: top
      10 10,5% (was 14,4%). De zeldzaamheid weegt per bezoeker iets anders (deterministisch uit de seed), anders worden
      dezelfde paar zeldzame activiteiten (sjoelen, 11%) de nieuwe hubs; "wandelen" staat nog op 11%. Een sterkere lift (0,5 en 0,6) gaf geen verbetering en is teruggedraaid. Harde regels E1-E6: 0 schendingen.
      De evaluatie-oracle (`evaluate.ts`, "niche krijgt eigen wereld") hield nog geen rekening met seizoen en gekozen plaats
      binnen/buiten; dat is gelijkgetrokken met de motor. Nieuwe tests: zeldzaamheid, aanbodstraf, spreiding over de
      bibliotheek (geen activiteit in meer dan een vijfde van de boeken), aanbod zonder kosten.
      **Beeldkosten**: ± $5,2 aan Gemini (23 vellen 3x3 + 10 losse voor 209 activiteiten en 8 richtingfoto's, 6 vellen voor
      54 kaartbeelden). Alle 209 activiteitsbeelden en 8 richtingfoto's zijn bekeken (contactvellen); drie bevatten kleine
      mensen (rib-boot, klein-festival, nachtmarkt): hun scène is herschreven maar het opnieuw maken mislukte.
      **Nog niet gedaan, wacht op Gemini**: 27 kaartbeelden (de negen nieuwe zintuig-families) en die 3 herstelde
      activiteitsfoto's: Gemini gaf eerst een uitgavenlimiet (429) en daarna 402 (prepaid saldo op). Zodra je tegoed hebt:
      `npx tsx scripts/generate-discovery-illustrations.ts --associations --sheet 3x3` (≈ $0,40) en
      `... --force --only rib-boot,klein-festival,nachtmarkt` (≈ $0,40). Tot dan toont de wizard een kaart zonder eigen
      beeld niet (`hasOwnImage`), dus nooit een verkeerd plaatje bij de verkeerde woorden; de zintuigronde heeft dan de
      oude 12 families. `taxonomy:check` meldt hoeveel kaarten wachten.

- [x] Stap 89 — "Ik krijg telkens geen e-mail van het boek op pootjm@hotmail.com". **Onderzocht**: in de database
      hebben alle recente betaalde boeken `recipient_email = pootjm@hotmail.com` maar `email_sent_at = null` en
      `audit_log.email_delivered = false` (laatste: bestelling WI-2026-000020, 25 okt 19:37): het versturen is dus elke
      keer geprobeerd en mislukt. Lokaal werkt het wel: een gewone testmail én de echte bevestigingsmail van dat boek (PDF 1,6
      MB als bijlage, zelfde code als in de app) werden door Resend geaccepteerd met `onboarding@resend.dev`. De
      bestelling is dus op Jans omgeving (Vercel `testomgeving`) mislukt; de fout stond alleen in het serverlog, en de
      Vercel-logs kan ik niet lezen. **Meest waarschijnlijke oorzaak** (niet bewezen): `EMAIL_FROM` daar wijst naar
      `windowinto.nl`, dat in Resend nog niet geverifieerd is (open sinds Stap 51); Resend weigert dan elke mail.
      **Aangepast**: (1) `sendEmail` (`src/lib/resend.ts`) probeert bij precies die weigering ("domain is not verified") één
      keer opnieuw vanaf `onboarding@resend.dev`: in een testomgeving komt de mail dan aan op het adres van het
      Resend-account (dat is dat van Jan); voor iedereen anders weigert Resend het opnieuw en blijft de fout gewoon een fout
      (er gaat dus nooit iets verkeerd of onopgemerkt weg); met tests. (2) Een mislukte mail laat nu zijn reden achter:
      `window_plans.progress_meta.email_error` (geen migratie nodig, zichtbaar als "E-mailfout" op de admin-orderpagina), zodat
      de volgende keer de echte oorzaak uit de database te lezen is. **Echte oplossing voor klanten, buiten de code**:
      `windowinto.nl` verifiëren in Resend (DNS-records) en `EMAIL_FROM` in Vercel op `WINDOW <hello@windowinto.nl>` zetten.
      Dit werkt pas op Vercel na een deploy. Getest: `tsc`, lint, 17 e-mailtests.

- [x] Stap 90 — Vertalingen, taal naar IP, controle van de feedback en een bruikbaarder admin (verzoek van Jan na zijn
      testbestelling op Vercel). **Eerst de e-mail**: de laatste bestelling mislukte weer met "Missing API key" op Vercel; die
      omgeving had de sleutel nog niet (Jan zette hem erbij en deployde opnieuw; het resultaat van zijn nieuwste bestelling
      is hierna nog niet in de database gezien). De fout over de PDF die hij kreeg was een localhost-link uit mijn eigen
      testmail, niet de bijlage.
      **Vertalingen (audit)**: de woordenlijsten zelf waren in orde (nl/en hebben dezelfde sleutels, geen Nederlandse tekst in
      de Engelse lijst). Gevonden en opgelost: (1) Engelse boeken bevatten Nederlandse woorden: "Gratis" als prijs (de prompts
      noemden dat woord letterlijk als voorbeeld, net als "een lokale vereniging", "vanaf ±€10" en "Een dagdeel"): de prompts
      zijn nu taalneutraal (`{{FREE}}` en voorbeelden in de taal van het boek) en `localizeBook` (nieuw, met tests) vervangt
      achteraf "Gratis/vanaf/prijs varieert" door het Engelse equivalent in een Engels boek en andersom; (2) de notities bij
      "echte plekken" kwamen soms in het Nederlands in een Engels boek (het model nam de tekst van de website over): de
      onderzoeksprompt eist nu vertalen en de onderzoekscache heeft een nieuwe sleutel (`|v2`) zodat oude Nederlandse notities
      niet blijven hangen; (3) "Gemeente Groningen" als plaats in de kop van een Engels boek: `displayPlace` laat "Gemeente" en
      "Provincie" weg; (4) een hardcoded Nederlandse tooltip in `PillSlider`; (5) formeel "u" in twee labels ("Wat heeft u
      nodig", "Dit kunt u nu doen") nu "je"; (6) er was geen 404- of foutpagina: nu `not-found.tsx` en `error.tsx`, in de taal
      van de bezoeker. Een boek blijft geschreven in de taal waarin het venster is geopend; zit die taal niet gelijk aan die
      van de site, dan staat er op `/plan` een korte uitleg. Een gedeeld boek (`/shared/[id]`) toont het boek in zijn eigen taal
      met de kop en voet in de taal van de bezoeker; dat is zo gelaten.
      Gecontroleerd in de browser, Engelse modus: landing, alle intakeschermen (7) tot en met het profiel, betaalpagina,
      wachtscherm, het boek, privacy, voorwaarden, herroeping, delen en 404: geen Nederlandse tekst meer behalve die uit
      oude boeken en Nederlandse plaatsnamen uit PDOK. Niet gezien: de PDF en e-mail van een nieuw Engels boek (de oude
      Engelse PDF is gescand: alleen "Gratis" en de Nederlandse plaatsnotities).
      **Taal naar IP** (`detectLocale` in `src/lib/locale.ts`, `getLocale` leest de header `x-vercel-ip-country`): zonder gekozen taal
      start NL, BE (en de Nederlandstalige gebieden) in het Nederlands, elk ander land in het Engels, behalve als de eerste taal
      van de browser Nederlands is (een Nederlander op vakantie). De toggle blijft altijd winnen (cookie). Alleen het
      landnummer wordt gelezen, het IP-adres zelf niet en er wordt geen cookie voor de afgeleide taal gezet. Dit vervangt de
      vroegere regel "nooit browser-gedetecteerd". Lokaal (zonder landheader) beslist de browsertaal, zonder beide Nederlands.
      Met tests; niet gezien op Vercel zelf met een buitenlands IP.
      **Feedback**: het formulier onder het boek werkt (lokaal ingevuld, rij in `test_feedback`, daarna weer verwijderd); het
      staat alleen aan met `NEXT_PUBLIC_TEST_FEEDBACK=1`.
      **Admin** (wachtwoord als altijd): `/admin` is nu een **Overzicht** (aandacht nodig, boeken per dag, duur, mislukt/blijft
      hangen, e-mail verstuurd met de foutreden, betalingen en omzet, hartjes en gekozen ideeën, taal), nieuw
      **Feedback** (scores met verdeling, betaalintentie, soort deur, opmerkingen, uitleg hoe je het leest, CSV-export),
      nieuw **Inhoud** (meest voorgestelde activiteiten en richtingen, wat mensen invullen, de bibliotheek per richting,
      nooit voorgestelde activiteiten), **Orders** met de e-mailfout per order en het **Logboek** (het oude `/admin`) op
      `/admin/logboek`. Alle cijfers komen uit `src/lib/adminStats.ts` (puur, 9 tests). De pagina's zelf zijn niet als ingelogde admin
      gezien: de beveiliging weigerde mij het wachtwoord of de sessietoken te gebruiken; wel gezien: de gedeelde onderdelen
      met voorbeeldgegevens, type- en lintcontrole en de build.

- [x] Stap 91 — E-mail nog steeds "Missing API key" op Vercel (de nieuwste bestelling in de database, 22:29 UTC, mislukte
      daar opnieuw, ná Jans eerdere aanpassing van de variabelen; of er daarna nog een test is gedaan is niet te zien).
      Ik kan Vercel zelf niet inzien, dus de admin laat nu zien wat de draaiende site van zijn instellingen ziet: nieuw
      blok **Instellingen van deze deployment** op `/admin` (`src/lib/adminEnv.ts`, met tests): Vercel-omgeving
      (production/preview), of `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_SITE_URL` (waarschuwt voor localhost),
      Anthropic, Stripe (test of live), Supabase en de optionele sleutels aanwezig zijn. Alleen aanwezigheid en niet-geheime
      waarden, nooit een sleutel; ontbrekende verplichte instellingen staan ook onder "Aandacht nodig". Zo is in één
      oogopslag te zien of de sleutel in de juiste omgeving terecht is gekomen.

- [x] Stap 92 — Testgegevens opruimen vanuit de admin (nieuw tabblad **Opruimen**, `/admin/opruimen`, op verzoek van Jan:
      "de oude gegevens verwijderen zodat de testfase de echte gegevens niet vertekent"). **Veiligheid vooraf bedacht**: (1) een
      echte order wordt nooit verwijderd, welke datum je ook kiest (een order is echt tenzij Stripe's eigen id een testsessie
      is, `cs_test_...`; de toestemming- en herroepingsregels van betalende klanten moeten bewaard blijven); er is bewust geen
      schakelaar om dat te omzeilen; (2) je kiest een datum ("alles tot en met") en wat weg mag: testboeken en testorders,
      onafgemaakte intakes, testfeedback, logboek; (3) eerst een voorbeeld met aantallen, dan alleen verwijderen door het woord
      VERWIJDER te typen; (4) het formulier bevat alleen de keuze, nooit rij-id's: de server bepaalt de selectie opnieuw
      (`src/lib/adminCleanup.ts`). Verwijderd wordt in een veilige volgorde: PDF-bestanden, testfeedback, boeken, orders (de
      toestemmingsregels van die test-orders gaan mee), sessies (met intake en apparaatgeheugen), logboek, en daarna de
      e-mailadressen van testers waar geen sessie meer aan hangt. De onderzoekscache en de bibliotheek blijven altijd staan.
      **Getest**: 4 unit-tests voor de selectie, en een echte proef tegen de database met verzonnen rijen uit 2020 (alleen die
      vielen binnen de datum): testsessie, boek zonder betaling en lege sessie met PDF, feedback, logboekregel en
      e-mailadres verdwenen; een verzonnen sessie met een betaling `cs_live_...` bleef staan en is daarna met de hand
      opgeruimd; alle tabelaantallen waren daarna weer gelijk aan ervoor. Daarbij een voorbeeld op de echte database
      (alleen lezen, niets verwijderd): alles tot en met vandaag zou 169 sessies, 175 boeken, 32 testorders, 154 PDF's, 4
      feedbackregels, 107 logboekregels en 5 e-mailadressen raken, en 0 echte orders bewaren. Niet gezien: de pagina zelf
      ingelogd (zelfde beperking als eerder).

- [x] Stap 93 — Testen met ± 50 bekenden, met een limiet van twee boeken per IP-adres (op verzoek van Jan). **Limiet**
      (`src/lib/testQuota.ts`, migratie `0021_test_quota.sql`, **nog handmatig uit te voeren**): aan met
      `TEST_MAX_BOOKS_PER_IP=2` (leeg of 0 = geen limiet, zoals bij de echte lancering). Van het IP-adres
      (`x-forwarded-for`, het eerste adres) wordt alleen een gesleutelde hash bewaard (HMAC, sleutel `IP_HASH_SECRET` of
      afgeleid van de Supabase-servicesleutel), per sessie in `test_quota`; de rij verdwijnt met de sessie. Wat telt is een
      gestart boek (pending of klaar); een mislukt boek kost de tester geen poging. De eigenaar (ingelogd op `/admin`) is nooit
      beperkt. Zonder leesbaar IP-adres (lokaal) of zonder tabel wordt niet beperkt (de site blijft werken, met een
      waarschuwing in het log). Afgedwongen op vier plekken: de intake (de bezoeker ziet een vriendelijke melding in plaats van de
      wizard), de betaalpagina, de acties "afrekenen" en "betaling overslaan", en als harde grens op het moment dat een boek
      wordt gestart (`getOrCreate*`); een bestaand boek openen blijft altijd kunnen. Meldingstekst nl + en
      (`venster.testLimit`), privacyverklaring kreeg een korte alinea "testfase" (**laat die tekst juridisch controleren**).
      Admin: de limiet staat in "Instellingen van deze deployment" en onder het Overzicht staat een blok "Testlimiet per
      internetverbinding" (hoeveel verbindingen, hoeveel op hun limiet); onder **Opruimen** is een vinkje "Tellers van de
      testlimiet" om iedereen weer het volle aantal te geven. **Een fout gevonden en gefixt**: de testmail van "Betaling overslaan"
      ging altijd naar Jans adres; met 50 testers had dat zijn inbox gevuld. Die mail gaat nu alleen nog als de eigenaar
      zelf is ingelogd. **Getest**: 6 unit-tests (limiet lezen, eerste IP, hash, beslissing), `tsc`, lint, en lokaal met de
      limiet aan en een IP-header: de intake blijft werken als de tabel nog ontbreekt (fail-open, waarschuwing in het log). **Niet
      gezien**: de limiet die echt bijt, want dat vraagt de migratie in de database; zodra die draait is dat te controleren
      met verzonnen rijen. Plan, kosten, werkwijze in drie golven, WhatsApp-berichten (nl + en) en controlelijst staan in
      `docs/testen-met-bekenden.md`.

- [x] Stap 94 — Een tester kon bij de Stripe-testbetaling het e-mailadres niet wijzigen (Stripe vult het veld vooraf in,
      bijvoorbeeld uit Link of uit de ingelogde Stripe-dashboardsessie, en dat voelt als vast). De betaalpagina heeft nu zelf
      een veld "Naar welk e-mailadres sturen we je boek?" (optioneel; leeg = het adres dat bij Stripe is ingevuld), dat als
      `delivery_email` in de Stripe-metadata gaat; `getOrCreateWindowPlan` kiest het ontvangersadres in de volgorde cadeau-adres,
      dit veld, Stripe-adres, en bewaart dat als `recipient_email` (ook voor de herinneringsmail). Het veld is verborgen als
      "dit is een cadeau" aan staat (dat adres gaat voor). Copy nl + en. Het e-mailadres bij Stripe zelf is op dit niveau niet
      te sturen (zet je `customer_email` mee, dan wordt het bij Stripe juist vergrendeld). Niet gezien in de browser met een
      echte Stripe-sessie; wel typecontrole, lint en de tests van de betaalpagina.

- [x] Stap 95 — Instellingencontrole op Jans Vercel (production): alles goed behalve een **vals alarm** van mijn eigen
      controle: de Supabase-servicesleutel stond als ontbrekend terwijl de site werkt, omdat de app die sleutel ook onder de
      nieuwe Supabase-naam `SUPABASE_SECRET_KEY` leest (`src/lib/supabase/env.ts`) en mijn controle alleen de oude naam
      kende; nu kent `adminEnv.ts` beide. Daarbij een echte zwakte gevonden en gefixt: de hash van het IP-adres (testlimiet)
      leidde zijn sleutel af van alleen `SUPABASE_SERVICE_ROLE_KEY`; bij een sleutel onder de andere naam was dat een
      lege, dus bekende sleutel (te raden). Nu wordt dezelfde resolver gebruikt als de rest van de app, en de admin raadt aan
      een eigen `IP_HASH_SECRET` te zetten. Afzender staat op `info@vantagelabs.nl`: die moet in Resend geverifieerd zijn.
      Nog open: `STRIPE_WEBHOOK_SECRET` (betalingen blijven 'pending', omzet 0), `NEXT_PUBLIC_POSTHOG_KEY` (geen
      gedragsmeting, nodig voor de funnel), `CRON_SECRET` (herinneringsroute open).

- [x] Stap 96 - Kennisengine, Stage A (audit en voorstel; `WINDOW_Bouwopdracht_Kennisengine.md`). **Geen applicatiecode
      veranderd**, geen betaalde aanroepen (EUR 0). Nieuw: `docs/knowledge-engine-audit.md` (code-audit, nulmeting,
      diagnose, voorstel, open besluiten K1-K10) en `docs/knowledge-sources.md` (bronnenregister S1-S5); enige andere
      wijziging: `/data/sources/raw/` in `.gitignore` (de downloads staan daar, ongecommit). **Belangrijkste bevindingen
      (alles gemeten)**: dekking is niet het hoofdknelpunt (375-398 van 423 activiteiten gebruikt in 500 boeken, populairste
      11%), wel dun in digitaal/gaming (+-20), persoonlijke uitdagingen (6) en er is geen "thuis"-facet; de blokken
      "invulling/overhouden/maak het van jou" komen uit 10 vaste type-sjablonen en spreken soms het idee tegen; in de
      beeld-intake worden afgeleide activiteiten aan de schrijver als "gekozen" voorgesteld; "Als je er maar een kiest" is
      in 72-88% van de boeken de onverwachte deur (richtingconstanten, geen passendheid); 4 activiteiten met onbekende
      kosten passen door het filter "gratis" (25-37% van de gratis-boeken); `chain` wordt opgeslagen maar nergens getoond;
      harde regels E1-E6 blijven 0 overtredingen in 3 x 500 profielen. **Bronnen**: S3 Wikidata (CC0) bruikbaar, klein;
      S2 alleen als naamlijst (AI-gegenereerd); S1 (CC BY-NC-ND), S4 en S5 afwijzen. **Voorstel**: B1 harnas eerst, dan
      activiteit-specifieke invulling + eerlijke gedachtegang, dan stapsgewijze ranking, pas daarna gerichte dekking.
      Gedraaid: `taxonomy:check` (0 fouten), `vitest run src/lib/discovery` (167 tests), shadow-runs en eigen metingen;
      niet gedraaid: de volledige `npm test`, tsc, lint, build (geen code veranderd). Wacht op akkoord van Jan voor Stage B.

- [x] Stap 97 - Kennisengine, B1: evaluatieharnas (branch `kennis`, afgetakt van `main`; Jan gaf "Start B1"). **Gratis en
      deterministisch**: geen enkele API-aanroep, EUR 0. Nieuw: `scripts/eval/profiles/P01-P20.json` (20 vaste profielen:
      17 beeld-intake, 3 kaartenwizard, 4 randgevallen, 2 cadeaus, vaste `seed` en `month`), `scripts/eval/run.ts`
      (`--engine current|v2`, `--profiles all|synthetic-cards|synthetic-images`, `--seeds-only` standaard, `--full`),
      `scripts/eval/blind-sheet.ts` (blinde A/B-HTML met de vijf rubricvragen, aparte sleutel, CSV-export, telling),
      `src/lib/discovery/eval/` (profielen, engine-register, runner, metingen, controles, resultaat, rapport, sheet),
      `scripts/eval/baseline/current.json` (seeds van de huidige motor), `docs/eval/` (README + rapporten van 2026-10-27).
      **Controles in `npm test`** (25 tests): harde grenzen (E1/E3/E4/E5/E6), duplicaten (id en genormaliseerde naam),
      spreiding (>= 4 werelden, >= 3 fotocategorieen), precies een wildcard; voor boeken `first_action` aanwezig (fout) en
      concreet (waarschuwing) en een exacte prijs, openingstijd of straat zonder bron in het onderzoek van dat idee (fout);
      een momentopname-test op `current.json`; en een test dat `--full` zonder bevestigd bedrag niets draait (exitcode 2) en
      `--engine v2` wordt geweigerd. **Reproductie van de nulmeting**: dezelfde 500 synthetische bezoekers (seed `ke-1`)
      geven met het harnas exact de cijfers van het auditrapport (o.a. 6,01 / 6,18 werelden per boek, 41,2% / 45,8% boeken met
      een paar dat >= 2 tags deelt, "Als je er maar een kiest" = onverwacht in 72% / 88%, 23/91 en 43/116 gratis-boeken met
      onbekende kosten); rapporten in `docs/eval/`. **Twee keuzes buiten de opdracht**: (1) `applyImageIntake` kreeg een optionele
      vierde parameter `month` (standaard `currentMonth()`, gedrag ongewijzigd) zodat een run niet van de datum afhangt;
      (2) het orakel in `engine/evaluate.ts` (E1) keurde een tegenstrijdige wens ("buiten of binnen") af, terwijl de motor die
      volgens `parseMustHaves` terecht negeert: het orakel telt nu alleen een enkelvoudige wens als harde grens (gevonden door
      mijn eigen randgeval P10; 6 vals-positieve overtredingen weg, de motor zelf is niet aangepast). Gedraaid: `tsc --noEmit`,
      `eslint src scripts e2e`, `taxonomy:check`, `npm run build`, volledige `npm test` (61 bestanden, 549 tests geslaagd).
      Niet gedaan: `--full` is nooit uitgevoerd (alleen de blokkade getest); `v2` bestaat nog niet.

- [x] Stap 98 - Kennisengine, B5: V1 en V2 (branch `kennis`, Jan gaf "Start B5"; keuze volgens audit K3). **Alles achter de vlag
      `KNOWLEDGE_ENGINE_V2`** (`src/lib/knowledgeFlags.ts`, standaard uit, accepteert 1/true/yes/on): zonder vlag is het gedrag
      onveranderd (bestaande tests bewijzen dat o.a. het laagschema nog exact `feels_like, sizes, next_step` heeft). Geen betaalde
      aanroepen gedaan, EUR 0; de kosten van de aanpassing zijn dus nog **niet gemeten** (schatting uit de audit: +$0,005-0,012 per boek).
      **V1, activiteit-specifieke invulling**: de parallelle laagcall schrijft met de vlag ook `timeline` (4 regels), `takeaways` (3)
      en `suggestions` (3) per idee (`FILL_PROMPT_RULES`, schema-uitbreiding in `generateFromSeeds.ts`); ze komen als `fill` op het idee
      (`IdeaBookEntry.fill`). Nieuw `src/lib/claude/ideaFill.ts`: `checkFill` (exact 4/3/3 regels, elk <= 110 tekens, anders weg, nooit
      afgekapt) en een deterministische **controle op tegenspraak** (`fillContext`, `lineConflict`, `fillConflicts`, `withoutConflicts`):
      wie alleen gaat krijgt geen "neem iemand mee" of "nieuwe gezichten", een online-only idee geen pinpas of parkeren, een binnenidee
      geen regenjas (nl + en; alleen bij een bekend feit). Een fill die conflicteert of onvolledig is wordt weggelaten en gelogd als
      `ideaN:fill_conflict (...)` of `ideaN:fill_dropped (...)`; de rest van het boek blijft heel. De PDF (`ideaBook.ts`,
      `scheduleFromLines` in `ideaContent.ts`) drukt de eigen regels af als ze er zijn en geldig zijn, anders de oude sjablonen; met de
      vlag aan worden ook sjabloonregels die het idee tegenspreken overgeslagen (de vier tijdlijnregels van een sjabloon niet: dat zijn
      vaste posities). Pagina-aantal ongewijzigd (10), gecontroleerd met een gerenderd voorbeeld.
      **V2, eerlijke herkomst en zichtbare keten**: (a) alleen voor de beeld-intake noemt `why()` een door ons afgeleide activiteit niet
      meer "gekozen" ("Reached from their images, not picked by them: ..."), en de schrijfprompt krijgt `HONEST_ORIGIN_RULE` ("the
      person chose IMAGES, not activities"); de kaartenwizard blijft zoals het was (daar kiest de persoon wel activiteiten). (b) de
      opgeslagen `chain` is zichtbaar: `buildIdeaThreads(..., { showPath })` voegt `path` toe (de activiteiten tussen beeld en deur,
      nooit de deur zelf) en `IdeaThread` toont een extra schakel met het onderschrift "Waar je beelden naartoe wezen: door ons
      afgeleid, niet door jou gekozen"; de PDF-zin krijgt er "Onderweg kwamen we langs X: dat leiden wij uit je beelden af..." bij
      (nl + en, `pathCaption`/`pdfPath`). Niet gebouwd: een keten voor boeken van de kaartenwizard (die hebben geen draad op `/plan`).
      **Getest**: 580 tests geslaagd (nieuw: `ideaFill.test.ts`, `generateFromSeeds.v2.test.ts`, `ideaBook.fill.test.ts`, 6 in
      `ideaThread.test.ts`), `tsc --noEmit`, eslint, `taxonomy:check`, `npm run build` schoon; de ene vitest-worker-time-out
      ("Timeout calling onTaskUpdate") staat er nog, ouder dan deze stap. **Niet gedaan**: een echte generatie met de vlag aan (wacht op
      Jans akkoord op een bedrag, zie B6), de websitevariant van de zichtbare keten voor boeken zonder draad, en de blinde vergelijking.

- [x] Stap 99 - Kennisengine, B6 (eerste, kleine betaalde vergelijking; Jan gaf "twee profielparen, max $1,00"). **Geen go/no-go**:
      twee profielparen zijn een eerste indruk, geen 60%-voorkeur. Gebouwd (gratis): engine `v2` in het harnas (dezelfde selectie als
      `current`, vastgelegd door een test; boek geschreven en gerenderd met `KNOWLEDGE_ENGINE_V2` aan), `--engine current,v2`, `--only`,
      `--max-usd` met een budgetmeter (`src/lib/discovery/eval/budget.ts`: rekent elk antwoord uit zijn eigen `usage` en start geen
      aanroep of boek meer dat het totaal over de grens kan brengen), `--book-reserve`, kosten/seconden/meldingen/invulling per boek in
      het rapport, een PDF per boek (`docs/eval/books/`, niet in git), en de nieuwe invulregels vallen onder de controle op prijzen en
      openingstijden zonder bron. Een `--full`-run gebruikt voor alle profielen de maand van vandaag. **Gedraaid**: P01 (stille creatieveling,
      alleen, Utrecht) en P12 (cadeau, duo, Haarlem), elk met de huidige versie en met v2, `sessionId` gelijk zodat de seeds gelijk zijn;
      **totaal $0,809 van de $1,00** (3 boeken in de eerste run $0,705, daarna het vierde apart: de reserve van $0,30 per boek paste
      toen niet meer onder de grens terwijl dat boek met cache ±$0,10 kostte). **Kosten**: onderzoek kostte bij een koud boek
      $0,20-0,24 (twee rondes: ook de vervangingsronde van Stap 85; veel meer dan de $0,10 van Stap 56-78) en is het grootste deel van
      $0,28-0,32 per ongecachet boek; alleen het schrijven: huidig $0,083, v2 $0,099 (P01) en $0,104 (P12), dus **+$0,016-0,021 per
      boek (+19-25%)**, meer dan de audit-schatting van +$0,005-0,012. **Tijd**: de laagcall is nu de lange (P01: 31 s -> 55 s, het
      schrijven duurt ±36 -> ±55 s). **Inhoud** (gelezen, niet gemeten): v2 gaf 14/14 ideeën een eigen invulling, geen `fill_dropped` of
      `fill_conflict`; de invulling is activiteit-specifiek en past bij alleen/duo (huidig: een café-sjabloon bij een zuurdesemworkshop);
      de herkomst klopt beter (huidig: "Je koos kalligrafie", "Je dacht aan een cosplay-outfit" terwijl dat afgeleid is; v2: "wees naar",
      "dit komt nergens uit je beelden vandaan"). **Gevonden zwakke punten van v2**: (1) P01 idee 5: de invulling zegt "je soldeert" terwijl
      de eerste stap een gratis softwaresynthesizer (VCV Rack) is: de tegenspraakcontrole ziet alleen alleen/online/binnen, niet dit;
      (2) vijf van zeven tips in P01 beginnen met "Noteer ...": herhaling; (3) de controle `first_action:vague` waarschuwt bij P01 idee 4.
      Bij de huidige versie vond de controle een fout in P12 (openingstijden "13.00-17.00" zonder bron); dat is één boek en dus geen bewijs
      dat v2 dat beter doet. Harde regels E1-E6: 0 in beide. **Blinde vergelijking**: `docs/eval/blind-b6-ronde-1.html` met
      `docs/eval/books-blind/P01-A.pdf` ... `P12-B.pdf`; de sleutel staat in `blind-b6-ronde-1.key.json` (niet openen voor je klaar bent; het
      blad toont alleen titel, intro, waarom en eerste stap, de invulregels staan alleen in de PDF's). Gates: `tsc`, eslint, `taxonomy:check`
      (0/0), `npm run build`, volledige `npm test` (64 bestanden, 586 tests; dezelfde ene vitest-worker-time-out). **Uitslag van Jans blinde beoordeling** (achteraf met de sleutel
      vergeleken): hij koos "voorstel B, duidelijk beter"; B was in beide profielen v2 (A = huidig). Eén beoordelaar (de bouwer van het product), twee
      profielen, de vijf rubricvragen niet apart ingevuld: een duidelijk signaal, geen vaststelling van de 60%-drempel. **Niet gedaan**: de
      overige 18 profielen, een tweede beoordelaar, de go-criteria ingevuld.

- [x] Stap 100 - Kennisengine, de twee zwakke punten van v2 (uit Stap 99), met een kleine betaalde controle (Jan: "Akkoord, draai het", daarna
      max. $0,30 in totaal; uitgegeven **$0,201**). **Punt 1, fill spreekt de route van het idee tegen** (P01 idee 5: tijdlijn "je soldeert",
      eerste stap "download VCV Rack"): oorzaak is dat de laagcall en de ideeëncall tegelijk lopen en elk een eigen route kozen. Opgelost met
      dezelfde route in beide prompts (alleen met de vlag): de tijdlijnregel in `FILL_PROMPT_RULES` en een nieuw blok `ROUTE_CONSISTENCY_RULE`
      in de ideeënprompt ("Easy way in" is de route; nooit van medium wisselen). Bewust **geen** deterministische controle: die zou op
      trefwoorden moeten leunen en goede invullingen onterecht weggooien. **Punt 2, herhaalde "Noteer ..."-tips**: de suggestieregel vraagt nu
      variatie over de 21 regels van het boek (geen werkwoord vaker dan twee keer, notitietips hooguit twee keer, eerst nakijken);
      `repeatedOpenings` (`ideaFill.ts`) meldt een openingswoord op meer dan drie suggesties als `fill_repetitive (woord xN)` in de log van de
      pijplijn en als waarschuwing `fill:repetitive_opening` in het harnas (nooit een reden om een regel te laten vallen: drie zijn verplicht).
      **Eerste controle ($0,101)** liet een fout in mijn eigen prompt zien: de Engelse voorbeeldwerkwoorden ("ask, photograph, compare, ...")
      werden in de Nederlandse tips overgenomen ("Ask de begeleider", "Photograph je plant"), en "Kies" stond er 5 keer in. Prompt aangepast:
      geen voorbeeldwerkwoorden meer, "geschreven in {{LANGUAGE}}, ook het eerste woord", en "controleer de 21 openingen voor je antwoordt".
      **Tweede controle ($0,100, P01 v2)**: de Engelse woorden zijn weg, "Noteer" staat er nog 1 keer, de route is consistent (idee 5: eerste
      stap een DJ-workshop uit het onderzoek, tijdlijn zonder solderen), maar **"Kies" staat nog 4 keer** (grens 2): de variatieregel werkt
      maar half. Schrijven nog ±53-58 s en $0,100-0,101 (cache warm). **Niet gedaan**: P12 opnieuw (paste niet meer in $0,30: ±$0,10 per boek),
      een tweede beoordeling, en de "Kies"-herhaling is niet opgelost (alleen gemeld). Nieuwe `--call-reserve` in het harnas. Resultaat van
      de laatste controle: `docs/eval/2026-10-27-v2-fixcheck-P01-full.*`. Gates: `tsc`, eslint, `taxonomy:check` (0/0), `npm run build`, volledige `npm test` (64 bestanden, 591 tests; dezelfde ene vitest-worker-time-out).

- [x] Stap 101 - Kennisengine, B4: ranking in stappen (Jan: "Laat het zo, ga door met de volgende fase"; **de gewichten en het effect zijn aan Jan getoond vóór de commit**, zie hieronder). **Achter `KNOWLEDGE_ENGINE_V2`**: zonder vlag is de selectie bit voor bit die van vóór B4 (de baseline-test op de 20 profielen en de twee regressiereeksen van 200 slagen ongewijzigd). **Nieuw `engine/weights.ts`**: alle getallen die de selectie sturen (zeldzaamheid, aanbodstraf, redundantie, ruis, hybride, aangrenzend, stretch, wildcard) staan er met uitleg, in twee sets: `WEIGHTS_CURRENT` (exact wat draaide) en `WEIGHTS_V2`; `selectSeeds(input, lib, { weights })`. **Wat v2 doet**: (1) stap 4 diversiteit: `sharedPairPenalty` 0,45 voor elk al gekozen idee dat twee of meer echte tags deelt met dit idee (een MMR-achtige straf bovenop de bestaande brugstraf); (2) stap 2 harde grens: `strictFreeCost`, een onbekende prijs komt niet meer door een gratis budget of "gratis" in de vrije tekst (onbekend is nooit gunstig; de oracle E1 en de "ook in deze richting"-lijst volgen dezelfde regel); (3) stap 6 uitleg: elk zaad krijgt `fit` (gemeten relevantie 0..1: 1 voor een eigen keuze, anders de gelijkenis met de dichtstbijzijnde keuze, 0,5 als er niets is om mee te vergelijken) en `reasons[]` (`picked`, `bridge:...`, `chain:...`, `new_world`, `verify:...`, `direction:...`), die op het idee worden bewaard; (4) "Als je er maar één kiest" (`possibilityMap.ts`) gebruikt bij boeken met `fit` de gemeten fit (0,32) naast haalbaarheid (0,30), nieuwheid (0,19) en verrassing (0,19); boeken zonder `fit` blijven zoals ze waren. **Gemeten** (gratis, 3 x 500 synthetische bezoekers per wizard plus de 20 vaste profielen, `docs/eval/2026-10-28-b4-ranking.md`): 0 overtredingen van de harde regels E1/E3/E4/E5/E6; boeken met een paar dat 2 of meer tags deelt 24,0-28,8% (was 38,4-46,2%); gratis-boeken met onbekende kosten 0 (was 17-57); fotocategorieën per boek 5,04-5,11 / 5,31-5,35 (niet lager); onverwacht als One Thing 19-34% (was 70-91%), vertrouwd 50-72%; de zachte criteria gelijk of iets beter. **Niet (helemaal) gehaald**: werelden per boek 5,97 en 5,98 op twee van de drie kaartenreeksen (onder de 6,0 van het criterium, maar niet lager dan de huidige motor: 5,95 en 5,98); populairste activiteit 12,2% (`wandelen`, beeld-intake, ke-3; huidig 13,0%) tegen de grens van 12%; en `online-cursus` is bij de beeld-intake een nieuwe populairste activiteit (11,0-11,6%). **Gevoeligheid**: de verdeling van One Thing is een knife edge (0,02 meer gewicht op `fit` verschuift het aandeel onverwacht met ± 10 punten); opnieuw meten na elke wijziging. **Bewust niet gedaan**: het facet `niveau` (bibliotheekdata, geen gewicht), de graaf en de deurlogica, het tonen van `reasons` in de app, en een blinde beoordeling van de selectie zelf (de blinde vergelijking van B6 ging over de tekst). **Een fout onderweg**: `v2` werd in `generateFromSeeds` gedeclareerd ná het eerste gebruik in de selectie; de volledige testreeks vond dat (25 tests), met een test erbij dat de vlag aan `fit` en `reasons` oplevert en de vlag uit niets. Gates: `tsc`, eslint, `taxonomy:check` (0/0), `npm run build`, volledige `npm test` (65 bestanden, 604 tests; dezelfde ene vitest-worker-time-out). Gewichten en effect zijn door Jan gezien en akkoord bevonden (commit na zijn "Commit en push").

- [x] Stap 102 - E-mail met de PDF komt niet aan bij andere adressen dan dat van Jan: oorzaak vastgesteld en de pagina
      spreekt de waarheid. **Oorzaak (gemeten, niet te fixen in code)**: in de database staat bij elke mislukte order de
      weigering van Resend: "You can only send testing emails to your own email address (pootjm@hotmail.com)... verify a domain
      at resend.com/domains". Zolang het domein van `EMAIL_FROM` (op Vercel `info@vantagelabs.nl`) niet in Resend is
      geverifieerd, stuurt Resend alleen naar het adres van het eigen account. De nieuwste betaalde order naar
      pootjm@hotmail.com is wel aangekomen (zelfde code, PDF als bijlage), dus de bijlage en de verzendcode werken. De
      Resend-sleutel is "restricted to only send emails" en kan geen domeinstatus lezen; dat moet Jan in het dashboard zien.
      **Wat Jan moet doen**: (1) resend.com/domains, domein toevoegen (windowinto.nl of vantagelabs.nl) en de DNS-records
      (SPF, DKIM, eventueel DMARC) bij de domeinhost zetten tot de status "Verified" is; (2) in Vercel `EMAIL_FROM` op
      `WINDOW <hello@<geverifieerd-domein>>` zetten; (3) opnieuw deployen; (4) testen met een bestelling naar een ander adres
      dan pootjm@hotmail.com. **Code (klein, geen verzendgedrag veranderd)**: (a) `/plan` zei altijd "We hebben ook een kopie
      gemaild" (`showEmailedCopy={!testSessionId}`), ook als de mail was mislukt; nu alleen als `email_sent_at` gezet is, en bij
      een vastgelegde mislukking staat er "De e-mail met je boek is niet aangekomen. Download de PDF hier" (`emailNotSent`, nl +
      en); tijdens het versturen (boek is al klaar, mail nog niet) verschijnt geen van beide; (b) `src/lib/emailErrors.ts`
      (`explainEmailError`, met tests) vertaalt de bekende Resend-fouten naar oorzaak en oplossing in gewoon Nederlands; de admin
      toont die onder "Aandacht nodig" en op het orderdetail ("Oorzaak en oplossing"). **Niet gedaan**: een knop "mail opnieuw
      versturen" in de admin voor mislukte orders (nuttig zodra het domein geverifieerd is; zeg het als je die wilt). Gates:
      `tsc`, eslint, `npm run build`, volledige `npm test` (66 bestanden, 607 tests; dezelfde ene vitest-worker-time-out).

- [x] Stap 103 - Kennisengine, B6 ronde 2 (Jan: "Doe B6, met budget van $1,20"; uitgegeven **$1,124**). Drie nieuwe profielen,
      elk met de huidige versie en met v2 (`--engine current,v2 --full`, harde grens `--max-usd 1.2`): P03 (avontuurzoeker met geld),
      P05 (gezin met kinderen, Utrecht) en P18 (kaartenwizard, avondje met vrienden, Haarlem). **Gelukt: P03 en P05** (4 boeken).
      **Niet gelukt: P18**: het onderzoek voor dat profiel kostte $0,17 en daarna bleef er onder de reserve per boek te weinig
      over om te schrijven; een tweede poging met kleinere reserves schreef alleen het huidige boek ($0,078) en kon v2 niet meer
      betalen. P18 is dus **niet** in de blinde vergelijking en de halve resultaten zijn verwijderd (het onderzoek staat wel in de
      cache). Dus samen met ronde 1 vier profielparen (P01, P12, P03, P05), niet de zes of meer waar de go-criteria om vragen.
      **Gemeten**: harde regels E1/E3/E4/E5/E6 0 overtredingen in beide; de selectie was voor P03 en P05 gelijk in beide versies, dus
      verschillen zitten in het schrijven en in "Als je er maar één kiest" (huidig: onverwacht in 100%; v2: vertrouwd 67%,
      onverwacht 33%). v2: 14 van 14 ideeën met eigen invulling (huidig 0 van 14), geen `fill_dropped` of `fill_conflict`. Meldingen:
      v2 `fill_repetitive (vraag x4)` bij P05 (de herhaling die in Stap 100 niet was opgelost, nu met "vraag" in plaats van "Kies"); huidig
      `unverified_website:booking.com` bij P05. Kosten: v2 $0,160 (P03, onderzoek deels uit cache) en $0,101 (P05, onderzoek geheel
      uit cache); huidig $0,290 en $0,242 (beide met koud onderzoek), dus niet direct vergelijkbaar; de meerkosten van alleen het
      schrijven blijven rond de +$0,016-0,021 uit Stap 99. Tijd: v2 61-70 s, huidig 73-110 s (inclusief onderzoek).
      **Blinde beoordeling**: `docs/eval/blind-b6-ronde-2.html` met `docs/eval/books-blind/P03-A.pdf` ... `P05-B.pdf`; de sleutel staat in
      `blind-b6-ronde-2.key.json` (niet openen voor je klaar bent). Rapporten: `docs/eval/2026-10-28-{current,v2}-only-P05-P18-P03-full.*`
      (bevatten P18 als mislukte regel). Geen codewijziging.

- [x] Stap 104 - Kennisengine, B6 ronde 2 beoordeeld en fase B2 (kennismodel) en B3 (import van S3) gebouwd (Jan: "Voorstel B bij
      blind-b6-ronde-2 is duidelijk beter en start fase B2 en B3"). **Eerst de uitslag (eerlijk)**: de sleutel van ronde 2 zegt dat
      voorstel B in beide profielen (P03, P05) de **huidige** versie was, niet v2. In ronde 1 koos Jan ook B, en dat was toen v2. Samen: vier
      profielparen, twee keer v2 duidelijk beter, twee keer de huidige versie duidelijk beter, één beoordelaar. Dat is **geen bewijs** dat v2
      beter is en ook geen bewijs van het tegendeel; de B6-drempel is niet gehaald en v2 blijft achter de vlag. De vijf rubricvragen zijn niet
      apart ingevuld, dus de reden is niet te lezen. Mogelijke oorzaken (niet bewezen): de herhaling in de tips bij v2 (`vraag` 4 keer bij P05),
      of dat een kortere, minder volle invulling beter leest. **Niet in B2/B3 gebruikt**: dit werk staat los van v2.
      **B2, kennismodel (klein, achter niets)**: `Activity` kreeg vier optionele velden: `aliases {nl,en}`, `provenance {source_id, method,
      source_record_id?, last_verified_at?}`, `source_links [{source_id, source_record_id}]` en `reviewed_by {by, at}`, gevalideerd in `validate.ts`
      (alias niet gelijk aan een eigen of andere naam of alias, per taal en genormaliseerd; `method` `source` vraagt een record-id; echte datums;
      een record hoort bij één activiteit; `reviewed`/`live` vraagt `reviewed_by`). `source_links` is een afwijking van het auditvoorstel (één
      `provenance`): provenance zegt waar een record **vandaan komt**, een koppeling zegt dat een bestaand record **hetzelfde is als** een extern
      record; één veld kan niet allebei zijn. Gedeelde naamnormalisatie in `src/lib/discovery/names.ts`. Bewust niet toegevoegd (geen
      consument): `kind`, `short_description`, extra facetten, een "thuis"-facet. Onbekend blijft `null`; een test controleert dat geen facet een
      vervangwaarde gebruikt. De bestaande set laadt ongewijzigd (`taxonomy:check` 0/0).
      **B3, importpijplijn voor S3 (Wikidata, CC0)**: `src/lib/knowledge/` (parse, normalize, match, screen, importer; zuiver en getest) en
      `scripts/knowledge/import.ts` (leest en schrijft bestanden; `--write`, `--apply`, `--queue-cap`). De logica staat in `src/` en niet in
      `scripts/knowledge/{parse,...}` zoals de opdracht noemt, zodat vitest hem kan testen. **Regels**: alleen een gelijke genormaliseerde naam in
      dezelfde taal voegt automatisch samen (label of alias), nooit over talen heen; gedeelde woorden geven alleen een kandidaat voor een mens
      ("schaken" is niet "correspondentieschaak", "boulderen" niet "klimmen"); niets wordt automatisch een activiteit. **Resultaat op S3**: 219
      records: **17 samengevoegd** (alle handmatig nagekeken: zwemmen, schilderen, fotografie, pottenbakken, kalligrafie, geocaching, genealogie,
      bonsai, origami, hardlopen, meditatie, imkeren, zendamateur, mountainbiken, vogels, houtbewerking, paddenstoelen; 7 nieuwe NL-bijnamen, 17
      koppelingen, in 7 databestanden), **80 in review** (21 voorstel nieuw, 25 twijfel, 34 "hebben we al onder een andere naam"), **122 afgewezen**
      (69 op voorstel van de lezer, 38 onder de grens van de wachtrij, 7 zonder label, 4 te algemeen, 2 onveilig, 2 vakterm). Rapport:
      `docs/knowledge/import-S3.md`; wachtrij `data/knowledge/review-queue.json`; staging, logboek en voorstellen in `data/knowledge/`.
      **Belangrijkste bevinding**: naamvergelijking mist wat de bibliotheek al heeft onder andere woorden (amateurastronomie is `telescoop`,
      kaarsen maken is `kaarsen-gieten`, kartracing is `karten`, grotten is `grotten-verkennen`, fossielen zoeken is `fossielen`): van de ± 158 niet
      gevonden records bleken er een stuk of 50 al gedekt. Die staan als "merge"-voorstel in de wachtrij (jij bevestigt met `"merge:<id>"`); ze
      vinden kan niet zonder semantiek of een mens. Echt nieuw zijn er 21 voorstellen (o.a. dammen, sudoku, jojo, proplifting, strandjutten,
      ballonmodelleren, bloemsierkunst, quilten, kaarten maken, conlanging, videoproductie, lederwerk, stenen stapelen, postcrossing, groundhoppen,
      paaldansen, touwtjespringen, pilates, rolschaatsen, bijdragen aan Wikimedia, open-source meebouwen), dus ± 21 in plaats van de 22 uit Stage A.
      **Keuzes die ik zelf maakte (K2, K5)**: alleen S3 (de enige bron met een schone licentie en NL); wachtrijgrens 80 (het voorbeeld uit de
      audit); mijn voorstellen zijn **voorstellen, geen beslissingen** (de lezer is dezelfde assistent die de bron las, niet Jan). Geen AI-vertalingen
      gedaan (€0): 11 wachtrij-items missen een NL-label en vragen een vertaling (`inferred_ai` tot gereviewd). **Idempotent**: twee keer draaien geeft
      byte-voor-byte dezelfde staging-, wachtrij- en rapportbestanden en één logregel (getest en op de echte data gecontroleerd).
      Getest: 639 tests (nieuw: 13 voor het kennismodel, 19 voor de import), `tsc`, eslint, `taxonomy:check` (0/0), `npm run build`. **Nog te
      doen door Jan**: de wachtrij beoordelen (21 + 25 + 34 regels, zie het rapport) en daarna de goedgekeurde nieuwe activiteiten laten schrijven
      (tags, kenmerken, scène, NL-label, `concept`, foto's ± $0,13 per vel van negen); wil je dat ik dat doe, geef de goedgekeurde lijst.
      **Aanvulling (Nederlandse labels)**: de 11 wachtrij-items zonder NL-label uit Wikidata hebben nu een voorgesteld NL-label (bv. "Stenen
      stapelen", "Meebouwen aan open-source software", "Spokenjacht"), gezet in `nl_labels` van `data/knowledge/proposals/S3.json` en in het
      rapport getoond als "… (vertaald voorstel)". Het zijn vertalingen door de assistent (`inferred_ai`, €0): ze staan in een eigen veld
      `nl_suggestion` en nooit in `labels.nl`, dat blijft brondata. Jan zei de voorstellen te onderschrijven; hij heeft de wachtrij nog niet
      beslist (`decision` staat overal op `null`), dus er is niets samengevoegd of aangemaakt op basis daarvan.

- [x] Stap 105 - Kennisengine B3: beslissingen vastgelegd en de goedgekeurde activiteiten geschreven (Jan: "zet de beslissingen en schrijf de
      nieuwe activiteiten; de 25 twijfelgevallen op accept, behalve Q34362, Q191448, Q472328, Q31916432, Q7547485 (afgewezen) en Q2093999,
      Q109577660, Q11411 (gemerged)"). **Beslissingen** staan nu apart van de wachtrij in `data/knowledge/decisions/S3.json` (blijven gelden bij elke
      run): 105 beslissingen = 32 accept, 68 merge, 5 reject. Jans akkoord op "alle voorstellen" is ook toegepast op de 23 merge-voorstellen die onder de
      wachtrijgrens van 80 vielen. **Zeven "accept"-voorstellen bleken al te bestaan en zijn door mij omgezet naar merge (Jan kan dat omkeren)**: reënactment
      -> `re-enactment`, begraafplaatsen bezoeken -> `begraafplaats`, videoproductie -> `korte-film` (stage), spokenjacht -> `paranormaal` ("Paranormaal
      onderzoek of spokenjacht"), vlinders kijken -> `insecten-tellen` ("Vlinders en insecten tellen"), heemkunde -> `archief` ("Lokaal archief en oude
      kranten uitzoeken"), lederbewerking -> `lederwerk`. Mijn eerdere opmerking dat er nog geen lederwerk in de bibliotheek stond was onjuist. Ik ontdekte
      dit pas bij het schrijven (de validator meldde `korte-film` dubbel); de naamvergelijking van de import ziet dit soort dubbelen niet, dus
      controleer het bij elke volgende bron. Mogelijk nog te dicht bij bestaand (wel geschreven): `rolschaatsen` naast `skaten` en `rolschaatsdisco`,
      `tokkelbaan` naast `klimpark`, `straatfotografie` naast `fotografie`.
      **32 nieuwe activiteiten** (bibliotheek 423 -> 455, `taxonomy:check --images` 0 fouten, 0 waarschuwingen, alle op `concept`, `provenance
      {S3, <Q-nummer>, curated}`): dammen, sudoku, jojo'en, proplifting, strandjutten, duiven houden, mieren houden, ballonmodelleren, bloemschikken,
      quilten, kaarten maken, een eigen taal bedenken, figuurzagen, straatfotografie, stenen stapelen, postcrossing, pins ruilen, groundhoppen,
      paaldansen, touwtjespringen, pilates, rolschaatsen, bergtoppen afvinken, langlaufen, kortegolf luisteren, DX'en, retrocomputing, bijdragen aan
      Wikipedia, meebouwen aan open-source, deltavliegen, tokkelbaan en magneetvissen. Alles wat toezicht vraagt (deltavliegen, tokkelbaan,
      magneetvissen) is `tier 2` met een instapnotitie; **laat die notities juridisch controleren**, net als de eerdere. Kenmerken, tags, NL- en
      EN-teksten en beeldbeschrijvingen zijn door mij opgesteld (een eerste inschatting, zoals de rest van de set). De elf NL-labels uit
      `nl_labels` zijn waar ze het label vormden vertaald door de assistent. **Beelden**: 32 foto's via Gemini, 5 aanvragen (3 vellen 3x3 + 2
      deelraster + 1 los), ≈ $0,67; alle 32 op een contactvel bekeken: geen mensen of handen; kleine tekstachtige vlakken (krantenpuzzel, het
      artikel op de Wikipedia-foto, een zwak "Encyclopedie article"), zoals eerder bij voorwerpen die tekst dragen.
      **Importer**: nieuwe uitkomst "nieuw geschreven" (`added`, herkend aan `provenance.source_record_id`), `decisions` als invoer, een door een mens
      beslist merge heet altijd `reviewed` (anders veranderde het rapport bij de tweede run omdat de namen dan als alias matchten). Resultaat op S3:
      219 records: 85 samengevoegd (17 automatisch + 68 beslist; 116 nieuwe bijnamen), 32 nieuw geschreven, 14 nog in review (de best scorende
      records waar niemand een mening over had; de wachtrij is met de beslissingen ruimer geworden, grens 80), 88 afgewezen (5 door Jan, 69 op voorstel).
      Drie keer draaien geeft dezelfde bestanden. **Gevolg van een grotere bibliotheek**: de selectie van de huidige motor is voor veel van de 20
      vaste profielen veranderd (de ruis en de zeldzaamheid hangen van de hele set af); `scripts/eval/baseline/current.json` is ververst (E1-E6 nog 0, ook
      voor 500 profielen in beide wizards en beide versies), en de test "zelfde seeds elke keer" kreeg een ruimere time-out (60 s) omdat een tweede
      volledige run bij 455 activiteiten net boven de 5 s uitkwam. Getest: 642 tests, `tsc`, eslint, `taxonomy:check --images`, `npm run build`.
