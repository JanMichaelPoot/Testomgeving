# Centrale intakepagina, doelgroepherkenning en dynamische profielopbouw

Opdracht: één centrale startpagina vóór de associatiefase ("voor wie, waar, randvoorwaarden"), de latere locatiepagina daarin
opnemen en verwijderen, de associatiefase doelgroepbewust maken en de generator het profiel laten gebruiken.
Dit document is de analyse (Fase A) en het ontwerp (Fase B). Wat er gebouwd en getest is staat in `CLAUDE.md` (Stap 133).

## Fase A, analyse van wat er was

**Route van de twee-pagina-intake (`images2`, de standaard)**, in `src/lib/vensterPages.ts`: `images` → `concrete` → `situation` → `profile`.

| Onderdeel | Waar | Wat het deed |
|---|---|---|
| Locatiepagina | `situation` in `AssociationWizard.tsx` | plaats (PDOK-suggesties, verplicht sinds Stap 130), afstand (`city`/`hour`/`anywhere`), tijd, budget, gezelschap (verplicht); onder "Meer opgeven": hoe, leeftijd, harde grenzen (chips + vrije tekst) |
| Opslag | `IntakeAnswers` (`src/app/intake/actions.ts`), `intake_answers.raw_json` | `location`, `searchDistance`, `timeAvailable`, `budget`, `company`, `socialFormats`, `ageCategory`, `mustHaves` (chips + tekst samengevoegd bij het betalen) |
| Beelden | `associations.json` (342 kaarten), `twoPages.ts` (`sampleBalancedBatch`, `composeConcretePage`) | 18 beelden gebalanceerd over vier stijlregisters en vier assen; pagina 2 volgt de gekozen beelden |
| Doelgroep | `agePenalty` in `engine/select.ts` | alleen een zachte leeftijdsweging uit `ageCategory`, nooit uitsluiten; geen begrip van "voor wie" |
| Vertaallaag | `imageIntake.ts` (`applyImageIntake`) | beelden en eigen keuzes worden de antwoorden die engine, prompt en PDF lezen |
| Generator | `generateFromSeeds.ts` / `generateIdeaBook.ts` (`formatProfile`) | plaats en afstand gaan naar het lokale onderzoek (`localResearch.ts`), `mustHaves` naar de harde filters en de prompt |
| Cadeau | `purpose: "gift"`, `recipientName`, de landingsknop | alle woorden "voor {naam}", losse naamvraag op het eerste beeldscherm |

**Wat kon blijven**: elk invoerveld, de PDOK-koppeling, de afstanden, `mustHaves`-parser, de sampler en de engine. **Wat ontbrak**: een
"voor wie" (de kern van de opdracht), een profiel met herkomst en betrouwbaarheid, doelgroep-effect op de beeldselectie, en veiligheid
voor minderjarigen.

## Fase B, ontwerp

### Nieuwe route
`start` → `images` → `concrete` → `profile`. Het oude scherm `situation` is uit de twee-pagina-route verdwenen: plaats, afstand en
randvoorwaarden worden één keer gevraagd, helemaal aan het begin. De vierrondes-intake (alleen bereikbaar met
`NEXT_PUBLIC_IMAGES2_PERCENT=0`) houdt zijn eigen situatiescherm, omdat die route de terugvaloptie is en niet is aangeraakt.

### De startpagina in drie delen (`startPage` in `AssociationWizard.tsx`)
- **A, voor wie** (`dict.venster.start.who`): vijf visuele keuzes (zelf, kind of jongere, andere volwassene, oudere, groep) met een
  eigen lijnicoon (`ContextIcon.tsx`). Niets kiezen = intern `unknown`; opnieuw tikken zet een keuze terug. Bij een cadeau (landingsknop)
  valt "voor mezelf" weg. Optionele voornaam (niet bij een groep). Geen vraag naar geslacht.
