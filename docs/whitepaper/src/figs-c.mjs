// Figures of chapters 8-12: from activity to visit, architecture, timeline, three scenarios, cost.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Svg, COL, wrap, textWidth } from "./svg.mjs";
import { LEVEL_COLORS } from "./figs-a.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const scenarios = JSON.parse(readFileSync(path.join(here, "facts", "scenarios.json"), "utf8"));

// --------------------------------------------------------------------------------------------------------------------
export function figConcrete() {
  const s = new Svg(640, 700, "Van een activiteit naar een bezoekbare mogelijkheid: de zoekladder en de controles");
  // boundary band
  s.rect(6, 6, 292, 40, { cat: "app", r: 6 });
  s.text(152, 22, "Ontdekken", { size: 11.5, weight: 700, anchor: "middle", fill: COL.app.t });
  s.text(152, 37, "motor, bibliotheek, geen AI, gratis", { size: 9.4, anchor: "middle", fill: COL.app.t });
  s.rect(342, 6, 292, 40, { cat: "ai", r: 6 });
  s.text(488, 22, "Concreet maken", { size: 11.5, weight: 700, anchor: "middle", fill: COL.ai.t });
  s.text(488, 37, "zoeken op het web, AI, websitecheck", { size: 9.4, anchor: "middle", fill: COL.ai.t });
  s.arrow(298, 26, 342, 26);
  s.text(320, 18, "grens", { size: 8.6, anchor: "middle", fill: COL.muted, italic: true });

  const X = 6, W = 392;
  let y = 62;
  const step = (cat, title, body, gapAfter = 20, label = "") => {
    const h = s.box(X, y, W, { cat, title, body, size: 9.2, tsize: 10.2 });
    if (gapAfter) s.arrow(X + W / 2, y + h, X + W / 2, y + h + gapAfter, label ? { label, lx: X + W / 2 + 56, ly: y + h + gapAfter / 2 + 3 } : {});
    const top = y;
    y += h + gapAfter;
    return [top, h];
  };
  step("app", "Het zaad", "Een activiteit met richting en deur, gekozen door de motor. Hier eindigt het ontdekken: het is nog een idee, geen adres.", 18);
  step("data", "0  Cache", "Per activiteit, plaats, afstand en maand. Gevonden opties tellen 30 dagen, 'niets gevonden' 7 dagen, 'niets' voor een eigen keuze 2 dagen. Wat een einddatum heeft, vervalt daarmee.", 18, "niet in de cache");
  step("ai", "1  Standaardronde", "Haiku 4.5 met webzoeken. Hoogstens 5 zoekopdrachten voor de ideeën samen, hoogstens 4 voor je eigen keuzes (apart). Alleen fysieke plekken: werkplaats, club, bezoekplek.", 18, "niets gevonden");
  step("ai", "2  Brede ronde", "Clubs, buurthuizen, bibliotheken, repair cafés, musea, boerderijen. Over twee keer de gekozen afstand (hoogstens 150 km), nabijste eerst, hoogstens 4 zoekopdrachten.", 18, "nog niets");
  step("ai", "3  Online, alleen als het van nature online is", "Een schrijfcursus of taalapp heeft geen plek nodig en gaat meteen naar aanbieders van thuis uit.", 18, "nog niets");
  step("app", "4  Vervangen", "De motor kiest een ander idee (twee rondes; de laatste alleen activiteiten die geen aanbieder nodig hebben). Een eigen keuze zonder aanbod wordt een verwant idee uit de graaf, en het boek zegt dat in één zin.", 18, "nog niets");
  step("ai", "5  Online als laatste redmiddel", "Pas nu: een cursus, webshop met pakket of landelijke vereniging met website. Fysiek gaat altijd voor.", 18, "nog niets");
  step("app", "6  Verwisselen", "Een idee dat nog steeds niets heeft, wordt geruild met een idee dat eerder in dezelfde run wel een optie vond. Zo komt er nooit een idee zonder optie in het boek.", 22);
  const hFinal = s.box(X, y, W, { cat: "data", title: "Bezoek in het boek", body: "Naam, plaats, link, korte notitie, eventueel een beoordeling, kaartlink en een eerste stap die je binnen een minuut kunt doen.", size: 9.2, tsize: 10.2 });
  // right column: checks
  const RX = 424, RW = 210;
  let ry = 62;
  const hc = s.box(RX, ry, RW, { cat: "app", title: "Wat er met elke gevonden optie gebeurt", body: ["Alleen een plek met echte plaatsnaam telt; 'Online' of alleen het land niet.", "De website wordt gelezen (max 150 KB). Er valt af: een host die niet bestaat, een pagina die zegt 'definitief gesloten', een geparkeerd of te koop staand domein, of een site waar de naam niet op voorkomt.", "Een verdwenen pagina op een bestaande site wordt de voorpagina. Een time-out, 403 of 429 telt niet als bewijs van het tegendeel.", "Een optie met einddatum in het verleden valt af."], size: 8.9, tsize: 10 });
  ry += hc + 12;
  const hr = s.box(RX, ry, RW, { cat: "app", title: "Volgorde en uniciteit", body: ["Rangorde op beoordeling, alleen als een zoekresultaat die liet zien. Gecorrigeerd: (score × n + 4,0 × 20) / (n + 20); onder 4,0 alleen als er niets beters is. Hoogstens 3 per idee.", "Eén plek, één idee: een plek die een eerder idee al heeft, valt bij een later idee af."], size: 8.9, tsize: 10 });
  ry += hr + 12;
  s.box(RX, ry, RW, { cat: "ext", title: "Wat niet wordt gecontroleerd", body: "Openingstijden, prijzen en adressen worden niet tegen een gestructureerde bron gehaald. Het boek belooft dus geen 'geverifieerde' plekken, alleen plekken waarvan de website bestaat en niet zegt gesloten te zijn.", size: 8.9, tsize: 10 });
  s.h = Math.max(y + hFinal, ry + 120) + 12;
  return s;
}

