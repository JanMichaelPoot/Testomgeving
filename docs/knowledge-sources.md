# Bronnenregister — kennisengine (Stage A2)

Opgesteld op 27 oktober 2026 (Stage A van `WINDOW_Bouwopdracht_Kennisengine.md`). Alle vijf de bronnen zijn **kandidaten, geen vertrouwde productiebronnen**. Er is niets geïmporteerd en er is geen applicatiecode veranderd; de downloads staan in `data/sources/raw/<source_id>/` (staat in `.gitignore`, wordt dus niet gecommit).

**Hoe er gemeten is.** Elke bron is zelf geopend of gedownload; de aantallen komen uit `scratch/ke/analyze-sources.mjs` (niet gecommit, kan op verzoek in `scripts/` komen). "Overlap" is gemeten op **namen**: *exact* = na normalisatie (kleine letters, accenten weg, leestekens weg) gelijk aan een NL- of EN-label van een van onze 423 activiteiten; *mogelijk* = alle woorden van de kortste naam komen voor in de andere. Dat is een **ondergrens**: "Bread Making" matcht niet met "Brood bakken met zuurdesem". Daarom is voor de bronnen die er toe doen ook handmatig een steekproef beoordeeld (zie "Netto toegevoegde waarde"). Dat oordeel is dat van één beoordelaar (de assistent, niet van Jan) en heeft bij n = 79 een marge van ongeveer ±8 procentpunt.

## Samenvatting

| Bron | Licentie | Commercieel? | Unieke records | NL-labels | Ontstaan | Advies |
|---|---|---|---|---|---|---|
| **S1** Leisure Research | CC BY-NC-ND 4.0 | **nee** (NC) en **geen bewerking** (ND) | 304 activiteiten | 0% | Menselijk, universiteit | **Afwijzen** |
| **S2** Hobbies (1.539) | MIT (volgens uploader) | onduidelijk voor de inhoud | 1.524 | 0% | **AI-gegenereerd (kimi-2.5) + gecrawld** | **Alleen als naamlijst-inspiratie, niet importeren** |
| **S3** Wikidata | CC0 | ja | 211 met label | 61% van 219 | Menselijk, crowd | **Gebruiken**, klein: NL/EN-labels en een paar nieuwe kandidaten |
| **S4** OpenActive | CC BY 4.0 | ja, met naamsvermelding | 768 | 0% | Menselijk, vocabulaire-redactie | **Afwijzen** (alleen beweging, merknamen, geen synoniemen) |
| **S5** alperugurcan/Hobbies | MIT (volgens uploader) | onduidelijk | 103 | 0% | **Synthetisch (ChatGPT)** | **Afwijzen** |

Wat Jan vermoedde en wat het onderzoek liet zien: S3 klopt (CC0, vaak ook NL, wel ruis). S4 heeft wel een hiërarchie maar **bijna geen synoniemen** (16 van 768) en is geen "smal domein met naamsvermelding": het is een sport- en fitnesslijst met merknamen. S2 en S5 zijn inderdaad AI-gegenereerd. S1 is niet te gebruiken voor een betaald product.

---

## S1 — Leisure Research: Catalogue of Leisure Activities

