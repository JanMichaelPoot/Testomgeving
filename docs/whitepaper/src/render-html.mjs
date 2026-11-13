// HTML renderer for the whitepaper (and for the diagram appendix and the findings list). Print-first: A4, named landscape pages for wide figures.
import { inline, FIGS, PARTS, TITLE, SUBTITLE, TAGLINE, BASIS, num } from "./model.mjs";
import { fontFaceCss } from "./fonts.mjs";
import { findings, KINDS } from "./findings.mjs";
import { esc } from "./svg.mjs";

const COLORS = { ink: "#202020", muted: "#6A655D", walnut: "#5B3F2F", walnutDark: "#3C2920", gold: "#B08A4A", paper: "#FFFFFF", cream: "#F7F5F0", line: "#DED8CE", ivory: "#FBF6EA", slate: "#3E5C76" };

export function css() {
  return `
${fontFaceCss()}
:root { --ink:${COLORS.ink}; --muted:${COLORS.muted}; --walnut:${COLORS.walnut}; --walnut-dark:${COLORS.walnutDark}; --gold:${COLORS.gold}; --line:${COLORS.line}; --cream:${COLORS.cream}; --ivory:${COLORS.ivory}; --slate:${COLORS.slate}; }
@page { size: A4; margin: 22mm 18mm 20mm 18mm;
  @top-left { content: "WindowInto · productwhitepaper"; font: 400 7.5pt 'Plus Jakarta Sans'; color: ${COLORS.muted}; }
  @bottom-right { content: counter(page); font: 600 8pt 'Plus Jakarta Sans'; color: ${COLORS.muted}; } }
@page :first { margin: 0; @top-left { content: none; } @bottom-right { content: none; } }
@page wide { size: A4 landscape; margin: 18mm 14mm 16mm 14mm;
  @top-left { content: "WindowInto · productwhitepaper"; font: 400 7.5pt 'Plus Jakarta Sans'; color: ${COLORS.muted}; }
  @bottom-right { content: counter(page); font: 600 8pt 'Plus Jakarta Sans'; color: ${COLORS.muted}; } }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: 'Plus Jakarta Sans', 'Segoe UI', Arial, sans-serif; font-size: 9.6pt; line-height: 1.52; color: var(--ink); background: #fff; font-variant-numeric: tabular-nums; }
p { margin: 0 0 2.6mm; orphans: 3; widows: 3; }
b, strong { font-weight: 700; }
code { font-family: 'Cascadia Mono', Consolas, 'Courier New', monospace; font-size: 0.86em; background: #F1EEE7; padding: 0.1em 0.3em; border-radius: 3px; word-break: break-word; }
ul, ol { margin: 0 0 3mm; padding-left: 5.2mm; } li { margin: 0 0 1.4mm; }
h1, h2, h3 { font-family: 'Newsreader', Georgia, serif; font-weight: 500; color: var(--walnut-dark); line-height: 1.18; text-wrap: balance; }
h1 { font-size: 27pt; margin: 0 0 7mm; padding-top: 2mm; break-before: page; break-after: avoid; }
h1 .no { display: block; font: 700 8.5pt 'Plus Jakarta Sans'; letter-spacing: 0.14em; text-transform: uppercase; color: var(--gold); margin-bottom: 2.4mm; }
h1::after { content: ""; display: block; width: 24mm; height: 1.2mm; background: var(--gold); margin-top: 5mm; }
h2 { font-size: 15.5pt; margin: 8mm 0 3mm; break-after: avoid; }
h2 .no { color: var(--gold); margin-right: 2mm; font-size: 0.82em; }
h3 { font-size: 11.6pt; margin: 5mm 0 1.8mm; break-after: avoid; font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; color: var(--walnut); }
.laga { background: var(--ivory); border-left: 1.2mm solid var(--gold); padding: 3.2mm 4.4mm; margin: 0 0 4.4mm; font-size: 10.2pt; line-height: 1.55; border-radius: 0 2mm 2mm 0; break-inside: avoid; }
.laga::before { content: "In gewone woorden"; display: block; font: 700 7pt 'Plus Jakarta Sans'; letter-spacing: 0.13em; text-transform: uppercase; color: var(--gold); margin-bottom: 1.2mm; }
.laga p { margin: 0; }
.lagb { background: #F4F4F2; border-left: 1.2mm solid var(--walnut-dark); padding: 3mm 4.4mm 1.6mm; margin: 4mm 0 5mm; border-radius: 0 2mm 2mm 0; font-size: 9.1pt; line-height: 1.5; }
.lagb > .lbt { font: 700 7pt 'Plus Jakarta Sans'; letter-spacing: 0.13em; text-transform: uppercase; color: var(--walnut-dark); margin-bottom: 2mm; }
.lagb p { font-size: 9.1pt; }
.lagb table { background: #fff; }
pre { font-family: 'Cascadia Mono', Consolas, 'Courier New', monospace; font-size: 7.7pt; line-height: 1.5; background: #202020; color: #F3EEE4; padding: 3mm 3.6mm; border-radius: 2mm; margin: 0 0 3.4mm; white-space: pre-wrap; word-break: break-word; break-inside: avoid; }
.note { border: 0.3mm solid var(--line); border-left-width: 1.2mm; border-radius: 0 2mm 2mm 0; padding: 2.6mm 4mm; margin: 0 0 4.4mm; font-size: 9.1pt; break-inside: avoid; background: #fff; }
.note .nl { display: block; font: 700 7pt 'Plus Jakarta Sans'; letter-spacing: 0.13em; text-transform: uppercase; margin-bottom: 1mm; }
.note.let-op { border-left-color: #B08A4A; } .note.let-op .nl { color: #8A6A30; }
.note.bevinding { border-left-color: #A4452C; background: #FBF3F0; } .note.bevinding .nl { color: #A4452C; }
.note.eerlijk { border-left-color: #3E5C76; background: #F2F6FA; } .note.eerlijk .nl { color: #3E5C76; }
.note.feit { border-left-color: #5E8A5B; background: #F3F8F2; } .note.feit .nl { color: #4A7247; }
.note p { margin: 0; }
table { width: 100%; border-collapse: collapse; margin: 0 0 4mm; font-size: 8.6pt; line-height: 1.38; table-layout: fixed; }
table.small { font-size: 7.7pt; line-height: 1.34; }
th { background: var(--walnut-dark); color: #fff; font-weight: 700; text-align: left; padding: 1.7mm 2.2mm; font-size: 0.94em; }
td { padding: 1.5mm 2.2mm; border-bottom: 0.25mm solid var(--line); vertical-align: top; word-break: break-word; }
tr { break-inside: avoid; }
tbody tr:nth-child(even) td { background: #FAF8F3; }
.tabwrap { break-inside: auto; margin: 0 0 4.4mm; } .tabwrap > table { margin: 0; }
.cap { font-size: 8.2pt; color: var(--muted); margin: 1.4mm 0 0; line-height: 1.4; } .cap b { color: var(--walnut); } .cap.t { margin: 0 0 1.6mm; font-weight: 400; break-after: avoid; }
table.steps { font-size: 8.5pt; margin-bottom: 4.2mm; } table.steps td:first-child { width: 17%; font-weight: 700; color: var(--walnut); background: #F7F2E8 !important; } table.steps tr:last-child td { border-bottom: 0.4mm solid var(--walnut); }
table.facts td:first-child { width: 28%; font-weight: 700; }
figure { margin: 4mm 0 5mm; break-inside: avoid; } figure svg { width: 100%; height: auto; display: block; }
section.wide { page: wide; break-before: page; break-after: page; display: flex; flex-direction: column; justify-content: flex-start; } section.wide figure { margin: 0; } section.wide figure svg { max-height: 150mm; }
.cover { height: 297mm; width: 210mm; background: ${COLORS.walnutDark}; color: #F7F2E8; padding: 26mm 20mm 20mm; position: relative; break-after: page; overflow: hidden; }
.cover .kick { font: 700 8.5pt 'Plus Jakarta Sans'; letter-spacing: 0.22em; text-transform: uppercase; color: #D2B77A; }
.cover h1 { font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 600; color: #FFFDFA; font-size: 62pt; margin: 10mm 0 2mm; padding: 0; break-before: avoid; line-height: 1; }
.cover h1::after { background: #D2B77A; margin-top: 7mm; }
.cover .sub { font: 600 18pt 'Cormorant Garamond', serif; color: #E9DFD3; margin: 0 0 12mm; }
.cover .tag { font: italic 400 13pt 'Newsreader', Georgia, serif; line-height: 1.4; color: #F3E3BC; max-width: 140mm; }
.cover .meta { position: absolute; left: 20mm; right: 20mm; bottom: 20mm; font-size: 8.8pt; color: #D9CFC2; border-top: 0.3mm solid #7A5F4F; padding-top: 4mm; line-height: 1.6; }
.cover .win { position: absolute; right: 20mm; top: 120mm; width: 74mm; height: 74mm; }
.toc { break-before: page; } .toc h1 { break-before: avoid; margin-bottom: 4mm; }
.toc ol { list-style: none; padding: 0; margin: 0; } .toc li { display: flex; align-items: baseline; gap: 2mm; margin: 0; padding: 0.5mm 0; font-size: 9pt; }
.toc li.c { font-weight: 700; margin-top: 2.4mm; color: var(--walnut-dark); font-size: 9.6pt; } .toc li.s { padding-left: 8mm; color: #3A3632; font-size: 8.5pt; }
.toc .d { flex: 1; border-bottom: 0.3mm dotted #B8B1A4; transform: translateY(-1mm); } .toc .pg { font-weight: 600; color: var(--muted); min-width: 7mm; text-align: right; }
.toc a { color: inherit; text-decoration: none; }
.noprint { display: none; }
`;
}

