// Figures of chapters 1-4: concept, distance model, journey, swimlane, input model, audience tree.
import { Svg, COL, wrap, textWidth } from "./svg.mjs";

// The seven discovery levels get one colour each, from warm (what you know) to cool (what you have not met).
export const LEVEL_COLORS = ["#F3E1AE", "#EBCF93", "#E0BC85", "#CDB190", "#B9AEA2", "#A4AAB4", "#8FA0B6"];
export const LEVELS = ["Vertrouwd", "Praktisch", "Verwant", "Inspirerend", "Verrassend", "Uitdagend", "Onontdekt"];

// --------------------------------------------------------------------------------------------------------------------
export function figOverview() {
  const s = new Svg(640, 478, "Overzicht van WindowInto: van beelden en activiteiten via de selectiemotor naar zeven ideeën met echte plekken");
  // window frame
  const fx = 168, fy = 16, fw = 304, fh = 178;
  s.rect(fx, fy, fw, fh, { fill: "#6B4A37", stroke: "#3C2920", r: 6, sw: 1.6 });
  const pane = (i, x, y, w, h) => {
    s.rect(x, y, w, h, { fill: LEVEL_COLORS[i], stroke: "#3C2920", r: 2, sw: 1 });
    s.text(x + w / 2, y + h / 2 - 2, String(i + 1), { size: 17, weight: 700, anchor: "middle", fill: "#3C2920" });
    s.text(x + w / 2, y + h / 2 + 14, LEVELS[i], { size: 10, anchor: "middle", fill: "#3C2920", weight: 600 });
  };
  const gx = 9, top = fy + 9, ph = 76;
  const pw = (fw - gx * 5) / 4;
  for (let i = 0; i < 4; i++) pane(i, fx + gx + i * (pw + gx), top, pw, ph);
  const bw = (fw - gx * 4) / 3;
  for (let i = 0; i < 3; i++) pane(4 + i, fx + gx + i * (bw + gx), top + ph + gx, bw, ph);
  s.text(fx + fw / 2, fy + fh + 17, "Zeven ideeën, van vertrouwd tot onontdekt", { size: 12, weight: 700, anchor: "middle", fill: COL.walnut });
  s.text(fx + fw / 2, fy + fh + 31, "Voor de lezer: vier deuren en een verzegelde wildcard", { size: 10, anchor: "middle", fill: COL.muted });

  // left: the visitor
  s.box(10, 22, 132, { cat: "user", title: "1  Tik beelden aan", body: "18 foto's per set, kies er 3 tot 8: plekken, momenten, zintuigen.", h: 84, size: 9.6 });
  s.box(10, 118, 132, { cat: "user", title: "2  Kies activiteiten", body: "18 concrete activiteiten die volgen uit je beelden. Kies er 1 tot 8, of laat ons verrassen.", h: 108, size: 9.6 });
  s.arrow(142, 64, 164, 90, { via: [[154, 64], [154, 90]] });
  s.arrow(142, 163, 164, 130, { via: [[154, 163], [154, 130]] });
  // right: the book
  s.box(498, 22, 132, { cat: "data", title: "Jouw boek", body: "Web, PDF (± 16 pagina's) en e-mail. Per idee: waarom, drie maten, echte plekken, eerste stap.", h: 112, size: 9.6 });
  s.box(498, 146, 132, { cat: "soft", title: "€ 7,50", body: "per boek, eenmalig, geen account", h: 60, size: 9.6, align: "left" });
  s.arrow(474, 90, 494, 78);

  // pipeline
  const py = 266, ph2 = 100, w = 112, gap = 15;
  const steps = [
    ["app", "Beelden lezen", "Elk beeld draagt gewogen tags en vier assen."],
    ["app", "Activiteiten kiezen", "Pagina 2 volgt je smaak; jouw keuzes zijn de ankers."],
    ["app", "Motor kiest zeven", "Regels en een graaf van verbanden, zonder AI."],
    ["ai", "Echte plekken zoeken", "Webzoekopdrachten, websitecheck, vervanging als er niets is."],
    ["ai", "Boek schrijven", "Twee schrijfaanroepen, kwaliteitspoort, PDF."],
  ];
  const facts = ["516 beelden\n172 families", "756 activiteiten\n22 werelden", "6 ideeën + 1 wildcard\ndeterministisch", "per idee minstens\neen echte optie", "2 modellen:\nSonnet 5 en Haiku 4.5"];
  s.text(10, py - 14, "Wat er achter het venster gebeurt", { size: 11, weight: 700, fill: COL.walnut });
  steps.forEach(([cat, title, body], i) => {
    const x = 10 + i * (w + gap);
    s.box(x, py, w, { cat, title, body, h: ph2, size: 9.6, tsize: 10.6 });
    if (i < steps.length - 1) s.arrow(x + w + 1, py + ph2 / 2, x + w + gap - 1, py + ph2 / 2);
    s.text(x + w / 2, py + ph2 + 17, facts[i].split("\n"), { size: 9.6, anchor: "middle", fill: COL.muted, lh: 12 });
  });
  s.rect(10, 416, 620, 1, { fill: "#DED8CE", stroke: "none" });
  s.legend(10, 438, [["user", "Wat de bezoeker doet"], ["app", "Eigen code"], ["ai", "AI-aanroep"], ["data", "Data / resultaat"], ["ext", "Externe bron"]]);
  s.text(10, 458, "Het geschreven boek is betaald; het venster en de profielduiding zijn gratis. Beeld en activiteit zijn nooit hetzelfde: beelden geven smaak, activiteiten geven keuze.", { size: 9.5, fill: COL.muted, maxW: 620 });
  return s;
}