- **B, waar**: de bestaande plaatsvraag met PDOK-suggesties en de bestaande drie afstanden. De plaats is het enige verplichte antwoord.
- **C, randvoorwaarden (optioneel)**: tijd, budget, met wie, "wat moet kloppen?" (de bestaande chips plus drie nieuwe voor vervoer en
  moment: *zonder auto bereikbaar*, *in het weekend*, *'s avonds*), en onder "Meer opgeven" hoe je meedoet, leeftijd en vrije tekst.
  Nieuwe velden alleen waar de generator er iets mee kan: de drie nieuwe chips zijn `verify`-vlaggen in de must-have-parser.

### Opslag
`IntakeAnswers.searchContext` (explicit, op de server opnieuw genormaliseerd) en `IntakeAnswers.audienceProfile` (alleen door de server
gebouwd, nooit uit de browser). Concept in sessionStorage kreeg `layout: 2`; een concept van vóór de startpagina wordt op de dichtstbijzijnde
pagina gezet (`migrateTwoPageDraft`).

### Zoekcontext is niet leeftijd (`src/lib/discovery/audience.ts`)
- "Voor mezelf" zegt niets over leeftijd; "kind of jongere" niet of het een kind of tiener is; "groep" is niet één leeftijd.
- Een expliciete leeftijd wint altijd. Alleen `child` (zacht: `under18`) en `senior` (zacht: `65plus`) geven een standaard aan de
  leeftijdsweging, en die weging sluit nooit iets uit (`effectiveAgeCategory`).
- **Eén harde regel**: bij `child` worden alcohol, kansspel, wapens, zwaar of scherp gereedschap en risico- of motorsporten met een volwassen minimumleeftijd niet aangeboden
  (`MINOR_UNSUITABLE`, een expliciete lijst), in de engine (`ResolvedConstraints.minorSafe`), op pagina 2 en in "Dit kon niet mee".
  De bibliotheek heeft geen leeftijdsveld, dus dit is een korte, expliciete lijst; voeg een id toe bij een nieuwe activiteit.
- `group` krijgt een kleine voorkeur voor dingen die je samen kunt doen (`audienceBias`).

### Beeldselectie
- **Eerste pagina**: `sampleBalancedBatch(..., { prefer })`: elke tweede plek gaat naar de beelden die het best bij de context passen
  (`CONTEXT_TAG_LEAN`, per tag, afgeleid van de tags die een beeld al draagt; beelden hebben geen leeftijd), de plekken ertussen blijven
  de seeded willekeurige volgorde. De registerbodems, de assenbalans en de rondes gelden nog. Voor `self`, `adult` en `unknown` is er geen
  voorkeur. Voor `senior` zijn er geen negatieve gewichten, zodat ouderen niet alleen rustig en traditioneel te zien krijgen.
- **Vervolg ("Andere beelden")**: afwisselend een beeld dichtbij wat al gekozen is en een beeld dat nog niet in de keuzes voorkomt
  (`imagePreference`), dus het profiel wordt verdiept én verbreed.
- **Pagina 2**: dezelfde context, als kleine toevoeging op de score (`prefer`), met het bestaande vaste aantal verkenplekken.
- Een eerste pagina die al getoond is verspringt niet meer als de context later verandert (`imageFirst` in het concept).

### Dynamic Audience & Interest Profile (`buildAudienceProfile`)
Zes dimensies: zoekcontext, doelgroep, leefwereld, interesses, activiteitenoriëntatie, individuele voorkeuren. Elke dimensie heeft een
herkomst (`explicit`, `inferred`, `unknown`) en een betrouwbaarheid (0 tot 1). Onder de ondergrens (0,3) blijft een dimensie `unknown`:
er worden geen conclusies geforceerd. Eigen gekozen activiteiten tellen als expliciet en zwaarder dan beelden. Geen geslacht, en de
stijlregisters komen er niet in. Gebouwd in `applyImageIntake` (server) en opgeslagen bij de antwoorden.

### Generator
`formatProfile` voegt `describeAudienceForPrompt` toe: de context met herkomst, de leeftijdsfase (en bij kind of oudere de uitdrukkelijke
waarschuwing niets aan te nemen), interesses, oriëntatie en voorkeuren elk met "stated" of "inferred ... confidence", en de regel dat er altijd
een idee buiten de interesses moet liggen. Een zoekopdracht voor iemand anders (geen cadeau) schrijft het boek aan die persoon of groep
(`otherLines`). Plaats, afstand en randvoorwaarden bereikten de generator al; ze komen nu van de startpagina. Een groep krijgt ideeën die
bij een gemengd gezelschap standhouden.

## Bekende grenzen
- Beelden dragen geen leeftijd; de voorkeur per context volgt uit tags en is een tendens, geen meting.
- De leeftijdsfase van een kind of jongere blijft ruw (`child_or_youth`); de beelden verfijnen interesses, niet de leeftijd.
- Vervoer, weekend en avond worden gecontroleerd (`verify`-vlaggen en de prompt), niet gefilterd: de bibliotheek heeft er geen data over.
- De PDF-omslag zegt bij een groep zonder naam "voor jou"; een apart groepswoord staat nog niet in de omslagcopy.
