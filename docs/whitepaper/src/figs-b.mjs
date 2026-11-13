// Figures of chapters 5-7: seven windows, association model, choices, taxonomy, chain, algorithm, slots, data flow.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Svg, COL, wrap, textWidth } from "./svg.mjs";
import { LEVEL_COLORS, LEVELS } from "./figs-a.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const lib = JSON.parse(readFileSync(path.join(here, "facts", "library.json"), "utf8"));

// --------------------------------------------------------------------------------------------------------------------
export function figWindows7() {
  const s = new Svg(640, 600, "De zeven vensters (ontdekkingsniveaus): per niveau de regel, de deur in het boek en een voorbeeld");
  const rows = [
    ["Vertrouwd", "Je eigen keuze (een anker), of een directe buur ervan. Bij het ankermodel tot drie van je eigen keuzes.", "Vertrouwd", "Een historische buitenplaats, Vissen, Sushi rollen"],
    ["Praktisch", "Het praktischste van de vertrouwde ideeën: goedkoop, kort, overal een aanbieder, alleen te doen, met een instap.", "Vertrouwd", "Stenen stapelen"],
    ["Verwant", "Niet gekozen, wel een echte brug (≥ 2,0) met een keuze. Het best passende aangrenzende idee (hoogste fit).", "Ontdekking", "Wandeling over een oude begraafplaats (brug: geschiedenis + verhaal)"],
    ["Inspirerend", "Het andere aangrenzende idee: verder weg, een nieuwe invalshoek op een bekende smaak.", "Ontdekking", "Leeg in dit voorbeeld"],
    ["Verrassend", "Ver van alle keuzes, bereikt via een gecureerde combinatie of een keten keuze, tussenstap, ver idee.", "Onverwacht", "High tea (combinatie met de buitenplaats)"],
    ["Uitdagend", "Eén kenmerk dat jij niet vastlegde gaat omhoog: binnen of buiten, inspanning, niveau, duur of een nieuwe vorm.", "Uitdaging", "Leeg in dit voorbeeld"],
    ["Onontdekt", "Een toevalsprikkel uit een wereld die je niet koos. Toeval bepaalt welke, de harde filters bepalen of het past.", "Wildcard (verzegeld)", "Een linoleumsnede maken"],
  ];
  s.text(10, 16, "Niveau en naam", { size: 9.6, weight: 700, fill: COL.walnut });
  s.text(150, 16, "Hoe het idee wordt gekozen", { size: 9.6, weight: 700, fill: COL.walnut });
  s.text(418, 16, "Deur in het boek", { size: 9.6, weight: 700, fill: COL.walnut });
  s.text(512, 16, "Voorbeeld (fictief profiel A)", { size: 9.6, weight: 700, fill: COL.walnut });
  const x0 = 6, y0 = 24, ph = 68, gap = 6;
  const H = rows.length * ph + (rows.length + 1) * gap;
  s.rect(x0, y0, 628, H, { fill: "#6B4A37", stroke: "#3C2920", r: 6, sw: 1.6 });
  rows.forEach(([name, rule, door, ex], i) => {
    const y = y0 + gap + i * (ph + gap);
    s.rect(x0 + gap, y, 628 - gap * 2, ph, { fill: LEVEL_COLORS[i], stroke: "#3C2920", r: 3, sw: 1 });
    s.text(x0 + 20, y + 41, String(i + 1), { size: 26, weight: 700, fill: "#3C2920" });
    s.text(x0 + 48, y + 29, name, { size: 11.6, weight: 700, fill: "#3C2920" });
    const empty = ex.startsWith("Leeg");
    s.text(x0 + 48, y + 44, i === 0 ? "familiar" : i === 1 ? "familiar" : i < 4 ? "adjacent" : i === 4 ? "unexpected" : i === 5 ? "stretch" : "wildcard", { size: 9, fill: "#5B4636", italic: true });
    s.text(x0 + 136, y + 18, rule, { size: 9.4, fill: "#2B1D15", maxW: 262, lh: 11.8 });
    s.text(x0 + 410, y + 18, wrap(door, 84, 9.6, 700), { size: 9.6, weight: 700, fill: "#3C2920", lh: 11.8 });
    s.text(x0 + 500, y + 18, ex, { size: 9.2, fill: empty ? "#5B4636" : "#2B1D15", italic: empty, maxW: 118, lh: 11.2 });
  });
  s.text(10, y0 + H + 18, "Elke pane is een idee. In het ankermodel (de standaard) staan vier eigen keuzes in het boek, dus de niveaus 4 en 6 blijven dan meestal leeg en niveau 1 telt tot drie ideeën.", { size: 9.4, fill: COL.muted, maxW: 620, lh: 12 });
  s.h = y0 + H + 52;
  return s;
}