// --------------------------------------------------------------------------------------------------------------------
export function figDistance() {
  const s = new Svg(640, 432, "Afstandsmodel: relevantie tegen nieuwheid voor de vijf richtingen van het boek");
  const X0 = 74, X1 = 612, Y0 = 34, Y1 = 290;
  const px = (n) => X0 + (n / 100) * (X1 - X0);
  const py = (r) => Y1 - (r / 100) * (Y1 - Y0);
  // zones
  const zones = [
    [0, 28, "Wat je al kent", "#F6EBD0"],
    [28, 58, "Wat je mogelijk leuk vindt", "#F1E4D6"],
    [58, 100, "Wat je nog niet kent", "#E6E9EE"],
  ];
  zones.forEach(([a, b, label, fill]) => {
    s.rect(px(a), Y0, px(b) - px(a), Y1 - Y0, { fill, stroke: "none", r: 0 });
    s.text((px(a) + px(b)) / 2, Y1 - 8, label, { size: 10.5, weight: 700, anchor: "middle", fill: COL.walnut });
  });
  // axes
  s.line(X0, Y1, X1, Y1, { stroke: COL.ink, sw: 1.2 });
  s.line(X0, Y0, X0, Y1, { stroke: COL.ink, sw: 1.2 });
  [0, 25, 50, 75, 100].forEach((v) => {
    s.line(px(v), Y1, px(v), Y1 + 4, { stroke: COL.ink });
    s.text(px(v), Y1 + 16, String(v), { size: 9.5, anchor: "middle", fill: COL.muted });
    s.line(X0 - 4, py(v), X0, py(v), { stroke: COL.ink });
    s.text(X0 - 8, py(v) + 3.5, String(v), { size: 9.5, anchor: "end", fill: COL.muted });
    if (v > 0 && v < 100) s.line(X0, py(v), X1, py(v), { stroke: "#E3DDD1", sw: 0.8, dash: "3 4" });
  });
  s.text((X0 + X1) / 2, Y1 + 32, "Nieuwheid: hoe ver van wat je al kent (0 tot 100)", { size: 10.5, anchor: "middle", weight: 600 });
  s.add(`<text transform="translate(18 ${(Y0 + Y1) / 2}) rotate(-90)" font-size="10.5" font-weight="600" text-anchor="middle" fill="${COL.ink}">Aansluiting bij jouw keuzes (0 tot 100)</text>`);
  // points: [novelty, relevance, label lines, level indexes, label dx, dy, anchor]
  const pts = [
    [15, 92, ["Vertrouwd en Praktisch (niveau 1 en 2)"], [0, 1], 22, 4, "start"],
    [48, 72, ["Verwant en Inspirerend (niveau 3 en 4)"], [2, 3], -4, -16, "middle"],
    [66, 52, ["Uitdagend", "(niveau 6)"], [5], -14, 28, "end"],
    [78, 56, ["Verrassend (niveau 5)"], [4], 16, -4, "start"],
    [90, 36, ["Onontdekt: de wildcard", "(niveau 7)"], [6], -14, 26, "end"],
  ];
  // path in the order of the book (familiar, adjacent, unexpected, stretch, wildcard)
  const order = [pts[0], pts[1], pts[3], pts[2], pts[4]];
  s.add(`<path d="${order.map((p, i) => `${i ? "L" : "M"}${px(p[0])} ${py(p[1])}`).join(" ")}" fill="none" stroke="${COL.walnut}" stroke-width="1.6" stroke-dasharray="5 4"/>`);
  pts.forEach(([n, r, label, lv, dx, dy, anchor]) => {
    const x = px(n), y = py(r);
    lv.forEach((l, i) => {
      s.circle(x + (i - (lv.length - 1) / 2) * 15, y, 9, { fill: LEVEL_COLORS[l], stroke: "#3C2920", sw: 1.3 });
      s.text(x + (i - (lv.length - 1) / 2) * 15, y + 3.6, String(l + 1), { size: 10, weight: 700, anchor: "middle", fill: "#3C2920" });
    });
    s.text(x + dx, y + dy, label, { size: 9.6, anchor, weight: 600, fill: COL.ink, lh: 11.5 });
  });
  // the requirement band
  s.box(X0, 326, X1 - X0, { cat: "ext", title: "Wat je echt kunt ondernemen", body: "Geen niveau maar een eis aan elk idee, ook aan de wildcard: minstens een echte, gecontroleerde optie (plek of aanbieder). Zonder optie komt een idee niet in het boek.", size: 9.8, tsize: 10.6 });
  s.text(10, 410, "Bron: vaste ordeningsscores per richting in src/lib/discovery/engine/scores.ts. Het zijn indicaties voor de volgorde, geen metingen.", { size: 9.2, fill: COL.muted, maxW: 620 });
  return s;
}

