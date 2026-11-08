# De associatielaag (stap 2 van "referentiebibliotheek in de app")

Status: gebouwd en gemeten, **uit** (`KNOWLEDGE_ASSOCIATION_LAYER` leeg). Geen API-kosten gemaakt.

## Wat het is

De 43 app-tags zijn grof: 51 van de 127 referentie-associaties hebben er geen (verwondering, trots, vrijheid, geduld, geur, tast, stilte, warmte,
schoonheid, ...), terwijl dat precies is wat een beeld oproept. De laag voegt een tweede woordenschat toe naast de tags:

| Onderdeel | Bestand | Hoe |
|---|---|---|
| Per beeldfamilie (114) wat het oproept, 3-6 associaties met gewicht 1 / 0,7 / 0,4 | `src/lib/discovery/cardAssociations.json` | met de hand geschreven (`scratch/xl/card_assoc_authoring.py`, niet in git); een test bewaakt echte slugs en gewichten |
| Per activiteit (544 van 702) zijn sterkste associaties, score 3-5, niet-ontdekking, max. 8 | `src/lib/discovery/activityAssociations.json` | gegenereerd: `npx tsx scripts/reference-library/export-activity-associations.ts --write`; de 158 zonder vector zijn de app-activiteiten die niet in de referentiebibliotheek staan |
| Nabijheid = overlap van beide, gedempt met idf (algemene associaties als "trots" zeggen minder dan "geur") en met de "hubness" van de activiteit | `associationLayer.ts`, `concretePool.ts` | zuiver, geen AI |
| Gebruik: pagina 2 van de twee-pagina-intake ("Waar wijzen je beelden naartoe?") houdt ook rekening met wat de gekozen beelden oproepen | `composeConcretePage` (`assocProfile`, gewicht 0,35) | alleen met de vlag aan; de selectiemotor en de harde regels zijn niet aangeraakt |

## Meting (gratis, 400 synthetische bezoekers, `scripts/association-layer-measure.ts`)

| | alleen tags | met laag (0,35) |
|---|---|---|
| verschillende activiteiten aangeboden | 655 | 652 |
| meest aangeboden activiteit (aquarium), aandeel pagina's | 14% | 18% |
| werelden per pagina | 13,1 | 12,9 |
| pagina's waarop een stijlregister-bodem faalt | 0 | 0 |
| overlap van de 18 activiteiten met de tags-only pagina | | 58% |

Eerste versie (gewicht 0,6, zonder hubness-demping) gaf aquarium op 25% van de pagina's: dat is bijgesteld. Het gewicht is niet "optimaal", alleen het hoogste dat de spreiding
niet merkbaar schaadt. Of de pagina's er ook **beter** van worden is niet gemeten (er is geen waarheid om tegen te meten); de voorbeeldsets in het scriptresultaat laten
beide kanten zien: meer passend bij hout en klei (meubels restaureren, makerspace, hoeden maken), bij wind en hoogte (paragliden, via ferrata, surfles), bij warm en stil (high tea,
pizza in een houtoven); verlies van onder meer ballet en jazzconcert bij "warm en stil". Een mens moet beoordelen of dat beter is.

## Gaten (associaties zonder beeldfamilie, gewicht ≥ 0,7)

35 van de 127. Veel zijn handelingen of onderwerpen die slecht als beeld werken (ontwerpen, observeren, taal, zelfstandig). Echte beeldgaten, naar aantal activiteiten:
**smaak** (33), **kunst** (38), **wereldculturen** (30), **duurzaamheid** (35), patronen (16), ornament (19), imperfectie (12), tradities (12), architectuur (11), minimalisme (7), zeevaart (5), wonen (8).
Voorstel: 12 nieuwe families (4 plekken, 4 momenten, 4 zintuigen) van 3 varianten = 36 beelden = 4 vellen 3x3 ≈ $0,54 (+ herhalingen). Nog niet gemaakt: wacht op akkoord.

## Nog niet gedaan

- De laag in de zichtbare uitleg ("daarin lazen we warmte en geur", `sharedAssociations` kan dat al) en in de selectiemotor (de indirect-plek); eerst moet de effect op pagina 2 beoordeeld zijn.
- Een beoordeling door een mens van de beeld-naar-associatie-toewijzing (door mij geschreven) en van de pagina's die de laag aanbiedt.
