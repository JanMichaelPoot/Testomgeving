import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../src/lib/pdf/fonts");
const b64 = (f) => readFileSync(path.join(dir, f)).toString("base64");

/** @font-face rules with the app's own brand fonts embedded (OFL licensed; see src/lib/pdf/fonts/OFL-*.txt). */
export function fontFaceCss({ cormorant = true } = {}) {
  const face = (family, file, weight, style = "normal") =>
    `@font-face{font-family:"${family}";src:url(data:font/ttf;base64,${b64(file)}) format("truetype");font-weight:${weight};font-style:${style};}`;
  return [
    face("Plus Jakarta Sans", "PlusJakartaSans-Regular.ttf", "300 500"),
    face("Plus Jakarta Sans", "PlusJakartaSans-Bold.ttf", "600 800"),
    face("Newsreader", "Newsreader-Medium.ttf", "400 700"),
    face("Newsreader", "Newsreader-Italic.ttf", "400 700", "italic"),
    ...(cormorant ? [face("Cormorant Garamond", "CormorantGaramond-SemiBold.ttf", "400 700"), face("Cormorant Garamond", "CormorantGaramond-SemiBoldItalic.ttf", "400 700", "italic")] : []),
  ].join("\n");
}