// --------------------------------------------------------------------------------------------------------------------
export function figJourney() {
  const W = 960;
  const s = new Svg(W, 584, "End-to-end customer journey van het eerste bezoek tot het ontvangen boek, in negen stappen");
  const labelW = 86;
  const cols = [
    { n: 0, t: "Landing", scr: "Schuifraam met acht ruiten, een knop: Open je venster", do: "Kijkt rond, kiest NL of EN, klikt op de knop.", got: "Taalkeuze (cookie). Analytics pas na toestemming.", bg: "Foto's komen uit eigen bestanden. PostHog: landing_viewed.", inf: "Taal van site en boek." },
    { n: 1, t: "Start", scr: "Voor wie, waar, randvoorwaarden", do: "Kiest voor wie (zelf, kind, volwassene, groep). Plaats en afstand. Optioneel tijd, budget, 'wat moet kloppen' (chips).", got: "Zoekcontext, plaats en land, km (5 tot 150), tijd, budget, chips.", bg: "Server-proxy naar PDOK (NL) of Photon geeft plaatsnamen.", inf: "Harde grenzen, zoekgebied, toon." },
    { n: 2, t: "Beelden", scr: "18 foto's in 3 kolommen", do: "Tikt minstens 3 en hoogstens 8 beelden. 'Andere beelden' geeft een nieuwe set (max 3 keer).", got: "Kaart-id's, max 5 per ronde (plek, moment, zintuig).", bg: "Browser stelt de set samen: seeded, vier registers en vier assen in balans.", inf: "Smaakprofiel en tempo." },
    { n: 3, t: "Activiteiten", scr: "18 concrete activiteiten", do: "Kiest 1 tot 8 (3 of meer werkt het best), of kiest 'verras me'. Drie plekken zijn 'Misschien ook?'.", got: "Activiteit-id's: jouw eigen keuzes (max 8).", bg: "Pagina 2 volgt de beelden: tag-nabijheid, vloer per register, 3 verkenplekken.", inf: "Dit zijn de ankers: tot 4 komen zeker in het boek." },
    { n: 4, t: "Profiel", scr: "Venster met jouw keuzes en een korte duiding", do: "Leest de duiding. Schuift vier assen bij of voegt thema's toe.", got: "Schuifwaarden, correcties (max 3).", bg: "Vaste tekst uit de keuzes; optioneel een korte AI-duiding, gecontroleerd.", inf: "Schuiven vervangen wat de beelden zeiden." },
    { n: 5, t: "Betalen", scr: "Bestelblok onder het profiel", do: "Vult e-mail in, vinkt voorwaarden en directe levering aan, betaalt via Stripe.", got: "Antwoorden (raw_json), toestemmingen, order.", bg: "Server vertaalt alles eenmalig. Het zoeken naar plekken start al tijdens het betalen.", inf: "Wijzigen kan tot de betaling." },
    { n: 6, t: "Wachten", scr: "Voortgangsscherm", do: "Wacht ± 1 tot 2 minuten.", got: "Niets nieuws.", bg: "Motor, zoeken, schrijven, kwaliteitspoort, PDF, opslag, e-mail.", inf: "Geen." },
    { n: 7, t: "Boek", scr: "/plan: zeven ideeën, vier deuren, verzegelde wildcard", do: "Leest, opent de wildcard, geeft hartje of duim, kiest 'Dit ga ik doen', deelt, downloadt.", got: "Feedback, gekozen idee. In de test: vragenlijst.", bg: "Tijdelijke link naar de PDF. Meetpunten zonder tekst.", inf: "Gekozen idee stuurt de herinnering." },
    { n: 8, t: "Daarna", scr: "E-mail", do: "Krijgt het boek per mail. Optioneel: herinnering en vervolgmail.", got: "Opt-in voor de vervolgmail.", bg: "Resend. Twee dagelijkse taken (09:00 en 09:30 UTC).", inf: "Vervolgboek herhaalt eerdere ideeën niet." },
  ];
  const cw = (W - labelW - 6) / cols.length;
  const x0 = labelW + 6;
  const rows = [
    ["Scherm", "scr", "soft", 84],
    ["Bezoeker doet", "do", "user", 124],
    ["Verzameld en doorgegeven", "got", "data", 86],
    ["Op de achtergrond", "bg", "app", 104],
    ["Invloed van de bezoeker", "inf", "ext", 62],
  ];
  let y = 8;
  // headers
  cols.forEach((c, i) => {
    const x = x0 + i * cw;
    s.rect(x + 2, y, cw - 4, 34, { fill: COL.walnut, stroke: "none", r: 6 });
    s.dot(x + 16, y + 17, c.n, { cat: "user", r: 9 });
    s.text(x + 30, y + 21, c.t, { size: 10.8, weight: 700, fill: "#fff" });
  });
  y += 42;
  rows.forEach(([label, key, cat, h]) => {
    s.rect(2, y, labelW, h - 4, { fill: COL[cat].f, stroke: COL[cat].s, r: 6 });
    s.text(labelW / 2 + 2, y + (h - 4) / 2 - ((wrap(label, labelW - 12, 10, 700).length - 1) * 6), wrap(label, labelW - 12, 10, 700), { size: 10, weight: 700, anchor: "middle", fill: COL[cat].t, lh: 12.5 });
    cols.forEach((c, i) => {
      const x = x0 + i * cw;
      s.box(x + 2, y, cw - 4, { cat, body: c[key], h: h - 4, size: 9.1, pad: 6, r: 6 });
    });
    y += h;
  });
  s.legend(8, y + 12, [["user", "Wat de bezoeker doet"], ["data", "Data die doorgaat"], ["app", "Eigen code en AI"], ["ext", "Invloed op het resultaat"]]);
  s.h = y + 26;
  return s;
}

