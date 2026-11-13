import { h1, h2, h3, p, ul, ol, laagA, laagB, fig, tab, code, note, facts, pb, steps } from "./dsl.mjs";

// ====================================================================================================================
// Front matter: reading guide
// ====================================================================================================================
export const leeswijzer = h1("leeswijzer", "Leeswijzer", { unnumbered: true, blocks: [
  p("Dit document beschrijft hoe WindowInto werkt, vanuit de code zoals die nu in de repository staat. Het is geschreven voor de oprichter en ontwikkelaar, en het is zo opgebouwd dat iemand zonder technische achtergrond de grote lijn kan volgen. Wie dieper wil, vindt per onderdeel een technisch kader."),
  h2("Waarop dit document is gebaseerd"),
  ul([
    "De broncode van de branch `site-optimalisatie`, laatste commit `0844364` (13 november 2026), met de documentatie in `docs/` en het bouwlogboek `docs/changelog.md`.",
    "Vier eerder gegenereerde meetboeken (persona's P04, P10, P12 en P13, in `scratch/persona-books/`) voor wat het zoeken naar echte plekken oplevert en kost.",
    "Lokale, gratis runs van de echte selectiemotor op drie fictieve profielen en op de echte bibliotheek (hoofdstuk 11). Dezelfde scripts staan in `docs/whitepaper/src/probe/`, zodat elk getal opnieuw te berekenen is.",
  ]),
  h2("Wat bewust niet is gedaan"),
  ul([
    "Er zijn geen betaalde aanroepen gedaan: geen live zoekopdracht, geen nieuw boek, geen afbeelding. Waar dit document iets over het zoeken zegt, komt het uit de code of uit een eerder gegenereerd meetboek.",
    "De instellingen op Vercel zijn niet ingezien. Bij elke schakelaar noemt dit document de standaardwaarde uit de code; wat live feitelijk aan staat kan daarvan afwijken (hoofdstuk 9, {tab:flags}).",
    "De live site is niet doorlopen en er is niets gecommit of gepubliceerd.",
  ]),
  h2("Hoe betrouwbaar is elke bewering?"),
  p("Alles wat hier staat is aan de code te toetsen. Waar de werking niet volledig uit de code volgt, staat dat erbij. Drie labels onderscheiden wat bestaat van wat een idee is:"),
  tab("labels", "De drie statuslabels", ["Label", "Betekenis"], [
    ["**Bestaat**", "Aantoonbaar in de code en actief in de standaardinstelling."],
    ["**Gedeeltelijk**", "Gebouwd, maar standaard uit, niet overal aangesloten, of met een bekend gat."],
    ["**Idee**", "Staat alleen in de aanbevelingen (hoofdstuk 13). Niet gebouwd."],
  ], { widths: [22, 78] }),
  p("Waar documentatie en code elkaar tegenspreken, volgt dit document de code. Alle tegenstrijdigheden staan in bijlage C."),
  h2("Twee lagen"),
  laagA("**Laag A** is de uitleg in gewone woorden, vaak met een vergelijking. Dit is het blok met het gouden randje, zoals dit."),
  laagB("Laag B: technische verdieping", [p("**Laag B** is het technische kader: de componenten, gegevensstructuren, formules en beperkingen. Dit blok heeft een donkere rand en bevat bestandsnamen tussen `codeletters`.")]),
  h2("Kleuren in de figuren"),
  p("Alle diagrammen gebruiken dezelfde kleuren, zodat je in één blik ziet wie iets doet."),
  tab("kleuren", "Kleurcode van de figuren", ["Kleur", "Wie of wat"], [
    ["**Goud**", "De bezoeker: wat hij of zij doet of beslist."],
    ["**Walnoot**", "Eigen code van WindowInto, in de browser en op de server."],
    ["**Leiblauw**", "Gegevens die worden bewaard of doorgegeven."],
    ["**Paars**", "Een aanroep van een taalmodel (Anthropic Claude)."],
    ["**Salie**", "Externe bronnen en diensten: het web, Stripe, Resend, PDOK."],
  ], { widths: [22, 78] }),
  h2("Een opmerking over \"de zeven vensters\""),
  p("De opdracht noemt zeven WindowInto-vensters. In de code bestaat die term niet als scherm. Wat er wel is: het **venster** als merkmetafoor (een raam dat zich met je keuzes vult), en **zeven ontdekkingsniveaus** (`src/lib/discoveryLevels.ts`), die in het verbeterplan \"de zeven vensters\" heten. Elk idee in het boek is precies één venster op die ladder, van Vertrouwd tot Onontdekt. Dit document leest \"de zeven vensters\" daarom als de zeven niveaus (hoofdstuk 5). De bezoeker ziet die niveaus niet: een test bewaakt dat ze buiten alles blijven wat een bezoeker leest. Hij of zij ziet vier deuren en een verzegelde wildcard."),
  tab("begrippen", "Begrippen die steeds terugkomen", ["Begrip", "Wat het is"], [
    ["Venster", "De merkmetafoor: een raam dat zich ruit voor ruit vult met je keuzes. Ook de naam van de intake."],
    ["Beeldkaart en familie", "Een foto van een plek, moment of zintuig. Een familie is een groep van drie varianten van hetzelfde beeld."],
    ["Tag en as", "Een tag is een gewogen kenmerk (zoals *vakmanschap*). Een as is een schaal van -1 tot 1 (sociaal, energie, binnen of buiten, vertrouwd of nieuw)."],
    ["Wereld", "Een hoofdgroep van activiteiten (22), met subdomeinen (68). In de code `domain` en `sub`."],
    ["Activiteit", "Een concrete bezigheid uit de bibliotheek, zoals *Kaarsen maken*. Nog geen aanbieder en geen plek."],
    ["Zaad (seed)", "Het resultaat van de selectiemotor: een activiteit met een richting, een deur, een niveau en een verklaring."],
    ["Anker", "Een activiteit die de bezoeker zelf koos op pagina 2. Tot vier ankers komen zeker in het boek."],
    ["Deur", "Hoe een idee in het boek heet: Vertrouwd, Ontdekking, Onverwacht, Uitdaging, en de verzegelde Wildcard."],
    ["Niveau", "Interne ordening van zaden van 1 (Vertrouwd) tot 7 (Onontdekt). Zie hoofdstuk 5."],
    ["Brug", "Een gedeelde, niet-generieke tag tussen twee activiteiten. Hoe zeldzamer de tag, hoe zwaarder de brug."],
    ["Optie", "Een echte plek of aanbieder die het zoeken vond voor een activiteit, met naam, plaats, link en notitie."],
    ["Boek (Idea Book)", "Het betaalde resultaat: zes ideeën en een wildcard, als webpagina, PDF en e-mail."],
  ], { widths: [24, 76] }),
] });

