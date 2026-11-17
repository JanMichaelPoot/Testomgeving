# Voorstel: de associatiebeelden vervangen door thema-beelden ("Iets met ...")

Status: **akkoord van Jan (17 nov)**: de lijst van 30 klopt, **2 beelden per thema** (afwisselend getoond), **alle 30 op één scherm** met roulerende beelden, de 16 ontbrekende activiteiten zijn geschreven (Stap 208), de oude 516 kaarten **blijven in de data maar worden niet meer getoond**. Nog niet gebouwd; nog geen beelden gegenereerd.

## 1. Wat je vroeg

Alle huidige associatiebeelden (516 kaarten in 172 families: stemmingen, plekken en zintuigen) vervangen door beelden die direct een **gebied** uitdrukken: "iets met natuur", "iets met avontuur", "iets met cultuur", "iets met sport", "iets medisch", "iets met dieren", enzovoort. De lijst moet vrijwel het hele spectrum van de bibliotheek dekken.

## 2. Hoe ik de lijst heb opgebouwd

- Vertrekpunt is wat de bibliotheek **echt bevat**: 22 domeinen en 68 subdomeinen met 774 activiteiten. Een thema dat tot niets leidt zou een lege belofte zijn.
- Elk thema is een combinatie van subdomeinen en tags. Een activiteit mag onder meer thema's vallen (een kajakles is water, avontuur en sport tegelijk).
- **Dekking: 30 thema's raken 774 van 774 activiteiten (100 %).** Dat is de maat voor "vrijwel het hele spectrum".
- Eén thema, "iets medisch of met gezondheid", heeft nu **0 activiteiten**. Dat is een echt gat, zie sectie 4.

## 3. Het voorstel: 30 thema's in 6 groepen

"Activiteiten" is het aantal bibliotheekactiviteiten dat onder het thema valt.

### Buiten & natuur

| id | Thema | Beeld in één oogopslag | Activiteiten |
|---|---|---|---|
| natuur | Iets met natuur | Een bosrand of heuvellandschap in zacht licht | 135 |
| dieren | Iets met dieren | Een paard, schaap of vogel in het veld | 54 |
| water | Iets met water | Meer, zee of rivier met een kano of zeil | 53 |
| tuin | Iets met tuin en planten | Moestuin of kas met groeiende planten | 36 |
| buitenleven | Iets met buitenleven en overleven | Kampvuur of tent in het bos | 21 |

### Beweging & avontuur

| id | Thema | Beeld in één oogopslag | Activiteiten |
|---|---|---|---|
| avontuur | Iets met avontuur | Klimwand, bergtop of rotsspleet met touw | 43 |
| sport | Iets met sport | Loopbaan, bal en sportveld, zonder publiek | 50 |
| snelheid | Iets met snelheid en motoren | Racebaan, motor of zweefvliegtuig | 28 |
| mikken | Iets met mikken en precisie | Doelwit met pijlen of een dartbord | 23 |

### Creatief & cultuur

| id | Thema | Beeld in één oogopslag | Activiteiten |
|---|---|---|---|
| kunst-cultuur | Iets met kunst en cultuur | Museumzaal met schilderijen of een galerie | 37 |
| beeld | Iets met tekenen, schilderen en foto's | Ezel met verf, schetsboek en camera | 43 |
| ambacht | Iets met ambacht en handwerk | Werkbank met hout, klei of textiel | 67 |
| muziek | Iets met muziek | Instrumenten in een lichte kamer | 68 |
| podium | Iets met dans, theater en podium | Podium met gordijn en spotlicht | 74 |
| taal | Iets met schrijven, taal en verhalen | Schrijftafel met boeken, pen en papier | 70 |
| mode | Iets met mode, stijl en schoonheid | Kledingrek, sieraden en bloemen | 21 |

### Hoofd & techniek

