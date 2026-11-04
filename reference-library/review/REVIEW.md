# Review van de referentiebibliotheek, ronde 1

Datum: 2026-11-05. Omvang: alle 550 activiteiten, 127 associaties, 8.883 koppelingen.
De volledige lijst bevindingen staat in `findings.json` (en in het Excel-tabblad *Review*).

## Hoe er is beoordeeld

Eerst een geautomatiseerde audit van alle records (trefwoordregels, gelijkenis van koppelingen, scorestatistiek,
taalpariteit). Daarna zijn de sterkste activiteiten van elke associatie en elk gemarkeerd record met de hand gelezen,
vanuit vier rollen:

| Rol | Kijkt naar |
|---|---|
| Ambachtsmeester | materialen, technieken, klopt een vaardigheids- of esthetiekkoppeling met het echte werk |
| Sport- en avontuurcoach met veiligheidsachtergrond | veiligheidsklasse, binnen/buiten, fysieke associaties, eerlijk over risico en inspanning |
| Cultuurhistoricus en docent | feitelijke beweringen in de ontdekkingsredenen, zijn de bruggen zinvol, culturele balans |
| Taxonoom en UX-onderzoeker | overlap en gaten in de woordenlijst, scoredisipline, bijna-dubbelen, consistentie, taalpariteit |

**Eerlijke beperking:** dit is één AI die vier rollen speelt, geen beoordeling door vier mensen. Feiten zijn getoetst aan
mijn kennis, niet aan bronnen. Alle records blijven op status *Concept*; *Reviewed* is gereserveerd voor een mens.

## Wat is aangepast

**Woordenlijst: 112 naar 127 associaties.** Vijftien nieuwe, elk met definitie in NL en EN en koppelingen:
muziek (47 activiteiten), taal en schrift (38), spellen en spelregels (33), voertuigen en vervoer (28), ambacht en vakwerk (48),
online en digitaal (29), café en uitgaan (26), museum, theater en bibliotheek (21), leren en groeien (33), snelheid (30),
luisteren en inleven (34), conditie en kracht (43), coördinatie en balans (46), kans en geluk (18), miniatuur en schaal (21).
Reden: een derde van de bibliotheek ging over muziek, taal of spel zonder dat daar een thema voor was, sport werd alleen via
"beweging" beschreven, en ambacht (het hart van de bibliotheek) had geen eigen thema.

**Afbakening.** 29 associaties die makkelijk door elkaar lopen hebben nu een korte *scope*-notitie (wat het niet is, welke buur
je dan gebruikt): rust/stilte/welzijn, zorg/welzijn, gemeenschap/gezelligheid, ontdekking/verwondering, geschiedenis/tradities/nostalgie,
precisie/detail, kunst/schoonheid, trots/meesterschap en meer. Staat in het tabblad *Associations*.

**Scoredisipline.** `trots` stond op 43% van de activiteiten en `concentratie` op 43%, waardoor ze weinig onderscheiden.
170 zwakke generieke koppelingen zijn weggehaald; `trots` zit nu op 18%, `concentratie` op 37%. 22 generieke score-5-koppelingen
bij ambachten zijn naar 4 gezet.

**Feiten.** Twaalf absolute beweringen ("het oudste", "als eerste", "opgelost") zijn gecontroleerd. Eén was fout:
"computers hebben dammen opgelost" geldt alleen voor het Engelse 8x8-spel, niet voor 10x10-dammen. Elf redenen zijn in
beide talen voorzichtiger geformuleerd. Twee zwakke ontdekkingsredenen (vlog-maken/humor, lezing-workshop-geven/zorg) zijn herschreven.

**Veiligheid.** Twee echte gevallen gevonden door te lezen: `vijver-aanleggen` (graven naast open water) en `cyanotypie`
(fotochemicaliën) zijn naar veiligheidsklasse 1 gegaan. De 37 trefwoordhits in klasse 0 waren verder vals alarm.

**Consistentie.** Tegenstrijdige sterke koppelingen op drie records onderzocht; `sashiko-herstellen` gerepareerd
(minimalisme naar 3), de andere twee zijn terecht (luisteren in stilte, een stille nacht met nachtgeluiden).

**Bijna-dubbelen.** Negen paren met 90% of meer gelijke koppelingen, na de andere wijzigingen nog vijf (zwemmen/zwemmen-baantjes,
padel/badminton, vechtsport/boksles, tuinmeubels-maken/vlonder-bouwen, buurtmaaltijd/potluck). Elk staat als opmerking op beide records.

**Per record:** `qa` (ronde 1, *aangepast* of *gecontroleerd*) en waar nodig `qa_notes` (ingeschatte kenmerken, overlap, bewuste gaten).
Zichtbaar in *Activities*.

## Wat klopt en is dus niet veranderd

- Alle materiaalkoppelingen met score 4-5 (hout, papier, textiel, verf, metaal, steen, leer, klei, glas): geen foute gevonden.
- Elf records met een afwijkende binnen/buiten-combinatie (zwembad, windtunnel, pizzaoven): terecht.
- Taalpariteit: geen onvertaalde omschrijving of reden; de 19 gelijke namen zijn leenwoorden (yoga, sudoku, go).

## Wat nog openstaat

1. **Mens-beoordeling.** Scores en redenen zijn nog steeds het oordeel van één beoordelaar. Een steekproef door een mens, en
   een bronnencontrole van de genoemde feiten (Anna Atkins 1843, eerste ballonvaarten 1783, UNESCO-lijsten, Zumba), is nodig voor je ze aan bezoekers toont.
2. **Culturele balans.** Voorbeelden en bruggen leunen Nederlands/westers. Een volgende batch met niet-westerse ambachten, muziek en spellen helpt.
3. **Ontdekkingsbruggen.** Ze leunen nog op wetenschap (128 van 1.100), geschiedenis (89), verhalen (80), tradities (69); samen 27%, onder de alarmgrens
   van 30%. De eerste batches kunnen naar de smallere nieuwe associaties worden omgezet.
4. **Dekking van de app.** Circa 160 van de 578 app-activiteiten staan nog niet in de referentiebibliotheek.
5. **Was en zeep** als materiaal ontbreekt (kaarsen-gieten, zeep-maken); pas toevoegen als er meer van die ambachten komen.

## Advies voor de app (niet doorgevoerd)

Dertien voorgestelde extra tags voor `vocabulary.json`: strength, coordination, speed, listening, digital, mobility, music,
tradition, spirituality, seafaring, weather, humour, fairness (met reden in `findings.json` en tabblad *App_Vocabulaire_Advies*).
**Niet toegepast**: nieuwe tags veranderen de relatiegraaf, de scores van de motor en de opgeslagen basislijnen; dat is een
eigen besluit met eigen metingen. Verder aanbevolen voor de app zelf: `zwemmen` en `zwemmen-baantjes` samenvoegen, en
veiligheidsklasse heroverwegen voor `synthesizer-bouwen` (solderen) en `nachtdieren` (in het donker).