// --------------------------------------------------------------------------------------------------------------------
export function figAssocModel() {
  const s = new Svg(640, 600, "Associatiemodel: van beeldkaarten en tags naar de pagina met concrete activiteiten");
  const L = 6, Lw = 196, C = 228, Cw = 188, R = 436, Rw = 198;
  const hL = s.box(L, 8, Lw, { cat: "data", title: "516 beeldkaarten", body: ["172 families van 3 varianten. Rondes: plekken 177, momenten 174, zintuigen 165.", "Per kaart: 2 tot 5 gewogen tags (uit 43), vier assen van -1 tot 1 (sociaal, energie, binnen of buiten, vertrouwd of nieuw) en een stijlregister dat de bezoeker nooit ziet."], size: 9.1, tsize: 10.4 });
  const hR = s.box(R, 8, Rw, { cat: "data", title: "756 activiteiten", body: ["22 werelden, 68 subdomeinen. Gemiddeld 3,6 tags per activiteit (43 tags, 7 'generiek': een sfeer, geen verband).", "Ook per activiteit: sociale vormen, intensiteit, niveau, kosten, duur, binnen of buiten, seizoen, toezicht, aanbod."], size: 9.1, tsize: 10.4 });
  const y2 = Math.max(hL, hR) + 8 + 24;
  const hU = s.box(L, y2, Lw, { cat: "user", title: "Je tikt 3 tot 8 beelden", body: "Een set van 18 per keer; maximaal 5 per ronde telt mee.", size: 9.3 });
  s.arrow(L + Lw / 2, 8 + hL, L + Lw / 2, y2);
  const hC = s.box(C, y2, Cw, { cat: "app", title: "Smaakprofiel", body: ["Tag-profiel = som van de tagwaarden van je beelden, plus 2,5 per thema bij 'Niet helemaal'.", "Assen = gemiddelde van je beelden, tenzij je een schuif verzet."], size: 9.1, tsize: 10.4 });
  s.arrow(L + Lw, y2 + hU / 2, C, y2 + hU / 2);
  const y3 = y2 + hC + 22;
  const hD = s.box(C, y3, Cw, { cat: "app", title: "Twee afgeleide dials", body: ["Nieuwheid-as: 'praktisch tot wild' (5 klassen).", "Energie-as: inspanning (3 klassen).", "Ze sturen de harde filters: toezicht en intensiteit."], size: 9.1, tsize: 10.4 });
  s.arrow(C + Cw / 2, y2 + hC, C + Cw / 2, y3);
  const hP = s.box(R, y2, Rw, { cat: "app", title: "Pagina 2: 18 activiteiten", body: ["score = nabijheid / max + 0,25 aspassing + 0,3 context + 0,5 toeval (seeded)", "nabijheid = Σ profiel[tag] (generiek ×0,5) / √aantal tags", "Vloer: elk register minstens 2; 3 verkenplekken van ver."], size: 8.9, tsize: 10.4 });
  s.arrow(R + Rw / 2, 8 + hR, R + Rw / 2, y2);
  s.arrow(C + Cw, y2 + hC / 2, R, y2 + hC / 2);
  const y4 = y2 + hP + 22;
  const hK = s.box(R, y4, Rw, { cat: "user", title: "Je kiest 1 tot 8", body: "Of: verras me. Dit zijn jouw eigen keuzes.", size: 9.3 });
  s.arrow(R + Rw / 2, y2 + hP, R + Rw / 2, y4);
  const y5 = Math.max(y3 + hD, y4 + hK) + 26;
  const hM = s.box(C, y5, R + Rw - C, { cat: "data", title: "Wat de motor krijgt", body: "Ankers: je eigen activiteiten (tot 4 komen zeker in het boek). Dials en filters bepalen wat de motor mag voorstellen. Tag-profiel en assen komen terug in de profielduiding en in 'Omdat je … koos'.", size: 9.3, tsize: 10.4 });
  s.arrow(C + Cw / 2, y3 + hD, C + Cw / 2, y5);
  s.arrow(R + Rw / 2, y4 + hK, R + Rw / 2, y5);
  const hA = s.box(L, y5, 206, { cat: "soft", title: "Associatielaag (staat uit)", body: "127 associaties zoals geur, trots of vrijheid zouden pagina 2 verfijnen (gewicht 0,35). Gebouwd en gemeten, niet aangezet.", size: 8.9, tsize: 10, dash: "4 3" });
  s.arrow(L + 206, y5 + hM / 2, C, y5 + hM / 2, { dash: "3 3" });
  const yl = y5 + Math.max(hM, hA) + 22;
  s.legend(8, yl, [["data", "Data"], ["app", "Eigen code"], ["user", "Bezoeker"]], { size: 9.6 });
  s.h = yl + 14;
  return s;
}