// --------------------------------------------------------------------------------------------------------------------
export function figSwimlane() {
  const W = 960;
  const s = new Svg(W, 640, "Swimlane van de hele reis: bezoeker, browser, server, AI, opslag en externe bronnen");
  const lanes = [
    ["user", "Bezoeker"],
    ["app", "Browser\n(de site)"],
    ["app", "Server\n(Next.js, Vercel)"],
    ["ai", "AI\n(Claude)"],
    ["data", "Opslag\n(Supabase)"],
    ["ext", "Extern\n(PDOK, Stripe,\nResend, web)"],
  ];
  const labelW = 100, laneH = 96, top = 8;
  lanes.forEach(([cat, label], i) => {
    const y = top + i * laneH;
    s.rect(labelW, y, W - labelW - 4, laneH - 4, { fill: i % 2 ? "#FBFAF7" : "#F6F3EC", stroke: "#E6E0D4", r: 4 });
    s.rect(4, y, labelW - 8, laneH - 4, { cat, r: 6 });
    const ls = label.split("\n");
    s.text((labelW - 8) / 2 + 4, y + (laneH - 4) / 2 - (ls.length - 1) * 6.5 + 3, ls, { size: 10, weight: 700, anchor: "middle", fill: COL[cat].t, lh: 13 });
  });
  const colX = (c) => 112 + c * 114;
  const CW = 100;
  const ly = (i) => top + i * laneH + 4;
  const B = (lane, c, title, body, cat, w = CW) => {
    const x = colX(c);
    const h = s.box(x, ly(lane), w, { cat, title, body, size: 8.8, tsize: 9.5, pad: 5, r: 5 });
    return { x, y: ly(lane), w, h, cx: x + w / 2, cy: ly(lane) + h / 2, r: x + w, b: ly(lane) + h };
  };
  const o1 = B(0, 0, "Opent de site", "kiest NL of EN", "user");
  const o2 = B(1, 0, "Toont het venster", "de landingspagina", "app");
  const p1 = B(0, 1, "Start", "voor wie, plaats, afstand, chips", "user");
  const p2 = B(2, 1, "Plaatssuggesties", "proxy: /api/location-suggest", "app");
  const p3 = B(5, 1, "PDOK of Photon", "geeft plaatsnamen", "ext");
  const q1 = B(1, 2, "Pagina 1", "stelt 18 beelden samen (seeded)", "app");
  const q2 = B(0, 2, "Tikt 3 tot 8 beelden", "", "user");
  const r1 = B(1, 3, "Pagina 2", "18 activiteiten uit de pool van de server", "app");
  const r2 = B(0, 3, "Kiest 1 tot 8 activiteiten", "of: verras me", "user");
  const t1 = B(2, 4, "Profielduiding", "vaste tekst, of een AI-versie", "app");
  const t2 = B(3, 4, "Sonnet 5", "korte duiding, ± € 0,005", "ai");
  const t3 = B(0, 4, "Stuurt bij en betaalt", "e-mail, vinkjes", "user");
  const u1 = B(2, 5, "Bewaart en vertaalt", "antwoorden, order, toestemmingen; start Stripe", "app");
  const u2 = B(3, 5, "Haiku 4.5 + web", "zoekt al plekken terwijl er betaald wordt", "ai");
  const u3 = B(5, 5, "Stripe Checkout", "betaling; stuurt terug naar /plan", "ext");
  const v1 = B(2, 6, "Genereert het boek", "motor, zoeken, schrijven, QA, PDF", "app");
  const v2 = B(3, 6, "Haiku en Sonnet", "zoeken, twee schrijfaanroepen", "ai");
  const v3 = B(4, 6, "Bewaart", "plan, PDF (privé), cache", "data");
  const v4 = B(5, 6, "Websites en Resend", "websitecheck; e-mail met PDF", "ext");
  const w1 = B(1, 6, "/plan toont het boek", "peilt de voortgang", "app");
  const w2 = B(0, 6, "Leest, kiest, deelt", "", "user");
  const A = (...a) => s.arrow(...a);
  const gapR = (b, d = 7) => b.r + d;
  A(o1.cx, o1.b, o2.cx, o2.y);
  A(o1.r, o1.cy, p1.x, p1.cy);
  A(p1.cx, p1.b, p2.cx, p2.y);
  A(p2.cx, p2.b, p3.cx, p3.y);
  A(p1.r, p1.cy, q1.x, q1.cy, { via: [[gapR(p1), p1.cy], [gapR(p1), q1.cy]] });
  A(q1.cx, q1.y, q2.cx, q2.b);
  A(q2.r, q2.cy, r1.x, r1.cy, { via: [[gapR(q2), q2.cy], [gapR(q2), r1.cy]] });
  A(r1.cx, r1.y, r2.cx, r2.b);
  A(r2.r, r2.cy, t1.x, t1.cy, { via: [[gapR(r2), r2.cy], [gapR(r2), t1.cy]] });
  A(t1.cx, t1.b, t2.cx, t2.y);
  A(t1.cx + 22, t1.y, t3.cx + 22, t3.b, { dash: "3 3" });
  A(t3.r, t3.cy, u1.x, u1.cy, { via: [[gapR(t3), t3.cy], [gapR(t3), u1.cy]] });
  A(u1.cx, u1.b, u2.cx, u2.y);
  A(u1.r, u1.cy + 8, u3.r, u3.cy - 8, { via: [[gapR(u1, 5), u1.cy + 8], [gapR(u1, 5), u3.cy - 8]] });
  A(u3.r, u3.cy + 8, v1.x, v1.cy + 8, { via: [[u3.r + 13, u3.cy + 8], [u3.r + 13, v1.cy + 8]] });
  A(v1.cx, v1.b, v2.cx, v2.y);
  A(v1.r, v1.cy, v3.r, v3.cy, { via: [[v1.r + 9, v1.cy], [v1.r + 9, v3.cy]] });
  A(v1.r, v1.cy + 10, v4.r, v4.cy, { via: [[v1.r + 17, v1.cy + 10], [v1.r + 17, v4.cy]] });
  A(w1.cx, v1.y, w1.cx, w1.b, { dash: "3 3" });
  A(w1.cx, w1.y, w2.cx, w2.b);
  s.legend(112, 622, [["user", "Bezoeker"], ["app", "Eigen code"], ["ai", "AI-aanroep"], ["data", "Opslag"], ["ext", "Extern"]], { size: 9.6 });
  s.text(W - 8, 622, "Niet op tijdschaal; links naar rechts is de volgorde.", { size: 9.2, anchor: "end", fill: COL.muted });
  return s;
}

