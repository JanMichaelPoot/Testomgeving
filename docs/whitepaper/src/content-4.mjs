import { h1, h2, h3, p, ul, ol, laagA, laagB, fig, tab, code, note, facts, pb, steps } from "./dsl.mjs";

// ====================================================================================================================
// Chapter 8
// ====================================================================================================================
export const ch8 = h1("ch8", "Van activiteiten naar concrete bezoeken", { blocks: [
  laagA("Een idee als 'Nordic walking' is nog niets om morgen te doen. Daarom stuurt WindowInto na de keuze een zoeker het web op: wie biedt dit aan, bij jou in de buurt, nu? Wat de zoeker vindt, wordt gecontroleerd, en wat niet bestaat of dicht is, komt niet in het boek."),
  h2("De grens tussen ontdekken en een concrete aanbieder"),
  p("Tot en met de selectiemotor is alles een *idee*: een activiteit uit de bibliotheek met een reden waarom hij bij je past. De motor weet niet of er in Zwolle een LARP-groep is. Pas de zoekstap verandert 'zou je kunnen doen' in 'kun je morgen bellen'. Dat is een andere soort werk: het gebruikt het live web en een taalmodel, het is niet reproduceerbaar, en het kost geld. Daarom ligt hier de grens in het systeem, en daarom is de volgorde zo gekozen dat het zoeken pas begint nadat de motor zijn zeven heeft gekozen."),
  fig("concrete", "De vertaalslag van activiteit naar bezoek: de zoekladder (links) en wat er met elke gevonden optie gebeurt (rechts)."),
  h2("Hoe aanbieders worden gevonden"),
  p("Per boek zoekt één gegroepeerde aanroep van het goedkopere model (Claude Haiku 4.5, met de webzoektool) naar alle activiteiten tegelijk, in plaats van één aanroep per activiteit. De opdracht aan het model is streng: vind alleen echte, nu werkende plekken waar een beginner terechtkan; 'niets verifieerbaar gevonden' is een goed antwoord; een verkeerde plek in een betaald boek is erger dan geen. Per activiteit krijgt het model zoektermen (bijvoorbeeld *beginnersles* en *proefles*) en de gebruikelijke instap uit de bibliotheek."),
  ul([
    "**Alleen fysieke plekken.** Een werkplaats, atelier, club, bezoekplek, boerderij of natuurgebied. Een online cursus, app, webshop of landelijke organisatie zonder lokaal adres telt hier niet.",
    "**Bewijs van leven.** De eigen website of een bron van de afgelopen 12 maanden (24 voor een permanente plek bij een eigen keuze) moet tonen dat de plek bestaat en nu draait.",
    "**Evenementen en seizoenen.** Een cursus met vaste start of een seizoensaanbod telt alleen met een datum in de komende vier weken, of als het dit seizoen loopt. Een einddatum wordt bewaard en laat een gecachet antwoord eerder vervallen.",
    "**Wensen.** Vervoer zonder auto, een avond, toegankelijkheid, kinderen, rustig, geen alcohol, nieuwe mensen en geen Nederlands veranderen welke opties blijven staan als er meer dan drie zijn.",
  ]),
  p("Een eigen keuze van de bezoeker krijgt meer zoekruimte: een eigen aanroep, hoogstens vier zoekopdrachten, een straal van de gekozen afstand (zonder afstand ongeveer 25 km), en een permanente plek telt op oudere bewijs. Zo valt de wens van de bezoeker niet als eerste af."),
  h2("Hoe locaties worden gekoppeld"),
  p("Het model geeft per optie een naam, de echte plaats van de aanbieder (uit het adres op zijn website, nooit de plaats waarin gezocht werd), een link, een korte notitie en eventueel een beoordeling. In het boek wordt de locatie van een idee alleen genoemd als die letterlijk uit de opties van dát idee komt: `checkEntry` haalt een locatie weg die het onderzoek niet had. De kaartlink is een gewone Google Maps-zoekopdracht op naam en plaats (`mapsSearchUrl`), geen verzonnen diepe link, dus hij kan niet 'fout' zijn zoals een gefabriceerd adres. Een online aanbieder krijgt geen kaartlink."),
  h2("Hoe wordt gecontroleerd dat een activiteit echt bestaat?"),
  tab("controle", "Wat de code controleert, en wat niet", ["Controle", "Hoe", "Status"], [
    ["Website bestaat", "Hostnaam wordt opgezocht; een host die niet bestaat valt af. Een intern of IP-adres valt af.", "**Bestaat**"],
    ["Pagina bestaat", "404 of 410: de voorpagina wordt als vervanger geprobeerd; antwoordt die ook niet, dan valt de optie af.", "**Bestaat**"],
    ["De site zegt 'gesloten'", "De pagina wordt gelezen (hoogstens 150 KB) op zinnen als 'definitief gesloten' in vijf talen.", "**Bestaat**"],
    ["Geparkeerd of te koop", "Dezelfde leesstap herkent een geparkeerd domein.", "**Bestaat**"],
    ["Naam komt op de site voor", "Geen enkel woord (4+ letters, geen vulwoorden) van de naam op een echte pagina (400+ tekens): de site gaat over iets anders.", "**Bestaat**"],
    ["Datum niet verlopen", "Een einddatum in het verleden valt af; gecachete antwoorden vervallen op de einddatum.", "**Bestaat**"],
    ["Beoordeling echt", "Alleen met een bron en schaal 5 of 10; nooit geschat. Gecorrigeerd: (score × n + 4,0 × 20) / (n + 20).", "**Bestaat**"],
    ["Openingstijden, adres, prijs", "Niet tegen een gestructureerde bron gehaald; het boek mag er niets over beloven.", "**Niet gecontroleerd**"],
    ["Biedt het echt beginnerslessen aan?", "Dit rust op de instructie aan het model; de code controleert het niet.", "**Niet gecontroleerd**"],
  ], { widths: [24, 56, 20] }),
  note("eerlijk", "De eerlijke zin voor het boek is dus: *we zoeken plekken op het web en controleren of hun website bestaat en niet zegt gesloten te zijn*. 'Geverifieerde plekken' of 'gecontroleerde openingstijden' zou meer beloven dan de code doet. Een time-out, een 403 of een 429 telt overigens niet als bewijs van het tegendeel: veel echte sites weigeren robots."),
  h2("Hoe relevantie en geschiktheid worden beoordeeld"),
  p("Relevantie is al bepaald door de motor; het zoeken beoordeelt *geschiktheid*. De opties worden geordend op beoordeling, waarbij een plek met weinig reviews niet wint van een bekende op één vijfsterrenbeoordeling (de score wordt naar een voorafgaand gemiddelde van 4,0 getrokken, ter waarde van 20 reviews). Onder 4,0 blijft een optie alleen staan als er niets beters is. Hoogstens drie opties per idee. Daarbovenop komt de uniciteitsregel: een plek die een eerder idee al heeft, valt bij een later idee af, zodat één manege niet drie keer in het boek staat. De eigen keuzes gaan hierbij eerst."),
  h2("Hoe een concreet bezoek wordt gepresenteerd"),
  p("In het boek staat per idee: de naam en plaats van de eerste optie, de kaartlink, waar gevonden een beoordeling met bron en aantal reviews, de andere opties als alternatief, twee stappen en één eerste handeling die in een minuut kan ('bel Manege 't Hoogt en vraag naar een dag paardenverzorging'). De schrijver mag de eerste optie kiezen en moet een lager gewaardeerde alleen noemen met een reden uit het profiel."),
  note("bevinding", "In meetboek P13 noemt het idee *Nordic walking* een *gratis proefles* bij *Moving to Better Health*, terwijl de notitie van het onderzoek voor die aanbieder een proefles van € 25 noemt; de gratis proefles hoorde bij een andere optie (SVZAWA, Zeist). De kwaliteitspoort controleert tijd en budget van het boek als geheel, maar niet of een prijsclaim klopt met de notitie van de genoemde optie (bevinding F-04). Hetzelfde boek noemt een voornaam en een telefoonnummer van een contactpersoon van een manege, uit een zoekresultaat (bevinding F-05)."),
  laagB("Laag B: de zoekstroom in code", [
    code("settle(seeds)         = withBroad(seeds, standaardronde(seeds))      // één brede ronde, 2x afstand, ≤ 150 km\nwithOnline(seeds,\"nature\") = alleen wat van nature online is                // schrijfcursus, taalapp\nvoor ronde in 1..SUPPLY_ROUNDS(2):                                          // vervangen\n    noSupply = ideeën die een aanbieder nodig hebben en geen optie vonden, niet eigen keuze\n    retry = select(exclude = geprobeerd [+ alles wat geen aanbieder nodig heeft bij de laatste ronde])\n    accepteer retry alleen als er minder ideeën zonder aanbod zijn én geen eigen keuze verloren gaat\nvervang eigen keuzes zonder aanbod door een verwant idee uit de graaf (≤ 4 kandidaten)\nwithOnline(seeds,\"all\")      // het allerlaatste redmiddel\nruil ideeën zonder optie met een eerder in deze run onderzocht idee dat wel een optie heeft", "text"),
    p("De zoekopdracht heeft een eigen cachesleutel: `plaats|straal|maand|v5[|online][|broad][|n:wensen]`. Gevonden opties tellen 30 dagen, 'niets gevonden' 7 dagen, 'niets voor een eigen keuze' 2 dagen (`FOUND_TTL_DAYS`, `EMPTY_TTL_DAYS`, `PICK_EMPTY_TTL_DAYS`). De cache is gedeeld tussen bezoekers en bevat geen persoonsgegevens: alleen activiteit, plaats en maand."),
    p("Al tijdens het betalen start `prewarmBookResearch` dezelfde selectie en dezelfde zoekrondes, met dezelfde sessie als seed en dezelfde geschiedenis, zodat het echte boek alles in de cache vindt. Dat kost ongeveer $ 0,10 aan zoeken ook voor een bezoeker die daarna niet betaalt; `PREWARM_RESEARCH=0` zet het uit."),
  ]),
] });

