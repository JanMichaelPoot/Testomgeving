// Generates the card photos of the discovery library with Gemini: one per
// activity plus one per domain. Idempotent: it only creates what is MISSING, so
// after adding activities you just run it again and only the new ones are made.
//
//   npx tsx scripts/generate-discovery-illustrations.ts                 all missing photos
//   npx tsx scripts/generate-discovery-illustrations.ts --domains-only  only the 10 domain cards
//   npx tsx scripts/generate-discovery-illustrations.ts --only hardlopen,yoga
//   npx tsx scripts/generate-discovery-illustrations.ts --domain movement
//   npx tsx scripts/generate-discovery-illustrations.ts --limit 10      first 10 missing (a test batch)
//   npx tsx scripts/generate-discovery-illustrations.ts --force         regenerate even if a photo exists
//   npx tsx scripts/generate-discovery-illustrations.ts --concurrency 4
//   npx tsx scripts/generate-discovery-illustrations.ts --sheet 3x3     cheaper: 9 photos per generated image
//   npx tsx scripts/generate-discovery-illustrations.ts --sheet 2x2 --limit 1   test one sheet
//
// --sheet: the image model charges per generated image, not per pixel, so ONE 2K
// image holding a grid of photos costs the same as one single photo. The sheet is
// cut into tiles with src/lib/discovery/sheetSlicer.ts. 2x2 gives tiles of ~1000px
// (as sharp as the single photos), 3x3 ~680px (cheaper still, slightly softer).
// Cells that do not fill a whole sheet, and sheets whose grid cannot be found, fall
// back to one-by-one generation. With --sheet, --limit counts sheets. Domain cards
// are always made one by one.
//
// Reads GEMINI_API_KEY from .env.local. Output: public/illustrations/discovery/<id>.jpg
// (and domains/<domain>.jpg), 4:3, resized to 800px wide and JPEG-compressed.
import { existsSync, mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { generateIllustration } from "../src/lib/gemini";
import { ALL_ACTIVITIES, DOMAINS } from "../src/lib/discovery/library";
import { sliceSheet } from "../src/lib/discovery/sheetSlicer";

if (!process.env.GEMINI_API_KEY && existsSync(".env.local")) process.loadEnvFile(".env.local");
if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is not set (expected in .env.local).");
  process.exit(1);
}

const OUT = path.join(process.cwd(), "public/illustrations/discovery");
const WIDTH = 800;

// Same photographic language as the rest of the site (warm walnut, linen, cream),
// with ONE bold accent colour per domain so the cards are recognisable at a
// glance and the wizard doesn't turn beige. No people: it avoids stereotypes
// about who does which hobby and generation glitches with faces and hands.
function stylePrefix(colorName: string, hex: string) {
  return (
    "Photorealistic contemporary editorial photograph in a premium travel-magazine style. " +
    "Warm natural light, a warm neutral base of walnut wood, linen and cream, " +
    `with ONE bold saturated accent colour: ${colorName} (${hex}). That accent must be clearly and prominently present, ` +
    "preferably as part of the subject itself (the coloured gear, paint, wool, material or object the scene is about) " +
    "and otherwise as a painted wall or backdrop; avoid using a random draped cloth as the only source of colour. " +
    "It gives the image real colour contrast and punch, richer and more saturated than a muted look, yet tasteful. " +
    "One clear focal subject that is instantly recognisable even at thumbnail size, simple uncluttered background, " +
    "shallow depth of field, crisp detail. " +
    "Strictly no people, no faces, no hands, no text, no letters, no logos."
  );
}

// The style, without the accent colour: in a sheet every cell names its own accent.
const SHEET_STYLE =
  "Photorealistic contemporary editorial photographs in a premium travel-magazine style. " +
  "Warm natural light, a warm neutral base of walnut wood, linen and cream, plus one bold saturated accent colour per photograph, " +
  "clearly present as part of the subject itself (the coloured gear, paint, wool, material or object the scene is about) or as a painted wall behind it, " +
  "giving real colour contrast and punch, richer than a muted look yet tasteful. " +
  "Each photograph has one clear focal subject that is instantly recognisable at thumbnail size, a simple uncluttered background, shallow depth of field and crisp detail. " +
  "Strictly no people, no faces, no hands, no text, no letters, no logos anywhere.";