// --------------------------------------------------------------------------------------------------------------------
export function figChoices() {
  const s = new Svg(640, 650, "Procesdiagram van de opeenvolgende keuzes en wat elke stap doorgeeft");
  const X = 8, W = 330;
  const annX = 372, annW = 258;
  const node = (y, cat, title, body, h) => {
    s.box(X, y, W, { cat, title, body, size: 9.4, tsize: 10.4, h });
    return y + h;
  };
  const note = (y, text, h = 60) => {
    s.box(annX, y, annW, { cat: "soft", body: text, size: 9.2, h, dash: "3 3" });
    s.line(X + W, y + h / 2, annX, y + h / 2, { dash: "2 3", stroke: "#B8B1A4" });
  };
  const down = (y1, y2, label) => s.arrow(X + W / 2, y1, X + W / 2, y2, label ? { label, lx: X + W / 2 + 54, ly: (y1 + y2) / 2 + 3 } : {});
  let y = 6;
  let e = node(y, "user", "Startpagina", "Voor wie, plaats, afstand en randvoorwaarden. Alleen de plaats is verplicht.", 58);
  note(y, "Wordt bewaard als concept in de browser (sessionStorage).", 58);
  down(e, e + 14);
  y = e + 14;
  e = node(y, "app", "Pagina 1: 18 beelden", "Eerste set: de context leunt de keuze (kind: spel en dieren, groep: samenwerken). Vier registers elk minstens 4, elke as aan beide kanten vertegenwoordigd.", 70);
  note(y, "Per set: één variant per familie; families die je zag komen niet terug, tot de voorraad op is.", 70);
  down(e, e + 14);
  y = e + 14;
  e = node(y, "user", "Je tikt beelden", "Minstens 3, hoogstens 8. 'Andere beelden' geeft een nieuwe set (max 3 keer): afwisselend dichtbij wat je koos en iets wat je nog niet koos.", 70);
  note(y, "Gaat door: lijst kaart-id's (max 5 per ronde).", 52);
  down(e, e + 14);
  y = e + 14;
  e = node(y, "app", "Smaakprofiel en dials", "Tag-profiel en vier assen worden direct in de browser uitgerekend. De twee dials volgen daaruit; de server bepaalt ze opnieuw bij het opslaan.", 72);
  down(e, e + 14);
  y = e + 14;
  e = node(y, "app", "Pagina 2: 18 activiteiten", "Volgt de beelden. Drie plekken 'Misschien ook?' komen van ver, uit een ander register en een andere wereld.", 56);
  note(y, "'Andere activiteiten' kan 3 keer; wat je koos blijft staan.", 40);
  down(e, e + 14);
  y = e + 14;
  e = node(y, "user", "Je kiest activiteiten", "Minstens 1, hoogstens 8, of 'verras me'. Bij 1 of 2 keuzes vraagt de site om er meer.", 58);
  note(y, "Gaat door: eigen keuzes (ankers). 'Verras me' laat de beelden alleen de dials sturen.", 52);
  down(e, e + 14);
  y = e + 14;
  e = node(y, "app", "Profielscherm", "Je venster en een korte duiding. Je mag vier assen verschuiven en thema's toevoegen ('Niet helemaal'). Een schuif vervangt wat de beelden zeiden.", 70);
  note(y, "Gaat door: axesOverride en correcties.", 40);
  down(e, e + 14);
  y = e + 14;
  e = node(y, "user", "Betalen", "E-mail, twee vinkjes (voorwaarden, directe levering), Stripe. Wijzigen kan tot dit moment.", 58);
  down(e, e + 14);
  y = e + 14;
  e = node(y, "app", "Server vertaalt eenmalig", "Saneert id's, rekent smaakprofiel en dials opnieuw uit, bouwt het publieksprofiel en bewaart alles als één record. De motor leest alleen dit record.", 70);
  note(y, "Wat de browser stuurt wordt niet vertrouwd: alles wordt opnieuw berekend.", 52);
  s.h = e + 10;
  return s;
}

