import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { h1, h2, h3, p, ul, ol, laagA, laagB, fig, tab, code, note, facts, pb, steps } from "./dsl.mjs";
import { findings, KINDS } from "./findings.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const scenarios = JSON.parse(readFileSync(path.join(here, "facts", "scenarios.json"), "utf8"));
const verificationPath = path.join(here, "facts", "verification.json");
const verification = existsSync(verificationPath) ? JSON.parse(readFileSync(verificationPath, "utf8")) : [];

const nl = (n) => String(n).replace("-", "−").replace(".", ",");
const DOOR = { natural: "Vertrouwd", discovery: "Ontdekking", unexpected: "Onverwacht", stretch: "Uitdaging", wildcard: "Wildcard" };
const CTX = { self: "voor zichzelf", child: "voor een kind of jongere", adult: "voor een andere volwassene", group: "voor een groep" };
const TIME = { halfday: "een halve dag", fullday: "een hele dag", hour: "een uur", weekend: "een weekend" };

function ideaLine(sd) {
  const name = sd.hybrid ? `${sd.hybrid} (combinatie)` : sd.activity;
  return `niveau ${sd.level}: ${name}`;
}
const DIAL = { either: "gemengd", unexpected: "open voor onverwacht", grounded: "vertrouwd", practical: "praktisch", wild: "wild" };
const EFFORT = { minimal: "weinig inspanning", some: "een beetje inspanning", committed: "volle inzet" };
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const NOTE_NL = (n) => (n.startsWith("anchor_picks:") ? `ankermodel met ${n.split(":")[1]} eigen keuzes` : n === "indirect_slot" ? "de 'indirecte plek' is gebruikt" : n);

function scenarioTable(key, id, extra) {
  const sc = scenarios.find((x) => x.key === key);
  const chip = sc.constraints.formats ? " Chip: *Met een groep*." : "";
  return tab(id, `Praktijkvoorbeeld ${key}, in zeven stappen`, ["Stap", "Wat er gebeurt"], [
    ["1 Invoer", `Zoekt ${CTX[sc.context]} in ${sc.location}, binnen ${sc.km} km, budget tot € ${sc.budget} per persoon, ${TIME[sc.time] ?? sc.time}, in november.${chip}`],
    ["2 Associaties aangeboden", `Een gebalanceerde set van 18 beelden uit 516${sc.context === "child" ? ", met een lichte voorkeur voor spel, dieren en maken" : sc.context === "group" ? ", met een lichte voorkeur voor samenwerken, competitie en gezelligheid" : " (bij 'voor zichzelf' geen contextvoorkeur)"}.`],
    ["3 Keuzes", `Beelden: ${sc.cards.join("; ")}. Activiteiten: ${sc.picks.join("; ")} (de laatste is een verkenplek).`],
    ["4 Verwerking", `Sterkste tags: ${sc.topTags.slice(0, 4).map((t) => t.split(":")[0].toLowerCase()).join(", ")}. Assen: sociaal ${nl(sc.axes.social)}, energie ${nl(sc.axes.energy)}. Dials: ${DIAL[sc.dials.practicalToWild] ?? sc.dials.practicalToWild}, ${EFFORT[sc.dials.effort] ?? sc.dials.effort}. Kostenklasse t/m ${sc.constraints.costCap}, intensiteit t/m ${sc.constraints.intensityCap}${sc.constraints.minorSafe ? ", kind-lijst aan" : ""}${sc.constraints.formats ? ", alleen groepsvormen" : ""}. ${cap(NOTE_NL(sc.notes[0]))}; ${NOTE_NL(sc.notes[1] ?? "")}.`],
    ["5 Activiteiten die voortkomen", sc.seeds.map(ideaLine).join("; ") + "."],
    ["6 Bezoeken vinden", extra.search],
    ["7 Eindresultaat", extra.result],
  ], { widths: [20, 80] });
}