// ====================================================================================================================
// Chapter 1
// ====================================================================================================================
export const ch1 = h1("ch1", "Executive overview", { blocks: [
  laagA("WindowInto werkt als een ontdekkingstocht. Je begint niet met een vraag maar met plaatjes: je tikt aan wat je aantrekt. Uit die keuzes leest de applicatie je smaak af, en daarna kiest ze zeven dingen om te proberen, van heel vertrouwd tot iets waar je zelf niet op zou komen. Bij elk ding hoort een echte plek of aanbieder bij jou in de buurt."),
  h2("Wat is WindowInto?"),
  p("WindowInto is een webapplicatie voor het ontdekken van nieuwe dingen om te doen. In ongeveer drie minuten tikt een bezoeker beelden en activiteiten aan. Daarna maakt WindowInto voor €7,50 een persoonlijk boek: zes ideeën plus één wildcard, als webpagina, als PDF van ongeveer zestien pagina's en per e-mail. Er is geen account en geen app."),
  h2("Welk probleem lost het op?"),
  p("Een zoekmachine heeft een vraag nodig, en wie toe is aan iets nieuws heeft die vraag juist niet. Een vragenlijst voelt als huiswerk. Een toplijstje is algemeen. WindowInto draait dat om: het laat beelden zien, leest uit wat je kiest en maakt daar concrete, lokale, haalbare activiteiten van."),
  h2("Voor wie?"),
  p("Voor mensen die vastzitten, zich vervelen of toe zijn aan iets nieuws zonder te weten wat. Ook voor wie zoekt voor een ander: een kind of jongere, een andere volwassene of een groep. Het boek wordt dan aan die persoon of groep geschreven. De startpagina vraagt eerst voor wie je zoekt."),
  h2("Hoe helpt het nieuwe mogelijkheden te vinden?"),
  p("Het boek is geen lijst van wat bij je past, maar een ladder met zeven treden. De eerste ideeën zijn je eigen keuzes of hun directe buren. Daarna volgen ideeën die verder weg liggen, via een echte verbinding. Het zevende idee komt uit een wereld die je niet koos, en blijft verzegeld tot je het opent. Zo blijf je niet binnen wat je al kent, zonder dat het willekeurig wordt."),
  h2("Wat maakt de aanpak onderscheidend?"),
  ul([
    "**Beelden vóór woorden.** De smaak komt uit wat je aantikt, niet uit wat je kunt benoemen.",
    "**Regels, geen dobbelstenen.** Een deterministische motor zonder AI kiest de zeven ideeën. Een taalmodel schrijft later alleen de tekst. Toeval bepaalt in één slot welke wildcard het wordt, nooit of die past.",
    "**Harde grenzen zijn heilig.** Budget, binnen of buiten, seizoen, toezicht en de keuze 'voor een kind' worden nooit overschreden. Een onbekend feit telt nooit als gunstig.",
    "**Echte plekken, of geen idee.** Een zoekstap vindt aanbieders op het web, controleert of hun website bestaat en niet zegt gesloten te zijn, en vervangt een idee zonder optie door een ander.",
    "**Eerlijk over AI.** Het boek zegt dat het met AI is gemaakt, belooft geen geverifieerde openingstijden en geen medisch, juridisch of financieel advies.",
  ]),
  fig("overview", "WindowInto in één beeld: van beelden en activiteiten, via de selectiemotor en het zoeken, naar een boek met zeven ideeën."),
  h2("Van eerste invoer naar concrete mogelijkheid"),
  p("De bezoeker zegt voor wie, waar en binnen welke afstand, tikt 3 tot 8 van 18 beelden aan en kiest 1 tot 8 van 18 concrete activiteiten: de ankers. Na betaling kiest de motor zeven ideeën (de ankers, een aangrenzend, een onverwacht en een wildcard). Een AI met webzoeken zoekt per idee echte aanbieders, de code controleert hun websites en twee schrijfaanroepen maken het boek."),
  tab("cijfers", "WindowInto in cijfers (uit de code, 13 november 2026)", ["Onderdeel", "Aantal"], [
    ["Beeldkaarten", "516, in 172 families van 3 varianten (plekken 177, momenten 174, zintuigen 165)"],
    ["Activiteiten", "756 in 22 werelden en 68 subdomeinen; 43 tags; 80 gecureerde combinaties"],
    ["Het boek", "7 ideeën (6 + wildcard), 4 deuren, 7 niveaus, PDF van ± 16 pagina's, € 7,50 eenmalig"],
    ["AI", "Claude Sonnet 5 (schrijven) en Haiku 4.5 (zoeken); $ 0,21 tot $ 0,39 per boek in vier meetboeken"],
    ["Door een mens gecontroleerd", "0 van 756 activiteiten: alle staan op status `concept`"],
  ], { widths: [26, 74], small: true }),
] });