// --------------------------------------------------------------------------------------------------------------------
function treemap(items, x, y, w, h, out = []) {
  if (items.length === 0) return out;
  if (items.length === 1) {
    out.push({ ...items[0], x, y, w, h });
    return out;
  }
  const total = items.reduce((a, b) => a + b.n, 0);
  let acc = 0;
  let k = 0;
  for (; k < items.length - 1; k++) {
    if (acc + items[k].n / 2 >= total / 2) break;
    acc += items[k].n;
  }
  k = Math.max(1, Math.min(items.length - 1, k + (acc + items[k].n / 2 >= total / 2 ? 0 : 1)));
  const a = items.slice(0, k);
  const b = items.slice(k);
  const sa = a.reduce((p, q) => p + q.n, 0) / total;
  if (w >= h) {
    treemap(a, x, y, w * sa, h, out);
    treemap(b, x + w * sa, y, w * (1 - sa), h, out);
  } else {
    treemap(a, x, y, w, h * sa, out);
    treemap(b, x, y + h * sa, w, h * (1 - sa), out);
  }
  return out;
}
const mix = (c1, c2, t) => {
  const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const a = p(c1), b = p(c2);
  return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join("");
};

export function figTaxonomy() {
  const s = new Svg(640, 560, "Visuele taxonomie van de activiteitenbibliotheek: 22 werelden naar aantal activiteiten");
  const items = [...lib.domains].sort((a, b) => b.n - a.n);
  const min = Math.min(...items.map((d) => d.n));
  const max = Math.max(...items.map((d) => d.n));
  const tiles = treemap(items, 6, 24, 628, 400);
  s.text(8, 15, "756 activiteiten in 22 werelden; oppervlak = aantal activiteiten", { size: 10.4, weight: 700, fill: COL.walnut });
  for (const t of tiles) {
    const k = Math.pow((t.n - min) / (max - min), 0.6);
    s.rect(t.x + 1.5, t.y + 1.5, t.w - 3, t.h - 3, { fill: mix("#F7EFDF", "#D8B873", k), stroke: "#FFFFFF", sw: 0, r: 4 });
    const pad = 7;
    let size = t.w > 120 ? 11 : 9.4;
    const longest = Math.max(...t.nl.split(/\s+/).map((wd) => wd.length));
    while (size > 7.2 && textWidth('x'.repeat(longest), size, 700) > t.w - pad * 2 - 3) size -= 0.4;
    const lines = wrap(t.nl, t.w - pad * 2 - 2, size, 700);
    if (t.w < 56 || t.h < 30) continue;
    let yy = s.text(t.x + pad + 1.5, t.y + 17, lines, { size, weight: 700, fill: "#3C2920", lh: size * 1.2 });
    s.text(t.x + pad + 1.5, yy + (t.w > 120 ? 13 : 8), `${t.n}`, { size: t.w > 120 ? 17 : 12.5, weight: 700, fill: "#5B3F2F" });
    if (t.w > 150 && t.h > 100) {
      const subs = t.subs.map((x) => x.replace(/\((\d+)\)/, " $1")).join(" · ");
      s.text(t.x + pad + 1.5, yy + 40, wrap(subs, t.w - pad * 2 - 2, 8.6), { size: 8.6, fill: "#5B4636", lh: 10.4 });
    }
  }
  // facets
  const fy = 440;
  s.text(8, fy, "Hoe volledig zijn de eigenschappen? (aandeel van de 756)", { size: 10.4, weight: 700, fill: COL.walnut });
  const facets = [
    ["Kosten bekend", 752 / 756, "752"],
    ["Seizoen vastgelegd", 143 / 756, "143"],
    ["Aanbod vastgelegd (gewoon, regionaal, zeldzaam)", 436 / 756, "436"],
    ["Niveau hoger dan 0", 120 / 756, "120"],
    ["Verplicht toezicht (tier 2)", 58 / 756, "58"],
    ["Door een mens gecontroleerd", 0, "0"],
  ];
  facets.forEach(([label, v, n], i) => {
    const y = fy + 16 + i * 17;
    s.text(8, y + 9, label, { size: 9.4, fill: COL.ink });
    s.rect(262, y, 300, 11, { fill: "#EFEAE0", stroke: "none", r: 3 });
    if (v > 0) s.rect(262, y, 300 * v, 11, { fill: COL.data.s, stroke: "none", r: 3 });
    s.text(570, y + 9, `${n} (${Math.round(v * 100)}%)`, { size: 9.4, fill: COL.muted });
  });
  s.h = fy + 16 + facets.length * 17 + 8;
  return s;
}