// ====================================================================================================================
// Chapter 11
// ====================================================================================================================
export const ch11 = h1("ch11", "Praktijkvoorbeelden", { blocks: [
  laagA("Hieronder drie fictieve bezoekers met een verschillende situatie. Hun keuzes zijn gesimuleerd, maar wat de motor ermee doet is echt: dezelfde code als in productie, met de echte bibliotheek, in november."),
  note("let-op", "**Wat echt is en wat niet.** Echt: de bibliotheek, de motor, de filters, de gewichten en de uitvoer (zaden, niveaus, ketens). Verzonnen: de personen, hun plaats en wat zij kiezen (de vier activiteiten met de meeste tag-overlap met hun beelden, plus één verkenplek). Niet gedraaid: het zoeken en schrijven, omdat dat betaalde AI-aanroepen zijn. Stap 6 en 7 volgen daarom uit de code en uit een eerder gegenereerd meetboek. De leeftijd en het gezelschap zijn niet ingevoerd, omdat de standaardroute er niet naar vraagt."),
  h2("Voorbeeld A: een rustige zoeker voor zichzelf"),
  fig("scA", "Praktijkvoorbeeld A: beelden, wat de code leest, gekozen activiteiten en de zeven ideeën van de motor."),
  scenarioTable("A", "voorbeeldA", {
    search: "Per idee zoekt het onderzoek in en rond Zwolle binnen 25 km. *High tea op een historische buitenplaats* is een combinatie: de opties van beide helften tellen. Vindt de standaardronde niets voor *Sushi rollen* (regionaal aanbod), dan volgt een brede ronde over 50 km en pas daarna een verwant idee. *Vissen* krijgt in de eerste stap de regel mee dat een vergunning vooraf geregeld moet worden.",
    result: "Een boek met vier eigen keuzes (deur Vertrouwd), een wandeling over een oude begraafplaats (Ontdekking), een high tea op een buitenplaats (Onverwacht) en een linoleumsnede als verzegelde wildcard. De deur Uitdaging ontbreekt (bevinding F-02). De vijfde keuze, een stedentrip rond één thema, haalde het boek niet (bevinding F-09).",
  }),
  p("Wat dit voorbeeld toont: de motor volgt de smaak (geschiedenis, verhaal, stilte) en gaat in kleine stappen weg ervan. De *brug* tussen een historische buitenplaats en een begraafplaats is 4,5: geschiedenis én verhaal. De high tea is een gecureerde combinatie met een van haar eigen keuzes. De wildcard is het verst weg (aansluiting 0,13) en dat is de bedoeling."),
  h2("Voorbeeld B: een ouder die zoekt voor een kind"),
  fig("scB", "Praktijkvoorbeeld B: zoeken voor een kind in Utrecht."),
  scenarioTable("B", "voorbeeldB", {
    search: "Het onderzoek zoekt in en rond Utrecht binnen 15 km. De doelgroep is 'kind of jongere' zonder leeftijd: de schrijfopdracht krijgt de regel niets aan te nemen over leeftijd, en de motor past de kind-lijst en een zachte weging 'onder 18' toe. Voor *Lasergamen of paintball* zal de eerste stap de minimumleeftijd moeten laten controleren.",
    result: "Vier eigen keuzes, oriëntatielopen als aangrenzend idee (via competitie en beweging), een parfumerie bezoeken als onverwacht idee (een keten van het naaicafé via natuurlijke cosmetica, met één zwakke brug, *stijl*) en kaarsen maken als wildcard. Het boek spreekt de ouder of het kind aan als 'de persoon' of bij naam.",
  }),
  p("Wat dit voorbeeld toont: de kind-lijst filtert 33 activiteiten, maar *Lasergamen of paintball* staat er niet op en komt in dit boek terecht (bevinding F-07). Het onverwachte idee heeft aansluiting 0,00: de keten loopt via één zwakke tag. Bij 'zoeken voor een ander' zit de zorg in de schrijfopdracht en in de keuze van de beelden, niet in een leeftijdsgrens per activiteit."),
  h2("Voorbeeld C: een vriendengroep"),
  fig("scC", "Praktijkvoorbeeld C: zoeken voor een groep van zes in Eindhoven."),
  scenarioTable("C", "voorbeeldC", {
    search: "Het onderzoek zoekt in en rond Eindhoven binnen 25 km. De chip werkt alleen in de motor: alleen activiteiten die een kleine of grote groep ondersteunen komen door de filter. Het zoeken en schrijven krijgen er geen eigen regel voor, dus of een aanbieder groepen aanneemt, komt alleen via de notitie van de optie in het boek. Een puzzeljacht, paintball en een ijshockey-proefles hebben meestal regionaal aanbod en kunnen een brede ronde vragen.",
    result: "Vier eigen keuzes, een ijshockey-proefles (Ontdekking), een eigen mini-onderzoek doen via een keten door codes kraken (Onverwacht) en modelbouw als wildcard. Modelbouw heeft geen enkele brug met de keuzes (aansluiting 0,00): de toevalsloting koos een wereld die niemand koos.",
  }),
  p("Wat dit voorbeeld toont: een groepschip is een harde filter op de sociale vorm, geen weging. De motor kiest uit wat in groepsvorm kan. De wildcard is ook hier bewust ver weg, zonder verband, en dat is het ontwerp: *toeval bepaalt welke, de filters bepalen of het past*."),
  h2("Wat alle drie laten zien"),
  tab("conclusies", "Vergelijking van de drie voorbeelden", ["Aspect", "A (voor zichzelf)", "B (kind)", "C (groep)"], [
    ["Eigen keuzes in het boek", "4 van 5", "4 van 5", "4 van 5"],
    ["Niveaus", "1, 1, 1, 2, 3, 5, 7", "1, 1, 1, 2, 3, 5, 7", "1, 1, 1, 2, 3, 5, 7"],
    ["Deuren", "Vertrouwd 4, Ontdekking 1, Onverwacht 1, Wildcard 1", "idem", "idem"],
    ["Zwakste verband", "Wildcard (0,13)", "Onverwacht (0,00) en wildcard (0,13)", "Onverwacht (0,21) en wildcard (0,00)"],
    ["Opvallend", "Combinatie als onverwacht idee", "Kind-lijst laat paintball door", "Groepschip filtert op vorm"],
  ], { widths: [22, 26, 26, 26] }),
] });