// --------------------------------------------------------------------------------------------------------------------
export function figInputs() {
  const s = new Svg(640, 540, "Inputmodel: welke invoer waar ingrijpt (harde filter, weging, zoeken, schrijven, alleen controle)");
  const cols = ["Harde filter", "Weging in de motor", "Zoeken", "Schrijven", "Alleen gecontroleerd"];
  const colX = [250, 320, 390, 460, 530];
  const rows = [
    ["Wie", "Voor wie: kind of jongere", [1, 1, 0, 1, 0]],
    ["", "Voor wie: groep", [0, 1, 0, 1, 0]],
    ["", "Voornaam (optioneel)", [0, 0, 0, 1, 0]],
    ["Waar", "Plaats (en land)", [0, 0, 1, 1, 0]],
    ["", "Afstand in km", [0, 0, 1, 0, 0]],
    ["Hoe", "Tijd", [0, 0, 0, 1, 1]],
    ["", "Budget per persoon", [1, 0, 0, 1, 1]],
    ["", "Hoe meedoen (chips)", [1, 0, 0, 1, 0]],
        ["", "'Wat moet kloppen' (chips)", [1, 0, 1, 1, 1]],
    ["Keuzes", "Beelden (pagina 1)", [1, 1, 0, 1, 0]],
    ["", "Activiteiten (pagina 2)", [0, 1, 1, 1, 0]],
    ["", "Vier schuiven op het profiel", [1, 1, 0, 0, 0]],
    ["", "'Niet helemaal'-thema's", [0, 1, 0, 1, 0]],
  ];
  const top = 54, rh = 27;
  cols.forEach((c, i) => {
    const lines = wrap(c, 64, 9.4, 700);
    s.text(colX[i] + 25, 20, lines, { size: 9.4, weight: 700, anchor: "middle", fill: COL.walnut, lh: 11.5 });
  });
  let y = top;
  let groupStart = 0;
  rows.forEach(([group, label, marks], i) => {
    if (group) {
      s.line(8, y - 1, 632, y - 1, { stroke: "#CFC8BC", sw: 0.8 });
      s.text(10, y + 16, group, { size: 10, weight: 700, fill: COL.walnut });
      groupStart = i;
    }
    if (i % 2 === 0) s.rect(70, y, 562, rh, { fill: "#FAF7F1", stroke: "none", r: 0 });
    s.text(76, y + 17.5, label, { size: 10.4, fill: COL.ink });
    const cats = ["app", "user", "ext", "ai", "data"];
    marks.forEach((m, j) => {
      if (m) {
        s.circle(colX[j] + 25, y + rh / 2, 7.5, { fill: COL[cats[j]].s, stroke: COL[cats[j]].s });
      } else s.circle(colX[j] + 25, y + rh / 2, 2, { fill: "#D8D2C6", stroke: "none" });
    });
    y += rh;
  });
  s.line(8, y, 632, y, { stroke: "#CFC8BC", sw: 0.8 });
  s.text(10, y + 20, "Lees: een stip betekent dat de code deze invoer daar gebruikt. Tijd en afstand zijn bewust geen harde filter: de duur in de bibliotheek is een gebruikelijke sessielengte, en de afstand stuurt het zoeken.", { size: 9.4, fill: COL.muted, maxW: 620, lh: 12 });
  s.text(10, y + 56, "'Alleen gecontroleerd' = de motor kan er niet op filteren (geen data in de bibliotheek) en geeft het door als controlevlag aan het zoeken en schrijven: toegankelijkheid, huisdieren, dieet, vervoer, weekend, avond, kosten dicht bij het budget.", { size: 9.4, fill: COL.muted, maxW: 620, lh: 12 });
  s.h = y + 90;
  return s;
}

