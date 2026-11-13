// Development helper: renders pages of a PDF to PNG with pdf.js in headless Chromium. Usage: node pdf-preview.mjs <pdf> <page> [page...]
import http from "node:http";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const [pdfArg, ...pageArgs] = process.argv.slice(2);
const pdfFile = path.resolve(pdfArg);
const outDir = path.resolve(here, "..", "_preview");
mkdirSync(outDir, { recursive: true });
const pdfjsDir = path.join(here, "node_modules", "pdfjs-dist", "build");

const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]);
  try {
    if (u === "/doc.pdf") return res.writeHead(200, { "content-type": "application/pdf" }).end(readFileSync(pdfFile));
    if (u === "/") return res.writeHead(200, { "content-type": "text/html" }).end(`<!doctype html><body style="margin:0"><canvas id=c></canvas></body>`);
    if (u.startsWith("/pdfjs/")) return res.writeHead(200, { "content-type": u.endsWith(".mjs") ? "text/javascript" : "application/octet-stream" }).end(readFileSync(path.join(pdfjsDir, u.slice(7))));
  } catch {}
  res.writeHead(404).end();
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1500 } });
await page.goto(`http://localhost:${port}/`);
await page.evaluate(async (port) => {
  const pdfjs = await import(`http://localhost:${port}/pdfjs/pdf.mjs`);
  pdfjs.GlobalWorkerOptions.workerSrc = `http://localhost:${port}/pdfjs/pdf.worker.mjs`;
  window.__doc = await pdfjs.getDocument(`http://localhost:${port}/doc.pdf`).promise;
}, port);
const total = await page.evaluate(() => window.__doc.numPages);
console.log("pages:", total);
for (const n of pageArgs.map(Number)) {
  const dims = await page.evaluate(async (n) => {
    const p = await window.__doc.getPage(n);
    const vp0 = p.getViewport({ scale: 1 });
    const scale = 1000 / vp0.width;
    const vp = p.getViewport({ scale });
    const c = document.getElementById("c");
    c.width = vp.width;
    c.height = vp.height;
    await p.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
    return [vp.width, vp.height];
  }, n);
  await page.setViewportSize({ width: Math.ceil(dims[0]), height: Math.ceil(dims[1]) });
  await (await page.$("#c")).screenshot({ path: path.join(outDir, `p-${String(n).padStart(2, "0")}.png`) });
  console.log("ok page", n);
}
await browser.close();
server.close();
