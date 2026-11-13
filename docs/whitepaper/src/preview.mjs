// Development helper: renders figures to PNG files so they can be looked at. Usage: node preview.mjs [figure ids...]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fontFaceCss } from "./fonts.mjs";
import { allFigures } from "./figures.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "..", "_preview");
mkdirSync(out, { recursive: true });
const wanted = process.argv.slice(2);
const figs = allFigures();
const ids = Object.keys(figs).filter((id) => !wanted.length || wanted.includes(id));

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${fontFaceCss({ cormorant: false })} body{margin:0;background:#fff;font-family:"Plus Jakarta Sans"} .f{display:inline-block}</style></head><body>${ids.map((id) => `<div class="f" id="${id}">${figs[id].svg.toString()}</div>`).join("\n")}</body></html>`;
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
for (const id of ids) {
  const el = await page.$(`#${id}`);
  await el.screenshot({ path: path.join(out, `${id}.png`) });
  console.log("ok", id, `${figs[id].svg.w}x${figs[id].svg.h}`);
}
await browser.close();