// ====================================================================================================================
// Chapter 12
// ====================================================================================================================
const byKind = (k) => findings.filter((f) => f.kind === k).map((f) => f.id).join(", ");
export const ch12 = h1("ch12", "Kwaliteitsanalyse en aandachtspunten", { blocks: [
  laagA("WindowInto is een zorgvuldig gebouwd systeem met een duidelijke ruggengraat: harde grenzen, een deterministische motor, een eerlijke zoekstap. De kwetsbaarheden zitten niet in die ruggengraat maar aan de randen: de data van de bibliotheek, wat het zoeken niet kan controleren, en de afstand tussen wat de documentatie belooft en wat de standaardinstelling doet."),
  p(`Dit hoofdstuk beoordeelt de applicatie kritisch en scheidt drie soorten uitspraken. Een **bewezen tekortkoming** is aan code of uitvoer aan te wijzen (${byKind("B")}). Een **risico** volgt uit het ontwerp maar is niet zichtbaar in een run (${byKind("R")}). Een **verbetermogelijkheid** is een aanbeveling zonder dat iets stuk is (${byKind("V")}). Wat niet uit de code te verifiëren is, heet **onduidelijk** (${byKind("O")}). Bijlage A heeft de volledige lijst met bewijs.`),
  h2("Wat goed werkt"),
  ul([
    "**Een eerlijke scheiding van ontdekken en bestaan.** De motor weet niets van aanbod; het zoeken beslist wat er is, en een idee zonder optie komt niet in het boek. In meetboek P13 kregen alle zeven ideeën een fysieke optie, zonder één online aanbieder (Stap 178).",
    "**Harde grenzen zijn een eigen laag.** Budget, binnen of buiten, seizoen, toezicht, kind-lijst en chips zijn nooit een gewicht, en een onbekend feit sluit niets uit maar wordt gecontroleerd.",
    "**Zacht falen.** Elke stap die geld of tijd kost (zoeken, lagen, kwaliteitspoort, duiding) heeft een terugval; het betaalde boek wordt afgeleverd, desnoods zonder lagen of via de klassieke pijplijn.",
    "**Variatie is gemeten en bijgesteld.** Een lange wandeling stond in 22 procent van de boeken en na drie maatregelen in 11 procent (oktober, `docs/discovery-engine.md`); het doelgroeponderzoek van 12 november leidde tot vier reeksen fixes (Stap 167 tot 170).",
    "**Kosten zijn laag per boek.** Drie van vier meetboeken kostten $ 0,21 tot $ 0,23; het vierde $ 0,39 met vijf zoekrondes.",
  ]),
  fig("cost", "AI-kosten per gegenereerd boek in vier meetboeken, uit `scratch/persona-books`. Zoeken is het grootste deel en het meest variabel."),
  h2("Beoordeling per aandachtsgebied"),
  tab("kwaliteit", "Kritische beoordeling per aandachtsgebied", ["Gebied", "Beoordeling", "Bevindingen"], [
    ["Consistentie van de gebruikerservaring", "De route is kort en duidelijk, met echte voortgang tijdens het wachten. De belofte 'kies er tot acht' wordt niet nagekomen (vier komen er in). Vier intakevarianten en twee pijplijnen maken de code breder dan de ervaring.", "F-09, F-13"],
    ["Logische samenhang tussen de stappen", "Sterk: elke stap geeft een gedefinieerd object door (hoofdstuk 7). Zwak punt: de simulaties gaan uit van meer keuzes dan het minimum, en leeftijd en gezelschap worden niet meer gevraagd terwijl de code ze nog gebruikt.", "F-03, F-08"],
    ["Kwaliteit van de associaties", "Beelden zijn evenwichtig samengesteld en bijna elke familie heeft drie varianten. De associatielaag, die de woordenschat zou verrijken, is niet beoordeeld. Het stijlregister is een aanname van de bouwer.", "F-19, F-26"],
    ["Dekking van de bibliotheek", "756 activiteiten in 22 werelden is breed. Alle staan op concept; het niveau-facet is voor 84 procent leeg; bij 42 procent is het aanbod niet vastgelegd. Dieren, ambacht en sport domineren; reizen, helpen en stijl zijn dun.", "F-10"],
    ["Relevantie van resultaten", "De motor is relevant en gevarieerd, en het zoeken levert echte plekken. Een vervanger kan formeel passen maar inhoudelijk afliggen, en een prijsclaim kan afwijken van de optie.", "F-04, F-06"],
    ["Diversiteit van aanbevelingen", "Vier mechanismen (clusters, wereldlimieten, zeldzaamheid, hub-demping) en gemeten verbetering. In de standaardinstelling bestaat een boek uit vier eigen keuzes en drie anderen: de diversiteit zit in drie plekken.", "F-02, F-11"],
    ["Blinde vlekken in de selectie", "Tijd is geen filter; vervoer, avond, weekend en toegankelijkheid zijn alleen vlaggen; 'verras me' negeert de beelden; de kind-lijst is handmatig.", "F-07, F-14, F-24"],
    ["Technische afhankelijkheden", "Vier externe partijen op het kritieke pad (Stripe, Anthropic, Supabase, Resend). Zachte terugval overal behalve bij betalen en opslag.", "F-12, F-16"],
    ["Schaalbaarheid", "De generatie draait in één aanroep met weinig marge; begrenzers per instantie; de gedeelde cache helpt pas bij volume; kosten variëren per plaats.", "F-12, F-15, F-17, F-18"],
    ["Privacy en gegevensminimalisatie", "Sterk: anonieme sessie, een hash voor het geheugen, geen IP-adres bewaard, geen vrije tekst in metingen. Aandachtspunten: namen en nummers van derden in notities; tekst naar Anthropic; juridische toets open.", "F-05, F-21"],
  ], { widths: [22, 58, 20] }),
  h2("Mogelijke foutscenario's en wat er dan gebeurt"),
  tab("fouten", "Foutscenario's", ["Scenario", "Gedrag", "Beoordeling"], [
    ["Het zoeken mislukt of geeft niets", "Een mislukte ronde telt niet als 'geen aanbod'. Het idee gaat naar de volgende trede van de ladder; het boek blijft komen.", "Goed"],
    ["De schrijfaanroep geeft een onleesbaar antwoord", "Eén herhaling; bij een lijst als tekst herstelt `repairStringifiedFields`; faalt het weer, dan de klassieke pijplijn.", "Goed"],
    ["De lagen-aanroep faalt", "Het boek komt zonder de extra lagen.", "Goed"],
    ["De kwaliteitspoort faalt", "Het boek blijft zoals het was; de poort kan een boek nooit laten mislukken.", "Goed"],
    ["De generatie loopt vast of wordt gestopt", "Na 300 s wordt de rij `failed`; één automatische tweede poging; daarna een knop.", "Goed"],
    ["Twee verzoeken tegelijk", "Een unieke index per sessie; de tweede toont het wachtscherm.", "Goed"],
    ["De PDF kan niet worden opgeslagen", "`pdf_url` blijft leeg; de webpagina werkt.", "Redelijk"],
    ["De e-mail faalt", "De reden wordt in `progress_meta.email_error` bewaard en in het beheer getoond; het boek is er.", "Goed"],
    ["Een migratie ontbreekt", "Schrijfpogingen vallen terug op minder kolommen (`isMissingColumnError`) en loggen de oorzaak.", "Goed"],
    ["Het tegoed bij Anthropic is op", "Een mislukte rij met een knop om opnieuw te proberen; geen eindeloze herhaling.", "Redelijk: de bezoeker weet de reden niet"],
    ["Een betaalde bestelling zonder boek", "De betaling is veilig; de bestelling is traceerbaar via bestelnummer.", "Goed"],
  ], { widths: [28, 52, 20] }),
  h2("Waar de beoordeling zelf beperkt is"),
  p("Er zijn geen gegevens van echte bezoekers (bevinding F-22): wat hier staat over relevantie en variatie komt uit simulaties en een handvol meetboeken. Het zoeken is niet opnieuw gedraaid voor dit document. Geen enkele uitspraak over de werking op de live site is hier getoetst."),
] });

