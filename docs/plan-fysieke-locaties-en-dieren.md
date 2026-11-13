# Plan: fysieke locaties eerst bij de concrete opties, en activiteiten met dieren

Opdracht van Jan (13 nov 2026), met een correctie dezelfde dag: de **activiteiten** zelf blijven zoals ze zijn (thuis of online blijft mogelijk). Het gaat om de **concrete opties met de Google-link in het boekje**: die moeten voor cursussen en workshops **eerst fysieke locaties** zoeken (workshops, studio's, georganiseerde uitjes, speellocaties) en **pas ten slotte** ook online varianten. Daarnaast: activiteiten met dieren (knuffelen, wedstrijden, vissen, jagen, enzovoort).

## Onderdeel A: fysiek eerst, online als laatste (gebouwd, Stap 175)

**Wat er voor was.** Het lokale zoeken vroeg naar "echte opties", zonder te zeggen dat het een plek moest zijn. De online-ronde (`mode: "online"`) volgde zodra er niets in de buurt was, en het schrijven mocht eerste stappen als "open Google en zoek" of "download de app" kiezen. In de vier persona-boeken (sectie K) stond daardoor bij fietsreparatie een online videocursus, bij diorama's een webshop en bij een leerplatform een gratis account, ook waar een plek in de buurt bestaat.

**De volgorde nu, per idee:**
1. **Lokale zoekronde, alleen fysieke plekken.** De opdracht noemt workshops, studio's, ateliers, scholen, clubs en verenigingen met proeflessen, georganiseerde uitjes, speel- en activiteitenlocaties, boerderijen, dierenparken en natuurplekken. Een online cursus, videoles, app, webshop, startpakket of landelijke organisatie zonder lokaal adres telt niet; de optie krijgt de echte plaats van de aanbieder. Een controle achter de opdracht (`isPhysicalOption`) haalt een optie weg die toch "Online", alleen een land of een webshop-naam heeft.
2. **Dubbele straal.** Een idee zonder optie krijgt één keer een zoekronde over twee keer de gekozen afstand (maximaal 150 km; niet als de bezoeker al 100 km of heel Nederland kiest). De log noemt het (`widened_radius:`).
3. **Vervangen.** Heeft het idee dan nog niets, dan werken de bestaande vervangingsrondes (een ander idee).
4. **Online als laatste redmiddel.** Pas voor wat dan nog niets heeft komt de bestaande online-ronde (een online cursus, een webshop, een landelijke club). Hij is dus niet weg, maar niet meer gelijkwaardig.

**Het schrijven.** De schrijfregel voor `details` en `first_action` zegt nu: staat er een fysieke plek bij het idee, dan is stap 1 daar contact opnemen of langsgaan (boeken, bellen, openingstijden of de proefles controleren) en gebruikt de website alleen om te boeken; staan er alleen online aanbieders bij ("Online"), dan is de aanbieder de weg erin; een online aanbieder gaat nooit voor een fysieke plek die erbij staat. Zonder gevonden optie: "zoek op Google Maps en bel de dichtstbijzijnde".

**De kwaliteitspoort.** Nieuwe controle `online_start`: heeft een idee een fysieke plek en stuurt de eerste stap of een detail toch naar een download, app, account, online cursus, videoles of webshop, dan herschrijft `qualityRepair` het naar een bezoek, telefoontje of boeking bij die plek. Een idee waarvan alleen online aanbieders bekend zijn, wordt niet gecontroleerd.

**De Google-link in het boekje.** De "Kaart"-link (Google Maps) stond bij elke optie, ook bij een online aanbieder, waar een zoekopdracht "MAX Vandaag, Online" niets zegt. Nu krijgt een fysieke plek de kaartlink en een online aanbieder alleen zijn website (`hasMapLink` in `maps.ts`; de pagina en de PDF). Een oud boek zonder plaats houdt zijn link.

**De cache.** De opgeslagen zoekresultaten gaan van `v3` naar `v4`: oudere antwoorden kunnen online aanbieders bevatten en worden niet meer vertrouwd, dus de eerste boeken zoeken opnieuw (iets meer zoekkosten, eenmalig).

**Wat niet is veranderd.** Geen filter op activiteiten, geen chip, geen veld per activiteit: een thuis- of online-activiteit blijft in de selectie en op pagina 2.

**Nog te meten (kost geld).** Of dit in echte boeken werkt: het aandeel ideeën met een fysieke plek, en of een online aanbieder alleen nog verschijnt waar niets fysieks bestaat. Dat vraagt dezelfde vier persona-boeken als in sectie K (± $0,22 per boek, ± $0,9) en een akkoord van Jan.

## Onderdeel B: activiteiten met dieren (gebouwd, Stap 176)

Ongeveer 30 nieuwe activiteiten in vijf groepen; ze krijgen de gewone bibliotheekvelden en komen dus ook langs de fysieke zoekronde van onderdeel A.

| Groep | Nieuw (voorstel) | Bestaand |
|---|---|---|
| Knuffelen en zacht | kattencafé, geitenyoga, lama- of ezeltocht, lammetjesdag (lente), konijnen en cavia's knuffelen bij een opvang, kuikens en lammeren kijken | kinderboerderij, alpaca-wandeling, dierenasiel (honden uitlaten), dierentuin |
| Wedstrijden en shows kijken of meedoen | hondenshow, ponysprong- en dressuurwedstrijd, duivenwedstrijd, pluimveetentoonstelling (winter), schapendrijven met border collies, trekpaardwedstrijd, ringrijden (zomer) | paardenrennen, hondensport, stoeterij, roofvogelshow |
| Vissen | karpervissen-proefdag, vliegviscursus, zeevissen op een kotter, kinderen vissen aan een visvijver, garnalen of krabben vangen (Waddenkust, zomer) | vissen |
| Jagen en wildkijken | kennismakingsdag jachtopleiding, wildkijken met een boswachter (hertenbronst, sept tot okt), valkerij-ervaring, jachthoorn blazen, apport-training met jachthonden bekijken | kleiduifschieten |
| Dieren houden en verzorgen | bijen houden (imkerdag), pluimvee verzorgen, paardenverzorgingsdag | imkeren, duiven-houden, paardrijden |

Randvoorwaarden:
- **Wet en vergunning.** Jagen mag in Nederland alleen met een jachtakte en vissen alleen met een VISpas (en toestemming van de visrechthebbende). De activiteiten zijn kennismakingen (een open dag, een clinic, meekijken), nooit "ga jagen". De schrijver noemt de vereiste vergunning en laat ernaar vragen bij het boeken. Alles wat tot jagen leidt, krijgt `safety.tier` 2 (alleen onder gekwalificeerde begeleiding), net als schieten nu.
- **Leeftijd.** Jachtkennismaking, kleiduiven en valkerij komen op `MINOR_UNSUITABLE`; vissen met kinderen en knuffelen niet.
- **Dierenwelzijn en smaak.** Een chip "Zonder jagen of vissen" onder "Eten en drinken" en een bredere "Zonder dieren" voor wie bang of allergisch is. Zonder die chips kan een bezoeker die dit niet wil een jachtidee krijgen; dat is het ene echte risico van dit onderdeel.
- **Seizoen.** Lammetjesdag, hertenbronst, pluimveetentoonstelling, ringrijden en krabben vangen krijgen `months`.
- **Beelden.** Zes tot acht nieuwe beeldfamilies van drie varianten (vissen bij zonsopgang, een valkerij-stal, een lege behendigheidsbaan, geiten op hooi, een kattencafé, een duivenhok, een springpiste, een hoogzit), zonder mensen of handen: 18 tot 24 beelden, ± **$0,40 tot $0,55**, pas na akkoord.
- **Per activiteit**: label nl en en, tags, `sub` en `domain`, `register.json`, `cardAssociations.json`, een beeldscène, `months`, `safety`, `supply`; `taxonomy:check` en de bibliotheektests bewaken de volledigheid.

## Fasering en beslispunten

| Fase | Inhoud | Kosten | Stand |
|---|---|---|---|
| 1 | Onderdeel A | $0 | **gebouwd** |
| 2 | Onderdeel B: 27 activiteiten, twee uitzet-chips, vergunningsnotitie, seizoen, 27 activiteitsfoto's ($0,40) | $0,40 | **gebouwd** |
| 3 | Meting met echte boeken | $0,50 akkoord; besteed $0,33 (boek P13 $0,254 + één losse zoekronde $0,079) | **uitgevoerd, één boek**: zie onderaan |

Besloten door Jan (13 nov): jagen als kennismaking met vergunninguitleg en een uitzet-chip; beeldbudget akkoord. Nog open: de meting met echte boeken (± $0,9 tot $1,1) wacht op een akkoord.

Afwijking van het plan: de 27 beelden zijn de activiteitsfoto's voor pagina 2 (nodig om de activiteiten te tonen), geen nieuwe beeldfamilies voor pagina 1; die hadden het budget overschreden en kunnen later.

## Meting (13 nov 2026): P13, Jan en Ria (68 en 70, geen auto, rustig tempo)

Eén echt boek (de reserve van $0,25 per boek liet binnen $0,50 geen tweede toe; $0,254) en één losse zoekronde als diagnose ($0,079).

- **Fysieke zoekronde:** 2 van 7 ideeën kregen een fysieke optie (trekvogelexcursie Griftpark, klaverjasvereniging Utrecht). Paardenverzorging, wandelmeditatie, nordic walking, nestkast en fietsreparatie vonden in de eerste ronden niets en vielen terug op online (NHA, Mindfulness.nl, MAX, een bouwpakket-webshop). Nordic walking kreeg helemaal geen optie.
- **De schrijver doet wat is afgesproken** waar hij kan: bij paardenverzorging staat stap 1 "zoek een manege op Google Maps en bel", met de online cursus alleen als tweede. Bij insectenhotel, wandelmeditatie en fietsreparatie staat de online aanbieder vooraan, omdat er niets fysieks bekend was.
- **Waarom leeg?** De losse zoekronde (zelfde prompt, zelfde model) vond wél een manege voor paardenverzorging (Stal van Brenk, Utrecht), maar niets voor nordic walking (alleen cursusdata uit 2024), wandelmeditatie (data verlopen) en nestkast (geen workshop in november). Twee oorzaken dus: ruis tussen twee zoekrondes (paardenverzorging stond in het boek als leeg opgeslagen) en de strenge regel "binnen vier weken te doen" in een seizoenstille maand, die terecht lege uitkomsten geeft.
- **Fietsreparatie** vindt geen plek omdat de zoekopdracht naar workshops en studio's zoekt; een repair café of fietsenmaker met cursus valt erbuiten. Mogelijke verbetering (niet gebouwd): per activiteit een zoekwoord-hint ("repair café", "manege proefles"), of een tweede poging bij een leeg resultaat voor een idee dat de bezoeker zelf koos.
- **Dieren:** paardenverzorgingsdag en ganzenkijken (uit de nieuwe set) zaten in dit boek en kwamen goed door de pijplijn.
- Eén boek is geen statistiek: de aantallen zijn een indicatie, geen meting.

## Onderdeel C: geen idee zonder optie (gebouwd, Stap 177)

Opdracht van Jan (14 nov 2026) na de meting hierboven: de opties in het boek moeten goed en nuttig zijn, er mogen geen lege uitkomsten zijn, en desnoods wordt een ander idee uitgewerkt. Volgorde nu per idee: standaard zoeken met zoektermen per activiteit, breed zoeken op dezelfde afstand, dubbele afstand, een ander idee (voor eigen keuzes een verwante activiteit, met een zin in het boek), en pas als allerlaatste online. Een plek wordt niet voor twee ideeën gebruikt en het onderzoek stopt na 120 seconden met nieuwe rondes. Details en tests: `docs/changelog.md`, Stap 177.

Nog te meten (kost geld): twee echte boeken (P13 en P04, ± $0,6) om te zien hoeveel ideeën nu een fysieke optie hebben en wat de extra zoekrondes kosten (verwacht: $0,05 tot $0,12 per boek meer).