// ====================================================================================================================
// Chapter 9
// ====================================================================================================================
export const ch9 = h1("ch9", "Technische architectuur", { blocks: [
  laagA("WindowInto is een gewone website met drie vaste gezichten. Wat je op je scherm ziet, draait in je browser. Het zware werk gebeurt op een server die Vercel beheert. Wat bewaard moet blijven, staat in een database van Supabase. Daaromheen staan diensten voor betalen, e-mail, plaatsnamen en het taalmodel."),
  fig("arch", "Systeemarchitectuur: browser, Next.js op Vercel en Supabase, met de externe diensten rechts."),
  h2("De onderdelen, eerst eenvoudig, dan technisch"),
  tab("tech", "Technologie in twee lagen", ["Onderdeel", "In gewone woorden", "Technisch"], [
    ["Frontend", "Wat je ziet en aantikt.", "Next.js 16.3 (App Router) met React 19.2, TypeScript, Tailwind CSS 4. Kleine, herbruikbare componenten onder `src/components/window/`."],
    ["Backend", "Code die op een server draait, niet in je browser.", "Server Actions en Route Handlers in dezelfde Next.js-app, gehost op Vercel. `after()` laat het zware werk na de respons doorlopen met maximaal 300 s (`maxDuration` op `/plan`)."],
    ["Selectiemotor", "De regels en de kaart van verbanden.", "Pure TypeScript zonder AI en zonder netwerk (`src/lib/discovery/engine/`). Dezelfde code draait in de browser (pagina's) en op de server (motor)."],
    ["Database", "Waar antwoorden, bestellingen en boeken bewaard blijven.", "Supabase Postgres, 24 migraties, `@supabase/ssr` en `supabase-js`. De bibliotheek staat bewust *niet* in de database maar als JSON in de code."],
    ["Taalmodellen", "De schrijver en de zoeker.", "Anthropic SDK 0.123. Sonnet 5 (`claude-sonnet-5`) schrijft en duidt; Haiku 4.5 zoekt (met de webzoektool `web_search_20250305`) en controleert grammatica. Afgedwongen tool-uitvoer (`tool_choice`) in plaats van vrije tekst."],
    ["PDF", "Het boek als document.", "`pdf-lib` met ingebedde lettertypes (Newsreader, Cormorant Garamond, Plus Jakarta Sans). Geen headless browser: elke pagina wordt getekend."],
    ["Betalen", "De kassa.", "Stripe Checkout (gehost); kaartgegevens komen nooit bij ons. Een webhook zet de status; de generatie start vanuit `/plan` nadat de betaling bij Stripe is opgevraagd."],
    ["E-mail", "Het boek in je inbox.", "Resend, met de PDF als bijlage. Twee dagelijkse taken via Vercel Cron: 09:00 UTC (herinnering) en 09:30 UTC (vervolgmail)."],
    ["Plaatsnamen", "Suggesties bij het typen.", "PDOK Locatieserver (Nederland) en Photon op OpenStreetMap-data (andere landen), via een eigen proxy-route."],
    ["Metingen", "Wat bezoekers doen, zonder wat ze schrijven.", "PostHog (browser na toestemming, plus een paar server-events zonder persoon). Een test (`analyticsEvents.test.ts`) laat elke gebeurtenis en elke eigenschap controleren, zodat er geen vrije tekst in kan sluipen."],
    ["Beeldmateriaal", "De foto's.", "Gemini (`@google/genai`) maakt ze met scripts, buiten een bezoek om. Elk beeld heeft een regel in `imageProvenance.json`."],
  ], { widths: [14, 24, 62] }),
  h2("Gegevensstromen en afhankelijkheden"),
  p("Het datastroomdiagram in hoofdstuk 7 (figuur 7.3) toont de objecten; de swimlane in hoofdstuk 3 toont de deelnemers. Samen: een bezoeker produceert een concept in de browser, de server bewaart en vertaalt het, de motor kiest, het zoeken verrijkt, het taalmodel schrijft, de code controleert en rendert, en het resultaat gaat in de opslag en per mail naar buiten. De applicatie hangt voor een betaald boek af van vier externe partijen die op het kritieke pad staan: Stripe, Anthropic, Supabase en Resend. Vallen het taalmodel of de zoekstap uit, dan gaat het boek zacht door: zonder lagen, zonder opties, of via de klassieke pijplijn (`generateIdeaBook`)."),
  tab("opslag", "Wat waar wordt bewaard", ["Tabel of opslag", "Inhoud", "Persoonsgegevens"], [
    ["`sessions`, `intake_answers`", "Een anonieme sessie en alle antwoorden (`raw_json`)", "Ja, indirect: plaats, optioneel voornaam en vrije tekst. Niet gekoppeld aan een e-mailadres."],
    ["`window_plans`", "Het boek (ideeën, wildcard, profielsamenvatting), voortgang, PDF-pad, ontvangstadres, gekozen idee, feedback", "Ja: het e-mailadres van de ontvanger (voor herinnering en vervolg), alleen met toestemming voor de vervolgmail"],
    ["`payments`, toestemmingen", "Bestelnummer, bedrag, status, akkoord op voorwaarden en directe levering met tijdstip en sessie, land en plaats van de besteller", "Ja, beperkt. Het IP-adres zelf wordt niet gelezen of bewaard; land en plaats komen uit de Vercel-headers."],
    ["`users`", "E-mailadres van de koper (Stripe)", "Ja"],
    ["`discovery_history`", "SHA-256 van een apparaatcode en activiteit-id's, maximaal twaalf maanden", "Nee: nooit de code of een e-mailadres. Alleen na een expliciete keuze."],
    ["`local_research_cache`", "Gevonden opties per activiteit, plaats en maand", "Nee"],
    ["`test_quota`, `test_feedback`", "Een gesleutelde hash van het adres (testfase); anonieme antwoorden op de testvragenlijst", "Hash, geen adres"],
    ["Opslag `window-plans`", "De PDF van elk boek", "Ja (inhoud). Privé-bucket: alleen via een tijdelijke link."],
  ], { widths: [24, 44, 32] }),
  h2("Beveiliging en privacy, voor zover aantoonbaar"),
  ul([
    "**Sessie.** Een httpOnly-cookie, `sameSite=lax`, zeven dagen, `secure` in productie. Persoonsgegevens zijn zoveel mogelijk los van gedragsdata: de antwoorden hangen aan een sessie, niet aan een e-mailadres.",
    "**Toegang tot de database.** De server gebruikt een service-role-client, alleen op de server. Row Level Security wordt in zeven migraties ingeschakeld (de basistabellen, het auditlog, de juridische tabellen, de zoekcache, het herhalingsgeheugen, de testvragenlijst en het testquotum).",
    "**PDF.** De bucket is privé (migratie 0011); `pdf_url` bevat alleen het pad en bij elk bezoek wordt een kortlevende, ondertekende link gemaakt.",
    "**Content Security Policy.** Per verzoek een nonce voor `script-src` met `strict-dynamic` (`src/proxy.ts`); de enige uitzonderingen zijn twee vaste, gehashte scripts van het framework.",
    "**Beheer.** Eén wachtwoord (`ADMIN_PASSWORD`); het cookie bevat een SHA-256 van dat wachtwoord, niet het wachtwoord, en verloopt na acht uur. Zonder ingesteld wachtwoord is het beheer onbereikbaar in plaats van open.",
    "**Toestemming en juridisch.** Cookiebanner voor PostHog; twee verplichte, afzonderlijke vinkjes vóór betaling (voorwaarden; directe levering met verlies van het herroepingsrecht), met tijdstip en sessie vastgelegd. Een lichte versiecontrole van de juridische teksten (`LEGAL_VERSIONS`).",
    "**Taalmodel.** De tekst van de bezoeker (voornaam, vrije tekst) gaat in de schrijfopdracht naar Anthropic. Het boek zegt 'Gemaakt met AI'. De juridische toets van de privacyzin hierover staat nog open in de to-do van de oprichter.",
  ]),
  h2("Schakelaars en hun standaardwaarde"),
  p("Veel gedrag staat achter een omgevingsvariabele. De standaardwaarden hieronder komen uit de code. Wat op Vercel is ingesteld, kon voor dit document niet worden ingezien."),
  tab("flags", "Omgevingsvariabelen die het gedrag veranderen", ["Variabele", "Standaard", "Effect"], [
    ["`KNOWLEDGE_ANCHOR_PICKS`", "**aan** (leeg is aan; `0`, `false`, `off`, `no` zet uit)", "Het ankermodel: tot vier eigen keuzes in het boek. Gebruikt `WEIGHTS_ANCHOR`."],
    ["`KNOWLEDGE_INDIRECT_SLOT`", "**aan**", "De 'indirecte plek' binnen het ankermodel."],
    ["`KNOWLEDGE_RANKING_V2`", "uit, maar het ankermodel zet de B4-rangschikking mee aan", "Gewichten `WEIGHTS_V2`, `fit` en `reasons` per idee."],
    ["`KNOWLEDGE_WRITING_V2` (oud: `KNOWLEDGE_ENGINE_V2`)", "**uit**", "Activiteitspecifieke tijdlijn, opbrengsten en suggesties; eerlijke herkomstwoorden. Een blinde vergelijking eindigde 2-2."],
    ["`KNOWLEDGE_ASSOCIATION_LAYER`", "**uit**", "De associatielaag op pagina 2 (127 associaties, gewicht 0,35)."],
    ["`REQUIRE_CONCRETE_OPTIONS`", "**aan**", "Extra online-ronde en vervangen van ideeën zonder optie."],
    ["`PREWARM_RESEARCH`", "**aan**", "Zoeken start tijdens het betalen (≈ $ 0,10, ook zonder betaling)."],
    ["`WINDOW_INTERPRETATION`", "**aan** (als er een API-sleutel is)", "Korte AI-duiding op het profielscherm; vaste tekst als terugval; 8 per verbinding per 10 minuten, 400 per uur."],
    ["`WINDOW_RESEARCH_MODEL`, `WINDOW_QA_MODEL`", "Haiku 4.5", "Model voor zoeken en voor de grammaticacontrole."],
    ["`NEXT_PUBLIC_IMAGES2_PERCENT`", "100", "Aandeel bezoekers met de tweepaginaroute; 0 zet de vierrondesroute aan."],
    ["`TEST_MAX_BOOKS_PER_IP`", "uit (leeg of 0)", "Testfase: maximaal N boeken per verbinding."],
    ["`NEXT_PUBLIC_TEST_FEEDBACK`", "uit", "De testvragenlijst onder het boek."],
    ["`STRIPE_MODE`", "test of live, uit de sleutel", "Toont de testbanner in testmodus."],
    ["`PRICE_TEST`", "uit", "Prijsvarianten; een fout in de instelling zet de test helemaal uit."],
    ["`SEASONAL_EDITION`", "uit", "Een seizoensedititie voor het schrijven."],
    ["`CRON_SECRET`", "optioneel", "Zo gezet: de twee dagelijkse taken eisen een Bearer-token."],
  ], { widths: [31, 25, 44], small: true }),
  note("eerlijk", "Er zijn vier intakevarianten in de code (`images2`, `associations`, `cards`, `legacy`) en twee generatiepijplijnen (`generateIdeaBookFromSeeds` en de klassieke `generateIdeaBook`). De standaardroute gebruikt één van elk. De rest is terugvalcode die tests en onderhoud kost (bevinding F-13)."),
  h2("Schaalbaarheid en bekende grenzen"),
  ul([
    "Een boek draait in één serverless-aanroep met een plafond van 300 s. De zoektocht stopt met nieuwe rondes na 120 s; het schrijven heeft ongeveer 100 s nodig. Dat laat weinig marge (bevinding F-12).",
    "De snelheidsbegrenzers en het geheugen van de AI-duiding zijn per serverinstantie, niet globaal. Bij meer instanties wordt de begrenzing ruimer dan bedoeld.",
    "De gedeelde zoekcache helpt pas bij volume: gesimuleerd 5 tot 9 procent bij 100 tot 300 bestellingen, ongeveer 24 procent bij 1.000 (`docs/discovery-api-costs.md`).",
    "Het aantal gelijktijdige generaties wordt beperkt door de limieten van Anthropic en Vercel, niet door code. Een uniek-index per sessie voorkomt dubbele generaties.",
  ]),
] });