// ====================================================================================================================
// Chapter 2
// ====================================================================================================================
export const ch2 = h1("ch2", "De filosofie en het concept", { blocks: [
  laagA("Je kunt niet zoeken naar iets waarvan je niet weet dat het bestaat. WindowInto probeert de afstand te overbruggen tussen wat je kent en wat je zou kunnen doen, in kleine stappen die elk een echte verbinding hebben met de vorige."),
  h2("Het probleem met 'weet je het niet, dan zoek je het niet'"),
  p("Nieuwe interesses ontstaan zelden uit een lijstje. Ze ontstaan uit een verbinding: wie van hout houdt, ontdekt meubels restaureren; wie van kaarslicht houdt, vindt een high tea op een buitenplaats. WindowInto maakt die verbindingen expliciet en rekenbaar. Het gebruikt daarvoor een bibliotheek van activiteiten waarin elk item een paar gewogen kenmerken heeft, en een graaf die laat zien welke activiteiten via een zeldzaam gedeeld kenmerk met elkaar zijn verbonden."),
  h2("Vier zones tussen kennen en doen"),
  p("De applicatie behandelt de weg van bekend naar nieuw als vier zones: wat je al kent, wat je mogelijk leuk vindt, wat je nog niet kent, en wat je echt kunt ondernemen. De eerste drie zijn een ladder van nieuwheid. De vierde is geen niveau maar een eis: elk idee moet iets concreets hebben."),
  fig("distance", "Het afstandsmodel. De zeven niveaus staan op twee schalen: aansluiting bij je keuzes (omhoog) en nieuwheid (naar rechts). De getallen zijn vaste ordeningsscores per richting."),
  p("Het diagram laat twee dingen zien die in het ontwerp zitten. Ten eerste neemt de aansluiting af naarmate een idee nieuwer is: dat is de bedoeling. Ten tweede is de ladder niet strikt: *Uitdagend* (niveau 6) is minder nieuw dan *Verrassend* (niveau 5), omdat niveau 6 niet afstand meet maar inspanning. De niveaus ordenen dus afstand en veeleisendheid samen."),
  h2("Principes die in de code terug te vinden zijn"),
  tab("principes", "Ontwerpprincipes en waar ze in de code zitten", ["Principe", "Hoe het is gebouwd"], [
    ["Eerst herkenning, dan ontdekking", "Tot vier eigen keuzes komen zeker in het boek (het ankermodel). Pas daarna volgen aangrenzende, onverwachte en onbekende ideeën."],
    ["Toeval bepaalt welke, niet of het past", "De wildcard is een gewogen loting, maar alleen uit activiteiten die door de harde filters komen."],
    ["Onbekend is nooit gunstig", "Een feit dat niet is vastgesteld (`null`) sluit niets uit, maar wordt een controlevlag voor het zoeken. Een onbekende prijs telt niet als gratis."],
    ["Alleen uitsluiten op een bekend conflict", "`passesConstraints` verwerpt een activiteit alleen als een feit bekend is en botst."],
    ["Geen etiket op een mens", "Het geslacht wordt nergens gevraagd of afgeleid. Een leeftijdsweging is zacht en sluit niets uit. Een beeld krijgt een stijlregister, een mens nooit."],
    ["De AI schrijft, de code kiest", "De selectiemotor maakt geen AI-aanroep. Het taalmodel mag ideeën niet wisselen, toevoegen of hernoemen."],
    ["Geen idee zonder echte optie", "Een idee zonder verifieerbare plek wordt vervangen. Daarom heet de vierde zone een eis en geen niveau."],
  ], { widths: [30, 70] }),
  laagB("Laag B: waar 'afstand' in de code wordt gemeten", [
    p("Afstand tussen twee activiteiten is geen opgeslagen getal maar volgt uit hun tags. Elke tag heeft een gewicht dat afneemt met zijn gebruik: `weight(tag) = ln(N / aantal activiteiten met die tag)`, met N = 756. *Geschiedenis* (57 activiteiten) weegt 2,58; *verhaal* (107) weegt 1,96; *retro* (40) weegt 2,94."),
    p("Twee activiteiten delen een **brug** als ze minstens één niet-generieke tag delen: `bridge(a,b) = som van weight(t)` over die tags. Een verbinding heet echt vanaf `BRIDGE_MIN = 2,0`, grofweg één tag die in minder dan ongeveer 27 van 200 activiteiten voorkomt. Zeven sfeertags (focus, gezelligheid, ontdekken, leren, stilte, zelf maken, precisie) tellen nooit als brug: twee activiteiten zijn niet verwant omdat ze allebei rustig zijn. De graaf heeft 44.295 verbindingen boven die drempel en 14 geïsoleerde activiteiten (bron: `src/lib/discovery/engine/graph.ts`, gemeten met `probe/stats2.ts`)."),
  ]),
  h2("Wat de filosofie niet is"),
  p("WindowInto bouwt geen psychologisch profiel dat aan de bezoeker wordt getoond. De code berekent intern vier karaktersignalen (nieuwsgierigheid, spontaniteit, sociale energie, behoefte aan structuur; `src/lib/characterProfile.ts`) en geeft die alleen mee aan de schrijver voor de toon. De schrijfopdracht verbiedt ze te noemen of er iets over iemands karakter uit af te leiden. Het profielscherm toont een korte duiding van wat de keuzes *wijzen naar*, nooit wat iemand *is*."),
] });