| id | Thema | Beeld in één oogopslag | Activiteiten |
|---|---|---|---|
| techniek | Iets met techniek en bouwen | Werkbank met elektronica en tandwielen | 23 |
| wetenschap | Iets met wetenschap en sterren | Telescoop onder een sterrenhemel | 13 |
| spel | Iets met spel, puzzel en strategie | Schaakbord, dobbelstenen, puzzelstukken | 103 |
| mysterie | Iets met mysterie en speurwerk | Muur met aanwijzingen, loep en sleutel | 35 |
| verzamelen | Iets met verzamelen en modelbouw | Vitrine met munten en miniaturen | 50 |
| geschiedenis | Iets met geschiedenis en nostalgie | Oude kaart, kasteelmuur of antiek | 99 |

### Mens & welzijn

| id | Thema | Beeld in één oogopslag | Activiteiten |
|---|---|---|---|
| eten | Iets met eten en drinken | Gedekte tafel met brood, fruit en een kan | 49 |
| rust | Iets met rust en stilte | Kaars, mat en raam met ochtendlicht | 90 |
| zorg | Iets medisch of met gezondheid | Stethoscoop, EHBO-koffer en planten | **0** |
| helpen | Iets met anderen helpen | Gedeelde tuin of buurthuis met open deur | 76 |
| samen | Iets met mensen ontmoeten | Lange tafel met stoelen en lampjes | 131 |
| leren | Iets met leren en groeien | Leeg klaslokaal met een bureau | 110 |

### Uit & weg

| id | Thema | Beeld in één oogopslag | Activiteiten |
|---|---|---|---|
| avond-uit | Iets met een avond uit | Straat met neon en terraslampjes | 13 |
| reizen | Iets met reizen en nieuwe plekken | Perron, kaart en koffer of een stadsgezicht | 18 |

## 4. Gaten in de bibliotheek (en wat er nu aan gedaan is)

**Correctie op de eerste versie van dit voorstel.** Ik schreef dat "iets medisch" 0 activiteiten had en wetenschap 13. Mijn eerste zoekopdracht was te grof: de bibliotheek had al EHBO-cursus, zorgboerderij, bezoekvrijwilliger bij ouderen, gebarentaal, massage, ademwerk, telescoop, wetenschapsmuseum, weerstation, citizen science, microscopie en geologie. Het echte gat was kleiner: er was geen enkele **tag** voor gezondheid en er ontbrak vooral aanbod dat echt medisch of zorggericht is.

**Gedaan (Stap 208, zonder foto, dus zonder kosten):** 16 nieuwe activiteiten, nieuwe tag `health` (Gezondheid), en die tag ook op 5 bestaande activiteiten.

| Thema | Voor | Nu | Nieuw |
|---|---|---|---|
| Iets medisch of met gezondheid | 5 (alleen via losse woorden) | 15 | reanimatie en AED, eerste hulp bij baby’s en kinderen, bloed of plasma geven, vrijwilliger in een hospice, gastheer of gastvrouw in een ziekenhuis, mantelzorgcafé, museum over geneeskunde en het lichaam, gezond-koken-workshop, meekijken in een zorgberoep, anatomisch tekenen |
| Iets met wetenschap en sterren | 13 | 17 | planetarium of sterrenwacht, natuurkundeproefjes, wetenschapscafé, open dag bij een onderzoeksinstituut; daarnaast waterraket bouwen (techniek) en fossielen zoeken (natuur) |

De 16 staan op `image_pending`: ze zijn geschreven en ingedeeld (register, Nederlandse zoektermen) maar blijven onzichtbaar tot hun foto er is. De bibliotheek telt nu 790 activiteiten, waarvan 774 zichtbaar. Alle 790 vallen onder minstens één thema.

## 5. Regels voor de nieuwe beelden

- **Eén hoofdzaak per beeld, herkenbaar zonder tekst.** Wie "natuur" ziet, denkt natuur. Dat is het verschil met de huidige beelden, die een gevoel oproepen ("Zout op je huid").
- Zelfde art direction als nu: warm, premium reismagazine, geen mensen, gezichten of handen, geen tekst in beeld.
- Kleurcodering per groep (zachte accenten uit het bestaande palet), zodat een wand van 30 tegels als geheel overzichtelijk blijft.
- Elke tegel is een hele knop met de tekst "Iets met ...". Beeld en tekst samen, zodat niemand hoeft te raden.

