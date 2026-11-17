# Implementatieplan: online-first en thematische ontdekking

Opgesteld op 17 november 2026, op basis van de gedeelde ChatGPT-chat "Analyse WindowInto feedback" (productplan v1.0 van 17 nov) **vergeleken met de huidige code** (branch `site-optimalisatie`, na Stap 206).
**Alleen een plan: er is geen code, data, afbeelding of instelling gewijzigd en er is niets betaald.**

Labels: **[Feit]** in code of bestanden gecontroleerd, **[Advies]** mijn voorstel, **[Besluit]** Jan beslist eerst.

---

## 1. Samenvatting

1. **Het ChatGPT-plan beschrijft een app die er voor een groot deel al is.** [Feit] Er is al een online resultaatpagina (`/plan`, overzicht + per idee een venster), een mail met link, een beeld-intake in twee beeldpagina's, een bibliotheek van 774 activiteiten, deelknoppen, geen cadeauroute meer en een compactere mobiele weergave (Stap 202). Wat in het plan "nieuw bouwen" heet, is vaak "aanscherpen".
2. **De echte gaten zijn vijf** [Feit]: (a) de mailplaatjes ontbreken voor 560 van de 774 activiteitenfoto's, (b) de mail linkt niet naar het afzonderlijke idee, (c) de associatiefase is ordenend op *register* (stijl), niet op herkenbare *thema's* ("iets met natuur"), (d) er is geen *aanleiding* (vrijgezellenfeest, vakantie, vrijwilligerswerk, familie-uitje) in de intake, (e) per idee staan er hoogstens 3 echte plekken (`MAX_OPTIONS = 3`), maar een harde ondergrens van 3 bestaat niet.
3. **Eén aanname in het plan klopt niet.** [Feit] "PDF loslaten maakt het product goedkoper" geldt nauwelijks: de PDF wordt lokaal gemaakt (pdf-lib, geen betaalde aanroep). Van de ±$0,36 per boek is 78 tot 88 % webonderzoek (`docs/kostenonderzoek-boekgeneratie.md`). Online-first is een **productkeuze**, geen prijsbesparing. De prijs hangt af van het aantal echte plekken per idee, niet van de PDF.
4. **Wat ik niet zou bouwen**: zeven afzonderlijke "vensters" als schermen, en een verplicht account. Zie sectie 5.
5. **Volgorde**: eerst gratis, lokale reparaties (Fase 0), dan de thema-laag en de aanleiding (Fase 1 en 2), daarna de diepte per idee (Fase 3), dan online-first en de selectietest. Zoals het plan zelf zegt: eerst de motor, dan de presentatie.

---

## 2. Vergelijking: plan versus huidige app

