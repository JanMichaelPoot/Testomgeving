# Plan van aanpak: van associaties en profiel naar de juiste activiteiten (18 november 2026)

Opdracht van Jan: de bibliotheek (816 activiteiten) zo goed mogelijk benutten en op basis van thema's/associaties **in combinatie met het profiel** de juiste, interessante en geschikte activiteiten kiezen, met de referentie "De activiteiten-engine" (4.1 tot 4.4) als maatstaf. Jan bepaalt met vinkjes welke onderdelen gebouwd worden; dit document is de onderbouwing.

Zekerheid: **[B]** gelezen in de code of gemeten, **[O]** onderbouwde raming.

## 1. Waar we nu staan, naast de referentie

| Referentie | Stand [B] | Verdict |
|---|---|---|
| 4.1 Doelgroep, zoekcontext, leeftijd | `searchContext` en leeftijd sturen harde regels (`audience.ts`, `suitability.ts`, `constraints.ts`) | Gedekt |
| 4.1 Locatie | Zoekafstand en aanbodindex (`supply`, `quietSupply`) wegen mee; geen geografische selectie in de motor zelf | Grotendeels gedekt |
| 4.1 Voorkeuren (associaties) | 30 themategels, gewicht per tag; pagina 2 en de onverwachte deur gebruiken ze (Stap 211-212) | Gedekt voor pagina 2 en één deur; de **overige vier ideeën** kiest de motor nog op de eigen kiezen en tags, niet vanuit de thema's |
| 4.1 Combinaties | E4: onverwachte deur uit twee thema's, 39% van de boeken | Gedekt, zwakke treffers blijven (boomklimmen als natuur+techniek) |
| 4.1 Randvoorwaarden | Tijd, budget, inspanning, gezelschap, must-haves | Gedekt |
| 4.2 Omvang 500-1.000 | **816** activiteiten, 22 werelden | Gedekt |
| 4.2 Kenmerken per activiteit | Wel: domein, subdomein, tags, formats (groepsgrootte), setting, intensiteit, niveau, kosten, duur, supply (beschikbaarheid), entry (praktisch), veiligheid, maanden. **Niet:** een type (zelf maken, leren, bijwonen...), een verrassingsgraad, een doelgroep als data (alleen lijsten), een uitvoeringsvorm | Gaten |
| 4.2 Brede lijst | Aanwezig: escaperoom, naaien, duiken, parachute, houtbewerking, poppenhuis, fotografie, poetry slam. **Ontbreekt**: ringwerpen en traditionele spellen (0), voordragen/presenteren (0), poëzie (alleen slam), textiel (3) | Kleine gaten |
| 4.3 Vijf opties, elk met minimaal drie activiteiten | Het boek heeft **vijf ideeën van één activiteit**; daaronder staan tot drie "ook in deze richting" (uit de relatiegraaf van de activiteit, niet uit de thema's), drie maten (proeven, doen, verdiepen) en tot drie plekken. Jan besliste op 15 november: "vijf opties = de vijf ideeën" | **Grootste verschil**: een optie is nu een activiteit, niet een richting met drie activiteiten |
| 4.4 Zes kwaliteitscriteria | Bestaan: websitecontrole, relevantie, "nooit verzinnen" in de zoekprompt. Doelgroep: harde regels. Relatie: `reasons` en `fit`. **Niet** als één poort per boek, en **geen** onderscheid zelf/aanbieder/organiseren | Gedeeltelijk |
| Status van de bibliotheek | Alle 792 activiteiten staan op `concept`; geen enkele is `reviewed` | Open |
| Uitdaging in het boek (Stap 213) | Slechts 24% van de boeken heeft een uitdagend idee | Open |

## 2. Het kernbesluit: wat is een "optie"?

De referentie wil vijf **richtingen** ("Creatief met de natuur", "Techniek en ontdekken", ...), elk met minimaal drie concrete activiteiten. De motor kiest nu vijf losse activiteiten. Drie manieren om dat te lezen:

| | Wat het is | Kosten/lengte | Mijn advies |
|---|---|---|---|
| **R1: richting met één uitgewerkt idee en twee korte activiteiten** | Elke van de vijf opties is een richting met een naam en drie activiteiten uit de bibliotheek, gekozen op themafit en profiel. Eén krijgt de volledige uitwerking en plekken (zoals nu), de twee andere een regel met reden, kosten en duur | +±$0,03-0,06 modelkosten [O]; PDF ±1-2 pagina's langer | **Ja** |
| R2: een idee blijft een optie | Niets aan de structuur; de drie activiteiten komen uit "ook in deze richting" (thema-bewust gemaakt) en de drie maten | Geen extra kosten | Alleen als kosten/lengte zwaarder wegen |
| R3: drie volledig uitgewerkte activiteiten per optie | 15 uitgewerkte ideeën, elk met onderzoek | ×3 onderzoekskosten, ver boven de $0,50-grens, PDF van 25+ pagina's | Nee |

## 3. Bouwblokken (de vinkjes)

**A. Selectie vanuit thema's en profiel (de motor)**

| Id | Wat | Effect | Meting |
|---|---|---|---|
| A1 | **Richtingen uit thema's en profiel**: de motor bouwt eerst vijf onderling verschillende richtingen (uit de gekozen thema's, thema-paren en wat het profiel zegt), kiest dan per richting de activiteiten | De opties van de referentie ontstaan; de vier gewone ideeën volgen de thema's, niet alleen de eigen keuzes | Eval: elke richting ≥3 passende activiteiten, themadekking, geen leeg thema |
| A2 | **Eén geschiktheidsscore** per activiteit: themafit x profielpassing (leeftijd, tijd, budget, inspanning, gezelschap, zoekafstand, verrassingsniveau), overal dezelfde | Rangschikking binnen een richting is uitlegbaar en consistent | Eval voor/na op de 20 vaste profielen |
| A3 | **Onderlinge verschil-bewaking**: richtingen en hun activiteiten mogen niet op elkaar lijken (ander subdomein, ander type, hoogstens één variant van dezelfde activiteit) | "Vijf vrijwel identieke varianten" kan niet meer | Test: minimale afstand tussen richtingen, max. één activiteit per subdomein per richting |
| A4 | **Ruisopruiming van de thema's** (E6): ±30 handgemaakte thema-paren voor zwakke combinaties en de tagweging van "techniek" bijstellen | Minder zwakke treffers als boomklimmen voor natuur+techniek | Zelfde meting als Stap 212 (aandeel en sterkte van combinaties) |
| A5 | **Eén uitdagend idee per boek** (Stap 213: nu 24%) | Het venster uitdaging en avontuur is altijd aanwezig | Dekkingscontrole van de zeven vensters: uitdaging van 24% naar ≥90% |