| Veld | Waarde |
|---|---|
| `source_id` | S1 |
| Naam · uitgever | Catalogue of Leisure Activities, versie 4.3.0 · Palacký University Olomouc (Tsjechië), Department of Christian Social Work |
| URL | https://www.leisureresearch.eu/en/catalogue/download |
| Opgehaald op · bestand | 27-10-2026 · `get-csv?version=4003000` (87.723 bytes), sha256 begint met `3c52937e1c48b0cf` |
| Licentie | **Creative Commons BY-NC-ND 4.0**, zoals op de downloadpagina staat (link: http://creativecommons.org/licenses/by-nc-nd/4.0/). Niet zelf de volledige licentietekst opgehaald; de pagina zelf noemt BY-NC-ND. |
| Commercieel gebruik | **Nee** (NonCommercial). WINDOW is een betaald product, dus niet toegestaan. |
| Bewerking / herdistributie | **Nee** (NoDerivatives): omzetten naar ons schema is een bewerking. |
| Naamsvermelding | Vereist, maar speelt niet: de bron mag niet worden gebruikt. |
| Formaat en schema | CSV met `;`; kolommen Type, Activity code, subcategory, category, versie, geldigheid, Name en/cs/sk. Er is ook XML en een CSV met HTML-beschrijvingen (die laatste niet gedownload). |
| Records | 393 regels: 304 activiteiten, 80 subcategorieën, 9 categorieën. Activiteiten zijn uniek binnen de bron (0 dubbel). |
| Volledigheid | Beschrijving 0% in de CSV · categorie 100% · synoniemen 0% · hiërarchie 3 niveaus (categorie > subcategorie > activiteit). |
| Talen | EN, CS, SK. **Geen NL (0%).** |
| Ontstaanswijze | Menselijk samengesteld voor sociaalwetenschappelijk onderzoek (een vragenlijstinstrument), niet voor aanbevelingen. |
| Onderhoud | Versie 4.3.0, geldig vanaf 15-07-2022; de site noemt copyright 2012–2026. |
| Overlap met onze set | Exact 5 (1,6%), mogelijk 30 (9,9%). |
| Netto toegevoegde waarde | **Niet beoordeeld**: de bron valt af op de licentie. |
| Beperkingen | Het is een onderzoeksinstrument: veel regels zijn algemeen ("Communication in General"). |
| **Advies** | **Afwijzen.** NC én ND maken gebruik voor WINDOW onmogelijk, ook voor alleen labels. Alleen geteld om het besluit te onderbouwen; de download niet gebruiken en niet delen. |

## S2 — Dots-n-Squares/Hobbies (Hugging Face)

| Veld | Waarde |
|---|---|
| `source_id` | S2 |
| Naam · uitgever | Hobbies · gebruiker "Dots-n-Squares" op Hugging Face |
| URL | https://huggingface.co/datasets/Dots-n-Squares/Hobbies |
| Opgehaald op · versie | 27-10-2026 · repository-revisie `f77f464c3dcd159a289177c4a24bbcf354e99393`, laatst gewijzigd 14-03-2026 · `hobbies.parquet` (2.173.730 bytes), sha256 begint met `032898f55222c92085934fd6cf722820ecfab6ea9dd2ffb294323757626d538d` |
| Licentie | **MIT**, zoals de uploader op de dataset card vermeldt. Dat is een verklaring van de uploader; zie "Ontstaanswijze". |
| Commercieel gebruik | **Onduidelijk** (volgens de projectregel: onduidelijk = nee). MIT staat het toe, maar de card zegt dat de inhoud "gecrawld en AI-gegenereerd" is; de rechten van de gecrawlde bronnen en de gebruiksvoorwaarden van het gebruikte model (kimi-2.5) zijn niet vastgelegd. Hobbynamen zelf zijn feiten of korte termen; de omschrijvingen en prijzen niet. |
| Naamsvermelding · herdistributie | MIT vraagt het copyrightbericht bij overname van substantiële delen; bij het overnemen van alleen namen is dat naar verwachting niet nodig, maar dat is een juridische afweging voor Jan. |
| Formaat en schema | Parquet. Velden: `id`, `name`, `short_description`, `long_description`, `tools_description` (lijst met naam+prijs), `categories` (komma-lijst uit 8 waarden), `cost_us`, `cost_eu`, `cost_thailand`, `tools_rarity`, en leeftijdsvlaggen (`toddler` … `elderly`). |
| Records | 1.539 rijen, **1.524 unieke namen** na normalisatie (15 dubbel). |
| Volledigheid | Beschrijving 100% · categorie 100% · synoniemen 0% · hiërarchie geen. |
| Talen | Alleen EN (0% NL). Prijzen in USD, EUR en THB. |
| Ontstaanswijze | **AI-gegenereerd (kimi-2.5) en gecrawld**; de card zegt zelf: "Data quality is unproven" en "must be treated as suggestions, not as facts". |
| Onderhoud | Eenmalige upload (aangemaakt 23-02-2026). |
| Overlap met onze set | Exact 47 (3,1%), mogelijk 210 (13,8%), niet gevonden 1.267 (83,1%), op woordniveau. |
| **Netto toegevoegde waarde** | Handmatige beoordeling van een vaste steekproef (elk 16e van de 1.267, n = 79): **40% is inhoudelijk een dubbel van iets dat we al hebben** (bijv. "Whittling", "Fermentation", "Cooperative Board Games"), **23% is te smal of niet doenbaar in Nederland** (skispringen, luge, sitar), **5% is ongeschikt** (Home Distilling is in NL niet toegestaan, Craps = gokken, "DeFi Exploration" = financieel, Cliff Jumping = gevaarlijk), **16% is een sterke nieuwe kandidaat** (Game Development, Open Source Contributing, OpenStreetMap Editing, Paper Marbling, Vivarium Making, Scent Work, Tie-Dye, Rugby, Techno Music Production, Travel Writing, Programming, Social Deduction Games, Paper Quilling) en **15% zwak** (Jump Rope, Live Streaming, Bottle Collecting, …). Doorgerekend naar 1.267: ongeveer **105–315 sterke kandidaten (puntschatting ≈ 210)**. In de dunne domeinen (digitaal, gemeenschap) ongeveer 5 van de 79, dus enkele tientallen. Het totale aantal "nieuwe, bruikbare" activiteiten is dus een orde van grootte kleiner dan de 1.539 doet vermoeden. |
| Beperkingen | AI-teksten zonder bron; Amerikaanse prijzen; geen NL; onveilige of niet-toegestane items zitten tussen de gewone; de categorieën zijn grof (8). |
| **Advies** | **Niet importeren.** Eventueel als **naamlijst** gebruiken om gerichte kandidaten te vinden in dunne domeinen; elke kandidaat dan zelf schrijven (eigen label, eigen tags, eigen facetten, `concept`) en nooit een beschrijving, prijs of leeftijdsvlag overnemen. Voor die beperkte inspiratie is geen importpijplijn nodig. |

## S3 — Wikidata (hobby-activiteiten, SPARQL)

| Veld | Waarde |
|---|---|
| `source_id` | S3 |
| Naam · uitgever | Wikidata · Wikimedia Foundation |
| URL | https://www.wikidata.org/wiki/Wikidata:List_of_activities_done_as_hobby · https://query.wikidata.org/ |
| Opgehaald op · bestand | 27-10-2026 · SPARQL-resultaat `hobby.json` (107.366 bytes), sha256 begint met `3865b0afb799f706`. Query: de zoekopdracht van de lijstpagina (instantie of subklasse van *hobby* Q47728, zonder sporttakken en kunstvormen) met EN- en NL-label en -omschrijving erbij. De query staat in `data/sources/raw/S3/q.rq`. |
| Licentie | **CC0 1.0**. Gecontroleerd op https://www.wikidata.org/wiki/Wikidata:Licensing ("All structured data … is released into the public domain under Creative Commons Zero"); de opgehaalde pagina heeft een eigen hash (`45097239ba65456e`). |
| Commercieel gebruik | **Ja.** |
| Naamsvermelding · herdistributie | Niet vereist (CC0). Wel netjes om de bron te noemen. |
| Formaat en schema | SPARQL-JSON: `item` (Q-id), `en`, `nl`, `den`, `dnl`. |
| Records | 222 resultaatrijen, **219 unieke items**, 211 met EN-label. |
| Volledigheid | EN-omschrijving 196 (89%) · **NL-label 133 (61%)** · NL-omschrijving 78 (36%) · categorie geen · synoniemen geen (alias-labels niet opgevraagd) · hiërarchie via P279 beschikbaar, niet opgehaald. |
| Talen | EN, NL, en alle andere Wikidata-talen op aanvraag. |
| Ontstaanswijze | Menselijk (crowd), met zeer wisselende volledigheid. |
| Onderhoud | Doorlopend bijgewerkt. |
| Overlap met onze set | Exact 17 (8,1%), mogelijk 36 (17,1%), niet gevonden 158 (74,9%). |
| **Netto toegevoegde waarde** | Alle 158 niet-gevonden items zijn handmatig doorgelezen: ongeveer **22 sterke nieuwe kandidaten** (o.a. dammen, jojo, proplifting, strandjutten, ballonmodelleren, rotsen stapelen, postcrossing, bloemsierkunst, quilten, videoproductie, conlanging, groundhoppen, kaartenmaken) en ruim 100 items die al bij ons staan onder een andere naam, te algemeen zijn ("verzamelhobby", "kaartspel"), geen activiteit zijn ("virtual influencer", "autistic special interest", "argument diagram") of riskant ("amateur chemistry", "weapon collecting"). De echte waarde zit in **de 133 NL-labels** (door mensen gemaakt, CC0): synoniemen en NL/EN-koppelingen voor onze ~100 raakvlakken. |
| Beperkingen | Veel ruis en meta-items; labels zijn soms een vakterm ("Tyrosemiophilia", "nesophilia"); de bron geeft geen facetten (kosten, duur, intensiteit). De SPARQL-service vraagt een herkenbare User-Agent en heeft gebruiksgrenzen; één keer ophalen is ruim binnen die grenzen. |
| **Advies** | **Gebruiken, klein**: (a) NL/EN-labels en synoniemen voor bestaande activiteiten, (b) ± 20 nieuwe kandidaten via de reviewwachtrij. Dit is de enige bron met een schone licentie en NL-dekking. |

## S4 — OpenActive Activity List

| Veld | Waarde |
|---|---|
| `source_id` | S4 |
| Naam · uitgever | OpenActive Activity List · OpenActive (Open Data Institute-ecosysteem) |
| URL | https://github.com/openactive/activity-list · https://openactive.io/activity-list/activity-list.jsonld |
| Opgehaald op · bestand | 27-10-2026 · `activity-list.jsonld` (489.922 bytes), sha256 begint met `dd0904968f9527604d357332554d302a`; laatste commit in de repository: 13-05-2025 (via de GitHub-API gecontroleerd) |
| Licentie | **Creative Commons BY 4.0** (`license`-veld in het bestand, `LICENSE`-bestand in de repository en README). |
| Commercieel gebruik | **Ja.** |
| Naamsvermelding | **Vereist** bij gebruik ("OpenActive Activity List, CC BY 4.0"), met link naar de licentie en vermelding van eventuele wijzigingen. |
| Formaat en schema | JSON-LD/SKOS: `id`, `identifier`, `prefLabel`, `broader`, `narrower`, `definition`, `notation`, `altLabel`. |
| Records | **768 begrippen**, allemaal uniek; 146 op het hoogste niveau, 117 met `narrower`. |
| Volledigheid | Definitie 100% · hiërarchie (`broader`) 81% · **synoniemen (`altLabel`) 2,1% (16 stuks)** |
| Talen | Alleen Brits Engels. **Geen NL.** |
| Ontstaanswijze | Menselijk, door een vocabulaire-redactie, gebouwd voor activiteitenaanbieders in het Verenigd Koninkrijk. |
| Onderhoud | Laatste wijziging in de repository 13-05-2025 (ruim 17 maanden geleden); het beheer loopt via een redactietool en een geautomatiseerde pull request. |
| Overlap met onze set | Exact 23 (3,0%), mogelijk 79 (10,3%), niet gevonden 666 (86,7%). |
| **Netto toegevoegde waarde** | Het bereik is **lichamelijke activiteit en fitness**, het domein `movement` (38 activiteiten, 9% van onze set) dat niet dun is. Een steekproef van de niet-gevonden begrippen (elke 9e) bestaat voornamelijk uit **merknamen van fitnesslessen** (Zumba®, RPM™, Bodyattack™, Insanity, PowerWave™) en uit sportvarianten ("11-a-side", "Crown Green Bowls", "Fives", "Gaelic Handball"). Daar zitten hooguit een paar tientallen echte nieuwe, doenbare activiteiten in (Pickleball, Cheerleading, Voguing, Obstacle Course Racing, Walking Rugby), geen enkele in de dunne domeinen (digitaal, gemeenschap, uitdaging). |
| Beperkingen | Geen NL, bijna geen synoniemen, merkgebonden termen, UK-context (aanbod, namen), geen facetten. |
| **Advies** | **Afwijzen voor import.** De hiërarchie kan later als naslag dienen als `movement` ooit fors moet groeien; dan met naamsvermelding. Het is niet de bron met "synoniemen en hiërarchie" die vooraf werd verwacht. |

## S5 — alperugurcan/Hobbies (Hugging Face)

| Veld | Waarde |
|---|---|
| `source_id` | S5 |
| Naam · uitgever | Hobbies · gebruiker "alperugurcan" op Hugging Face |
| URL | https://huggingface.co/datasets/alperugurcan/Hobbies |
| Opgehaald op · versie | 27-10-2026 · revisie `b915168b8a9022c72068d42a6bfbf82a9bc2d84d`, laatst gewijzigd 26-09-2024 · `hobbies.csv` (12.023 bytes), sha256 begint met `36ba57deac8aeffa` |
| Licentie | **MIT**, volgens de uploader. |
| Commercieel gebruik | **Onduidelijk** (AI-uitvoer van ChatGPT zonder verdere herkomst). |
| Formaat en schema | CSV: `hobby`, `tags` (3 woorden), `difficulty_level`, `cost`, `time_requirement`, `physical_activity_level`, `sociability`, `location`, `age_group`, `equipment_needed`. |
| Records | 117 rijen, **103 unieke** (14 dubbel). |
| Volledigheid | Beschrijving 0% · categorie/tags 100% · synoniemen 0%. |
| Talen | Alleen EN. |
| Ontstaanswijze | **Synthetisch, "created with chatgpt"** (dataset card). |
| Onderhoud | Eenmalige upload, laatst gewijzigd 26-09-2024. |
| Overlap met onze set | Exact 25 (24,3%), mogelijk 30 (29,1%), niet gevonden 48. |
| Netto toegevoegde waarde | Van de 48 niet-gevonden items zijn bijna alle algemeen ("Jogging", "Gardening", "Hiking", "Drawing"); hooguit een stuk of vijf nieuw (Slacklining, Acroyoga, Fly Tying, Fitness Gaming, Hand Lettering). |
| Beperkingen | Zeer klein, geen herkomst, geen beschrijvingen, drie grove facetten per hobby. |
| **Advies** | **Afwijzen.** Geen toegevoegde waarde boven wat al in onze set staat. |

---

## Wat ik niet kon vaststellen

- **Juridisch oordeel** over MIT-labels op AI-gegenereerde datasets (S2, S5) en over de gecrawlde delen van S2: dit is een afweging voor Jan (en zo nodig een jurist); de projectregel "onduidelijk = niet gebruiken" is hier aangehouden.
- De **volledige licentietekst van S1** is niet apart opgehaald; de pagina noemt BY-NC-ND 4.0, wat al voldoende is om af te wijzen.
- De **S4-licentie** is wel volledig ingezien (README, `LICENSE`, `license`-veld in het bestand).
- De S2-steekproef (n = 79) en de S3-doorlezing (n = 158) zijn door één beoordelaar gedaan. Een tweede beoordelaar (Jan) zou de sterke kandidaten uit S3 in een kwartier kunnen controleren als besluit K2 op "ja" valt.