| Eis uit het plan of de feedback | Staat nu | Gat |
|---|---|---|
| Online resultaat als hoofdproduct | `/plan` bestaat (overzicht + venster per idee, `PlanReveal.tsx`, `IdeaDialog.tsx`); PDF en mail met PDF bestaan ernaast [Feit] | PDF is nog de bijlage en een vaste stap; online heeft geen herhaal-/bewaarfunctie |
| Gelaagde presentatie | Overzicht, dan venster per idee met "Waarom", plekken, eerste stap [Feit] | Laag 4 ("alternatieven en verrassingen") ontbreekt; controle op herhaling tussen rij, venster en mail nodig |
| Mail met samenvatting, link per activiteit | Mail toont titel, intro en één algemene link "bekijk online" (`windowPlan.ts`) [Feit] | **Geen link per idee**; tester vroeg erom |
| Mailplaatjes laden altijd | `emailImages().thumb()` verwijst naar `/email/thumbs/discovery/<id>.jpg`, maar die map heeft **214 van 774** bestanden [Feit] | **560 activiteiten geven een kapot plaatje**; alt-tekst is leeg; geen vangnet als de file ontbreekt |
| Associaties thematisch, niet activiteitgericht | Pagina 1: 516 beelden in drie rondes (plekken 177, momenten 174, zintuigen 165), 172 families, gebalanceerd op register [Feit] | Geen herkenbare thema's op het scherm; sommige beelden suggereren al een activiteit ("Het kostuum aan, de rol in", "Een veulen bij het hek") |
| Beeld per thema wisselt | Per familie bestaat een variant; "Andere beelden" geeft een nieuwe set [Feit] | Geen themategel met roterend beeld |
| Hele tegel is een knop | **Al zo**: de hele kaart is een `button` met `aria-pressed` (`AssociationWizard.tsx` ±985-1000) [Feit] | Geen gat. Wel: het vinkje rechtsboven kan de indruk wekken dat alleen dat telt; visuele status en tikgebied controleren op mobiel |
| Doelgroep en aanleiding | Zoekcontext: mezelf, kind of jongere, andere volwassene, groep, nog onbekend (`audience.ts`); leeftijd en budget optioneel [Feit] | **Geen aanleiding** (vrijgezellenfeest, vakantie, familie-uitje, vrijwilligerswerk); bibliotheek heeft weinig voor vrijwilligerswerk (`society.json`: 15 items) en groepsfeesten |
| 5 opties met minstens 3 concrete plekken | 4 ideeën + wildcard; per idee `MAX_OPTIONS = 3` (`localResearch.ts:50`); geen idee zonder plek (Stap 197) [Feit] | Geen harde ondergrens van 3; in dunne gebieden onhaalbaar (Wernigerode: 8 van 20 onderzochte activiteiten met plek, Stap 205) |
| Selectie: kies meer, werk er drie uit, prioriteer | Pagina 2: kies 3 tot 8 uit 18, of laat ons kiezen; boek heeft altijd 4 + 1 [Feit] | Geen prioritering; de verwachting "alles wat ik kies komt in het boek" wordt niet expliciet weggenomen |
| Verrassingen | Wildcard verzegeld + "Onverwacht"-deur [Feit] | Voldoet in de kern; het plan wil twee |
| Delen | WhatsApp en link kopiëren in `ShareButton.tsx` [Feit] | Facebook en native delen nog controleren |
| Mobiele witruimte | Stap 202 | Opnieuw meten na de wijzigingen hieronder |
| Cadeaubon weg | Stap 150 | Klaar |
| Account niet verplicht | Geen accounts [Feit] | Klaar; link is onraadbaar (checkout-id of `cs_test_free_<uuid>`) |
| Feitelijke status van informatie | Echte plekken met kaartlink en alleen getoonde Google-score [Feit] | Status "geverifieerd / indicatief" bestaat niet als zichtbaar label |

---

## 3. Besluiten

**Besloten door Jan op 17 november:** B1 streven 3 plekken met een vloer van 2; B2 het themascherm komt als nieuw scherm vóór de beelden; B3 de PDF verdwijnt helemaal overal uit het product (niet alleen uit de mail), dus Fase 4 wordt een ombouw; start met Fase 0 als Stap 207 (klaar, zie changelog).

