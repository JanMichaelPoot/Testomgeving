# WINDOW — bouwopdracht voor Claude Code

Plak dit als eerste prompt in een nieuwe Claude Code-sessie in dit project, of sla het op als `CLAUDE.md` in de projectroot zodat Claude Code het automatisch als context leest.

---

## Project

Ik bouw **WindowInto** (voorheen WINDOW), een digitale possibility-discovery app. Gebruikers vullen
een rijk persoonsprofiel in (situatie, doel, wie ze zijn, waar ze zijn, en een
reeks dial-achtige voorkeuren); de app genereert direct via AI 4-5
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
   "Make this real" → Stripe Checkout (geen kandidaat-selectie meer). Bij de
   beeld-intake ("Het venster") staat dit blok onderaan het laatste scherm (het
   profiel, Stap 108); de aparte `/checkout`-pagina blijft alleen voor de oudere
   kaarten- en klassieke wizard.
4. **Idea Book** — het betaalde resultaat: profielsamenvatting, 4-5
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

---

## Actuele stand en afspraken (gelezen bij elke sessie, houd dit kort)

**Het volledige voortgangslogboek (Stap 1 t/m 163, in het Nederlands) staat in `docs/changelog.md`, niet hier.** Lees het alleen als je weet waar je naar zoekt (`Grep` op stapnummer of term). Voeg nieuwe stappen **onderaan `docs/changelog.md`** toe, in dezelfde stijl: wat is gedaan, wat is getest, wat is bewust niet gedaan. Houd dit bestand kort.

Wat hierboven uit de oorspronkelijke bouwopdracht nog steeds geldt: techstack, merk (Warm Walnut), juridische eisen en scope. Wat inmiddels anders is dan de tekst hierboven:
- De app heet **WindowInto** (voorheen WINDOW); prijs **€7,50** (vast in `src/lib/pricing.ts`); de intake is de beeld-intake met twee beeldpagina's (`start` → `images` → `concrete` → `profile`, betalen op het profielscherm); het Idea Book is 4 ideeën + 1 wildcard (Stap 198: vijf in totaal, PDF 7 tot ±12 pagina's); een boek mag in totaal maximaal $0,50 aan modelkosten kosten (`src/lib/claude/costLedger.ts`).
- Geen cadeaubon of cadeauroute meer (Stap 150); "voor iemand anders zoeken" bestaat wel.
- Ideeën komen uit de selectiemotor (`src/lib/discovery/engine/`) met de bibliotheek (`src/lib/discovery/data/`, ±700 activiteiten); de referentiebibliotheek in `reference-library/` is een aparte laag.

**Werkafspraken die uit eerdere stappen zijn blijven hangen:**
- Praat Nederlands met Jan; code, comments en commits Engels. Commit en push alleen na "commit en push"; naar `main` alleen na "merge naar main" (fast-forward, `git push origin <branch>:main`).
- Kosten eerst: doe alles wat lokaal en gratis kan voor je een betaalde aanroep doet (Gemini ≈ $0,134 per beeld, ruim $0,13 per 3x3-vel van 9; een volledig boek ≈ $0,15-0,50). Vraag akkoord op een bedrag voor je echte generaties draait. Beeldscripts: `scripts/generate-discovery-illustrations.ts --sheet 3x3` (eerst `--dry-run`).
- Verifieer tegen de database of de echte uitvoer in plaats van op de meest voor de hand liggende verklaring te vertrouwen. Een Supabase-migratie is pas "klaar" als de kolom echt bestaat; migraties draait Jan zelf in de SQL-editor.
- Bij een verouderd beeld of tekst in de dev-server: stop de server, wis `.next`, start opnieuw. Op de live site: de deploy duurt 1-2 minuten; hard verversen (Ctrl+F5).
- Controle voor oplevering: `npm run typecheck` (zelfde controle als `next build` op Vercel, zonder `scratch/`; gewone `tsc` stopt bij een syntaxfout in een scratch-bestand en slaat dan de typecontrole van `src/` over, zo bleven de deploys van Stap 178-183 onopgemerkt falen; `npm run check` doet typecheck, eslint en vitest achter elkaar; een `pre-push`-hook in `.githooks/` draait de typecheck vóór elke push, eenmalig aanzetten met `git config core.hooksPath .githooks`), `npx eslint src e2e scripts`, `npx vitest run` (één bekende worker-time-out "onTaskUpdate" is oud en onschuldig; zware tests kunnen onder belasting hun limiet halen), relevante Playwright-tests (`npx playwright test e2e/<bestand>`). Zichtbare wijzigingen: bekijk ze met een schermafbeelding op 1440 en 390 px.
- Nieuwe afbeeldingen onder `public/` krijgen een regel in `src/lib/imageProvenance.json` (een test eist dat). Nieuwe activiteiten krijgen een stijlregister in `src/lib/discovery/register.json`; check met `npx tsx scripts/taxonomy-check.ts --images`.
- Zichtbare teksten staan in `src/lib/i18n/` (nl en en altijd samen); schrijf "WindowInto", nooit "WINDOW", in teksten voor mensen.
- `scratch/` is voor wegwerpbestanden (niet in git, behalve drie oude HTML-rapporten); ruim het op na afloop. Brondata die je later opnieuw nodig hebt (zoals `data/sources/raw/hero-photo-raw-1.jpg`) hoort daar niet.