// --------------------------------------------------------------------------------------------------------------------
export function figAudienceTree() {
  const s = new Svg(640, 500, "Beslisboom: wat de keuze 'voor wie' in de rest van de applicatie verandert");
  s.box(8, 196, 108, { cat: "user", title: "Voor wie zoek je?", body: "Eerste vraag op de startpagina. Niets kiezen kan.", h: 92, size: 9.6 });
  const items = [
    ["Voor mezelf", "Geen aanname over leeftijd of smaak. Het boek spreekt 'jou' aan.", "self"],
    ["Kind of jongere", "Zachte weging 'onder 18'. HARD: een lijst van 33 activiteiten valt weg (alcohol, gokken, wapens, zwaar gereedschap, risicosporten). Beelden en activiteiten met spel, dieren en maken wegen zwaarder.", "child"],
    ["Andere volwassene", "Niets aangenomen. Het boek wordt aan die persoon geschreven, met voornaam als je die geeft.", "adult"],
    ["Groep", "Kleine voorkeur voor samen doen (-0,15) en een kleine straf voor puur solo (+0,3). Samenwerken en competitie wegen mee. Boek voor 'jullie', geen naam.", "group"],
    ["Niet ingevuld", "Telt als onbekend en werkt als 'voor mezelf'. Er wordt niets geforceerd.", "unknown"],
  ];
  const heights = [56, 106, 56, 80, 56];
  let y = 8;
  const ys = [];
  items.forEach(([t, body], i) => {
    const h = heights[i];
    s.box(150, y, 120, { cat: "app", title: t, h, size: 9.6, tsize: 10.6, valign: "middle" });
    s.box(290, y, 342, { cat: "soft", body, h, size: 9.6, valign: "middle", pad: 9 });
    s.arrow(270, y + h / 2, 288, y + h / 2);
    ys.push(y + h / 2);
    s.arrow(116, 242, 148, y + h / 2, { via: [[132, 242], [132, y + h / 2]] });
    y += h + 8;
  });
  s.box(8, y + 6, 624, { cat: "data", title: "Voor alle vijf geldt", body: ["De standaardroute vraagt niet meer naar leeftijd: de enige leeftijdsaanname komt uit 'kind of jongere'. Elke leeftijdsweging is zacht: ze verschuift een score en sluit niets uit. De enige harde uitzondering is de lijst bij 'kind of jongere'.", "Het geslacht wordt nergens gevraagd, opgeslagen of afgeleid."], size: 9.8, tsize: 10.6 });
  s.h = y + 6 + 96;
  return s;
}