// ====================================================================================================================
// Chapter 3
// ====================================================================================================================
export const ch3 = h1("ch3", "De complete gebruikerservaring", { blocks: [
  laagA("De reis duurt ongeveer drie minuten invullen en één tot twee minuten wachten. Je tikt, je kiest, je betaalt, en je krijgt een boek. Onderweg verzamelt de applicatie alleen wat ze nodig heeft, en je kunt tot aan de betaling alles nog aanpassen."),
  h2("Negen stappen"),
  h3("0  Landing"),
  p("De homepage toont een fotografisch schuifraam met acht ruiten en één knop: *Open je venster*. Daaronder staan voorbeeldpagina's van een boek, uitleg en veelgestelde vragen. Een NL/EN-knop in de koptekst bepaalt de taal van de site én van het boek. Analytics (PostHog) start pas na toestemming in de cookiebanner."),
  h3("1  Start: voor wie, waar, randvoorwaarden"),
  p("De centrale startpagina vraagt in drie delen: **voor wie** (mezelf, kind of jongere, andere volwassene, groep, of niets kiezen), **waar** (plaats met suggesties, en een afstand van 5 tot 150 km) en optionele **randvoorwaarden** (tijd, budget per persoon en 'wat moet kloppen', allemaal als te kiezen chips en een schuif). Er is geen vrij tekstveld. Alleen de plaats is verplicht. Hoofdstuk 4 beschrijft wat elk antwoord later doet."),
  h3("2  Beelden"),
  p("De bezoeker ziet 18 foto's in drie kolommen en tikt er minstens 3 en hoogstens 8 aan. 'Andere beelden' geeft een nieuwe set, hoogstens drie keer. Er is geen goed of fout; de vraag is welke beelden nieuwsgierig maken. Er is hier geen 'verras me': die keuze bestaat pas op pagina 2."),
  h3("3  Activiteiten"),
  p("Pagina 2 toont 18 concrete activiteiten die bij de gekozen beelden passen. Drie ervan (*Misschien ook?*) komen bewust uit een andere richting. De bezoeker kiest er minstens één en hoogstens acht, of laat de applicatie verrassen. Bij één of twee keuzes vraagt de site om er meer. Deze keuzes zijn de ankers van het boek."),
  h3("4  Profiel"),
  p("Het venster toont nu de keuzes, met een korte, warme duiding in drie delen (opening, rode draad, richting). Die tekst wordt eerst uit vaste zinsdelen opgebouwd en kan daarna door een model worden vervangen door een gecontroleerde versie. Onder *Bekijk en stuur bij* kan de bezoeker vier schuiven verschuiven (sociaal, energie, binnen of buiten, vertrouwd of nieuw) en thema's toevoegen met *Niet helemaal*. Een optioneel tekstvak ('Wat missen we nog?') is het enige vrije tekstveld dat naar de schrijver gaat."),
  h3("5  Betalen"),
  p("Het bestelblok staat onderaan hetzelfde scherm. De bezoeker vult een e-mailadres in, vinkt twee verplichte vakjes aan (algemene voorwaarden; directe digitale levering met afstand van het herroepingsrecht), kiest optioneel een vervolgmail en een apparaatgeheugen, en betaalt € 7,50 via Stripe Checkout. Zodra de bestelling is vastgelegd, begint op de achtergrond al het zoeken naar plekken, zodat het boek na de betaling sneller klaar is."),
  h3("6  Wachten"),
  p("Een voortgangsscherm toont echte stappen: je keuzes gelezen, plekken opgezocht (met het aantal ideeën en plekken zodra dat bekend is), ideeën geschreven, boek opgemaakt. Na ongeveer twee minuten verschijnt een rustige melding dat het langer duurt."),
  h3("7  Het boek"),
  p("Op `/plan` staat een echo van wat de bezoeker zei, één idee om mee te beginnen, vier deuren met kaarten, en een verzegelde wildcard die zich opent. Elk idee toont waarom het past, tijd en niveau, drie maten (**proeven** ongeveer een uur, **doen** een halve dag, **doorpakken** een weekend of cursus), echte plekken met kaartlink en waar gevonden een beoordeling, en een eerste stap die binnen een minuut kan. De bezoeker kan hartjes geven, 'Dit ga ik doen' kiezen, de PDF downloaden en delen."),
  h3("8  Daarna"),
  p("Het boek komt per e-mail met de PDF als bijlage. Alleen met toestemming volgt twee tot negen dagen later een herinnering met de eerste stap van het gekozen idee, en na zes weken een vervolgmail ('Tijd voor een nieuw venster?'). Een vervolgboek herhaalt eerdere ideeën niet."),
  fig("journey", "De end-to-end customer journey in negen stappen: wat de bezoeker doet, wat er wordt verzameld, wat er op de achtergrond gebeurt en welke invloed de bezoeker heeft.", { landscape: true }),
  fig("swimlane", "Swimlane van de hele reis. Elke baan is een soort deelnemer; de volgorde loopt van links naar rechts.", { landscape: true }),
  h2("Waar heeft de bezoeker invloed?"),
  tab("invloed", "Invloed van de bezoeker per stap", ["Stap", "Beslist de bezoeker", "Beslist de applicatie"], [
    ["Start", "Voor wie, plaats, afstand, tijd, budget, grenzen (chips)", "Welke beelden voorrang krijgen; welke activiteiten wegvallen"],
    ["Beelden", "Welke 3 tot 8 beelden; hoe vaak 'andere beelden'", "Welke 18 beelden per set; de balans tussen registers en assen"],
    ["Activiteiten", "Welke 1 tot 8; of 'verras me'", "Welke 18 activiteiten; welke drie 'misschien ook'"],
    ["Profiel", "Schuiven en extra thema's", "De duiding; hoe de schuiven de afgeleide dials vervangen"],
    ["Betalen", "Of, en met welke toestemmingen", "De vertaling van alle antwoorden naar één record"],
    ["Het boek", "Hartje, 'Dit ga ik doen', delen", "Welke zeven ideeën; welke plekken; de tekst"],
  ], { widths: [16, 40, 44] }),
  note("let-op", "Het ankermodel neemt hoogstens vier van de gekozen activiteiten op (hoofdstuk 7). Wie er acht kiest, krijgt er vier terug als eigen idee; de rest wordt niet als 'niet meegenomen' gemeld, tenzij een harde grens ze uitsluit. Dat is een ontwerpkeuze, maar de tekst 'kies er tot acht' wekt een andere verwachting (bevinding F-09)."),
  laagB("Laag B: wat er in de browser blijft en wat naar de server gaat", [
    p("Het concept van de antwoorden staat in `sessionStorage` (een eigen concept voor de tweepaginaroute, `layout: 2`). De pagina's worden in de browser samengesteld met dezelfde pure code als op de server (`src/lib/discovery/twoPages.ts`, `associationSampling.ts`), met een seed per bezoeker, zodat een verversing dezelfde set toont. Pas bij het opslaan gaat alles naar de server (`saveIntake` in `src/app/intake/actions.ts`), die het opnieuw vertaalt en niets uit de browser vertrouwt: id's worden gezuiverd, het publieksprofiel wordt op de server gebouwd, en de doelgroep wordt opnieuw genormaliseerd. De standaardroute stuurt `ageCategory` en `socialFormats` altijd leeg mee en heeft geen vraag naar gezelschap (`company` blijft leeg): zie `saveForPayment` in `AssociationWizard.tsx`."),
    p("De tweepaginaroute is `start`, `images`, `concrete`, `profile` (`TWO_PAGE_PAGES` in `src/lib/vensterPages.ts`). De oudere vierrondesroute (`worlds`, `places`, `moments`, `senses`, `situation`, `profile`) bestaat nog als terugvaloptie (`NEXT_PUBLIC_IMAGES2_PERCENT=0`) en is niet aangeraakt."),
  ]),
] });