function il(text) {
  return inline(text)
    .map((t) => (t.k === "b" ? `<b>${esc(t.v)}</b>` : t.k === "i" ? `<i>${esc(t.v)}</i>` : t.k === "code" ? `<code>${esc(t.v)}</code>` : esc(t.v)))
    .join("");
}

function renderTable(b) {
  const widths = b.widths ? `<colgroup>${b.widths.map((w) => `<col style="width:${w}%">`).join("")}</colgroup>` : "";
  const head = b.head ? `<thead><tr>${b.head.map((h) => `<th>${il(h)}</th>`).join("")}</tr></thead>` : "";
  const rows = b.rows.map((r) => `<tr>${r.map((c) => `<td>${il(c)}</td>`).join("")}</tr>`).join("");
  return `<div class="tabwrap">${b.caption ? `<p class="cap t"><b>Tabel ${b.label}</b> ${il(b.caption)}</p>` : ""}<table class="${b.small ? "small" : ""}">${widths}${head}<tbody>${rows}</tbody></table></div>`;
}

const NOTE_LABEL = { "let-op": "Let op", bevinding: "Bevinding", eerlijk: "Eerlijk over de grenzen", feit: "Goed om te weten" };

export function renderBlocks(blocks, ctx = {}) {
  return blocks
    .map((b) => {
      switch (b.t) {
        case "h2":
          return `<h2 id="h-${b.label.replace(/\W/g, "-")}">${b.label ? `<span class="no">${b.label}</span>` : ""}${il(b.title)}</h2>`;
        case "h3":
          return `<h3>${il(b.title)}</h3>`;
        case "p":
          return `<p>${il(b.text)}</p>`;
        case "ul":
          return `<ul>${b.items.map((i) => `<li>${il(i)}</li>`).join("")}</ul>`;
        case "ol":
          return `<ol>${b.items.map((i) => `<li>${il(i)}</li>`).join("")}</ol>`;
        case "laagA":
          return `<div class="laga"><p>${il(b.text)}</p></div>`;
        case "laagB":
          return `<div class="lagb"><div class="lbt">Laag B · ${il(b.title.replace(/^Laag B: /, ""))}</div>${renderBlocks(b.blocks, ctx)}</div>`;
        case "fig": {
          const f = FIGS[b.id];
          const fig = `<figure data-fig="${b.id}">${f.svg.toString()}<figcaption class="cap"><b>Figuur ${b.label}</b> ${il(b.caption)}</figcaption></figure>`;
          return f.landscape ? `<section class="wide">${fig}</section>` : fig;
        }
        case "tab":
          return renderTable(b);
        case "code":
          return `<pre>${esc(b.text)}</pre>`;
        case "note":
          return `<div class="note ${b.kind}"><span class="nl">${NOTE_LABEL[b.kind] ?? b.kind}</span><p>${il(b.text)}</p></div>`;
        case "steps":
          return `<table class="steps"><tbody>${b.rows.map(([k, v]) => `<tr><td>${il(k)}</td><td>${il(v)}</td></tr>`).join("")}</tbody></table>`;
        case "facts":
          return `<table class="facts"><tbody>${b.rows.map(([k, v]) => `<tr><td>${il(k)}</td><td>${il(v)}</td></tr>`).join("")}</tbody></table>`;
        case "pb":
          return `<div style="break-after:page"></div>`;
        default:
          throw new Error(`Unknown block type ${b.t}`);
      }
    })
    .join("\n");
}