// ====================================================================================================================
// Chapter 13
// ====================================================================================================================
export const ch13 = h1("ch13", "Ontwikkelperspectief", { blocks: [
  laagA("De ruggengraat van WindowInto is sterk. De volgende stappen maken het product eerlijker (wat de documentatie belooft is wat de standaardinstelling doet), betrouwbaarder (wat het zoeken vindt klopt vaker) en geloofwaardiger (er komen echte gegevens van bezoekers)."),
  note("let-op", "Alles in dit hoofdstuk is een **aanbeveling**. Niets hiervan bestaat in de code. De inspanning (K, M, G) is een grove schatting van de schrijver en geen planning."),
  h2("Directe verbeteringen"),
  tab("direct", "Directe verbeteringen", ["Aanbeveling", "Waarom", "Bevinding", "Inspanning"], [
    ["Werk `product-reference.nl.md`, `discovery-engine.md` en `centrale-intake.md` bij; haal de getallen uit een script", "De documentatie belooft iets anders dan het product doet", "F-01", "K"],
    ["Beslis over de deur Uitdaging: een anker minder, of een wildcard die ook uitdaagt; pas uitleg en harnas daarop aan", "In het ankermodel ontbreekt de uitdaging en heeft Vertrouwd vier ideeën", "F-02", "K"],
    ["Zeg op pagina 2 hoeveel keuzes eigen ideeën worden", "Hoogstens vier van de acht keuzes komen in het boek", "F-09", "K"],
    ["Voeg een prijscontrole toe tussen een idee en de notitie van zijn eerste optie", "Een 'gratis' proefles die € 25 kost schaadt het vertrouwen", "F-04", "K"],
    ["Haal voornamen en telefoonnummers uit optienotities", "Persoonsgegevens van derden in een gedeeld boek", "F-05", "K"],
    ["Zet het vaste e-mailadres in een omgevingsvariabele; ruim verouderde commentaren op", "Verwarring en een persoonlijk adres in de repository", "F-20", "K"],
    ["Laat de simulaties ook met het wizardminimum draaien", "De metingen gelden voor 5+ beelden en 3+ activiteiten", "F-03", "K"],
  ], { widths: [38, 34, 12, 16], small: true }),
  h2("Functionele uitbreidingen"),
  tab("functioneel", "Functionele uitbreidingen", ["Aanbeveling", "Waarom", "Bevinding", "Inspanning"], [
    ["Beslis over leeftijd en gezelschap: terug als optionele vraag, of de dode code verwijderen", "Dode weging en afwijking van de documentatie", "F-08", "M"],
    ["Laat de bezoeker per idee 'klopt deze plek?' melden, en bewaar dat", "Eerste harde gegevens over de kwaliteit van het zoeken", "F-16, F-22", "M"],
    ["Gebruik het tag-profiel ook als de bezoeker 'verras me' kiest", "Beelden doen er dan nog toe", "F-24", "M"],
    ["Toon de rest van de eigen keuzes als 'ook in deze richting'", "Geen keuze verdwijnt zonder uitleg", "F-09", "M"],
  ], { widths: [38, 34, 12, 16], small: true }),
  h2("Algoritmische optimalisaties"),
  tab("algoritmisch", "Algoritmische optimalisaties", ["Aanbeveling", "Waarom", "Bevinding", "Inspanning"], [
    ["Voeg `minimumAge`, `accessibility` en `language` toe aan de bibliotheek en filter erop", "Nu zijn het vlaggen of handmatige lijsten", "F-07, F-08", "G"],
    ["Eis een minimale `fit`, dezelfde kostenklasse en toon voor een vervangend idee", "Een formele brug is geen inhoudelijke match", "F-06", "M"],
    ["Meet de variatie bij elke bibliotheek-uitbreiding en bewaak hem in de test", "Hubs en herhaling keren terug", "F-11", "K"],
    ["Beoordeel de associatielaag met een mens en zet hem alleen aan bij een duidelijke voorkeur", "Gebouwd en gemeten maar niet beoordeeld", "F-19", "M"],
    ["Kalibreer het niveau-facet of haal het uit `practicality`", "84 procent staat op 0", "F-10", "M"],
  ], { widths: [38, 34, 12, 16], small: true }),
  h2("Technische verbeteringen"),
  tab("technisch", "Technische verbeteringen", ["Aanbeveling", "Waarom", "Bevinding", "Inspanning"], [
    ["Verplaats het zoeken naar een achtergrondtaak met eigen tijdlimiet", "De marge binnen 300 s is krap", "F-12", "G"],
    ["Bewaar het verbruik per boek en geef een melding bij een drempel", "Geen harde bovengrens per boek", "F-15", "K"],
    ["Vervang begrenzers in het geheugen door de database", "Per serverinstantie is geen echte begrenzing", "F-17", "K"],
    ["Verkort de cachetermijn voor evenementen en cursussen", "30 dagen is te lang voor tijdelijk aanbod", "F-18", "K"],
    ["Verwijder de intakevarianten `cards` en `legacy` en bewaar de klassieke pijplijn alleen als terugval", "Minder onderhoud, minder paden", "F-13", "M"],
    ["Draai de testsuite met uitgebreide uitvoer en zet de worker-time-out expliciet", "Zes ongespecificeerde 'errors'", "F-25", "K"],
  ], { widths: [38, 34, 12, 16], small: true }),
  h2("Strategische mogelijkheden op langere termijn"),
  tab("strategisch", "Strategische mogelijkheden", ["Aanbeveling", "Waarom", "Bevinding", "Inspanning"], [
    ["Een eigen aanbiedersgegevensbestand, aangevuld met open data (kaartdata, gemeentelijke activiteitenkalenders) en samenwerkingen", "Het live web via een klein model is niet reproduceerbaar of volledig controleerbaar", "F-16", "G"],
    ["Een beoordelingsproces voor de bibliotheek met kenners per wereld (`reviewed` en `live`)", "Alle 756 activiteiten zijn onbeoordeeld", "F-10", "G"],
    ["Een meetplan op echte gebruikers: funnel in PostHog en de testvragenlijst als kwaliteitsmeter", "Alle gegevens zijn simulaties", "F-22", "M"],
    ["Een aanbiederslaag per land als WindowInto buiten Nederland wil groeien", "De motor is landonafhankelijk, het zoeken niet", "F-16", "G"],
  ], { widths: [38, 34, 12, 16], small: true }),
] });