// --------------------------------------------------------------------------------------------------------------------
export function figChain() {
  const s = new Svg(640, 470, "Voorbeeldketens: associatie, subassociatie, activiteit, aanbieder, bezoek");
  const w = 112, gap = 15, h = 112;
  const row = (y, title, sub, boxes) => {
    s.text(8, y, title, { size: 11, weight: 700, fill: COL.walnut });
    const nsub = s.text(8, y + 14, sub, { size: 9.2, fill: COL.muted, maxW: 620, lh: 11.5 }) - y - 14;
    boxes.forEach(([cat, t, b], i) => {
      const x = 8 + i * (w + gap);
      s.box(x, y + 20 + nsub, w, { cat, title: t, body: b, size: 8.9, tsize: 9.8, h });
      if (i < boxes.length - 1) s.arrow(x + w, y + 20 + nsub + h / 2, x + w + gap, y + 20 + nsub + h / 2);
    });
  };
  row(14, "A  Van smaak naar activiteit (motor)", "Reproduceerbaar en gratis: fictief profiel A uit hoofdstuk 11, echte bibliotheek.", [
    ["user", "1 Associatie", "Beeld 'Een oude leeszaal' (ronde plekken). Draagt de tags geschiedenis, verhaal en leren."],
    ["data", "2 Subassociatie", "Tags geschiedenis en verhaal. Hun gewicht: ln(756/57) = 2,58 en ln(756/107) = 1,96."],
    ["user", "3 Eigen keuze", "Pagina 2 biedt 'Een historische buitenplaats' aan: dezelfde tags. De bezoeker kiest het."],
    ["app", "4 Verbonden idee", "Brug van 4,54 (≥ 2,0) naar 'Wandeling over een oude begraafplaats' (fit 0,64)."],
    ["app", "5 Activiteit", "Seed: aangrenzend, niveau 3 'Verwant', met als keten buitenplaats naar begraafplaats."],
  ]);
  row(216, "B  Van activiteit naar bezoek (zoeken)", "Een eerder gegenereerd meetboek (persona P13, Utrecht). Het zoeken gebruikt het live web en is dus niet gratis te herhalen.", [
    ["app", "1 Activiteit", "'Paardenverzorgingsdag' was een eigen keuze (anker, niveau 1)."],
    ["ai", "2 Zoekopdracht", "Haiku 4.5 met webzoeken: aanbieders in en rond Utrecht, alleen fysieke plekken."],
    ["ext", "3 Aanbieders", "Manege 't Hoogt en Manege Groenestyn, beide in Utrecht, met website en korte notitie."],
    ["app", "4 Controle", "Bestaat de website? Zegt hij 'gesloten'? Is hij geparkeerd? Staat de naam erop?"],
    ["data", "5 Bezoek", "In het boek: 'Bel Manege 't Hoogt en vraag naar een dag paardenverzorging', met kaartlink."],
  ]);
  s.h = 216 + 46 + h + 10;
  return s;
}