| # | Vraag | Mijn advies |
|---|---|---|
| B1 | Per idee minimaal 3 echte plekken verplicht? | **Streven 3, vloer 2, absolute ondergrens 1 met zichtbaar label** ("in jouw regio vonden we er één"). Een harde 3 is in dunne regio's onmogelijk en duwt de kosten omhoog. Eerst meten (Fase 3). |
| B2 | Thema's als nieuw scherm vóór de beelden, of als filter boven pagina 1? | **Nieuw scherm** ("Waar heb je zin in? Iets met…", kies 2 tot 4). De wizard blijft op 5 pagina's (start, thema's, beelden, activiteiten, profiel), binnen de afspraak van CLAUDE.md. Te toetsen met de bestaande afhaakmetingen. |
| B3 | PDF: uit de mail halen? | **Ja**: mail met link per idee, PDF alleen als knop op `/plan` (blijft gratis om te maken). Bespaart bijna niets, maar maakt de mail korter en de online pagina leidend. |
| B4 | Beeldbudget voor nieuwe activiteiten (aanleiding-richtingen) | Vraag per bedrag akkoord. Richtprijs: ±$0,13 per 3x3-vel van 9, dus 30 nieuwe activiteiten ≈ $0,50. |
| B5 | Prioritering van drie keuzes (model B) invoeren? | **Niet bouwen, wel testen.** Eerst de verwachting uitspreken (Fase 0.3); een A/B-meting beslist later. |
| B6 | Zeven vensters als schermen? | **Nee.** Zie sectie 5. |

---

## 4. Stappenplan

Elke stap: wat, waar in de code, acceptatie, kosten. Alles in Fase 0 is lokaal en gratis.

### Fase 0 - Gratis reparaties (1 tot 2 dagen)

**Status 17 nov: 0.1 tot en met 0.3 klaar als Stap 207** (niet gecommit). Afwijkingen: geen runtime-vangnet voor een ontbrekende thumb (de nieuwe test borgt de dekking); de verwachtingszin staat op pagina 2, het profielscherm noemt al "vier ideeën en een wildcard"; de wildcard is op `/plan` niet meer verzegeld en heeft dus ook een directe link. 0.4 (herhalingsmeting) volgt apart.

**0.1 Mailplaatjes (kruisje in plaats van foto)** [Feit-gebaseerd]
- Draai `npx tsx scripts/make-email-assets.ts` (idempotent, geen API-kosten): maakt de 560 ontbrekende `public/email/thumbs/discovery/<id>.jpg`.
- Test: elk bestand in `public/illustrations/discovery/*.jpg` heeft een twin; faalt voortaan als iemand een foto toevoegt zonder thumb (zelfde patroon als de test op `imageProvenance.json`).
- `emailImages().thumb()` (`src/lib/email/layout.ts:77`) krijgt een vangnet: een generated manifest (of bestaanscheck) zodat een ontbrekende thumb de bestaande cirkel met nummer toont in plaats van een kapotte `<img>`.
- `alt` is nu `""`; vul de titel van het idee in.
- Acceptatie: 0 ontbrekende thumbs; testmail naar Gmail en Outlook (web en mobiel) toont bij 5 ideeën 5 plaatjes, ook met afbeeldingen geblokkeerd een leesbare tekst.

**0.2 Directe link per idee in de mail**
- Mail: elke idee-rij krijgt "Bekijk dit idee →" naar `{planUrl}&idee=idea-N` (de sleutel bestaat al: `ideaKey` in `src/lib/ideaKeys.ts`).
- `PlanReveal.tsx`: bij laden `?idee=` lezen en dat venster openen (`openIdea`, regel ±166), met `trackEvent("idea_opened", {source: "email"})`.
- Wildcard blijft verzegeld: link naar de pagina, niet naar de inhoud.
- Acceptatie: elke link opent het juiste venster, werkt ook na verversen en zonder JavaScript valt hij terug op het overzicht; unit test voor de URL-bouw, e2e voor het openen.

**0.3 Verwachtingen uitspreken, geen valse beloften**
- Pagina 2 en profielscherm: één vaste zin dat we vijf ideeën uitwerken en dat de gekozen activiteiten het zwaarst tellen, niet dat alles wat je kiest in het boek komt (`src/lib/i18n/venster.ts`, `twoPages.concrete`, nl en en).
- Acceptatie: zin op beide plekken, korte tekst, geen herhaling met de bestaande tekst.

**0.4 Tekst- en herhalingsaudit**
- Script (lokaal, gratis) dat voor een voorbeeldboek meet welke zinnen of bijna-gelijke bijzinnen terugkomen tussen `/plan` rij, venster, mail en PDF.
- Resultaat: lijst met te schrappen of in te korten stukken; daarna aanpassen met een telbare doelstelling (bijv. -25 % woorden in de mail en in het overzicht).

### Fase 1 - Associatiefase thematisch (hoogste prioriteit)

**1.1 Beelden op pagina 1 abstract houden**
- Lokaal script over de 516 kaarten (`associations.json`, veld `scene` en `label`): markeer beelden die een handeling of dier-activiteit al benoemen. Uitkomst is een lijst; **Jan beoordeelt de lijst** voor iets verandert.
- Nieuw veld in de kaartdata, bijv. `concrete: true`; de steekproef op pagina 1 (`twoPages.ts`, `sampleBalancedBatch`) neemt die niet, pagina 2 wel.
- Acceptatie: nul beelden op pagina 1 met een activiteitsnaam; de registerbalans en de nichevloeren (`GRACEFUL_MIN`, `NICHE_THEMES`) blijven gehaald (bestaande tests).

**1.2 Themascherm "Iets met…"**
- Startset van 12 thema's, afgeleid van de bestaande tagvocabulaire (`vocabulary.json`; tags met hoge dekking: `nature`, `water`, `movement`, `craft`/`making`, `performance`, `puzzling`/`technique`, `history`, `animals`, `food`, `challenge`/`speed`, `caring`/`teamwork`, `color`/`style`). De 12 uit het ChatGPT-plan (natuur, water, lucht, avontuur, cultuur, creativiteit, techniek, mensen, beweging, ambacht, onderzoek, beleving) worden daar eerst tegenaan gelegd; thema's zonder dekking in de bibliotheek vervallen of worden samengevoegd.
- Elke tegel toont een roterend beeld uit de bestaande kaarten die dat thema sterk dragen (`tagWeights` >= 0,7): **geen nieuwe beelden, geen kosten**. Tegel is een hele knop, 2 tot 4 kiezen.
- De keuze wordt een gewicht in `associationSampling.ts` (pagina 1) en `composeConcretePage` (pagina 2) en komt terug op het profielscherm als "Je koos: iets met natuur en iets met ambacht".
- Combinaties blijven mogelijk: gekozen thema's mogen elkaar kruisen (natuur + techniek), met de bestaande "Misschien ook?"-plekken (`EXPLORE_SLOTS`) als verrassing.
- Acceptatie: elk thema is zonder uitleg te herkennen (korte test met 5 mensen, eerst Jan en testers); twee verschillende themakeuzes geven aantoonbaar verschillende pagina's (diversiteitsmeting in het bestaande evalpakket `src/lib/discovery/eval`); intake blijft binnen 5 pagina's; afhaken op het nieuwe scherm gemeten in PostHog.

### Fase 2 - Aanleiding en doelgroep

**2.1 "Waarvoor zoek je?" op de startpagina**
- Zeven tegels: *gewoon ontdekken* (standaard), *familie-uitje*, *iets met kinderen*, *vakantie of dagje weg*, *vrijgezellenfeest of groepsuitje*, *vrijwilligerswerk*, *nieuwe hobby*. Optioneel, niet verplicht, naast de bestaande zoekcontext.
- Nieuw veld `occasion` in de antwoorden (`answers.ts`) en in de opgeslagen intake; stuurt tag-gewichten, `formats` (groep, familie) en de zoekopdracht van het onderzoek (Haiku).
- Acceptatie: alle zeven routes halen de intake en het boek; `/plan` en mail noemen de aanleiding ("voor jullie familie-uitje").

**2.2 Bibliotheek aanvullen waar de aanleiding leeg is**
- Eerst een lokale dekkingsmeting per aanleiding (hoeveel activiteiten, hoeveel met foto, hoeveel met plek in de steekproefregio's). Dan een voorstel met aantallen per aanleiding.
- Voorstel pas na jouw akkoord op het beeldbudget (B4), met een foto per activiteit, `imageProvenance.json`-regel, `register.json`-register en `npx tsx scripts/taxonomy-check.ts --images` zoals afgesproken.
- Vrijwilligerswerk is een eigen type: geen "cursus", maar een organisatie of project; het onderzoek moet daar anders naar zoeken (zoekhints in `searchHints.manual.json`).
- Kosten: ± $0,13 per 9 activiteiten voor beelden; onderzoekkosten blijven binnen de $0,50 per boek.

### Fase 3 - Diepte per idee

**3.1 Meten voordat we de ondergrens vastleggen (B1)**
- `scripts/compare-search.ts` en `scripts/persona-books.ts` bestaan al. Laat op vijf profielen (stad, dorp, grensgebied, buitenland, groep) zien hoeveel van de vijf ideeën 1, 2 of 3 plekken halen en wat dat per boek kost.
- Kosten: ± $0,26 per boek (laatste meting, Stap 200); vijf boeken ≈ $1,30. **Per bedrag akkoord van Jan.**

**3.2 Regel invoeren, uit de meting**
- Streven 3 plekken per idee, vloer 2; een idee met 1 krijgt een zichtbaar label; een idee zonder plek vervalt zoals nu (Stap 197).
- Status per feit zichtbaar: *geverifieerd* (site gecontroleerd), *indicatief* (schatting). De helft hiervan bestaat al intern (URL-controle, Places-score); het gaat om de weergave in `IdeaDialog.tsx` en de PDF.
- Acceptatie: gemiddeld >= 2,5 plekken per idee in een dichtbevolkt profiel, >= 1,5 in een dun profiel; kostenplafond $0,50 per boek (`costLedger.ts`) blijft hard.

### Fase 4 - Online-first (B3)

- **Besluit 17 nov: de PDF helemaal overal eruit** (niet alleen uit de mail). Eerst een lokale inventaris van alle afhankelijkheden, dan pas bouwen: `src/lib/pdf/` en `renderIdeaBookPdf`, `pdfAccess.ts` en de ondertekende URL, de opslag en de kolommen `pdf_url`/`pdf_version` (migratie draait Jan), `pdfPageNumbers` en `pdfHref` in `PlanReveal`, `WindowDownload.tsx`, de bijlage in `sendIdeaBookEmail`, de teksten `attachmentNote` en `doorsLead`, FAQ, voorbeeldpagina's en `wat-zit-erin`, scripts en e2e-tests die PDF's maken. Eerst bevestigen dat de voorwaarden en het herroepingsrecht (digitale inhoud, levering) niet op een PDF leunen; de levering is dan de online pagina plus de mail.
- Mail wordt: persoonlijke zin, drie belangrijkste ideeën met plaatje en link (staat er sinds Stap 207), wildcard-uitnodiging, knop "Bekijk al je ideeën", vragenlijstknop. Geen PDF-knop meer op `/plan`.
- `/plan`: laag "Ook interessant" (de activiteiten die de bezoeker koos op pagina 2 maar die geen boek-idee werden) als vierde laag, zonder suggestie dat ze zijn onderzocht. Dat vervult het "niet alles wordt uitgewerkt"-punt op een eerlijke manier.
- Later (niet in deze ronde): favorieten bewaren, "gedaan" markeren, opnieuw ontdekken. Het datamodel (hartjes, `commitToIdea`) bestaat al.
- Prijs: pas herzien na Fase 3. De variabele kosten per boek zijn ± $0,26 tot $0,40; de marge op €7,50 is groot, dus een lagere prijs is een commerciële, geen kostengedreven keuze.
- Acceptatie: mail < 1 scherm op mobiel zonder scrollen naar de hoofdlink; `/plan` toont zonder PDF alles; geen enkele pagina verwijst nog naar de PDF als hoofdproduct (teksten nl en en, FAQ, voorbeeldpagina's, `wat-zit-erin`).

### Fase 5 - Selectietest (B5)

- Twee varianten voor de verwachting en prioritering (A: huidig, B: "kies je top 3 uit je selectie"), per bezoeker vast toegewezen, gemeten met bestaande events (`intake_page_viewed`, `idea_liked`, `one_thing_committed`, vragenlijst) in `analyticsEvents.ts`.
- Pas beslissen met een minimum aantal complete intakes. Tot dan geen codewijziging aan het boek zelf.

### Fase 6 - Test en uitrol

- Vijf situaties door de volledige reis (ouder met kind, volwassene met nieuwe hobby, gezin, groep, vrijwilligerswerk) met `scripts/persona-books.ts`. Echte generaties alleen na akkoord op een bedrag.
- Controle voor oplevering volgens de afspraak: `npm run typecheck`, `npx eslint src e2e scripts`, `npx vitest run`, relevante Playwright-tests, schermafbeeldingen op 1440 en 390 px, mailtest in Gmail en Outlook.
- Nieuwe stappen komen onderaan `docs/changelog.md` (vanaf Stap 207).

---

## 5. Wat ik bewust niet overneem uit het ChatGPT-plan

| Voorstel | Waarom niet |
|---|---|
| Zeven vensters als aparte associatiefasen | De app is net compacter gemaakt (Stap 198) op feedback van "te veel tekst en herhaling". Zeven fasen werken tegen die feedback. De drie rondes (plekken, momenten, zintuigen) en de thema-laag geven dezelfde geleidelijke verbreding in minder schermen. |
| 500 tot 1000 activiteiten als doel | Er zijn er 774. De winst zit in de dekking van aanleidingen en in plekken per idee, niet in het totaal. |
| Verplicht account of terugkeerfuncties in de eerste versie | Klantbinding is nuttig, maar pas na bewezen betalingsbereidheid. Het datamodel is al voorbereid. |
| Prijs verlagen omdat de PDF vervalt | Zie samenvatting punt 3. |
| Een abonnement | Terecht door het plan zelf al uitgesloten. |

## 6. Risico's

| Risico | Maatregel |
|---|---|
| Themascherm verlengt de intake en geeft meer afhaken | Meten in PostHog; terugvallen op thema's als filter boven pagina 1 |
| Harde ondergrens van 3 plekken verhoogt de kosten en geeft lege boeken in dunne regio's | Streven in plaats van eis; label bij 1 plek; plafond $0,50 blijft |
| Nieuwe activiteiten zonder foto of thumb | Test op dekking (0.1) en `taxonomy-check` vóór oplevering |
| Verbetering aan kaarten raakt de balans van pagina 1 | Bestaande tests `associations.test.ts` (zwaar, ±620 s alleen draaien) en `twoPages.test.ts` |
| Plan en mail verschuiven naar online en de PDF-fouten blijven onzichtbaar | PDF blijft beschikbaar en getest; geen versienummerverandering zonder `PDF_VERSION` ophogen |

## 7. Aanbevolen eerste opdracht

Fase 0 in één stap (Stap 207): 0.1 tot en met 0.3. Het is lokaal, gratis, lost de twee concrete testerklachten over de mail op en neemt de valse verwachting over de selectie weg. 0.4 volgt als meting. Daarna Fase 1.1 als lokale lijst, ter beoordeling.
