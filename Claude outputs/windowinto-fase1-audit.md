# WindowInto — Fase 1: Audit & Architecture

Technische en productanalyse van de bestaande app, vóór er iets wordt gewijzigd. Doel: vaststellen wat er staat, wat goed is en blijft, en waar de afstand zit tot de visie uit het master-prompt (karakterprofiel, Open Doors, Serendipity Engine, premium magazine-PDF). Er is in deze fase geen code aangepast.

---

## 1. Samenvatting

De huidige app (werknaam in de code nog "WINDOW") is een volwassen, goed doorontwikkelde MVP — 23 bouwstappen diep, met een werkende betaalflow, een rijke PDF-generator en een zorgvuldig AVG-bewuste dataarchitectuur. Het is geen prototype dat opnieuw moet worden opgebouwd.

Maar inhoudelijk is het vandaag een **ideeëngenerator**, geen **ontdekkingservaring**. Concreet:

- Er is één plat lijstje van "6 ideeën + 1 wildcard", geen afstands-gegradeerde "Open Doors" (Natural → Discovery → Unexpected → Stretch → Wildcard).
- Er is geen karakterprofiel, geen dimensies (nieuwsgierigheid, spontaniteit, sociale energie, etc.), geen "Your Discovery Profile".
- Er is geen scoremodel (relevance/novelty/feasibility/surprise) — Claude genereert alles in één ongestuurde tool-call, zonder interne kwaliteitscontrole of regeneratie op basis van scores.
- De intake is een geoptimaliseerde versie van een **traditionele vragenlijst** (15 velden, 5 pagina's), niet de gedrags-/scenariogerichte vragen die het master-prompt voorstelt (bijv. "een vrije zaterdag doemt op — wat doe je?").
- De output heeft geen "Your World", "What You May Be Missing", "What If…" of "If You Do Only One Thing" — het is: profiel → 6 ideeën → wildcard → klaar.
- Er is geen feedbackloop ("More like this" / "Not me"), geen Challenge Mode, geen "WindowInto for Two", geen Share Card als los deelbaar object (er is wél een deel-link naar een read-only paginaversie).

Dat is niet slecht nieuws: de **infrastructuur** waar dit bovenop moet komen (intake → Claude tool-call → gestructureerd JSON → PDF-renderer met dry-run-layout, betaalflow, e-mail, deelfunctie, audit-log) staat er, is getest, en is van goede kwaliteit. De transformatie is vooral een **contentlaag-verbouwing** (welke vragen, welk datamodel, welke promptstructuur, welke outputstructuur) plus een **nieuwe presentatielaag** (Open Doors, Discovery Profile, Possibility Map), niet een technische herbouw.

---

## 2. Routes & schermen

| Route | Doel | Status |
|---|---|---|
| `/` | Landing: belofte, CTA, "wat je krijgt", testimonials | Werkt, statisch |
| `/intake` | 5-pagina profiel-wizard (`IntakeWizard`) | Werkt, 15 velden |
| `/checkout` | Disclaimer, herroepingsrecht-checkbox, cadeau-toggle, Stripe Checkout | Werkt, incl. test-bypass |
| `/plan` | Het betaalde resultaat: `IdeaBookViewer` (boek-navigatie) | Werkt |
| `/shared/[id]` | Publieke, alleen-lezen preview van andermans Idea Book (geen profiel/voorkeuren) | Werkt |
| `/admin` (+ `/admin/login`) | Wachtwoord-gated audit-log met live tabel + .xlsx-export | Werkt (net gebouwd) |
| `/privacy`, `/terms` | Statische juridische pagina's | Werkt, inhoudelijk correct |
| `/api/stripe/webhook` | Stripe-signature-verificatie, betaalstatus bijwerken | Werkt |
| `/api/location-suggest` | PDOK-locatie-autocomplete-proxy | Werkt |
| `/api/cron/first-action-reminder` | Dagelijkse Vercel Cron: 1 herinneringsmail per boek, 2–9 dagen na aankoop | Werkt, nog niet live end-to-end getest |
| `/api/admin/audit-log/export` | .xlsx-export van het volledige audit-log | Werkt |

Geen aparte routes voor divergentie/keuze — dat is bewust (zie `CLAUDE.md`): de intake genereert direct het volledige betaalde eindproduct.

## 3. Componenten & state

- **`IntakeWizard.tsx`** (client component, ~530 regels): bouwt 5 `PageConfig`'s dynamisch op uit een `IntakeAnswers`-object via `buildPages()`. Veldtypes: `text`, `chips`, `multi-chips`, `slider`, `location`. State: `page`, `answers`, plus (sinds de laatste sessie) `hydrated` en `touchedSliders`. Sinds kort: sessionStorage-draftpersistentie (overleeft een refresh, wordt gewist bij succesvolle submit).
- **`PillSlider.tsx`**: een zelfgebouwde, klik-/sleep-/toetsenbord-bediende discrete slider (geen native `<input type="range">`), nu met een "aangeraakt"-indicator.
- **`CheckoutPanel.tsx`**: cadeau-toggle, disclaimer, waiver-checkbox, betaal-CTA, test-bypass.
- **`IdeaBookViewer.tsx`**: client-side "boek"-navigatie over een intern opgebouwde schermenlijst (profiel → voorkeuren (optioneel) → 6× idee → wildcard → done). Simpele `useState<number>`-index, geen URL-state (een refresh gaat terug naar scherm 0).
- **`IdeaDetail.tsx`**: hergebruikt tussen `/plan` en `/shared/[id]` — toont titel, intro, why-it-fits, stappen, praktische info, locatie+kaartlink, eerste-actie-callout.
- **`GeneratingScreen.tsx`**: full-screen wachtscherm met roterende statusregels + `router.refresh()` elke 5s.
- **`ShareButton.tsx`**: Web Share API met clipboard-fallback.

State is overal lokaal React-state (`useState`/`useTransition`), geen globale state-manager, geen URL-gedreven wizard-stappen. Dat is prima voor de huidige schaal, maar betekent: geen deep-linking naar een specifiek wizard- of boek-scherm, en een browser-refresh in `IdeaBookViewer` reset je naar het begin (in `IntakeWizard` inmiddels wél opgelost via sessionStorage).

## 4. Data & database

`intake_answers.raw_json` is een schemaloze JSONB-kolom — het volledige `IntakeAnswers`-object wordt daar in bewaard. De losse kolommen (`topic`, `time_available`, `budget`, `desired_surprise`, `company`) zijn legacy en ongebruikt. Dat betekent: **een nieuw, rijker intake-datamodel (karakterdimensies, gedragsvragen, comfortzone-slider) vereist geen nieuwe migratie** — het past direct in `raw_json`.

`window_plans.ideas_json`/`wildcard_json` zijn ook JSONB — zelfde verhaal: een `IdeaBookEntry` met nieuwe velden (novelty-score, doel-categorie "natural"/"discovery"/"unexpected"/"stretch"/"wildcard") kan zonder migratie.

Belangrijk architectuurprincipe, consequent toegepast: **gedragsdata (intake) blijft losgekoppeld van herleidbare data (e-mail)** — pas ná betaling wordt een e-mailadres aan een `users`-rij gekoppeld. Dit principe moet bewaard blijven in elke uitbreiding (bijv. een toekomstig karakterprofiel-account, "WindowInto for Two").

`audit_log` (nieuw, deze sessie): volledig anonieme kopie van elke generatie (input + output), voor kwaliteitscontrole door de eigenaar — geen sessie-/gebruikerskoppeling. Relevant voor Fase 3 (kwaliteitscontrole op AI-output): dit is al een audit-basis om regressies in de nieuwe promptstructuur te monitoren.

De `ideas`-tabel (uit het oude divergentie/convergentie-model) staat er nog, ongebruikt, bewust niet gedropt.

## 5. AI-laag: prompts & generatie

Dit is de kern van de gevraagde transformatie. Huidige situatie (`generateIdeaBook.ts`):

- **Eén Claude-call, geforceerde tool-use**, output: `profile_summary`, `must_haves`, `preferences`, `ideas[6]`, `wildcard`, `labels`. Geen intern scoremodel, geen tussenstap, geen zelf-kwaliteitscontrole vóór het antwoord teruggaat.
- **Geen karakterinferentie**: de systeemprompt vertelt Claude alleen "MUST-HAVES zijn hard, PREFERENCES zijn zacht" en geeft schrijfregels (toon, lengte, geen verzonnen adressen). Er wordt geen gedragspatroon herkend of vastgelegd (dimensies als nieuwsgierigheid, spontaniteit).
- **Geen afstand-tot-comfortzone-structurering**: alle 6 ideeën + wildcard worden in dezelfde asloze batch gevraagd. Er is één `practicalToWild`-slider-veld (net samengevoegd met de oude `surpriseLevel`) dat de generatie *richting* geeft, maar geen expliciete "genereer 1 Natural, 2 Discovery, 1 Unexpected, 1 Stretch, 1 Wildcard"-instructie.
- **Kwaliteitsniveau is al hoog** op de dingen die er wél zijn: `why_it_fits` moet al een directe terugverwijzing zijn naar wat de gebruiker zei ("Je vermeldde…"), er is een anti-verzonnen-adres-regel, en er is al een retry bij misvormde output. Dat is precies het soort discipline dat de Serendipity Engine en de kwaliteitscontrole-sectie van het master-prompt vragen — het ontbrekende stuk is een *scorend/categoriserend* laag erbovenop, niet een cultuuromslag in prompt-kwaliteit.
- **Combinatorische creativiteit** gebeurt импliciet (Claude krijgt het hele profiel in één keer en genereert vrij), maar wordt niet actief gestuurd of gecontroleerd op "is dit een onverwachte combinatie of een generiek antwoord" (het anti-generic-filter uit sectie 29 bestaat nog niet).

`shared.ts` bevat nog een oud, ongebruikt `IntakeContext`/`formatIntake` (van vóór stap 7's herontwerp) — dood gewicht, geen actieve import gevonden buiten de gedeelde `WINDOW_VOICE_SYSTEM_PROMPT`/`extractToolInput`.

## 6. PDF-generatie

`src/lib/pdf/ideaBook.ts` (via `pdf-lib` + `fontkit`, geen headless browser/HTML-naar-PDF): full-bleed achtergrondfoto per pagina, twee afgeronde "glass"-kaarten per idee (dry-run-gemeten hoogte, dus nooit een leeg ogend vak), 9 pagina's vast (cover, profiel, 6 ideeën, wildcard). Kwalitatief al dicht bij "klein persoonlijk magazine" — de sectie 20-eis uit het master-prompt is grotendeels al waargemaakt: grote typografie, veel witruimte, een vaste sfeerfoto, geen "AI-rapport"-uitstraling.

Wat ontbreekt t.o.v. de gevraagde 10-pagina-structuur (sectie 21): een "Your World"/"What You're Missing"-pagina, een Discovery Profile-pagina (dimensies), een Possibility Map-pagina (visuele deuren-kaart), een "What If…"-pagina, een "If You Do Only One Thing"-pagina, een "Keep Your Window Open"-slotpagina. Dat is puur een kwestie van meer pagina's toevoegen aan een al bewezen renderpatroon (dry-run-meting, full-bleed foto, kaart-lagen) — geen technische onzekerheid, wel een flinke contentuitbreiding.

## 7. Styling / visueel systeem

Consistent tokens-systeem (`globals.css`: `--color-accent`, `--color-accent-dark`, `--color-gold`, `--color-ink`, `--color-cream`, `--color-paper`), hergebruikt via Tailwind `@theme inline`. Kleur is recent (stap 21) van paars naar emerald/goud verschoven — via tokens, dus één centrale wijziging kleurde de hele site mee. Fraunces (serif) + Inter (sans). Rounded-pill-knoppen, veel witruimte, kaarten met zachte schaduwen — sluit al aan bij de gevraagde "premium editorial magazine + playful discovery tool"-richting uit sectie 25. Fotorealistische, emerald/goud-gegenereerde beelden op landing + wizard (Gemini, eenmalig gegenereerd en gecommit, geen live per-gebruiker beeldgeneratie — bewuste kostenbeslissing die voor een eventuele "premium doors"-visualisatie hetzelfde patroon kan volgen).

`Button`, `PillSlider`, chip-/kaart-patronen in `IntakeWizard` zijn herbruikbare, redelijk goed geïsoleerde bouwstenen — nieuwe schermen (Discovery Profile, Open Doors) kunnen hier grotendeels op verder bouwen in plaats van een nieuw ontwerpsysteem te vergen.

## 8. Bestaande functionaliteit die behouden moet blijven

- De volledige betaalflow (Stripe Checkout, webhook, herroepingsrecht-waiver, cadeau-optie met apart ontvanger-e-mailadres).
- De AVG-architectuur: sessie-gekoppelde gedragsdata, e-mail pas ná betaling, volledig anonieme audit-log.
- De dubbele-generatie-bescherming (`pending`/`ready`/`failed`-status, 90s-timeout).
- De deelfunctie (`/shared/[id]`, UTM-tracking, PostHog-funnel-events).
- De eerste-actie-herinneringsmail (cron).
- De net opgeleverde intake-UX-verbeteringen (samengevoegde sliders, suggestiechips, sessionStorage-draft, contextuele company-tekst).
- Twee-talige ondersteuning (nl/en) via `dictionaries.ts` — elke contentwijziging (nieuwe vragen, Open Doors-copy, Discovery Profile-labels) moet in beide talen.
- De admin-audit-log-omgeving (nu net gebouwd) — nuttig voor Fase 7's kwaliteitscontrole, en voor het monitoren van de nieuwe promptstructuur zodra die verandert.

## 9. Belangrijkste technische risico's voor de aankomende fasen

1. **Promptlengte/kosten**: het master-prompt vraagt een rijker profiel (karakterdimensies), een scoremodel, meerdere deur-categorieën, "What If", "One Thing" — als dat allemaal in één Claude-call blijft, wordt de system+user-prompt fors groter en de output-schema complexer, met een hoger risico op misvormde tool-calls (de bestaande retry dekt dat deels, maar bij een 3-4x grotere schema neemt de kans op een gedeeltelijk mislukte call toe). Overwegen: de generatie in 2 stappen knippen (1: karakterprofiel + deur-categorisering, 2: per-deur-content) — kost een extra API-call maar is robuuster en maakt losse quality-checks per deur mogelijk (sectie 28).
2. **PDF-paginagroei**: van 9 naar mogelijk 12-14 pagina's (Discovery Profile, Possibility Map, What If, One Thing, Keep it Open) — de dry-run-meettechniek schaalt goed, maar elke nieuwe paginasoort is een nieuwe renderfunctie om te bouwen en visueel te testen (geen headless-browser-render, dus geen CSS/HTML-shortcut).
3. **Geen geautomatiseerde tests** (bewust nog niet gebouwd, stap 20) — elke contentlaag-wijziging wordt nu handmatig end-to-end getest via de test-bypass. Bij een grotere contentherbouw (Fase 2-4) wordt dat risicovoller; het kan de moeite waard zijn om vóór Fase 3 (Possibility Engine) een lichte "genereer N mock-profielen → controleer schema/lengte/novelty-verdeling"-testscript te bouwen, geen volledig testframework.
4. **`IdeaBookViewer`-state bij herlaad**: geen URL/sessionStorage-persistentie van de boek-navigatie-positie (in tegenstelling tot de intake-wizard, die dat sinds kort wél heeft) — met meer schermen (Discovery Profile, Possibility Map, What If) wordt een refresh-reset naar scherm 0 vervelender. Kandidaat-fix in Fase 4.
5. **Serendipity Engine "regenereren bij onvoldoende kwaliteit" (sectie 28-29)** kost extra Claude-calls en dus geld/latency per aankoop — moet bewust begrensd worden (bijv. max 1 automatische regeneratie per kwaliteitscriterium, net als de bestaande retry-op-misvormde-output).

## 10. Advies voor Fase 2 (Input & Character Engine)

Dit is mijn eigen inschatting, niet alleen een samenvatting van het master-prompt:

- **Niet alle 33 productie-secties tegelijk nastreven.** De grootste productwaarde zit in twee dingen: (a) de Open Doors-structuur (vervangt de platte 6-ideeën-lijst — dit is de kern-innovatie, sectie 6) en (b) een minimaal, speels karakterprofiel (2-4 dimensies, niet de volledige lijst van 12 uit sectie 4) dat de deur-selectie voedt. Alles daarna (What If, One Thing, Possibility Map, Challenge Mode, For Two) is uitbreiding bovenop die twee fundamenten.
- **Hergebruik de bestaande 5-pagina-wizard-structuur**, voeg er geen 12 nieuwe schermen aan toe. De sliders/chips-patronen kunnen de scenario-vraag (sectie 8, vraag 6: "een vrije zaterdag...") en de comfortzone-slider (vraag 9) direct dragen zonder nieuw componenttype.
- **Bouw het karakterprofiel als een puur afgeleide, server-side berekening** (regels of een klein Claude-subcall) bovenop de bestaande intake-antwoorden, niet als aparte opgeslagen vragenlijst — scheelt database-schema-gedoe en sluit aan bij de bestaande "raw_json bevat alles"-aanpak.
- **Splits de generatie in twee Claude-calls** zodra de Open Doors + karakterprofiel worden gebouwd: eerst een compacte call die alleen het profiel + de deur-categorisering + scores oplevert (goedkoop, snel, makkelijk te loggen/debuggen), dan een tweede die de volledige deur-content genereert. Dat maakt sectie 28's kwaliteitscontrole (relevance/novelty/diversity) ook daadwerkelijk uitvoerbaar, want je hebt dan tussentijdse, inspecteerbare data in plaats van alles verstopt in één ondoorzichtige tool-call.
- **PDF en webweergave laatst** (Fase 4-5, zoals het master-prompt zelf ook voorstelt) — pas nadat de nieuwe datastructuur (Open Doors + karakterprofiel) een paar keer via de admin-audit-log is gecontroleerd op kwaliteit.

---

**Volgende stap:** wachten op akkoord voordat Fase 2 (Input & Character Engine) begint — dit document wijzigt niets aan de code.
