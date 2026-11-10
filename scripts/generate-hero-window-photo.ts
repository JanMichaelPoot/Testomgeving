// One-time script: ONE photographic frame for the landing-hero window (HeroWindow.tsx), seen from inside the room, with the glass of the
// eight panes filled with flat chroma green. scripts/process-hero-window-photo.ts then finds the panes in it (free, local), cuts them out
// as transparent glass and writes the pane rectangles, so the library images show through the real photographed frame.
// One request is about $0.13 (2K). Run locally with GEMINI_API_KEY set; the running app never calls Gemini.
//
//   npx tsx --env-file=.env.local scripts/generate-hero-window-photo.ts [attempt-number]
import { mkdirSync, writeFileSync } from "node:fs";
import { generateIllustration } from "../src/lib/gemini";

const PREFIX =
  "Photorealistic interior architectural photograph, shot straight on at eye level from inside a quiet room, soft natural daylight from the window, " +
  "shallow natural depth, real materials with real texture, like a photo from a premium interior magazine. " +
  "No people, no objects, no plants, no curtains, no text, no letters, no logos, no watermark.";

const SUBJECT =
  "A deep-set traditional timber sash window in a thick limewashed plaster wall, centred in the frame with a generous margin of plain wall on every side. " +
  "The wall is hand-troweled limewash plaster in warm cream, matte, with soft cloudy trowel marks. Around the opening a moulded dark-stained walnut architrave " +
  "(a head board that overhangs slightly and two side boards), then the thick plaster reveal on both sides and the top, then the dark walnut sash frame. " +
  "The sash has EXACTLY EIGHT rectangular glass panes of equal size, in two columns and four rows, separated by slim dark walnut glazing bars, with a slightly thicker " +
  "meeting rail across the middle and a small brass catch on it. A dark walnut windowsill board sticks out into the room under the window, seen slightly from above, " +
  "with a moulded front edge, empty. " +
  "IMPORTANT: every one of the eight glass panes is filled completely with one flat, uniform, pure chroma-key green (hex 00FF00), matte, with no reflection, no gradient, " +
  "no view, no highlight and no shadow on the green, so the glass can be cut out digitally. The frame, bars, plaster and sill are fully photographic.";

async function main() {
  const attempt = process.argv[2] ?? "1";
  mkdirSync("scratch", { recursive: true });
  const image = await generateIllustration(SUBJECT, "3:4", PREFIX, "2K");
  const out = `scratch/hero-photo-raw-${attempt}.jpg`;
  writeFileSync(out, image.data);
  console.log(`Wrote ${out} (${image.data.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