// --------------------------------------------------------------------------------------------------------------------
export function figArchitecture() {
  const s = new Svg(640, 640, "Technische architectuur: browser, Next.js op Vercel, Supabase en de externe diensten");
  const LX = 6, LW = 416, RX = 446, RW = 188;
  let y = 6;
  const band = (cat, title, items, note) => {
    const startY = y;
    s.rect(LX, y, LW, 10, { cat, r: 8 });
    // measure
    const innerW = (LW - 30) / 2;
    const heights = items.map(([t, b]) => {
      const tl = wrap(t, innerW - 12, 9.8, 700).length;
      const bl = wrap(b, innerW - 12, 8.7).length;
      return tl * 12.6 + bl * 11.3 + 14;
    });
    const rows = [];
    for (let i = 0; i < items.length; i += 2) rows.push(Math.max(heights[i], heights[i + 1] ?? 0));
    const total = 30 + rows.reduce((a, b) => a + b + 8, 0) + (note ? 4 : 0);
    s.parts.pop();
    s.rect(LX, y, LW, total, { cat, r: 9 });
    s.text(LX + 12, y + 19, title, { size: 11, weight: 700, fill: COL[cat].t });
    let ry = y + 28;
    rows.forEach((rh, r) => {
      [0, 1].forEach((c) => {
        const it = items[r * 2 + c];
        if (!it) return;
        s.box(LX + 10 + c * (innerW + 10), ry, innerW, { cat: "neutral", title: it[0], body: it[1], size: 8.7, tsize: 9.8, pad: 6, h: rh, r: 6 });
      });
      ry += rh + 8;
    });
    y += total + 30;
    return [startY, total];
  };
  const b1 = band("user", "Browser (de bezoeker)", [
    ["Wizard en pagina's", "React-componenten: startpagina, beelden, activiteiten, profiel, wachtscherm, boek."],
    ["Eigen rekenwerk", "Kiezen van de beelden en activiteiten gebeurt hier, met dezelfde code als op de server."],
    ["Concept", "sessionStorage bewaart je antwoorden tot het opslaan."],
    ["Meten", "PostHog, pas na toestemming, zonder vrije tekst."],
  ]);
  const b2 = band("app", "Next.js op Vercel (App Router, TypeScript)", [
    ["Server Components en Actions", "Opslaan van antwoorden, afrekenen, boek ophalen, feedback."],
    ["Route handlers", "Plaatssuggestie, Stripe-webhook, vensterafbeelding, admin-export."],
    ["Selectiemotor en bibliotheek", "756 activiteiten en 516 beeldkaarten als JSON in de code. Geen database voor de bibliotheek."],
    ["Boekpijplijn", "Zoeken, schrijven, kwaliteitspoort, PDF (pdf-lib), e-mail. Draait na de respons in after() met maximaal 300 s."],
    ["Twee dagelijkse taken", "Herinnering (09:00 UTC) en vervolgmail (09:30 UTC)."],
    ["Proxy en beheer", "Beheer achter één wachtwoord; taalkeuze en cookies."],
  ]);
  const b3 = band("data", "Supabase (Postgres en opslag)", [
    ["Per sessie", "sessions, intake_answers (raw_json), window_plans, payments, toestemmingen, idee-feedback."],
    ["Gedeeld en anoniem", "local_research_cache (plaats + activiteit, geen persoon), test_quota (afgeleide hash), test_feedback."],
    ["Optioneel geheugen", "discovery_history: alleen een SHA-256 van een apparaatcode en activiteit-id's."],
    ["Bestanden", "Privé-bucket window-plans: de PDF, alleen via een tijdelijke link."],
  ]);
  s.h = y - 10;
  // external column
  const ext = [
    ["ai", "Anthropic Claude", "Sonnet 5: schrijven en duiding. Haiku 4.5: zoeken met web_search en een grammaticacontrole."],
    ["ext", "Stripe", "Checkout in test- en livemodus; geen kaartgegevens bij ons. Webhook voor status."],
    ["ext", "Resend", "E-mail met de PDF, herinnering en vervolgmail."],
    ["ext", "PDOK en Photon", "Plaatsnamen: PDOK (NL), Photon op OpenStreetMap-data (buitenland)."],
    ["ext", "Websites van aanbieders", "Gelezen voor de controle: bestaat de plek, is hij open?"],
    ["ext", "PostHog en Vercel", "Meetpunten; Vercel geeft land en plaats uit de verbinding en voert de taken uit."],
    ["soft", "Alleen offline", "Gemini maakt beeldmateriaal met scripts. Niets daarvan draait bij een bezoek."],
  ];
  let ey = 18;
  s.text(RX, ey - 6, "Externe diensten", { size: 11, weight: 700, fill: COL.walnut });
  ey += 12;
  const eys = [];
  ext.forEach(([cat, t, b]) => {
    const h = s.box(RX, ey, RW, { cat, title: t, body: b, size: 8.7, tsize: 9.8, pad: 6, dash: cat === "soft" ? "4 3" : undefined });
    eys.push([ey, h]);
    ey += h + 8;
  });
  // connectors between bands
  const mx = LX + LW / 2;
  s.arrow(mx - 40, b1[0] + b1[1] + 2, mx - 40, b2[0] - 2, { both: true });
  s.arrow(mx + 40, b2[0] + b2[1] + 2, mx + 40, b3[0] - 2, { both: true });
  // arrows to the external column from the Next.js band
  const nx = LX + LW;
  const mid2 = b2[0] + b2[1] / 2;
  eys.slice(0, 6).forEach(([yy, hh], i) => {
    const sy = b2[0] + 24 + i * ((b2[1] - 48) / 5);
    s.arrow(nx, sy, RX, yy + hh / 2, { stroke: "#B8B1A4", sw: 1, via: [[nx + 12 + (i % 2) * 6, sy], [nx + 12 + (i % 2) * 6, yy + hh / 2]] });
  });
  s.h = Math.max(s.h, ey) + 6;
  s.legend(8, s.h + 10, [["user", "Bezoeker"], ["app", "Eigen code"], ["data", "Opslag"], ["ai", "AI"], ["ext", "Extern"]], { size: 9.6 });
  s.h += 24;
  return s;
}