// --------------------------------------------------------------------------------------------------------------------
export function figAlgoFlow() {
  const W = 960;
  const s = new Svg(W, 548, "Algoritmisch stroomdiagram in tien stappen, van invoer tot eindresultaat");
  const steps = [
    ["user", "1 Invoer verwerken", "In: startpagina, concept in de browser.", "Doet: valideert; server normaliseert land, km en budgetband.", "Uit: IntakeAnswers."],
    ["user", "2 Context bepalen", "In: voor wie, leeftijd, chips.", "Doet: zoekcontext, effectieve leeftijd, publieksprofiel met herkomst en zekerheid.", "Uit: searchContext, audienceProfile."],
    ["app", "3 Associaties kiezen", "In: 516 kaarten, context.", "Doet: balanceert een set van 18; bewaart wat je tikt.", "Uit: tag-profiel en vier assen."],
    ["app", "4 Koppelen aan activiteiten", "In: profiel, 756 activiteiten.", "Doet: scoort pagina 2; jouw keuzes worden ankers; assen worden dials.", "Uit: interests, practicalToWild, effort."],
    ["app", "5 Filteren", "In: alle activiteiten.", "Doet: harde regels: budget, inspanning, toezicht, vorm, seizoen, geschiedenis, kind-lijst, chips.", "Uit: pool plus controlevlaggen."],
    ["app", "6 Scoren en wegen", "In: pool, graaf, gewichten.", "Doet: per richting een som van brug, nabijheid, zeldzaamheid, leeftijd, aanbod, overlap.", "Uit: score per kandidaat."],
    ["app", "7 Rangschikken en kiezen", "In: scores, diversiteitsregels.", "Doet: slot voor slot de beste die past (max 2 per wereld, 1 per subdomein).", "Uit: 7 seeds met deur en niveau."],
    ["ai", "8 Extern zoeken", "In: 7 seeds, plaats, afstand.", "Doet: cache, dan Haiku met webzoeken: standaard, breed, online, vervangen.", "Uit: LocalOption per activiteit."],
    ["ext", "9 Resultaten verwerken", "In: ruwe zoekantwoorden.", "Doet: alleen fysiek, websitecheck, rangschikken op beoordeling, één plek één idee.", "Uit: geverifieerde opties of een vervanger."],
    ["ai", "10 Eindselectie en presentatie", "In: seeds met opties.", "Doet: twee Sonnet-aanroepen tegelijk, controles, kwaliteitspoort, PDF, mail.", "Uit: boek (web, PDF, e-mail)."],
  ];
  const bw = 168, gap = 27, bh = 190;
  steps.forEach(([cat, title, a, b, c], i) => {
    const row = Math.floor(i / 5);
    const col = i % 5;
    const x = 4 + col * (bw + gap);
    const y = 8 + row * (bh + 44);
    s.rect(x, y, bw, bh, { cat, r: 8 });
    s.text(x + 10, y + 21, wrap(title, bw - 20, 11, 700), { size: 11, weight: 700, fill: COL[cat].t, lh: 13 });
    let yy = y + 50;
    [[a, "In"], [b, "Logica"], [c, "Uit"]].forEach(([txt, tag], k) => {
      const clean = txt.replace(/^(In|Doet|Uit): /, "");
      s.text(x + 10, yy, tag.toUpperCase(), { size: 8, weight: 700, fill: COL[cat].s, spacing: 0.8 });
      yy = s.text(x + 10, yy + 11.5, clean, { size: 9.2, fill: COL[cat].t, maxW: bw - 20, lh: 11.4 }) + 2.5;
    });
    if (col < 4) s.arrow(x + bw, y + bh / 2, x + bw + gap, y + bh / 2);
  });
  // row connector: from step 5 down-left to step 6
  const y5 = 8 + bh, y6 = 8 + bh + 44;
  s.arrow(4 + 4 * (bw + gap) + bw / 2, y5, 4 + bw / 2, y6, { via: [[4 + 4 * (bw + gap) + bw / 2, y5 + 22], [4 + bw / 2, y5 + 22]] });
  s.legend(2, 8 + 2 * (bh + 44) - 14, [["user", "Invoer"], ["app", "Eigen code"], ["ai", "AI-aanroep"], ["ext", "Extern en controle"]], { size: 9.6 });
  s.text(W - 4, 8 + 2 * (bh + 44) - 12, "Stap 1 tot 4 gebeuren in de browser en bij het opslaan; 5 tot 7 draaien in de motor zonder AI.", { size: 9.2, anchor: "end", fill: COL.muted });
  s.h = 8 + 2 * (bh + 44) + 4;
  return s;
}