function sheetPrompt(cells: Job[], cols: number, rows: number) {
  const lines = cells.map((c, i) => `${i + 1}. (${c.colorName}, ${c.hex}) ${c.scene}.`);
  return {
    prefix:
      `${SHEET_STYLE} Create ONE single image that is a grid of ${cols} columns by ${rows} rows: ${cells.length} separate photographs of exactly equal size, ` +
      "arranged in reading order (left to right, then top to bottom), divided by clean, straight, plain pure-white gutters about 3% of the image width wide, " +
      "with a plain white margin around the whole grid. Every photograph fills its own cell completely, edge to edge, in landscape 4:3 orientation, " +
      "with no border, frame, caption or number, and is a fully independent photograph with its own subject and composition; nothing may cross a gutter. " +
      "The photographs, each with its own accent colour in brackets:",
    subject: lines.join(" "),
  };
}

interface Job {
  file: string;
  label: string;
  scene: string;
  colorName: string;
  hex: string;
}

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const domainById = new Map(DOMAINS.map((d) => [d.id, d]));
const only = value("only")?.split(",");
const onlyDomain = value("domain");
const force = flag("force");

const jobs: Job[] = [];
for (const d of DOMAINS) {
  if (only || onlyDomain) break; // domain cards are skipped when targeting specific activities
  jobs.push({ file: path.join(OUT, "domains", `${d.id}.jpg`), label: `domain ${d.id}`, scene: d.scene, colorName: d.colorName, hex: d.color });
}
if (!flag("domains-only")) {
  for (const a of ALL_ACTIVITIES) {
    if (a.status === "retired") continue;
    if (only && !only.includes(a.id)) continue;
    if (onlyDomain && a.domain !== onlyDomain) continue;
    const d = domainById.get(a.domain)!;
    jobs.push({ file: path.join(OUT, `${a.id}.jpg`), label: a.id, scene: a.scene, colorName: d.colorName, hex: d.color });
  }
}

const sheetSpec = value("sheet");
const sheetMatch = sheetSpec?.match(/^(\d)x(\d)$/);
if (sheetSpec && (!sheetMatch || sheetMatch[1] !== sheetMatch[2] || Number(sheetMatch[1]) < 2)) {
  console.error("--sheet takes a square grid such as 2x2 or 3x3 (the model output must stay 4:3).");
  process.exit(1);
}
const gridN = sheetMatch ? Number(sheetMatch[1]) : 0;

const todo = jobs.filter((j) => force || !existsSync(j.file));
const limit = Number(value("limit") ?? Infinity);
const batch = sheetSpec ? todo : todo.slice(0, limit);
const concurrency = Number(value("concurrency") ?? 3);


// A billing or rate-limit refusal (402/429) will not go away by retrying, and each
// retry only adds load on the account: stop the whole run at the first one.
let quotaHit: string | null = null;
const isQuotaError = (message: string) => /^(402|429)(\D|$)/.test(message);

async function make(job: Job) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (quotaHit) return `${job.label} SKIPPED (stopped after a billing/rate-limit error)`;
    try {
      const t0 = Date.now();
      const img = await generateIllustration(job.scene, "4:3", stylePrefix(job.colorName, job.hex), "1K");
      const jpg = await sharp(img.data).resize({ width: WIDTH }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
      mkdirSync(path.dirname(job.file), { recursive: true });
      await writeFile(job.file, jpg);
      return `${job.label} ok (${Math.round((Date.now() - t0) / 1000)}s, ${Math.round(jpg.length / 1024)} KB)`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (isQuotaError(message)) {
        quotaHit = message;
        return `${job.label} FAILED: ${message.slice(0, 160)}`;
      }
      if (attempt === 3) return `${job.label} FAILED: ${message}`;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  return `${job.label} FAILED`;
}

// One paid generation -> gridN*gridN photos. Returns one log line per cell.
async function makeSheet(cells: Job[], n: number): Promise<string[]> {
  const { prefix, subject } = sheetPrompt(cells, n, n);
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (quotaHit) return cells.map((c) => `${c.label} SKIPPED (stopped after a billing/rate-limit error)`);
    try {
      const t0 = Date.now();
      const img = await generateIllustration(subject, "4:3", prefix, "2K");
      const tiles = await sliceSheet(img.data, { cols: n, rows: n, outWidth: WIDTH });
      const seconds = Math.round((Date.now() - t0) / 1000);
      const lines: string[] = [];
      for (let i = 0; i < cells.length; i++) {
        mkdirSync(path.dirname(cells[i].file), { recursive: true });
        await writeFile(cells[i].file, tiles[i].jpeg);
        const soft = tiles[i].sourceWidth < WIDTH * 0.8 ? `, source ${tiles[i].sourceWidth}px` : "";
        lines.push(`${cells[i].label} ok (sheet ${seconds}s, ${Math.round(tiles[i].jpeg.length / 1024)} KB${soft})`);
      }
      return lines;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (isQuotaError(message)) {
        quotaHit = message;
        return cells.map((c) => `${c.label} FAILED: ${message.slice(0, 160)}`);
      }
      if (attempt === 2) return cells.map((c) => `${c.label} FAILED (sheet): ${message}`);
    }
  }
  return cells.map((c) => `${c.label} FAILED (sheet)`);
}