**B. De bibliotheek benutten en aanvullen**

| Id | Wat | Effect |
|---|---|---|
| B1 | **Type-kenmerk** afleiden (zelf maken, leren, bijwonen, bezoeken, ontmoeten, ondernemen) uit domein, tags en formats, handmatig bijgewerkt waar dat niet klopt | Richtingen en activiteiten kunnen echt van soort verschillen (A3); de referentie noemt het type als veld |
| B2 | **Uitvoeringsvorm** afleiden (zelf uit te voeren / aanbieder of locatie nodig / eerst te organiseren) uit supply, veiligheid, formats en entry | Basis voor 4.4 en voor eerlijk getoonde suggesties |
| B3 | **Gaten dichten**: de referentielijst naast de bibliotheek leggen en ±20-40 activiteiten toevoegen (ringwerpen en traditionele spellen, voordragen, poëzie, textiel, tuin- en natuurwerk...), lokaal geschreven; foto's pas later (`image_pending`), dus nog geen beeldkosten | Bredere keuze buiten sport, museum en horeca |
| B4 | **Verrassingsgraad per activiteit** afleiden (hoe ver van wat de meeste mensen kiezen) | Het referentieveld "verrassing" wordt data; helpt de onverwachte en uitdagende opties |
| B5 | **Reviewronde**: de 792 `concept`-activiteiten in lijsten per wereld doorlopen (kloppen kosten, duur, doelgroep, bestaan?) en op `reviewed` zetten | De bibliotheek is aantoonbaar gecontroleerd; basis voor criterium 1 uit 4.4 |

**C. Kwaliteitspoort en meting (4.4)**

| Id | Wat | Effect |
|---|---|---|
| C1 | **Zes-criteria-poort per boek**: bestaat, past bij doelgroep, concreet, haalbaar binnen de zoekcontext, relatie met associaties of bewust verrassend, geen verzonnen aanbieder/prijs/beschikbaarheid. Lokale regels, geen AI | Een idee dat de poort niet haalt wordt vervangen vóór het in het boek komt |
| C2 | **Zichtbaar onderscheid in boek en PDF** tussen zelf te doen, via aanbieder en eerst organiseren (vraagt B2) | De gebruiker weet wat hij krijgt |
| C3 | **Gratis eval voor en na** op de 20 vaste profielen en de thema-sets: diversiteit, themadekking, doelgroepfouten, uitdaging, zwakke combinaties; rapport in `docs/eval/` | Elke wijziging in A is gemeten |
| C4 | **Betaalde steekproef** op 3-4 persona's met echte boeken (max. $1 per persona, jouw akkoord op het bedrag vooraf) | Controle dat de keuzes ook in de echte tekst en plekken kloppen |

## 4. Aanbevolen volgorde

1. **C3 eerst** (de nulmeting, gratis), dan **B1 en B2** (kenmerken, lokaal en gratis).
2. **A1 tot en met A3** in één stap, gemeten met C3.
3. **R1 in het boek** (structuur, uitleg, PDF) met **C1** en **C2**.
4. **B3, A4, A5** daarna, elk gemeten.
5. **C4** als laatste, met jouw akkoord op het bedrag. **B5** loopt los, in lijsten die jij of ik per wereld doorlopen.

Alles blijft binnen de grenzen die al gelden: geen nieuwe betaalde dienst, de $0,50-kostenpoort per boek, geen wijziging aan Stripe of de kernloop.

## 5. Besluiten van Jan (18 november 2026)

| Blok | Besluit |
|---|---|
| Wat is een optie | **R1**: vijf richtingen, elk met drie activiteiten (één uitgewerkt met plekken, twee als korte regel) |
| A. Selectie | A1, A2, A3, A4 en A5: alle vijf |
| B. Bibliotheek | B1 + B2, B3, B4 en B5: alle |
| C. Kwaliteit | C1, C2 en C3. **C4 (betaalde steekproef) niet nu**: komt alleen na een apart bedrag-akkoord |

Stand: nulmeting C3 (Stap 214); B1 + B2 (Stap 215); A1 tot en met A3 (Stap 216); R1 in het boek (Stap 217); C1 + C2 met evenwichtsregel (Stap 218); A4 + A5 (Stap 219); B3: 24 activiteiten geschreven, wachten op foto (Stap 220, ±$0,67 voor de foto's, akkoord nodig). Volgende: B4, B5, en eventueel C4 (betaalde steekproef, apart bedrag-akkoord).