// --------------------------------------------------------------------------------------------------------------------
export function figSlotsTree() {
  const s = new Svg(640, 760, "Beslisboom van de selectiemotor: hoe de zeven zaden worden gekozen");
  const CX = 200, CW = 240, LX = 6, LW = 158, RX = 474, RW = 160;
  const D = (y, text, h = 46) => {
    const x = CX - 6, w = CW + 12;
    s.add(`<path d="M${x + 12} ${y} H${x + w - 12} L${x + w} ${y + h / 2} L${x + w - 12} ${y + h} H${x + 12} L${x} ${y + h / 2} Z" fill="#F8EFD9" stroke="#B08A4A" stroke-width="1.3"/>`);
    const ls = wrap(text, w - 44, 9.6, 700);
    s.text(x + w / 2, y + h / 2 - (ls.length - 1) * 5.8 + 3.5, ls, { size: 9.6, weight: 700, anchor: "middle", fill: "#4A3611", lh: 11.6 });
    return h;
  };
  const bx = (x, y, w, cat, title, body, size = 8.9) => s.box(x, y, w, { cat, title, body, size, tsize: 9.8 });
  const mid = CX + CW / 2;
  let y = 6;
  let h = bx(CX, y, CW, "app", "Pool", "Alles dat door de harde filters komt, zonder wat recent getoond is of is uitgesloten.");
  s.arrow(mid, y + h, mid, y + h + 14);
  y += h + 14;
  h = D(y, "Heeft de bezoeker activiteiten gekozen?");
  const d1 = y;
  s.arrow(CX - 6, d1 + h / 2, LX + LW, d1 + h / 2, { label: "nee", lx: CX - 22, ly: d1 + h / 2 - 5 });
  bx(LX, d1 - 6, LW, "app", "Verkennen", "6 ideeën uit 6 verschillende werelden, mildste eerst, plus een wildcard.");
  s.arrow(mid, y + h, mid, y + h + 16, { label: "ja", lx: mid + 12, ly: y + h + 11 });
  y += h + 16;
  h = D(y, "Minstens 3 eigen keuzes van pagina 2 bruikbaar?");
  const d2 = y;
  s.arrow(CX - 6, d2 + h / 2, LX + LW / 2, d2 + 34, { via: [[LX + LW / 2, d2 + h / 2]], label: "nee", lx: CX - 26, ly: d2 + h / 2 - 5 });
  s.arrow(CX + CW + 6, d2 + h / 2, RX + RW / 2, d2 + 34, { via: [[RX + RW / 2, d2 + h / 2]], label: "ja", lx: CX + CW + 26, ly: d2 + h / 2 - 5 });
  const hl = bx(LX, d2 + 34, LW, "app", "Gewoon pad: 2 × vertrouwd", "Een keuze of een directe buur. Het tweede slot leunt naar het praktische.");
  const hr = bx(RX, d2 + 34, RW, "app", "Ankermodel (standaard)", "4 eigen keuzes komen zeker in het boek, verdeeld over werelden. Daarna 1 aangrenzend, 1 onverwacht.");
  const y3 = d2 + 34 + Math.max(hl, hr) + 26;
  h = bx(CX - 20, y3, CW + 40, "app", "B  Onverwacht × 1 (eerste die past, in deze volgorde)", ["1 gecureerde combinatie met een van je keuzes (80 beschikbaar)", "2 keten keuze, tussenstap, ver idee: elke stap met brug ≥ 2,0", "3 één stap met een echte brug", "4 iets uit een wereld die je niet koos"]);
  s.arrow(LX + LW / 2, d2 + 34 + hl, LX + LW / 2, y3 + 30, { via: [[LX + LW / 2, y3 + 30]] });
  s.arrow(LX + LW / 2, y3 + 30, CX - 20, y3 + 30);
  s.arrow(RX + RW / 2, d2 + 34 + hr, RX + RW / 2, y3 + 30);
  s.arrow(RX + RW / 2, y3 + 30, CX + CW + 20, y3 + 30);
  s.arrow(mid, y3 + h, mid, y3 + h + 14);
  y = y3 + h + 14;
  h = bx(CX - 20, y, CW + 40, "app", "C  Aangrenzend × 1 (ankermodel) of × 2", ["Eerst de 'indirecte plek': deelt een tag met minstens twee keuzes en twee tags met één.", "Dan: nabijheid 0,2 tot 0,6 met brug ≥ 2,0, daarna 0,1 tot 0,75 met brug ≥ 1,2."]);
  s.arrow(mid, y + h, mid, y + h + 14);
  y += h + 14;
  h = D(y, "Zijn er al 6 zaden?");
  const d3 = y;
  s.arrow(CX + CW + 6, d3 + h / 2, RX, d3 + h / 2, { label: "ja", lx: CX + CW + 22, ly: d3 + h / 2 - 5 });
  const hs = bx(RX, d3 - 4, RW, "soft", "Geen uitdaging nodig", "In het ankermodel is het boek dan al vol.");
  s.arrow(mid, d3 + h, mid, d3 + h + 16, { label: "nee", lx: mid + 14, ly: d3 + h + 11 });
  y = d3 + h + 16;
  h = bx(CX - 20, y, CW + 40, "app", "D  Uitdaging × 1", "Eén kenmerk omhoog: binnen of buiten, intensiteit, niveau, duur, nieuwe vorm of andere wereld. De doelsterkte volgt je wildheidsdial: 1, 1,2, 2 of 2,8.");
  s.arrow(mid, y + h, mid, y + h + 14);
  y += h + 14;
  const yAanv = y;
  h = bx(CX - 20, y, CW + 40, "app", "Aanvullen", "Alleen als er nog geen zes zijn: het meest verwante idee dat past.");
  s.arrow(RX + RW / 2, d3 - 4 + hs, RX + RW / 2, yAanv + h / 2);
  s.arrow(RX + RW / 2, yAanv + h / 2, CX + CW + 20, yAanv + h / 2);
  s.arrow(mid, y + h, mid, y + h + 14);
  y += h + 14;
  h = bx(CX - 20, y, CW + 40, "ai", "E  Wildcard × 1: gewogen loting", "Uit werelden die je niet koos. Gewicht = (1 + 2·brug + 2·nog niet getoonde wereld) / (1 + 4·overlap) × e^(−2·leeftijdsstraf) × (0,5 + 1,5·zeldzaamheid) × e^(−3·aanbodstraf).");
  s.text(6, y + h + 20, "Overal geldt: hoogstens 2 per wereld (op de valreep 3), 1 per subdomein, hoogstens 2 per soort (cluster). Daarna krijgt elk zaad zijn deur en niveau.", { size: 9, fill: COL.muted, maxW: 626, lh: 11.4 });
  s.h = y + h + 48;
  return s;
}