async function runSheets() {
  const activityJobs = batch.filter((j) => !j.label.startsWith("domain "));
  const domainJobs = batch.filter((j) => j.label.startsWith("domain "));
  // Keep a domain's cells together so a sheet shares one accent colour where possible.
  const order = new Map(DOMAINS.map((d, i) => [d.id, i]));
  const domainOf = (label: string) => ALL_ACTIVITIES.find((a) => a.id === label)?.domain ?? "";
  activityJobs.sort((a, b) => (order.get(domainOf(a.label)) ?? 0) - (order.get(domainOf(b.label)) ?? 0));

  // Fill 3x3 sheets first, then smaller grids (2x2) for what is left, so almost nothing
  // has to be generated one by one.
  const sheets: { cells: Job[]; n: number }[] = [];
  let remaining = activityJobs;
  for (let n = gridN; n >= 2; n--) {
    while (remaining.length >= n * n) {
      sheets.push({ cells: remaining.slice(0, n * n), n });
      remaining = remaining.slice(n * n);
    }
  }
  const singles = [...domainJobs, ...remaining];
  const sheetLimit = Number(value("limit") ?? Infinity);
  const limited = Number.isFinite(sheetLimit);
  const useSheets = sheets.slice(0, sheetLimit);
  const skippedByLimit = sheets.slice(sheetLimit).reduce((n, sh) => n + sh.cells.length, 0);
  const approx = ((useSheets.length + (limited ? 0 : singles.length)) * 0.134).toFixed(2);
  console.log(
    `${activityJobs.length} activity photos missing: ${useSheets.length} sheet(s) (${useSheets.map((sh) => `${sh.n}x${sh.n}`).join(" ")})` +
      `${singles.length && !limited ? ` + ${singles.length} one-by-one` : ""}` +
      `, about $${approx} at $0.134 per generated image (plus any retries)`,
  );

  let next = 0;
  let done = 0;
  let failed = 0;
  const failedCells: Job[] = [];
  const worker = async () => {
    while (next < useSheets.length) {
      const { cells, n } = useSheets[next++];
      const lines = await makeSheet(cells, n);
      lines.forEach((line, i) => {
        if (line.includes("FAILED") || line.includes("SKIPPED")) {
          failed++;
          failedCells.push(cells[i]);
        }
        console.log(`[${++done}] ${line}`);
      });
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(useSheets.length, 1)) }, worker));

  // Cells that did not fill a sheet, plus cells of sheets that could not be cut, go one by one.
  const rest = limited ? [] : [...singles, ...failedCells];
  if (rest.length && !quotaHit) {
    console.log(`Generating ${rest.length} photo(s) one by one (leftover or sheet failed)`);
    failed -= failedCells.length;
    let i = 0;
    const single = async () => {
      while (i < rest.length) {
        const line = await make(rest[i++]);
        if (line.includes("FAILED") || line.includes("SKIPPED")) failed++;
        console.log(`[${++done}] ${line}`);
      }
    };
    await Promise.all(Array.from({ length: concurrency }, single));
  }
  if (skippedByLimit) console.log(`${skippedByLimit} photos left for later sheets (--limit applied).`);
  finish(failed);
}

function finish(failed: number): never {
  if (quotaHit) {
    console.log(
      "\nStopped: the Gemini account refused further requests (402 = billing/credit, 429 = spend-based rate limit).\n" +
        "Check billing and spend limits in Google AI Studio, then run the script again: it continues with only the missing photos.",
    );
  } else {
    console.log(failed ? `Done with ${failed} failures; run again to retry only those.` : "Done.");
  }
  process.exit(failed ? 1 : 0);
}

async function main() {
  if (sheetSpec) return runSheets();
  console.log(`${jobs.length} photos in scope, ${todo.length} missing${force ? " (forcing all)" : ""}, generating ${batch.length}, ${concurrency} at a time`);
  let next = 0;
  let failed = 0;
  let done = 0;
  const worker = async () => {
    while (next < batch.length) {
      const job = batch[next++];
      const line = await make(job);
      if (line.includes("FAILED") || line.includes("SKIPPED")) failed++;
      console.log(`[${++done}/${batch.length}] ${line}`);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  finish(failed);
}

main();