// --------------------------------------------------------------------------------------------------------------------
export function figTimeline() {
  const W = 960;
  const s = new Svg(W, 470, "Tijdlijn van het eerste contact tot het ontvangen boek, met parallelle processen");
  const labelW = 112;
  const lanes = [
    ["user", "Bezoeker"],
    ["app", "Eigen code"],
    ["ai", "AI (Claude)"],
    ["ext", "Extern zoeken\nen diensten"],
    ["data", "Resultaat\nen opslag"],
  ];
  const top = 38, laneH = 74;
  const phases = [
    ["Invullen", "± 3 minuten", 120, 112],
    ["Betalen", "20 tot 60 s", 234, 116],
    ["Boek maken (wachtscherm)", "60 tot 120 s, schematisch", 352, 452],
    ["Daarna", "dagen en weken", 806, 146],
  ];
  phases.forEach(([t, sub, x, w]) => {
    s.rect(x, 4, w - 2, 30, { fill: COL.walnut, stroke: "none", r: 6 });
    s.text(x + 8, 18, t, { size: 10.2, weight: 700, fill: "#fff" });
    s.text(x + 8, 29, sub, { size: 8.6, fill: "#E9DFD3" });
  });
  lanes.forEach(([cat, label], i) => {
    const y = top + i * laneH;
    s.rect(labelW, y, W - labelW - 4, laneH - 4, { fill: i % 2 ? "#FBFAF7" : "#F6F3EC", stroke: "#E6E0D4", r: 4 });
    s.rect(4, y, labelW - 8, laneH - 4, { cat, r: 6 });
    const ls = label.split("\n");
    s.text((labelW - 8) / 2 + 4, y + (laneH - 4) / 2 - (ls.length - 1) * 6 + 3.5, ls, { size: 10, weight: 700, anchor: "middle", fill: COL[cat].t, lh: 12.5 });
  });
  const ly = (i) => top + i * laneH + 5;
  const bar = (lane, x, w, title, cat, o = {}) => {
    const h = o.h ?? 30;
    const y = ly(lane) + (o.dy ?? 0);
    s.rect(x, y, w, h, { cat, r: 5, dash: o.dash });
    if (o.left) s.text(x - 5, y + 12, title, { size: 8.6, weight: 600, fill: COL[cat].t, anchor: "end" });
    else if (o.outside) s.text(x + w + 5, y + 12, title, { size: 8.6, weight: 600, fill: COL[cat].t });
    else s.text(x + 5, y + 11.5, wrap(title, w - 8, 8.6, 600), { size: 8.6, weight: 600, fill: COL[cat].t, lh: 10 });
    return { x, y, w, h };
  };
  bar(0, 124, 106, "Landing, start, beelden, activiteiten, profiel", "user", { h: 58 });
  bar(1, 124, 106, "Browser stelt pagina's samen en rekent het smaakprofiel", "app", { h: 58 });
  bar(0, 238, 108, "E-mail, vinkjes, betalen", "user", { h: 30 });
  bar(1, 238, 108, "Opslaan, vertalen, Stripe starten", "app", { h: 44 });
  bar(3, 238, 108, "Stripe Checkout", "ext", { h: 24 });
  bar(3, 238, 108, "Zoeken start al (cache opwarmen)", "ext", { h: 34, dy: 28, dash: "3 3" });
  const gx = (sec) => 358 + sec * 4.4;
  bar(0, gx(0), gx(97) - gx(0), "Wachtscherm met echte voortgang: gekozen, plekken opgezocht, ideeën geschreven, opgemaakt", "user", { h: 30 });
  bar(1, gx(0), 14, "Motor kiest 7 zaden", "app", { h: 22, outside: true });
  bar(3, gx(3), gx(22) - gx(3), "Web: standaard", "ext", { h: 26 });
  s.text(gx(3), ly(3) + 40, "eigen keuzes en rest naast elkaar", { size: 8.2, fill: COL.muted, italic: true });
  bar(3, gx(22), gx(34) - gx(22), "Web: breed", "ext", { h: 26, dash: "3 3" });
  bar(2, gx(3), gx(22) - gx(3), "Haiku 4.5 met webzoeken", "ai", { h: 26 });
  bar(2, gx(22), gx(34) - gx(22), "Haiku, breed", "ai", { h: 26, dash: "3 3" });
  bar(1, gx(36), gx(40) - gx(36), "Vervangen (alleen als nodig)", "app", { h: 22, dash: "3 3", outside: true });
  bar(2, gx(40), gx(70) - gx(40), "Sonnet 5: de ideeën", "ai", { h: 22 });
  bar(2, gx(40), gx(70) - gx(40), "Sonnet 5: de lagen", "ai", { h: 22, dy: 25 });
  s.text(gx(40), ly(2) + 62, "tegelijk: ± 45 s in plaats van 90 s", { size: 8.4, fill: COL.ai.s, italic: true, weight: 600 });
  bar(1, gx(70), gx(78) - gx(70), "Controles", "app", { h: 22, outside: true });
  bar(2, gx(70), gx(80) - gx(70), "Poort", "ai", { h: 22 });
  bar(4, gx(80), gx(88) - gx(80), "PDF", "data", { h: 22, outside: true });
  bar(4, gx(90), gx(97) - gx(90), "Opslaan en mailen", "data", { h: 22, dy: 26, left: true });
  s.add(`<line x1="${gx(40)}" y1="${top}" x2="${gx(40)}" y2="${top + 5 * laneH - 4}" stroke="#B8B1A4" stroke-width="1" stroke-dasharray="2 3"/>`);
  s.text(gx(40) + 4, top + 5 * laneH + 9, "schrijven begint pas als het zoeken klaar is", { size: 8.6, fill: COL.muted });
  bar(0, 810, 140, "Leest het boek, kiest, deelt, downloadt", "user", { h: 30 });
  bar(3, 810, 140, "Dag 2 tot 9: herinnering. Na 6 weken: vervolgmail, alleen met toestemming", "ext", { h: 52 });
  bar(4, 810, 140, "Plan en PDF blijven opvraagbaar via de link in de mail", "data", { h: 36 });
  const ly2 = top + 5 * laneH + 28;
  s.legend(labelW, ly2, [["user", "Bezoeker"], ["app", "Eigen code"], ["ai", "AI"], ["ext", "Extern"], ["data", "Data"]], { size: 9.4 });
  s.text(W - 8, ly2 + 2, "Stippelrand = alleen als het nodig is. Tijden zijn indicatief (docs/discovery-api-costs.md, meetlog P13).", { size: 8.8, anchor: "end", fill: COL.muted });
  s.h = ly2 + 14;
  return s;
}