## 6. Gevolgen voor de app (lokaal uit te werken, niet nu)

- De 516 kaarten dragen nu `tagWeights` en `axes`; elk nieuw thema krijgt die uit zijn subdomeinen en tags, zodat de selectiemotor, het profiel en de "Omdat je ... koos"-regel blijven werken.
- De registerbalans, de sierlijke vloer (`GRACEFUL_MIN`) en de nichevloeren (`NICHE_THEMES`) vallen weg of worden herschreven: bij thema's heeft elk gebied een eigen tegel, dus "sierlijk" of "niche" is geen aparte categorie meer. Dat maakt de steekproef eenvoudiger.
- **Fase 1.1 (de lijst van concrete beelden, `docs/fase-1-1-concrete-beelden.md`) vervalt hiermee**, omdat alle huidige kaarten van pagina 1 verdwijnen. De lijst blijft bruikbaar als je de oude kaarten later als verfijning wilt.
- De tweede pagina (concrete activiteiten) blijft; pagina 1 wordt de themakeuze (3 tot 8 thema's) en stuurt de gewichten voor pagina 2.
- Dit vervangt ook Fase 1.2 uit het implementatieplan: daar waren de thema's een extra scherm vóór de beelden; nu worden ze de beelden zelf.

## 7. Kosten

| Optie | Beelden | 3x3-vellen | Kosten (±$0,13 per vel) |
|---|---|---|---|
| Eén beeld per thema | 30 | 4 | ±$0,55 |
| Twee per thema (afwisseling bij herladen) | 60 | 7 | ±$0,95 |
| Drie per thema | 90 | 10 | ±$1,35 |
| Nieuwe activiteiten (zorg en wetenschap, ±16) | 16 | 2 | ±$0,30 |

Eerst een `--dry-run`, daarna pas echt genereren, en alleen met jouw akkoord op het bedrag.

## 8. Besluiten en vervolg

| Vraag | Besluit (Jan, 17 nov) |
|---|---|
| Lijst | Akkoord, 30 thema’s |
| Beelden per thema | 2, op het scherm afwisselend per bezoek |
| Weergave | Alle 30 op één scherm, per groep geordend; elke tegel = beeld + titel + korte omschrijving, helemaal klikbaar, duidelijke geselecteerde staat, bruikbaar met toetsenbord en op mobiel (zie schermvoorbeeld van Jan) |
| Zorg en wetenschap | Activiteiten geschreven (Stap 208) |
| Oude 516 kaarten | Laten staan, niet meer tonen |

**Nog open vóór het genereren: geld.** 60 themabeelden = 7 vellen van 3x3 ≈ $0,95, en de 16 foto’s voor de nieuwe activiteiten = 2 vellen ≈ $0,30. Samen ± $1,25. Eerst een `--dry-run`, dan jouw akkoord op dat bedrag.

**Art direction.** De voorbeeldschermen die je stuurde tonen mensen en handen (een klimmer, een pottenbakker). Onze regel is tot nu toe: geen mensen, gezichten of handen. Mijn voorstel: bij de themabeelden de regel iets verruimen tot "geen herkenbare gezichten; mensen mogen klein of van achteren in beeld", en handen toestaan waar dat het thema draagt (klei, schilderen). Zeg het als je het strak wilt houden.

**Bouwvolgorde (elk blok apart op te leveren en te testen)**
1. Themadata: de 30 thema’s met gewichten (tags en assen) uit hun subdomeinen, plus de tegelomschrijvingen nl en en. Lokaal en gratis.
2. Nieuwe steekproef voor pagina 1: alle 30 tonen, 2 beelden per thema met rotatie per bezoek; de oude kaarten blijven in de data maar worden niet meer getoond.
3. De tegel-UI (hele tegel is een knop, geselecteerde staat, toegankelijk) met tijdelijke beelden uit de bestaande foto’s, zodat het scherm al te beoordelen is.
4. Beelden genereren (na akkoord op het bedrag) en de tijdelijke vervangen; herkomstregels in `imageProvenance.json`.
5. Profielscherm en "Omdat je ... koos"-regel aanpassen naar thema’s; testen en meten (afhaken, diversiteit).
