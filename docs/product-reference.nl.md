# WindowInto: compact productoverzicht (NL)

Nederlandse versie van `docs/product-reference.md`. Bedoeld als bron voor modules zoals een korte uitlegfilm, een deck of social clips. Gebaseerd op de code (commit `890457c`) en het logboek in `CLAUDE.md`, 2026-11-04. Alleen feiten; wat niet live of niet bewezen is, staat erbij.

## 1. In één zin

**WindowInto** (merk: WINDOW / "WindowInto", windowinto.nl) maakt van een paar plaatjes die je aantikt een persoonlijk boek met vijf dingen om te proberen, bij jou in de buurt.

- Tagline: *"A Window Into What Could Be"*
- Kernbelofte: *"You don't need another answer. Sometimes you need to see another possibility."*
- Kop op de homepage: *"Wat als je iets ontdekt waarvan je nog niet wist dat het bij je past?"*
- Toon: slim, nieuwsgierig, warm, een tikje ondeugend. Meer premium reismagazine dan productiviteitsdashboard. Je-vorm.

## 2. Voor wie, en welk probleem

- Mensen die vastzitten, zich vervelen of toe zijn aan iets nieuws, maar niet kunnen zeggen wat.
- Ook wie zoekt voor een ander (kind of jongere, andere volwassene, groep). Het boek wordt dan aan die persoon of groep geschreven.
- Probleem: een zoekmachine heeft een vraag nodig en die heb je niet. Vragenlijsten voelen als huiswerk. Toplijstjes zijn algemeen.
- Idee: laat plaatjes zien, lees smaak uit wat je kiest, maak er concrete, lokale, haalbare activiteiten van.
- Alleen Nederland (plekken komen uit Nederlandse zoekresultaten, plaatsnamen via PDOK). Geen account, geen app.

## 3. De route van de bezoeker

Invullen duurt ±3 minuten, het boek maken 1 à 2 minuten. Eén taalkeuze (NL/EN-knop in elke header) stuurt scherm en boek.

