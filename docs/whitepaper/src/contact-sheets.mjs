// Development helper: renders every page of a PDF small and tiles them into contact sheets for a quick layout review.
import http from "node:http";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const pdfFile = path.resolve(process.argv[2]);
const perSheet = Number(process.argv[3] ?? 18);
const cols = Number(process.argv[4] ?? 6);
const outDir = path.resolve(here, "..", "_preview", "sheets");
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
const page = await browser.newPage({ viewport: { width: 700, height: 900 } });
await page.goto(`http://localhost:${port}/`);
await page.evaluate(async (port) => {
  const pdfjs = await import(`http://localhost:${port}/pdfjs/pdf.mjs`);
  pdfjs.GlobalWorkerOptions.workerSrc = `http://localhost:${port}/pdfjs/pdf.worker.mjs`;
  window.__doc = await pdfjs.getDocument(`http://localhost:${port}/doc.pdf`).promise;
}, port);
const total = await page.evaluate(() => window.__doc.numPages);
const tiles = [];
for (let n = 1; n <= total; n++) {
  const dataUrl = await page.evaluate(async (n) => {
    const p = await window.__doc.getPage(n);
    const vp0 = p.getViewport({ scale: 1 });
    const vp = p.getViewport({ scale: 420 / Math.max(vp0.width, vp0.height) * (vp0.height > vp0.width ? 1.41 : 1) });
    const c = document.createElement("canvas");
    c.width = vp.width;
    c.height = vp.height;
    await p.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
    return c.toDataURL("image/png");
  }, n);
  tiles.push(Buffer.from(dataUrl.split(",")[1], "base64"));
}
await browser.close();
server.close();
const W = 300, H = 424;
for (let s = 0; s * perSheet < total; s++) {
  const chunk = tiles.slice(s * perSheet, (s + 1) * perSheet);
  const rows = Math.ceil(chunk.length / cols);
  const comps = [];
  for (let i = 0; i < chunk.length; i++) {
    const img = await sharp(chunk[i]).resize({ width: W - 8, height: H - 8, fit: "inside", background: "#fff" }).extend({ top: 4, bottom: 4, left: 4, right: 4, background: "#888" }).png().toBuffer();
    comps.push({ input: img, left: (i % cols) * W, top: Math.floor(i / cols) * H });
  }
  await sharp({ create: { width: cols * W, height: rows * H, channels: 3, background: "#555" } }).composite(comps).png().toFile(path.join(outDir, `sheet-${s + 1}.png`));
}
console.log(`pages ${total}, sheets ${Math.ceil(total / perSheet)}`);