// ====================================================================================================================
// Appendices
// ====================================================================================================================
const findingRows = findings.map((f) => [`**${f.id}**`, KINDS[f.kind], f.area, `**${f.title}.** ${f.evidence}`, f.advice]);
export const appA = h1("appA", "Bijlage A. Technische bevindingenlijst", { appendix: "A", blocks: [
  p("Alle bevindingen uit het onderzoek, met bewijs en advies. B is bewezen, R is een risico, V is een verbetermogelijkheid, O is onduidelijk of niet te verifiëren. Dezelfde lijst staat als los bestand in `WindowInto-bevindingen.md`."),
  tab("bevindingen", "De bevindingen", ["Id", "Soort", "Gebied", "Bevinding en bewijs", "Advies"], findingRows, { widths: [8, 10, 10, 50, 22], small: true }),
] });

export const appB = h1("appB", "Bijlage B. Tegenstrijdigheden tussen documentatie, ontwerp en code", { appendix: "B", blocks: [
  p("Waar documentatie, ontwerp en implementatie verschillen, volgt dit document de code. Hieronder staan de verschillen die bij het onderzoek zijn gevonden."),
  tab("tegenstrijdig", "Documentatie of ontwerp tegenover de code", ["Bron", "Zegt", "Code", "Gevolg"], [
    ["`product-reference.nl.md`", "± 578 activiteiten in 21 richtingen; 342 beeldkaarten in 114 families", "756 in 22 werelden; 516 kaarten in 172 families", "Getallen in uitleg en materiaal kloppen niet"],
    ["`product-reference.nl.md`", "'Alleen Nederland'", "Plaatsen in andere landen worden ondersteund (land, Photon, zoeken in de taal van het land)", "De belofte is nauwer dan het product"],
    ["`product-reference.nl.md`", "Een cadeaubon van € 14,95 bestaat", "Verwijderd in Stap 150", "Verouderd"],
    ["`product-reference.nl.md`", "'3 tot 8 keuzes' op beide pagina's, met 'verras me' bij de beelden", "Pagina 1: 3 tot 8, geen 'verras me'. Pagina 2: 1 tot 8, of 'verras me'", "Verkeerde verwachting van de flow"],
    ["`product-reference.nl.md`", "'Een volwassen activiteit wordt nooit aan een kind getoond'", "Alleen 33 genoemde id's vallen af (`MINOR_UNSUITABLE`)", "De belofte is sterker dan de code"],
    ["`product-reference.nl.md`", "Kosten ± $ 0,15 tot $ 0,35 per boek", "Gemeten $ 0,21 tot $ 0,39", "Ondergrens te laag"],
    ["`product-reference.nl.md`, `plan/data.ts`", "Vier deuren: 2 vertrouwd, 2 ontdekking, 1 onverwacht, 1 uitdaging", "Ankermodel: 4, 1, 1, 0 en een wildcard", "Zie F-02"],
    ["`discovery-engine.md`", "'Nog niet aangesloten op de generatie'", "De motor is de standaard (`runEngine` in `generateFromSeeds.ts`)", "Verouderde kop"],
    ["`discovery-engine.md`", "De zeven zaden vallen één op één op de zeven niveaus", "Niet in het ankermodel: de niveaus 4 en 6 blijven leeg", "Zie F-02"],
    ["`discovery-engine.md`, `weights.ts`", "`WEIGHTS_CURRENT` is de standaard", "`knowledgeAnchorEnabled()` is standaard aan en kiest `WEIGHTS_ANCHOR`", "Documentatie volgt de oude standaard"],
    ["`centrale-intake.md`", "Leeftijd, gezelschap en vrije tekst onder 'Meer opgeven'", "`saveForPayment` stuurt `ageCategory` en `socialFormats` leeg; `company` is leeg; `mustHaves` is alleen de chips", "Zie F-08"],
    ["`twoPages.ts`", "`MIN_IMAGE_PICKS = 5`, `MIN_CONCRETE_PICKS = 3`", "De wizard eist 3 beelden en 1 activiteit", "Zie F-03"],
    ["`plan/data.ts` (commentaar)", "Een knop 'Betaling overslaan' en 'testers die de betaling overslaan'", "De knop bestaat niet meer; het pad is alleen voor de beheerder", "Verwarrend commentaar"],
    ["`pdf/ideaBook.ts` (commentaar)", "Noto-lettertypes", "Newsreader, Cormorant Garamond en Plus Jakarta Sans", "Verwarrend commentaar"],
    ["`verbeterplan-windowinto.md`", "'Zeven vensters' als ontwerp op de pagina", "Alleen als intern niveau; de bezoeker ziet vier deuren en een wildcard", "Terminologie"],
  ], { widths: [20, 30, 32, 18], small: true }),
] });