| # | Scherm | Wat gebeurt er |
|---|---|---|
| 0 | **Landing** | Een realistisch schuifraam (8 ruiten, eiken kozijn, stenen dorpel) opent ruit voor ruit, elke ruit een andere foto, af en toe wisselt er zacht één. Eén knop: "Open je venster". Daaronder vier verschillen, voorbeeldpagina's, vertrouwen, veelgestelde vragen. |
| 1 | **Start** | Voor wie (mezelf, kind of jongere, andere volwassene, groep, nog onbekend; optioneel voornaam). Plaats en reisafstand (5 tot 100+ km). Optioneel: tijd, budget per persoon (tot €10 … €200 of "maakt niet uit") en "wat moet kloppen" (alleen buiten/binnen, met het openbaar vervoer, 's avonds, niet in een groep, vegetarisch …). Alleen de plaats is verplicht. |
| 2 | **Beelden** | 18 fotokaarten tegelijk (3 kolommen), steeds één variant per familie. Tik wat je aantrekt. "Andere beelden" geeft een nieuwe set (tot 3 sets, eerdere sets blijven bereikbaar). 3 tot 8 keuzes, of "Verras me". "Welke beelden maken je nieuwsgierig?" Geen goed of fout. |
| 3 | **Activiteiten** | 18 concrete activiteiten dicht bij je beelden (3 daarvan zijn "Misschien ook leuk?" uit andere richtingen). Kies er tot 8, of laat ons kiezen. "Zin om dit eens te proberen?" |
| 4 | **Profiel** | Het venster toont nu je keuzes. Een korte, warme duiding ("Je houdt van …, en van …"), de rode draad en een richting; schuiven en extra's achter "Bekijk en stuur bij". Onderaan hetzelfde scherm staat het bestelblok. De duiding is een korte AI-tekst met vaste tekst als terugval en plakt nooit een etiket op iemand. |
| 5 | **Betalen** | Prijs, wat je krijgt, optioneel ander e-mailadres, optioneel cadeau (e-mail ontvanger), optioneel toestemming voor een vervolgmail, twee verplichte vinkjes (disclaimer en afstand van het 14 dagen herroepingsrecht bij directe levering), betaalknop naar Stripe. **€7,50** per boek. iDEAL en kaart pas na instelling in het Stripe-dashboard (`docs/live-gaan.md`). |
| 6 | **Wachten** | Eerlijke voortgang: je keuzes gelezen, plekken opgezocht, ideeën geschreven, boek opgemaakt. Aantallen verschijnen als ze bekend zijn ("5 deuren gekozen"). Na ±2 minuten een rustige melding dat het langer duurt. |
| 7 | **Jouw boek** (`/plan`) | Echo van wat je zei, het ene idee om mee te beginnen, vier deuren met kaarten, een verzegelde wildcard die je opent, PDF downloaden, delen, hartjes, "Dit ga ik doen". |
| 8 | **Daarna** | Het boek ook per e-mail met de PDF. Optioneel een herinnering met de eerste stap na een paar dagen en een vervolgmail na ±6 weken. Beide alleen met toestemming, één keer. |

## 4. Wat er in het boek zit

**Opbouw:** 4 ideeën + 1 wildcard, gerangschikt op afstand tot jou, **deuren** genoemd (nooit "niveaus" in beeld):

1. **Vertrouwd** (1): dicht bij wat je al doet, net iets beter uitgewerkt.
2. **Ontdekking** (1): past bij wat je leuk vindt, maar nog niet geprobeerd.
3. **Onverwacht** (1): verrast eerst, tot je leest waarom het past.
4. **Uitdaging** (1): net buiten je comfortzone, nog haalbaar.
5. **Wildcard** (1): "het idee dat we eigenlijk niet zouden voorstellen. Maar toch doen." Verzegeld tot je het opent.

**Per idee:** waarom het bij je past (verwijst naar wat je koos), tijd, niveau, ervaringsprofiel (vijf dimensies), een mogelijke invulling, drie manieren om te beginnen (**proeven** ±1 uur, **doen** een halve dag, **doorpakken** weekend of cursus), kosten en duur, **echte plekken bij jou in de buurt** met kaartlink en, waar gevonden, een waardering die een zoekresultaat echt liet zien, een eerste stap binnen een minuut, en "ook in deze richting". Een draad toont hoe je keuzes hier uitkwamen ("Zo kwamen we hierop").

**Vormen:** de webpagina, een vormgegeven PDF (minimaal 7 pagina's, tot ±12 met de extra laag; ivoor papier, gouden lijnen, Cormorant Garamond-koppen) en een e-mail met de PDF als bijlage.

**Gratis vooraf:** je venster (beeldcollage) en de profielduiding, inclusief een te downloaden vensterafbeelding. **Betaald:** het boek.

## 5. Hoe het werkt (voor een voice-over)

- **Beelden zijn een taal.** 342 beeldkaarten in 114 families (plek, moment, zintuig); elke familie heeft 3 vergelijkbare varianten, zodat wat we lezen niet afhangt van welke foto je zag. Elke kaart draagt gewogen tags (natuur, ambacht, precisie, stilte …) en assen (sociaal, energie, binnen/buiten, vertrouwd/nieuw).
- **Een bibliotheek van activiteiten.** Ongeveer **578 activiteiten** in **21 richtingen** (ambacht, sport, muziek, reizen, eten, mysterie, helpen, groeien, stijl …), elk met tags, sociale vorm, niveau, kosten, duur, seizoen en benodigd toezicht. Activiteiten met toezicht komen alleen via een erkende aanbieder met instructeur.
- **Een selectiemotor met regels, niet met dobbelstenen.** Hij kiest vijf: eerst je eigen keuzes (tot twee), dan één aangrenzend idee, één verrassend idee uit een gecureerde combinatie en een wildcard. Harde grenzen worden nooit overschreden: budget, binnen/buiten, seizoen, toezicht, voor wie je zoekt. Een volwassen activiteit wordt nooit aan een kind getoond.
- **Echte plekken.** Voor de gekozen ideeën zoekt een AI met webzoekopdrachten aanbieders bij jou in de buurt, laat alles vallen waarvan de website niet bestaat of het aanbod niet noemt, geeft de voorkeur aan goed beoordeelde en zegt het als er niets is. Een tweede ronde zoekt online of landelijke opties, zodat elk idee iets concreets heeft.
- **Schrijven.** Een tweede AI-aanroep schrijft de tekst per idee uit die feiten. Een kwaliteitspoort haalt zichtbare "machinerie", herhaalde zinnen en seizoens- of binnen/buiten-tegenstrijdigheden eruit en herstelt ze.
- **Intern (niet publiek):** ruwweg $0,15 tot $0,35 AI-kosten per boek, met een harde bovengrens van $0,50 tegenover €7,50 prijs.

## 6. Prijs en producten

- **Boek:** €7,50 eenmalig, per boek, geen abonnement, geen account.
- **Cadeaubon:** €14,95 (kaart met code, goed voor één boek, 12 maanden geldig). Werkt, maar staat **bewust niet op homepage, menu of voet**; alleen via directe link.
- **Vervolg:** optionele mail "Tijd voor een nieuw venster?" na ±6 weken; het volgende boek herhaalt eerdere ideeën niet.
- **Garantie:** "Klopt een plek niet? Je krijgt een extra kortingscode van €2,50 als compensatie." (mail naar info@vantagelabs.nl; te sturen vanuit de admin, Stap 235)

## 7. Huisstijl

- **Palet "Warm Walnut":** walnoot `#5B3F2F`, donker walnoot / primaire knop `#3C2920`, secundair `#A98262`, achtergrond `#F7F5F0`, vlakken `#FFFDFA`, tekst `#202020`, gedempt `#77736C`, rand `#DED8CE`, selectie `#F2ECE1`. Goud `#B08A4A` alleen als terughoudend accent.
- **Letters:** Newsreader (serif) voor landingskoppen, Plus Jakarta Sans voor de rest, Cormorant Garamond in de PDF.
- **Vormen:** radius 8 / 12 / 18 px, 1 px randen, geen zware schaduwen of gloed.
- **Terugkerend motief:** het venster. Het is de hero, het paneel dat zich vult tijdens het invullen, de PDF-omslag en de deelkaart. 3 tot 24 ruiten, één per keuze; de stijl (schuifraam, bovenlicht, groot glas) hangt af van hoe breed je smaak is.
- **Fotografie:** fotorealistisch, warm, geen mensen of gezichten op de kaartbeelden, geen leesbare tekst. AI-gegenereerd (Gemini) uit eigen prompts.
- **Logo:** twee overlappende afgeronde vierkanten in een oranje-naar-blauw verloop, woordmerk "Window" + verloop-"Into".

## 8. Waar vind je materiaal (hergebruik, niet opnieuw genereren)

| Wat | Waar |
|---|---|
| Logo | `public/logo/`, `windowinto-cream.png` |
| Texturen voor het hero-venster | `public/illustrations/hero-window/` |
| 342 kaartfoto's | `public/illustrations/associations/` |
| Activiteits- en richtingfoto's | `public/illustrations/discovery/` |
| Voorbeeldpagina's (NL/EN: omslag, profiel, idee 1, idee 2) | `public/examples/spreads/*.jpg` |
| Volledige voorbeeldboeken | `public/examples/idea-book-nl.pdf`, `idea-book-en.pdf` |
| Deelkaarten (verhaal 1080x1920, vierkant 1080x1080) | route `/share-card/story-nl`, `/share-card/square-en`, … |
| Venster als afbeelding bij een keuzeset | route `/api/window-image?c=<ids>` |
| Beeldherkomst en licentie | `src/lib/imageProvenance.json` (3 beelden staan nog op "bevestigen") |

Let op: het voorbeeldboek is een echte generatie voor een Nederlands profiel (echte plaats, echte plekken). Controleer of je dat profiel in beeld wilt tonen.

## 9. Wat je niet mag beweren

- Niet "geverifieerde plekken" of "gecontroleerde openingstijden". Eerlijke zin: "We zoeken plekken op het web en controleren of hun website bestaat." Openingstijden en adressen worden niet tegen een gestructureerde bron gecontroleerd.
- Er zijn nog geen reviews of testimonials. De site zegt dat ook. Verzin er geen.
- Geen medisch, therapeutisch, financieel of juridisch advies (disclaimer vóór betaling).
- Het boek is met AI gemaakt en zegt dat ("Gemaakt met AI").
- Alleen Nederland. Geen app, geen account, geen socials behalve een eenvoudige deellink.
- Noem de interne "niveaus" niet en plak geen leeftijdslabel op iemand. Alleen deuren.
- Suggereer nooit een gratis boek: venster en profiel zijn gratis, het boek kost €7,50.

## 10. Voorstel uitlegfilm van 75 seconden

| Beat | Tijd | Beeld | Voice-over (concept) |
|---|---|---|---|
| 1 Haak | 0–8 s | Leeg raam, crème muur | "Ken je dat? Je bent toe aan iets nieuws, maar je weet niet wát." |
| 2 Probleem | 8–18 s | Zoekbalk knippert, leeg | "Een zoekmachine wil een vraag. Die heb je nog niet." |
| 3 Beelden | 18–33 s | Raster van 18 foto's, tikken, ruiten vullen zich | "Daarom beginnen we met plaatjes. Tik aan wat je aantrekt. Geen goed of fout." |
| 4 Lezing | 33–43 s | Profielscherm, één warme zin | "We lezen wat je keuzes over je zeggen en laten het je zien." |
| 5 Boek | 43–62 s | Vier deuren, verzegelde wildcard, kaartlink, eerste stap | "Zeven ideeën, van vertrouwd tot onverwacht, met echte plekken bij jou in de buurt en een eerste stap voor vandaag." |
| 6 Eerlijk | 62–70 s | PDF-pagina, kleine letters "Gemaakt met AI" | "Gemaakt met AI, uit plekken die we opzoeken. Klopt er één niet, dan krijg je een nieuw boek." |
| 7 Oproep | 70–75 s | Logo, knop "Open je venster", prijs | "Open je venster. €7,50." |

Opdeling in modules: (a) haak + probleem, (b) de drie tikken, (c) rondleiding door het boek, (d) vertrouwen + prijs, (e) eindkaart. Elk is los als clip te gebruiken.

## 11. Meer lezen

`CLAUDE.md` (volledig bouwlogboek), `docs/product-reference.md` (Engelse versie), `docs/discovery-engine.md` (selectiemotor), `docs/analytics-events.md` (metingen), `docs/live-gaan.md` (live gaan), `docs/cadeaubon.md` (bon), `docs/centrale-intake.md` (startpagina en doelgroep), `reference-library/` (losse activiteitenbibliotheek, niet gekoppeld aan de app).
