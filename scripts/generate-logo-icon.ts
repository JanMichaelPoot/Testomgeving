// One-off script: generates the new WindowInto brand icon via Gemini,
// replacing the old hand-drawn line-art WindowMark everywhere (header,
// footer, favicon, wizard progress dot, generating screen, /shared page).
// Recreated from a reference screenshot (a folded/peeling two-card icon,
// orange-to-blue gradient) rather than extracted from that low-res JPEG,
// for a crisp result at every size, including a small favicon.
//
// Deliberately requests a pure flat white background and generous margin,
// so a follow-up step (scripts/process-logo-icon.ts) can key it out to a
// transparent PNG.
//
//   GEMINI_API_KEY=... npx tsx scripts/generate-logo-icon.ts
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { generateIllustration } from "../src/lib/gemini";

const STYLE_PREFIX =
  "Clean, modern app-icon design. Flat, polished vector-illustration style " +
  "with soft smooth gradient shading — no photographic texture, no text, " +
  "no letters, no words, no watermark. Centered on a pure flat white " +
  "(#FFFFFF) background with generous even margin around the subject, for " +
  "easy background removal.";

const PROMPT =
  "A single app icon glyph: two overlapping rounded-square cards, like a " +
  "folded or peeling page. The back card sits slightly up and to the " +
  "left, solid warm orange fading to golden yellow. The front card " +
  "overlaps it slightly down and to the right, filled with a smooth " +
  "diagonal gradient — warm orange (#F5A623) in the top-left corner, " +
  "through golden yellow, to sky blue (#4FA8E0) and deeper blue " +
  "(#2E75C4) in the bottom-right corner. The front card's bottom-right " +
  "corner is peeled up like a turning page, revealing a pale blue-white " +
  "underside, with a soft realistic shadow under the fold. Both cards " +
  "have softly rounded corners (like a modern app icon, not sharp " +
  "corners). A subtle glossy highlight sweeps across the top of the " +
  "front card. Simple, confident, professional startup logo mark — no " +
  "extra shapes, no border, no background pattern.";

async function main() {
  const { data } = await generateIllustration(PROMPT, "1:1", STYLE_PREFIX, "2K");
  const outDir = path.join(process.cwd(), "public/logo");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "icon-raw.jpg");
  await writeFile(outPath, data);
  console.log(`Raw icon saved to ${outPath} — inspect before running process-logo-icon.ts.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