function renderPart(part) {
  const head = part.appendix
    ? `<h1 id="p-${part.id}"><span class="no">Bijlage ${part.appendix}</span>${il(part.title.replace(/^Bijlage [A-Z]\.\s*/, ""))}</h1>`
    : part.unnumbered
      ? `<h1 id="p-${part.id}">${il(part.title)}</h1>`
      : `<h1 id="p-${part.id}"><span class="no">Hoofdstuk ${part.label}</span>${il(part.title)}</h1>`;
  return `${head}\n${renderBlocks(part.blocks)}`;
}

function windowMark() {
  // The brand's recurring motif, drawn plainly: a window frame with seven panes in the level colours.
  const colors = ["#F3E1AE", "#EBCF93", "#E0BC85", "#CDB190", "#B9AEA2", "#A4AAB4", "#8FA0B6"];
  const pane = (i, x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${colors[i]}" stroke="#2A1B14" stroke-width="1"/>`;
  return `<svg class="win" viewBox="0 0 120 120" aria-hidden="true"><rect x="4" y="4" width="112" height="112" rx="6" fill="#6B4A37" stroke="#D2B77A" stroke-width="1.6"/>${[0, 1, 2, 3].map((i) => pane(i, 10 + i * 26, 10, 22, 46)).join("")}${[0, 1, 2].map((i) => pane(4 + i, 10 + i * 35, 62, 31, 46)).join("")}</svg>`;
}

export function cover() {
  return `<section class="cover"><div class="kick">Product- en architectuurdocument</div><h1>${esc(TITLE)}</h1><div class="sub">${esc(SUBTITLE)}</div><div class="tag">${esc(TAGLINE)}</div>${windowMark()}<div class="meta">Voor de oprichter en ontwikkelaar van WindowInto, en als uitleg voor wie het product wil begrijpen.<br>${esc(BASIS)}.<br>Met bijlagen: bevindingenlijst, tegenstrijdigheden tussen documentatie en code, gewichten van de motor, verificatie.</div></section>`;
}

/** The table of contents. `pages` maps an entry key to its page number (known after a first pass). */
export function toc(pages = {}) {
  const items = [];
  for (const part of PARTS) {
    if (part.unnumbered && part.id !== "leeswijzer") continue;
    const label = part.appendix ? `Bijlage ${part.appendix}. ${part.title.replace(/^Bijlage [A-Z]\.\s*/, "")}` : part.unnumbered ? part.title : `${part.label}  ${part.title}`;
    items.push({ cls: "c", label, key: `p:${part.id}` });
    if (!part.appendix && !part.unnumbered) for (const b of part.blocks) if (b.t === "h2") items.push({ cls: "s", label: `${b.label}  ${b.title}`, key: `h:${b.label}` });
  }
  return {
    items,
    html: `<section class="toc"><h1>Inhoud</h1><ol>${items.map((i) => `<li class="${i.cls}"><span>${esc(i.label).replace(/\*\*|`/g, "")}</span><span class="d"></span><span class="pg">${pages[i.key] ?? "00"}</span></li>`).join("")}</ol></section>`,
  };
}

export function whitepaperHtml(pages = {}) {
  const t = toc(pages);
  return {
    toc: t,
    html: `<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>WindowInto productwhitepaper</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css()}</style></head><body>${cover()}${t.html}${PARTS.map(renderPart).join("\n")}</body></html>`,
  };
}

// ---- the diagram appendix ---------------------------------------------------------------------------------------------
const FIG_TITLES = {};
export function diagramAppendixHtml() {
  const entries = [];
  for (const part of PARTS) {
    const walk = (blocks) => blocks.forEach((b) => {
      if (b.t === "fig") entries.push({ ...b, chapter: part.unnumbered ? "Leeswijzer" : part.appendix ? `Bijlage ${part.appendix}` : `Hoofdstuk ${part.label}`, chapterTitle: part.title });
      if (b.blocks) walk(b.blocks);
    });
    walk(part.blocks);
  }
  const body = entries
    .map((e) => {
      const f = FIGS[e.id];
      const head = `<div class="dh"><span class="dk">${esc(e.chapter)}</span><span class="dt">Figuur ${e.label}</span></div>`;
      const fig = `<figure>${head}${f.svg.toString()}<figcaption class="cap">${il(e.caption)}</figcaption></figure>`;
      return f.landscape ? `<section class="wide dapp">${fig}</section>` : `<section class="dapp port">${fig}</section>`;
    })
    .join("\n");
  const index = `<section class="toc"><h1>Diagrammenbijlage</h1><p>De belangrijkste architectuur-, proces- en algoritmediagrammen van het WindowInto-productwhitepaper, elk op een eigen pagina en op volle grootte. De kleurcode is overal gelijk: goud is de bezoeker, walnoot is eigen code, leiblauw is data, paars is een AI-aanroep en salie is een externe bron.</p><ol>${entries.map((e) => `<li class="s" style="padding-left:0"><span>Figuur ${e.label}  ·  ${esc(plainCap(e.caption))}</span></li>`).join("")}</ol></section>`;
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>WindowInto diagrammenbijlage</title><style>${css()} .dapp{break-before:page;break-after:page} .dapp.port{page:auto} .dh{display:flex;justify-content:space-between;margin-bottom:3mm;font:700 8pt 'Plus Jakarta Sans';letter-spacing:.12em;text-transform:uppercase;color:var(--gold)} .dh .dt{color:var(--walnut)} .dapp figure{margin:0} .dapp svg{max-height:225mm} section.wide.dapp svg{max-height:150mm}</style></head><body>${cover().replace("Productwhitepaper", "Diagrammenbijlage").replace(/Voor de oprichter[\s\S]*?<\/div>/, "Bij het WindowInto-productwhitepaper.<br>" + esc(BASIS) + ".</div>")}${index}${body}</body></html>`;
}
function plainCap(c) {
  return inline(c).map((t) => t.v).join("").split(". ")[0];
}

// ---- the findings list ---------------------------------------------------------------------------------------------------
export function findingsHtml() {
  const rows = findings
    .map((f) => `<tr><td><b>${f.id}</b></td><td>${esc(KINDS[f.kind])}</td><td>${esc(f.area)}</td><td><b>${il(f.title)}.</b> ${il(f.evidence)}<br><i>Gevolg:</i> ${il(f.impact)}</td><td>${il(f.advice)}</td></tr>`)
    .join("");
  const counts = Object.entries(KINDS).map(([k, v]) => `${v}: ${findings.filter((f) => f.kind === k).length}`).join(" · ");
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>WindowInto bevindingenlijst</title><style>${css()} @page { size: A4 landscape; margin: 16mm 14mm; } h1{break-before:avoid;font-size:22pt}</style></head><body><h1>Technische bevindingenlijst</h1><p>Beknopte lijst met onduidelijkheden, ontbrekende of afwijkende implementaties en ontwikkelaandachtspunten uit het onderzoek voor het WindowInto-productwhitepaper. ${esc(BASIS)}. ${counts}. Elke bevinding heeft bewijs in de code of de uitvoer; waar iets niet te verifiëren was, staat dat erbij.</p><table class="small"><colgroup><col style="width:5%"><col style="width:10%"><col style="width:9%"><col style="width:52%"><col style="width:24%"></colgroup><thead><tr><th>Id</th><th>Soort</th><th>Gebied</th><th>Bevinding, bewijs en gevolg</th><th>Advies</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}