// --------------------------------------------------------------------------------------------------------------------
const DOOR = { natural: "Vertrouwd", discovery: "Ontdekking", unexpected: "Onverwacht", stretch: "Uitdaging", wildcard: "Wildcard" };
const DIRNL = { familiar: "eigen keuze", adjacent: "aangrenzend", unexpected: "onverwacht", stretch: "uitdaging", wildcard: "wildcard" };

export function figScenario(key) {
  const sc = scenarios.find((x) => x.key === key);
  const s = new Svg(640, 600, `Praktijkvoorbeeld ${key}: ${sc.name}`);
  const nl = (n) => String(n).replace("-", "\u2212").replace(".", ",");
  const ctxLabel = { self: "voor zichzelf", child: "voor een kind of jongere", adult: "voor een andere volwassene", group: "voor een groep" }[sc.context];
  s.rect(6, 6, 628, 44, { cat: "soft", r: 8 });
  s.text(16, 24, sc.name, { size: 12, weight: 700, fill: COL.walnut });
  s.text(16, 40, `Zoekt ${ctxLabel} in ${sc.location}, binnen ${sc.km} km, budget tot € ${sc.budget} per persoon, november.`, { size: 9.4, fill: COL.muted });
  s.text(624, 24, "Fictief profiel, echte motor-uitvoer", { size: 9, anchor: "end", fill: COL.gold, weight: 700 });
  // three columns
  const cy = 62;
  const colW = 202, gap = 11;
  const chips = (x, y, w, title, cat, items) => {
    s.text(x, y, title, { size: 9.6, weight: 700, fill: COL[cat].t });
    let cyy = y + 8;
    items.forEach((it) => {
      const ls = wrap(it, w - 16, 9, 400);
      const h = ls.length * 10.8 + 8;
      s.rect(x, cyy, w, h, { cat, r: 5 });
      s.text(x + 8, cyy + 12, ls, { size: 9, fill: COL[cat].t, lh: 10.8 });
      cyy += h + 4;
    });
    return cyy;
  };
  const e1 = chips(6, cy, colW, "1  Beelden die zij tikt", "user", sc.cards);
  const tags = sc.topTags.map((t) => t.replace(":", " "));
  const dials = { either: "gemengd", unexpected: "open voor onverwacht", grounded: "vertrouwd", practical: "praktisch", wild: "wild" }[sc.dials.practicalToWild] ?? sc.dials.practicalToWild;
  const eff = { minimal: "weinig inspanning", some: "een beetje inspanning", committed: "volle inzet" }[sc.dials.effort];
  const readLines = [
    `Sterkste tags: ${sc.topTags.map((t) => t.split(":")[0]).join(", ")}`,
    `Assen: sociaal ${nl(sc.axes.social)}, energie ${nl(sc.axes.energy)}, binnen/buiten ${nl(sc.axes.setting)}, nieuw ${nl(sc.axes.novelty)}`,
    `Afgeleide dials: ${dials}; ${eff}`,
    `Harde grenzen: kosten t/m klasse ${sc.constraints.costCap}, intensiteit t/m ${sc.constraints.intensityCap}${sc.constraints.minorSafe ? ", kind-lijst aan" : ""}${sc.constraints.meetPeople ? ", mensen ontmoeten" : ""}${sc.constraints.formats ? ", alleen groepsvormen" : ""}`,
  ];
  s.text(6 + colW + gap, cy, "2  Wat de code uit de beelden leest", { size: 9.6, weight: 700, fill: COL.app.t });
  let ry = cy + 8;
  readLines.forEach((l) => {
    const ls = wrap(l, colW - 16, 9, 400);
    const h = ls.length * 10.8 + 8;
    s.rect(6 + colW + gap, ry, colW, h, { cat: "app", r: 5 });
    s.text(6 + colW + gap + 8, ry + 12, ls, { size: 9, fill: COL.app.t, lh: 10.8 });
    ry += h + 4;
  });
  const e3 = chips(6 + 2 * (colW + gap), cy, colW, "3  Activiteiten die zij kiest", "user", sc.picks.map((p, i) => (i === 4 ? `${p} (verkenplek)` : p)));
  let y = Math.max(e1, ry, e3) + 10;
  s.text(6, y + 4, "4  De zeven ideeën die de motor kiest", { size: 10.6, weight: 700, fill: COL.walnut });
  y += 14;
  const rowH = 44;
  sc.seeds.forEach((sd) => {
    const lvl = sd.level ? parseInt(sd.level, 10) : 0;
    const col = lvl ? LEVEL_COLORS[lvl - 1] : "#EEE";
    s.rect(6, y, 628, rowH - 4, { fill: "#FFFFFF", stroke: "#DED8CE", r: 6 });
    s.rect(6, y, 112, rowH - 4, { fill: col, stroke: "#3C2920", r: 6, sw: 1 });
    s.text(14, y + 17, sd.level ?? "", { size: 9.6, weight: 700, fill: "#3C2920" });
    s.text(14, y + 31, `${DOOR[sd.door] ?? sd.door}`, { size: 8.8, fill: "#4A3B30" });
    s.text(128, y + 17, sd.hybrid ? `${sd.hybrid}` : sd.activity, { size: 10.4, weight: 700, fill: COL.ink });
    let why;
    if (sd.reasons?.includes("picked")) why = "Je eigen keuze (anker).";
    else if (sd.hybrid) why = `Gecureerde combinatie met je keuze '${sd.chain[0]}'. Verband: ${sd.via.join(" en ")}.`;
    else if (sd.direction === "wildcard") why = sd.chain.length > 1 ? `Toevalsprikkel uit een wereld die je niet koos, losjes verbonden met '${sd.chain[0]}' (${sd.via.join(", ") || "geen brug"}).` : "Toevalsprikkel uit een wereld die je niet koos.";
    else if (sd.direction === "unexpected") why = `Keten: ${sd.chain.join(" → ")}. Verband: ${sd.via.join(", ") || "geen"}.`;
    else why = `Verbonden met '${sd.chain[0]}' via ${sd.via.join(" en ")}. Aansluiting ${nl(sd.fit)}.`;
    s.text(128, y + 30, wrap(why, 500, 8.8), { size: 8.8, fill: COL.muted, lh: 10 });
    y += rowH;
  });
  s.text(6, y + 10, "Het zoeken naar aanbieders is hier niet gedraaid: het gebruikt betaalde AI en webzoekopdrachten. Zie hoofdstuk 8 voor een echt resultaat.", { size: 9, fill: COL.muted, maxW: 626, lh: 11 });
  s.h = y + 30;
  return s;
}

