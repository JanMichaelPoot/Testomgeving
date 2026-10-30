import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import type { Locale } from "@/lib/locale";
import { glyphFilter } from "@/lib/pdf/ideaBook";

// The printable gift card (improvement brief B3): A5 landscape, or A6 landscape (the same card scaled by 1/sqrt(2), so it is exactly half
// an A5). In the brand's colours: walnut ground, gold double rule, the code on a cream panel. Everything printed is text that the giver
// typed or the code itself, passed through the same glyph filter as the Idea Book so nothing ever renders as an empty box.

export type GiftCardFormat = "a5" | "a6";

export interface GiftCardInput {
  code: string;
  locale: Locale;
  recipientName?: string | null;
  giverName?: string | null;
  message?: string | null;
  /** When the card stops being valid. */
  expiresAt: Date;
  /** The host people are told to visit, without a scheme, e.g. "windowinto.nl". */
  host: string;
  format?: GiftCardFormat;
}

// A5 landscape in points, and the factor from A5 to A6.
const A5_WIDTH = 595.28;
const A5_HEIGHT = 419.53;
const A6_SCALE = Math.SQRT1_2;

const hex = (h: string): RGB => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const C = {
  walnut: hex("#3C2920"),
  cream: hex("#F7F5F0"),
  paper: hex("#FFFDFA"),
  gold: hex("#B08A4A"),
  goldLight: hex("#D2B77A"),
  ink: hex("#202020"),
  muted: hex("#77736C"),
  border: hex("#DED8CE"),
};

const FONTS_DIR = path.join(process.cwd(), "src/lib/pdf/fonts");
const LOGO_DIR = path.join(process.cwd(), "public/logo");

const COPY = {
  nl: {
    eyebrow: "CADEAUBON",
    titleNamed: (name: string) => `Voor ${name}`,
    titleAnon: "Een cadeau voor jou",
    sub: "Een persoonlijk Idea Book vol mogelijkheden, met echte plekken bij jou in de buurt. Kies een paar beelden, wij maken er een boek van.",
    from: (name: string) => `— ${name}`,
    codeLabel: "JOUW CODE",
    redeemAt: "Wissel in op",
    steps: ["Ga naar de pagina hierboven", "Vul je code in", "Kies een paar beelden; je boek is binnen een paar minuten klaar"],
    valid: (date: string) => `Geldig tot ${date}`,
    single: "Eenmalig te gebruiken",
    tagline: "A Window Into What Could Be",
  },
  en: {
    eyebrow: "GIFT VOUCHER",
    titleNamed: (name: string) => `For ${name}`,
    titleAnon: "A gift for you",
    sub: "A personal Idea Book full of possibilities, with real places near you. Pick a few images and we turn them into a book.",
    from: (name: string) => `— ${name}`,
    codeLabel: "YOUR CODE",
    redeemAt: "Redeem at",
    steps: ["Go to the page above", "Enter your code", "Pick a few images; your book is ready in a few minutes"],
    valid: (date: string) => `Valid until ${date}`,
    single: "Single use",
    tagline: "A Window Into What Could Be",
  },
} as const;

function roundedRectPath(width: number, height: number, radius: number): string {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  return [`M ${r},0`, `H ${width - r}`, `A ${r},${r} 0 0 1 ${width},${r}`, `V ${height - r}`, `A ${r},${r} 0 0 1 ${width - r},${height}`, `H ${r}`, `A ${r},${r} 0 0 1 0,${height - r}`, `V ${r}`, `A ${r},${r} 0 0 1 ${r},0`, "Z"].join(" ");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      // A word wider than the line is broken by characters, so nothing runs out of its box.
      const pieces: string[] = [];
      if (font.widthOfTextAtSize(word, size) <= maxWidth) pieces.push(word);
      else {
        let chunk = "";
        for (const ch of word) {
          if (chunk && font.widthOfTextAtSize(chunk + ch, size) > maxWidth) {
            pieces.push(chunk);
            chunk = ch;
          } else chunk += ch;
        }
        if (chunk) pieces.push(chunk);
      }
      for (const piece of pieces) {
        const candidate = line ? `${line} ${piece}` : piece;
        if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
          out.push(line);
          line = piece;
        } else line = candidate;
      }
    }
    out.push(line);
  }
  return out;
}

function trackedWidth(text: string, font: PDFFont, size: number, tracking: number): number {
  let w = 0;
  for (const ch of text) w += font.widthOfTextAtSize(ch, size) + tracking;
  return Math.max(0, w - tracking);
}