export const appC = h1("appC", "Bijlage C. De gewichten van de selectiemotor", { appendix: "C", blocks: [
  p("De getallen die de selectie sturen, uit `src/lib/discovery/engine/weights.ts`. De productiestandaard is `WEIGHTS_ANCHOR`. Een hoge score koopt nooit een harde grens terug: de harde regels staan in `constraints.ts`."),
  tab("gewichten", "`WEIGHTS_ANCHOR` (ankermodel, B4-rangschikking en hub-demping)", ["Onderdeel", "Waarde", "Betekenis"], [
    ["`anchor.picks`", "4", "Aantal eigen keuzes dat zeker in het boek komt"],
    ["`anchor.indirect`", "aan", "De 'indirecte plek' als aangrenzend slot"],
    ["`hub`", "0,6", "Straf per eenheid hubness voor ideeën die de bezoeker niet koos"],
    ["`sharedPairPenalty`", "0,45", "Straf voor elk gekozen idee waarmee dit idee twee of meer echte tags deelt"],
    ["`redundancyPerBridge`", "0,05", "Straf per eenheid gedeeld verbindingsgewicht met gekozen ideeën"],
    ["`rare` per richting", "vertrouwd 0,12, aangrenzend 0,2, onverwacht 0,25, uitdaging 0,15, wildcard 1,5", "Hoe sterk een richting naar de lange staart leunt"],
    ["`rareJitter`", "0,4 + 1,2 × u", "Elke bezoeker weegt zeldzaamheid iets anders (seed)"],
    ["`supply`", "rare 0,18, regional 0,04", "Straf voor activiteiten die een aanbieder in de buurt nodig hebben"],
    ["`familiar`", "pickedScore 2, nearRel 0,4, noise 0,3, spreiding 0,35, praktisch 0,3", "Vertrouwd, zonder ankers"],
    ["`unexpected`", "hybridBase 2,5, hybridBridge 0,15, hybridNoise 0,3, chainNoise 0,15, oneStepBridge 0,1, oneStepNoise 0,15, farRelMax 0,3", "Onverwacht"],
    ["`adjacent`", "noise 0,15, noveltyOtherWorld 0,15, peak 0,38", "Aangrenzend"],
    ["`stretch`", "base 2, bridge 0,15, noise 0,2, doelen 1 / 1,2 / 2 / 2,8", "Uitdaging"],
    ["`wildcard`", "bridge 2, newWorld 2, redundancyFactor 4, ageDecay 2, baseRare 0,5, supplyDecay 3", "Wildcard"],
    ["`strictFreeCost`, `explain`", "aan", "Onbekende kosten passeren geen gratis budget; `fit` en `reasons` per idee"],
  ], { widths: [26, 44, 30], small: true }),
] });

