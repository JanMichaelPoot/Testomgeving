// Builds every deliverable of the whitepaper from the single source in this folder:
//   WindowInto-whitepaper.html / .pdf / .docx, WindowInto-diagrammenbijlage.pdf (+ diagrammen/*.png|svg),
//   WindowInto-bevindingen.pdf / .md
// Usage (from this folder): node verify.mjs && node build.mjs
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { whitepaperHtml, diagramAppendixHtml, findingsHtml } from "./render-html.mjs";
import { buildDocx } from "./render-docx.mjs";
import { FIGS, PARTS, inline } from "./model.mjs";
import { findings, KINDS } from "./findings.mjs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "..");
const figDir = path.join(out, "diagrammen");
mkdirSync(figDir, { recursive: true });

const browser = await chromium.launch();

async function toPdf(html, file, opts = {}) {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: file, printBackground: true, preferCSSPageSize: true, outline: true, tagged: true, ...opts });
  await page.close();
}

async function pageTexts(file) {
  const data = new Uint8Array(readFileSync(file));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true, disableFontFace: true }).promise;
  const texts = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    texts.push(tc.items.map((it) => it.str).join(" ").replace(/\s+/g, " "));
  }
  return texts;
}

const norm = (s) => s.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g, "");

// ---- the whitepaper: two passes, so the table of contents knows its page numbers
const pdfPath = path.join(out, "WindowInto-whitepaper.pdf");
let pages = {};
let built = whitepaperHtml(pages);
for (let pass = 1; pass <= 3; pass++) {
  await toPdf(built.html, pdfPath);
  const texts = (await pageTexts(pdfPath)).map(norm);
  const found = {};
  let from = 0;
  // the contents pages come first: start searching after the page that holds the last contents entry
  const lastLabel = norm(built.toc.items[built.toc.items.length - 1].label);
  const tocLast = Math.max(1, texts.findIndex((t, i) => i > 0 && t.includes(lastLabel)));
  from = tocLast + 1;
  for (const item of built.toc.items) {
    const text = norm(item.label);
    const title = text;
    let idx = -1;
    for (let i = from; i < texts.length; i++) {
      if (texts[i].includes(text) || texts[i].includes(title)) {
        idx = i;
        break;
      }
    }
    if (idx >= 0) {
      found[item.key] = idx + 1;
      from = idx;
    }
  }
  const same = JSON.stringify(found) === JSON.stringify(pages);
  pages = found;
  console.log(`pass ${pass}: ${texts.length} pages, ${Object.keys(found).length}/${built.toc.items.length} contents entries located${same ? " (stable)" : ""}`);
  if (same) break;
  built = whitepaperHtml(pages);
}
writeFileSync(path.join(out, "WindowInto-whitepaper.html"), built.html);

// ---- figure images
{
  const page = await browser.newPage({ deviceScaleFactor: 2.5 });
  await page.setContent(built.html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  for (const id of Object.keys(FIGS)) {
    const el = page.locator(`figure[data-fig="${id}"] svg`).first();
    if ((await el.count()) === 0) continue;
    await el.screenshot({ path: path.join(figDir, `fig-${id}.png`) });
    const svg = FIGS[id].svg.toString().replace("<svg ", `<svg style="font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif" `);
    writeFileSync(path.join(figDir, `fig-${id}.svg`), svg);
  }
  await page.close();
  console.log(`figures: ${Object.keys(FIGS).length} png + svg in diagrammen/`);
}

// ---- the editable version
writeFileSync(path.join(out, "WindowInto-whitepaper.docx"), await buildDocx({ figDir, outPath: path.join(out, "WindowInto-whitepaper.docx") }));
console.log("docx written");

// ---- the diagram appendix and the findings list
await toPdf(diagramAppendixHtml(), path.join(out, "WindowInto-diagrammenbijlage.pdf"));
await toPdf(findingsHtml(), path.join(out, "WindowInto-bevindingen.pdf"));
const plainText = (t) => inline(t).map((x) => x.v).join("");
const md = [
  "# WindowInto: technische bevindingenlijst",
  "",
  `Beknopte lijst met onduidelijkheden, ontbrekende of afwijkende implementaties en ontwikkelaandachtspunten uit het onderzoek voor het productwhitepaper. Basis: branch \`site-optimalisatie\`, commit \`0844364\`, 13 november 2026.`,
  "",
  Object.entries(KINDS).map(([k, v]) => `- **${k}** = ${v} (${findings.filter((f) => f.kind === k).length})`).join("\n"),
  "",
  "| Id | Soort | Gebied | Bevinding en bewijs | Advies |",
  "|---|---|---|---|---|",
  ...findings.map((f) => `| **${f.id}** | ${f.kind} | ${f.area} | **${plainText(f.title)}.** ${plainText(f.evidence).replace(/\|/g, "\\|")} *Gevolg:* ${plainText(f.impact).replace(/\|/g, "\\|")} | ${plainText(f.advice).replace(/\|/g, "\\|")} |`),
  "",
].join("\n");
writeFileSync(path.join(out, "WindowInto-bevindingen.md"), md);
await browser.close();
console.log("done");