function drawTracked(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number, color: RGB, tracking: number) {
  let cursor = x;
  for (const ch of text) {
    page.drawText(ch, { x: cursor, y, size, font, color });
    cursor += font.widthOfTextAtSize(ch, size) + tracking;
  }
}

export function formatCardDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Amsterdam" }).format(date);
}

/** The card as PDF bytes. */
export async function renderGiftCardPdf(input: GiftCardInput): Promise<Uint8Array> {
  const t = COPY[input.locale];
  const s = input.format === "a6" ? A6_SCALE : 1;
  const W = A5_WIDTH;
  const H = A5_HEIGHT;

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(input.locale === "nl" ? "WindowInto cadeaubon" : "WindowInto gift voucher");
  doc.setAuthor("WindowInto");

  const [displayBytes, displayItalicBytes, sansBytes, sansBoldBytes, logoBytes] = await Promise.all([
    readFile(path.join(FONTS_DIR, "CormorantGaramond-SemiBold.ttf")),
    readFile(path.join(FONTS_DIR, "CormorantGaramond-SemiBoldItalic.ttf")),
    readFile(path.join(FONTS_DIR, "PlusJakartaSans-Regular.ttf")),
    readFile(path.join(FONTS_DIR, "PlusJakartaSans-Bold.ttf")),
    readFile(path.join(LOGO_DIR, "windowinto-cream.png")),
  ]);
  const display = await doc.embedFont(displayBytes, { subset: true });
  const displayItalic = await doc.embedFont(displayItalicBytes, { subset: true });
  const sans = await doc.embedFont(sansBytes, { subset: true });
  const sansBold = await doc.embedFont(sansBoldBytes, { subset: true });
  const logo = await doc.embedPng(logoBytes);
  const printable = glyphFilter([display, displayItalic, sans, sansBold]);

  const page = doc.addPage([W * s, H * s]);
  // Everything below is laid out on the A5 sheet and scaled by `s`; the page itself is `s` times as large.
  const X = (n: number) => n * s;
  const fs = (n: number) => Math.max(n * s, 5.2);

  page.drawRectangle({ x: 0, y: 0, width: W * s, height: H * s, color: C.walnut });
  // The double gold rule: a firm outer line and a fine inner one.
  page.drawRectangle({ x: X(14), y: X(14), width: X(W - 28), height: X(H - 28), borderColor: C.gold, borderWidth: Math.max(0.9 * s, 0.5) });
  page.drawRectangle({ x: X(19), y: X(19), width: X(W - 38), height: X(H - 38), borderColor: C.goldLight, borderWidth: Math.max(0.35 * s, 0.25), opacity: 0, borderOpacity: 0.55 });

  // --- left column
  const LEFT = 46;
  const LEFT_W = 304;
  const logoH = 22;
  const logoW = (logo.width / logo.height) * logoH;
  page.drawImage(logo, { x: X(LEFT), y: X(H - 40 - logoH), width: X(logoW), height: X(logoH) });

  drawTracked(page, printable(t.eyebrow), X(LEFT), X(H - 98), sansBold, fs(8.5), C.goldLight, X(2.6));

  const recipient = printable(input.recipientName?.trim() ?? "");
  const title = recipient ? t.titleNamed(recipient) : t.titleAnon;
  let titleSize = 40;
  let titleLines = wrap(title, display, titleSize, LEFT_W);
  while ((titleLines.length > 2 || titleLines.some((l) => display.widthOfTextAtSize(l, titleSize) > LEFT_W)) && titleSize > 24) {
    titleSize -= 2;
    titleLines = wrap(title, display, titleSize, LEFT_W);
  }
  titleLines = titleLines.slice(0, 2);
  let y = H - 98 - titleSize * 1.05;
  for (const line of titleLines) {
    page.drawText(line, { x: X(LEFT), y: X(y), size: fs(titleSize), font: display, color: C.cream });
    y -= titleSize * 1.0;
  }

  y -= 10;
  for (const line of wrap(printable(t.sub), sans, 10, LEFT_W).slice(0, 4)) {
    page.drawText(line, { x: X(LEFT), y: X(y), size: fs(10), font: sans, color: rgb(0.86, 0.83, 0.78) });
    y -= 14;
  }

  // The giver's message and name take whatever room is left above the footer, at the largest size that fits.
  const message = printable((input.message ?? "").trim());
  const giver = printable((input.giverName ?? "").trim());
  const FOOTER_Y = 46;
  if (message || giver) {
    y -= 12;
    const room = y - (FOOTER_Y + 24);
    const signatureH = giver ? 18 : 0;
    if (message) {
      let size = 16;
      let lines = wrap(`“${message}”`, displayItalic, size, LEFT_W);
      while (lines.length * size * 1.18 + signatureH > room && size > 10) {
        size -= 0.5;
        lines = wrap(`“${message}”`, displayItalic, size, LEFT_W);
      }
      const maxLines = Math.max(1, Math.floor((room - signatureH) / (size * 1.18)));
      if (lines.length > maxLines) {
        lines = lines.slice(0, maxLines);
        lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[\s,.;:!?]+$/, "")}…`;
      }
      for (const line of lines) {
        page.drawText(line, { x: X(LEFT), y: X(y), size: fs(size), font: displayItalic, color: C.goldLight });
        y -= size * 1.18;
      }
    }
    if (giver) {
      y -= 6;
      page.drawText(t.from(giver), { x: X(LEFT), y: X(y), size: fs(10), font: sansBold, color: C.cream });
    }
  }

  page.drawText(printable(t.tagline), { x: X(LEFT), y: X(FOOTER_Y), size: fs(8), font: displayItalic, color: C.goldLight });

  // --- right panel: the code
  const PX = 372;
  const PW = W - 46 - PX;
  const PY = 52;
  const PH = H - 52 - 52;
  const PAD = 15;
  page.drawSvgPath(roundedRectPath(X(PW), X(PH), X(14)), { x: X(PX), y: X(PY + PH), color: C.cream });
  const innerW = PW - PAD * 2;

  let py = PY + PH - 30;
  drawTracked(page, printable(t.codeLabel), X(PX + PAD), X(py), sansBold, fs(7.2), C.muted, X(1.9));
  py -= 8;
  page.drawLine({ start: { x: X(PX + PAD), y: X(py) }, end: { x: X(PX + PW - PAD), y: X(py) }, thickness: Math.max(0.6 * s, 0.4), color: C.gold });

  // The code on one line, at the largest size that fits the panel.
  let codeSize = 17;
  while (trackedWidth(input.code, sansBold, codeSize, 0.6) > innerW && codeSize > 9) codeSize -= 0.5;
  py -= 26;
  drawTracked(page, input.code, X(PX + PAD), X(py), sansBold, fs(codeSize), C.ink, X(0.6));

  py -= 30;
  page.drawText(printable(t.redeemAt), { x: X(PX + PAD), y: X(py), size: fs(8), font: sans, color: C.muted });
  py -= 13;
  let hostSize = 11.5;
  const hostText = `${input.host}/cadeau`;
  while (sansBold.widthOfTextAtSize(hostText, hostSize) > innerW && hostSize > 7) hostSize -= 0.5;
  page.drawText(hostText, { x: X(PX + PAD), y: X(py), size: fs(hostSize), font: sansBold, color: C.walnut });

  py -= 26;
  t.steps.forEach((step, i) => {
    const lines = wrap(printable(step), sans, 8.5, innerW - 16);
    page.drawCircle({ x: X(PX + PAD + 5), y: X(py + 3), size: X(5.5), color: C.walnut });
    const num = String(i + 1);
    page.drawText(num, { x: X(PX + PAD + 5) - sansBold.widthOfTextAtSize(num, fs(7)) / 2, y: X(py + 0.6), size: fs(7), font: sansBold, color: C.cream });
    lines.forEach((line, j) => {
      page.drawText(line, { x: X(PX + PAD + 16), y: X(py - j * 11), size: fs(8.5), font: sans, color: C.ink });
    });
    py -= Math.max(1, lines.length) * 11 + 7;
  });

  const bottomY = PY + 24;
  page.drawLine({ start: { x: X(PX + PAD), y: X(bottomY + 20) }, end: { x: X(PX + PW - PAD), y: X(bottomY + 20) }, thickness: Math.max(0.5 * s, 0.35), color: C.border });
  page.drawText(printable(t.valid(formatCardDate(input.expiresAt, input.locale))), { x: X(PX + PAD), y: X(bottomY + 6), size: fs(8.5), font: sansBold, color: C.ink });
  page.drawText(printable(t.single), { x: X(PX + PAD), y: X(bottomY - 6), size: fs(7.5), font: sans, color: C.muted });

  return doc.save();
}