const verRows = verification.map((r) => [r.area, r.claim, r.expected, r.actual, r.ok ? "klopt" : "**FOUT**"]);
export const appD = h1("appD", "Bijlage D. Verificatie en eindcontrole", { appendix: "D", blocks: [
  h2("Wat is gecontroleerd"),
  ol([
    "**Getallen opnieuw uit de bron.** `verify.mjs` leest de bronbestanden als tekst en JSON (onafhankelijk van de TypeScript-probes) en vergelijkt elk getal en elke regel die dit document noemt. Het resultaat staat hieronder.",
    "**De motor opnieuw gedraaid.** De drie voorbeelden en de rekenvoorbeeld zijn gegenereerd met `probe/scenarios.ts` en `probe/worked.ts` op de echte bibliotheek. De uitvoer staat in `facts/`.",
    "**Tegenstrijdigheid tussen figuren en tekst.** Elke verwijzing naar een figuur of tabel wordt bij het bouwen opgelost; een verwijzing naar iets dat niet bestaat laat de build falen. Getallen in figuren (bijvoorbeeld 516 kaarten, 44.295 verbindingen) komen uit dezelfde feitenbestanden als de tekst.",
    "**De standaardinstelling.** Bij elke schakelaar is de standaardwaarde uit de code gecontroleerd (hoofdstuk 9). Wat op Vercel is ingesteld, is niet gecontroleerd.",
    "**Vergelijking met de live werking.** De wizard is niet doorlopen; wat over de schermen staat, komt uit `AssociationWizard.tsx` en de woordenboeken. Dat is de belangrijkste beperking.",
  ]),
  h2("Wat bij de controle is gecorrigeerd"),
  ul([
    "De intake: eerst beschreven volgens `centrale-intake.md` (leeftijd en vrije tekst), daarna gecorrigeerd naar `saveForPayment` (alleen chips, geen leeftijd, geen gezelschap).",
    "De voorbeelden: eerst gedraaid met een leeftijd van 65-plus en met een chip 'mensen ontmoeten' bij een vriendengroep; opnieuw gedraaid zoals de standaardroute werkelijk stuurt (geen leeftijd) en met de chip 'Met een groep'.",
    "Het aantal ideeën per deur: eerst overgenomen uit de documentatie (2-2-1-1), daarna gemeten in drie runs en in meetboek P13 (4-1-1-0).",
  ]),
  tab("verificatie", "Controle van de getallen en regels in dit document", ["Gebied", "Bewering", "Verwacht", "Gevonden", "Uitkomst"], verRows, { widths: [14, 38, 16, 18, 14], small: true }),
] });