// ====================================================================================================================
// Chapter 10
// ====================================================================================================================
export const ch10 = h1("ch10", "De volledige tijdlijn", { blocks: [
  laagA("Van het eerste klikken tot het ontvangen boek duurt het ongeveer vijf minuten, waarvan één tot twee minuten wachten. Veel werk gebeurt tegelijk: terwijl jij betaalt zoekt de applicatie al plekken, en terwijl de ideeën worden geschreven schrijft een tweede aanroep de extra lagen."),
  h2("Vijf soorten gebeurtenissen"),
  tab("tijdlijn", "De tijdlijn per soort gebeurtenis", ["Fase", "Gebruikersinteractie", "Intern proces", "Gegevensverwerking", "Extern zoeken", "Resultaatverwerking"], [
    ["Invullen (± 3 min)", "Start, beelden, activiteiten, profiel", "Pagina's samenstellen in de browser", "Smaakprofiel en dials berekenen; concept in `sessionStorage`", "Plaatssuggesties (PDOK of Photon)", "-"],
    ["Betalen (20 tot 60 s)", "E-mail, vinkjes, betalen", "Opslaan, vertalen, Stripe-sessie maken", "Rijen in `intake_answers`, `payments`, toestemmingen", "Stripe Checkout; **het zoeken start al** (cache opwarmen)", "-"],
    ["Boek maken (60 tot 120 s)", "Wachtscherm", "Motor kiest 7 zaden; controles; kwaliteitspoort", "Cache lezen en schrijven; voortgang bewaren", "Haiku met web: standaard, breed, online, vervangen; websitecheck", "PDF tekenen, uploaden, e-mailen"],
    ["Lezen", "Boek openen, kiezen, delen", "Tijdelijke PDF-link maken", "Feedback en gekozen idee bewaren", "-", "Webpagina en PDF tonen"],
    ["Daarna (dagen tot weken)", "Mail lezen, terugkomen", "Dagelijkse taken (09:00 en 09:30 UTC)", "Verzend-tijdstip bewaren", "-", "Herinnering (dag 2 tot 9), vervolgmail (week 6)"],
  ], { widths: [14, 16, 18, 20, 18, 14], small: true }),
  fig("timeline", "Tijdlijn van input tot eindresultaat, met parallelle processen. Niet op schaal; stippelrand betekent 'alleen als het nodig is'.", { landscape: true }),
  h2("Wat achtereenvolgens gebeurt en wat tegelijk"),
  ul([
    "**Achtereenvolgens:** de motor eerst, dan het zoeken, dan het schrijven, dan de controles, dan de PDF. Het schrijven begint pas als het zoeken klaar is, omdat de tekst de opties nodig heeft.",
    "**Tegelijk:** het zoeken naar eigen keuzes en naar de rest van het boek (twee aanroepen naast elkaar); het schrijven van de ideeën en het schrijven van de lagen (twee Sonnet-aanroepen, ongeveer 45 s in plaats van 90 s); het zoeken tijdens het betalen.",
    "**Alleen als nodig:** de brede ronde, de online ronde en het vervangen. In meetboek P13 waren dat vijf zoekrondes in plaats van één, met bijna 54 s zoeken en $ 0,39 totaal; in drie andere meetboeken $ 0,21 tot $ 0,23.",
  ]),
  h2("Hoe de generatie robuust blijft"),
  laagB("Laag B: gelijktijdigheid en herstel", [
    p("Een uniek-index (migratie 0012) staat per sessie maar één actieve rij in `window_plans` toe. Een tweede verzoek dat hem verliest, leest wat het eerste maakt en toont het wachtscherm. De zware generatie draait in `after()`; een verversing van de pagina start dus geen tweede generatie."),
    p("Een rij die langer dan de platformlimiet (300 s) op `pending` staat, hoort bij een gestopt proces en wordt `failed`. Eén automatische tweede poging mag (`shouldRetryStopped`, het onderzoek zit dan grotendeels in de cache); een sessie waarvan ook de tweede poging stopte, toont het foutscherm met een knop *Probeer opnieuw* in plaats van een eindeloze keten van generaties die elk geld kosten."),
    p("De voortgang (`progress_stage`: `selected`, `researched`, `written`, `rendered`, met aantallen in `progress_meta`) wordt bij elke stap bewaard; het wachtscherm toont wat er echt klaar is. Elke schrijfactie voor de voortgang faalt zacht: ontbreekt de kolom, dan wordt zonder getallen geschreven in plaats van het boek te laten mislukken."),
  ]),
] });