// --------------------------------------------------------------------------------------------------------------------
export function figCost() {
  const s = new Svg(640, 270, "AI-kosten per gegenereerd boek in vier meetboeken, verdeeld over zoeken, schrijven en lagen");
  const rows = [
    ["P04  gezin, kinderen van 3 en 6", 0.115, 0.045, 0.057],
    ["P10  rolstoelgebruiker", 0.081, 0.08, 0.052],
    ["P12  internationale inwoner", 0.141, 0.044, 0.048],
    ["P13  stel, gepensioneerd (deels uit cache)", 0.283, 0.047, 0.059],
  ];
  s.text(6, 16, "Kosten van het zoeken en schrijven per boek, in dollars", { size: 10.6, weight: 700, fill: COL.walnut });
  const x0 = 214, scale = 900;
  [0, 0.1, 0.2, 0.3, 0.4].forEach((v) => {
    s.line(x0 + v * (scale - 0), 30, x0 + v * scale, 30 + rows.length * 38 + 4, { stroke: "#E6E0D4", sw: 0.8 });
    s.text(x0 + v * scale, 30 + rows.length * 38 + 18, `$${v.toFixed(2).replace(".", ",")}`, { size: 9, anchor: "middle", fill: COL.muted });
  });
  rows.forEach(([label, r, m, l], i) => {
    const y = 38 + i * 38;
    s.text(8, y + 15, wrap(label, 200, 9.6), { size: 9.6, fill: COL.ink, lh: 11 });
    let x = x0;
    [[r, COL.ext.s], [m, COL.ai.s], [l, "#B692BA"]].forEach(([v, c]) => {
      s.rect(x, y, v * scale, 22, { fill: c, stroke: "none", r: 2 });
      x += v * scale;
    });
    s.text(x + 6, y + 15, `$${(r + m + l).toFixed(3).replace(".", ",")}`, { size: 9.6, weight: 700, fill: COL.ink });
  });
  s.legend(8, 30 + rows.length * 38 + 44, [["ext", "Zoeken naar plekken"], ["ai", "Schrijven van de ideeën"]], { size: 9.4 });
  s.rect(344, 30 + rows.length * 38 + 36, 13, 13, { fill: "#B692BA", stroke: "#7A4E7E", r: 3 });
  s.text(363, 30 + rows.length * 38 + 46, "Lagen (drie maten, sfeer, volgende stap)", { size: 9.4, fill: COL.muted });
  s.h = 30 + rows.length * 38 + 62;
  return s;
}