export const appE = h1("appE", "Bijlage E. Bronnen", { appendix: "E", blocks: [
  p("De bestanden waar dit document op rust. Paden zijn relatief aan de root van de repository."),
  tab("bronnen", "Gelezen bronnen", ["Onderdeel", "Bestanden"], [
    ["Selectiemotor", "`src/lib/discovery/engine/` (select, graph, weights, constraints, levels, scores, related, types, index)"],
    ["Pagina's en associaties", "`src/lib/discovery/` (twoPages, associationSampling, associationProfile, associations, imageIntake, audience, concretePool, associationLayer, interpretation, profileStory), `src/lib/vensterPages.ts`, `src/components/window/AssociationWizard.tsx`"],
    ["Bibliotheek", "`src/lib/discovery/data/*.json`, `vocabulary.json`, `associations.json`, `hybrids.json`, `clusters.ts`, `register.json`, `searchHints.*`, `reference-library/README.md`"],
    ["Generatie", "`src/lib/claude/` (generateFromSeeds, localResearch, verifyUrls, qualityGate, qualityRepair, prewarmResearch, ideaLayers, rating), `src/lib/knowledgeFlags.ts`, `src/lib/anthropic.ts`"],
    ["Opslag, betalen en e-mail", "`src/app/intake/actions.ts`, `src/app/plan/data.ts`, `src/app/checkout/actions.ts`, `src/app/api/stripe/webhook/route.ts`, `src/app/api/cron/`, `src/lib/email/`, `supabase/migrations/`, `src/types/database.ts`, `src/proxy.ts`, `src/lib/adminAuth.ts`"],
    ["Documentatie en meetgegevens", "`CLAUDE.md`, `docs/changelog.md`, `docs/discovery-engine.md`, `docs/association-layer.md`, `docs/centrale-intake.md`, `docs/discovery-api-costs.md`, `docs/doelgroeponderzoek.md`, `docs/product-reference.nl.md`, `docs/verbeterplan-windowinto.md`, `scratch/persona-books/` (P04, P10, P12, P13)"],
    ["Eigen berekeningen", "`docs/whitepaper/src/probe/` en `docs/whitepaper/src/facts/`"],
  ], { widths: [24, 76] }),
] });