// --------------------------------------------------------------------------------------------------------------------
export function figDataFlow() {
  const W = 960;
  const s = new Svg(W, 400, "Datastroomdiagram: welke objecten door de applicatie gaan, van invoer tot boek");
  const bw = 124, gap = 78, bh = 92;
  const nodes = [
    ["IntakeAnswers", "concept in de browser (sessionStorage)"],
    ["StoredIntake", "raw_json in intake_answers, per sessie"],
    ["EngineInput", "interests, dials, budget, maand, seed, geschiedenis"],
    ["Seed [7]", "activiteit, richting, deur, niveau, keten, fit, redenen"],
    ["LocalOption []", "per activiteit: naam, plaats, url, notitie, beoordeling"],
    ["Prompt", "profiel, 7 seeds met opties, datum, regels"],
    ["Ruwe tekst", "ideeën en lagen, uit twee aanroepen"],
    ["IdeaBookEntry [7]", "gecontroleerd, met plaatsen, scores, deur"],
    ["GeneratedIdeaBook", "na de kwaliteitspoort"],
    ["Plan, PDF, e-mail", "window_plans, privé-opslag, Resend"],
  ];
  const procs = [
    ["user", ["saveIntake"]],
    ["app", ["applyImage", "Intake"]],
    ["app", ["selectSeeds"]],
    ["ai", ["research", "Seeds"]],
    ["app", ["formatProfile,", "seedBlock"]],
    ["ai", ["Sonnet 5", "(2 calls)"]],
    ["app", ["checkEntry,", "buildEntry"]],
    ["ai", ["runQuality", "Gate"]],
    ["app", ["renderIdea", "BookPdf"]],
  ];
  const X0 = 6;
  const pos = (i) => {
    const row = Math.floor(i / 5);
    const col = i % 5;
    const c = row === 1 ? 4 - col : col;
    return { x: X0 + c * (bw + gap), y: 30 + row * 160 };
  };
  nodes.forEach(([t, b], i) => {
    const p = pos(i);
    s.box(p.x, p.y, bw, { cat: "data", title: t, body: b, size: 8.8, tsize: 10, h: bh });
  });
  procs.forEach(([cat, ls], i) => {
    const a = pos(i), b = pos(i + 1);
    const same = Math.floor(i / 5) === Math.floor((i + 1) / 5);
    if (same) {
      const dir = Math.floor(i / 5) === 1 ? -1 : 1;
      const x1 = dir > 0 ? a.x + bw : a.x;
      const x2 = dir > 0 ? b.x : b.x + bw;
      const cy = a.y + bh / 2;
      s.arrow(x1, cy, x2, cy);
      const mx = (x1 + x2) / 2;
      s.rect(mx - 36, cy - 40, 72, 30, { cat, r: 5 });
      s.text(mx, cy - 28 - (ls.length - 1) * 4.6, ls, { size: 8.6, weight: 600, anchor: "middle", fill: COL[cat].t, lh: 10 });
    } else {
      const cx = a.x + bw / 2;
      s.arrow(cx, a.y + bh, cx, b.y);
      s.rect(cx + 10, a.y + bh + 22, 82, 30, { cat, r: 5 });
      s.text(cx + 51, a.y + bh + 33, ls, { size: 8.6, weight: 600, anchor: "middle", fill: COL[cat].t, lh: 10 });
    }
  });
  s.text(6, 16, "Rij 1 loopt naar rechts, rij 2 terug naar links. De gekleurde labels zijn de bewerkingen tussen de gegevens.", { size: 9.2, fill: COL.muted });
  s.legend(6, 372, [["data", "Gegevens"], ["user", "Server-actie na invoer"], ["app", "Eigen code"], ["ai", "AI-aanroep"]], { size: 9.6 });
  s.h = 388;
  return s;
}
