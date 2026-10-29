import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import {
  degrees,
  PDFBool,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFString,
  clip,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  type PDFFont,
  type PDFPage,
  type PDFImage,
  type RGB,
} from "pdf-lib";
import { DIFFICULTY_LABELS, type GeneratedIdeaBook, type IdeaBookEntry } from "@/lib/claude/generateIdeaBook";
import { hasMoreLayers, pdfPageNumbers } from "@/lib/claude/ideaLayers";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/language";
import { mapsSearchUrl } from "@/lib/maps";
import { ideaPhoto } from "@/lib/illustrations";
import { buildScrimPng } from "@/lib/pdf/scrim";
import { DOOR_ORDER, orderIdeasByDoor, pickOneThingIndex } from "@/lib/possibilityMap";
import {
  EXPERIENCE_DIMENSIONS,
  activityKindFor,
  budgetStatusFor,
  editorialFor,
  experienceProfileFor,
  extractUrl,
  replaceUrl,
  fillTemplate,
  ideaPageLabels,
  kindCopy,
  pickStable,
  scheduleFor,
  scheduleFromLines,
  timeFits,
  type IdeaPageLabels,
} from "@/lib/pdf/ideaContent";
import { fillConflicts, fillContext, normalizeFill, withoutConflicts } from "@/lib/claude/ideaFill";
import { getActivity } from "@/lib/discovery/library";
import { knowledgeWritingV2Enabled } from "@/lib/knowledgeFlags";

// pdf-lib has no first-class "add a hyperlink" API, so a clickable region
// is a manually-built Link annotation — a standard, documented technique
// for this library, not a hack specific to this file.
function addLinkAnnotation(
  page: PDFPage,
  rect: { x: number; y: number; width: number; height: number },
  url: string
) {
  const annotRef = page.doc.context.register(
    page.doc.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [rect.x, rect.y, rect.x + rect.width, rect.y + rect.height],
      Border: [0, 0, 0],
      A: {
        Type: "Action",
        S: "URI",
        URI: PDFString.of(url),
      },
    })
  );
  page.node.addAnnot(annotRef);
}

const PAGE_WIDTH = 595.28; // A4 in points
const PAGE_HEIGHT = 841.89;
const MARGIN = 60; // continuation-page overflow safety net only, see newPageIfNeeded

// --- PossibilityPageA4 design system (whole book) -------------------------
// Originally scoped to the idea/wildcard pages only (Stap 36/41, design
// published at https://claude.ai/artifact/RjoS7G6YeDZQJWRdn8RVyT) while the
// cover/profile/possibility-map pages stayed on an older, disconnected
// "Warm Walnut" dark-glass-card look. This step (PDF-opzet) extends the
// same design system to those three pages too — one visual language for
// the whole book instead of two — and adds the actual WindowInto wordmark
// (public/logo/windowinto-cream.png on photos, windowinto-color.png on
// light surfaces) in place of the design's plain-text "WINDOW" placeholder,
// per the explicit request behind this change.
//
// Three deliberate departures from the source spec (unchanged from before):
// 1. Fonts: the spec names Lora + Inter. This project already bundles
//    Noto Serif/Sans as self-hosted TTFs (no network font loading during
//    generation, already verified for Dutch accented characters — see
//    Stap 8's font-format bug) — reusing them avoids adding and licensing
//    two more families for a serif-display + sans-body pairing that's
//    already the same shape. Weight 600 (body-strong) maps to the bundled
//    Bold (700); weight 500 (caption) maps to Regular (400) — the two
//    weights this project's fonts don't have.
// 2. The spec's outer page card (rounded corners + hairline border, meant
//    for its own on-screen preview) is dropped: this PDF is a real,
//    printable A4 page, and every other page in this book is already
//    full-bleed with no card-on-background treatment — a rounded outer
//    card would read as a floating screenshot, not a print page. The hero
//    photo's top corners are therefore square, not radius-lg.
// 3. The "Concrete opties" panel (a named option + one-sentence
//    description) is omitted. IdeaBookEntry has no separate option-name/
//    description field — Stap 36 removed the multi-option array
//    specifically to cut generation cost, and Stap 41 cut it further.
//    Showing it from `location` instead would just repeat the location
//    line directly below it, so the location line (pin + name + map link)
//    alone covers the spec's separate "Location line" element.
//
// Every px figure in the spec is 96 CSS px/in; PDF points are 72/in, so
// every constant below is the spec's px value × 0.75.
// "Het venster" fase 6: the book now speaks the site's brand: walnut ink (#3C2920, the site's
// --color-accent-dark) and gold (#B08A4A, --color-gold) instead of the old orange accent, and
// Newsreader + Plus Jakarta Sans (the site's fonts, OFL, bundled in ./fonts) instead of Noto.
// The colours of the whole book: ivory and gold (chosen by Jan on 25 Oct 2026 from three options, after the
// walnut look was found to be too brown). Deep slate-blue ink on warm ivory paper, gold foil lines, and
// a gilded window on the cover with a fine double border like a collector's edition. One object, so
// the whole book can be re-coloured in one place.
interface PdfTheme {
  ink: RGB;
  inkMuted: RGB;
  inkInverse: RGB;
  surfacePage: RGB;
  surfacePanel: RGB;
  surfaceInverse: RGB;
  accent: RGB;
  accentLight: RGB;
  /** The dark colour of the gradient over photos. */
  scrim: RGB;
  /** A wash over the profile page's photo, so the shared warm background photo sits with the colours. */
  wash: { color: RGB; opacity: number };
  cover: {
    bg: RGB;
    /** The window's frame and mullions. */
    frame: RGB;
    sillBand: RGB;
    sillText: RGB;
    eyebrow: RGB;
    title: RGB;
    tagline: RGB;
    logo: "cream" | "color";
    /** A fine double line round the page and a small diamond rule under the title. */
    collector: boolean;
  };
}

const hex = (h: string): RGB => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);

const theme: PdfTheme = {
  ink: hex("#1F2A3C"),
  inkMuted: hex("#5C6676"),
  inkInverse: hex("#FFFDF8"),
  surfacePage: hex("#FFFEFB"),
  surfacePanel: hex("#F7F2E8"),
  surfaceInverse: hex("#1F2A3C"),
  accent: hex("#A8812F"),
  accentLight: hex("#D6B866"),
  scrim: hex("#0E1522"),
  wash: { color: hex("#F8F3E8"), opacity: 0.32 },
  cover: {
    bg: hex("#F8F3E8"),
    frame: hex("#B08A4A"),
    sillBand: hex("#EFE6D3"),
    sillText: hex("#5C4A1E"),
    eyebrow: hex("#A8812F"),
    title: hex("#1F2A3C"),
    tagline: hex("#4B5566"),
    logo: "color",
    collector: true,
  },
};

const PWA4_INK = theme.ink;
const PWA4_INK_MUTED = theme.inkMuted;
const PWA4_INK_INVERSE = theme.inkInverse;
const PWA4_SURFACE_PAGE = theme.surfacePage;
const PWA4_SURFACE_PANEL = theme.surfacePanel;
const PWA4_SURFACE_INVERSE = theme.surfaceInverse;
const PWA4_ACCENT = theme.accent;
const PWA4_GOLD_LIGHT = theme.accentLight;
const PWA4_SCRIM_RGB = theme.scrim;

const PWA4_BODY_PAD_X = 21; // space-6, 28px
const PWA4_SPACE_2 = 6; // 8px
const PWA4_SPACE_3 = 9; // 12px
const PWA4_SPACE_4 = 12; // 16px
const PWA4_SPACE_5 = 15; // 20px
const PWA4_SPACE_7 = 30; // 40px
const PWA4_RADIUS_SM = 7.5; // 10px
const PWA4_RADIUS_MD = 15; // 20px
const PWA4_CONTENT_WIDTH = PAGE_WIDTH - PWA4_BODY_PAD_X * 2;

// The spec's own "spark" glyph beside "BEGIN HIER", exactly as given in its
// reference preview (viewBox 0 0 24 24) — built from straight-line M/L/l
// commands only, so it's safe to uniformly scale every number (unlike an
// arc-based path, where scaling would also corrupt the large-arc/sweep
// flags).
const PWA4_SPARK_PATH_24 = "M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2z";

function scaleLinearSvgPath(pathData: string, scale: number): string {
  return pathData.replace(/-?\d*\.?\d+/g, (n) => String(Math.round(parseFloat(n) * scale * 100) / 100));
}

// Width of a manually letter-spaced line (see drawTrackedLine) — needed
// wherever a tracked eyebrow label's width determines a box's size.
function trackedTextWidth(text: string, font: PDFFont, size: number, tracking: number): number {
  let w = 0;
  for (const ch of text) w += font.widthOfTextAtSize(ch, size) + tracking;
  return Math.max(0, w - tracking);
}

const FONTS_DIR = path.join(process.cwd(), "src/lib/pdf/fonts");
const IMAGES_DIR = path.join(process.cwd(), "public/illustrations/idea-book");
const LOGO_DIR = path.join(process.cwd(), "public/logo");

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
  maxLines?: number
): string[] {
  // A single "word" wider than the whole line (a long web address) can't be
  // wrapped at a space, so it is broken across lines instead of running out
  // of its box.
  const words = text
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((word) => {
      if (font.widthOfTextAtSize(word, size) <= maxWidth) return [word];
      const chunks: string[] = [];
      let chunk = "";
      for (const ch of word) {
        if (chunk && font.widthOfTextAtSize(chunk + ch, size) > maxWidth) {
          chunks.push(chunk);
          chunk = ch;
        } else {
          chunk += ch;
        }
      }
      if (chunk) chunks.push(chunk);
      return chunks;
    });
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  if (maxLines !== undefined && lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last.length > 0 && font.widthOfTextAtSize(`${last}…`, size) > maxWidth) {
      last = last.slice(0, -1).trimEnd();
    }
    kept[maxLines - 1] = `${last}…`;
    return kept;
  }

  return lines;
}

// A rounded-rectangle SVG path, top-left origin, Y increasing downward
// (standard SVG convention) — pdf-lib's drawSvgPath flips this to match
// the page's own upward-Y space, so passing the panel's top-left corner
// as {x, y} draws it exactly where expected. This is what gives every
// card in the book its "subtiel afgeronde" corners; pdf-lib's plain
// drawRectangle has no radius option at all.
function roundedRectPath(width: number, height: number, radius: number): string {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  return [
    `M ${r},0`,
    `H ${width - r}`,
    `A ${r},${r} 0 0 1 ${width},${r}`,
    `V ${height - r}`,
    `A ${r},${r} 0 0 1 ${width - r},${height}`,
    `H ${r}`,
    `A ${r},${r} 0 0 1 0,${height - r}`,
    `V ${r}`,
    `A ${r},${r} 0 0 1 ${r},0`,
    "Z",
  ].join(" ");
}

interface Fonts {
  /** Cormorant Garamond SemiBold: the display face for titles (the book's "luxury" voice). */
  display: PDFFont;
  /** Its italic, for the tagline, the profile quote and the sensory scene. */
  displayItalic: PDFFont;
  serif: PDFFont;
  sans: PDFFont;
  sansBold: PDFFont;
}

interface Images {
  cover: PDFImage;
  background: PDFImage;
  logoCream: PDFImage; // reversed wordmark — for dark photo/scrim backgrounds
  logoColor: PDFImage; // walnut wordmark — for light surface-page backgrounds
  scrim: PDFImage; // 1px-wide alpha gradient (transparent top to opaque bottom), see scrim.ts
}

// Asks the viewer to interpolate a stretched image (and its alpha mask) instead of showing it
// in blocks. The scrim is 1 pixel wide and stretched over a whole page, so without this some
// viewers would show its 256 rows as visible steps.
function smoothImage(doc: PDFDocument, image: PDFImage) {
  try {
    const stream = doc.context.lookup(image.ref);
    const dict = (stream as { dict?: PDFDict }).dict;
    if (!dict) return;
    dict.set(PDFName.of("Interpolate"), PDFBool.True);
    const mask = dict.get(PDFName.of("SMask"));
    const maskStream = mask ? doc.context.lookup(mask) : undefined;
    (maskStream as { dict?: PDFDict } | undefined)?.dict?.set(PDFName.of("Interpolate"), PDFBool.True);
  } catch {
    // Purely cosmetic: without the flag the gradient still has 256 fine steps.
  }
}

// "Cover" fit (like CSS background-size: cover): scales so both dimensions
// are at least as large as the box, so drawing at this size and centering
// always fills the box completely — any excess simply falls outside the
// page's MediaBox, which is how PDF viewers/printers naturally crop it,
// the standard technique for a full-bleed image.
function coverFitSize(image: PDFImage, boxWidth: number, boxHeight: number) {
  const scale = Math.max(boxWidth / image.width, boxHeight / image.height);
  return { width: image.width * scale, height: image.height * scale };
}

// Characters the brand fonts lack, mapped to something they have; anything else unknown is
// dropped. Applied to every string of the book before drawing (see renderIdeaBookPdf).
const GLYPH_FALLBACKS: Record<string, string> = {
  "→": "->", "←": "<-", "⇒": "=>", "✓": "v", "✔": "v", "✗": "x", "★": "*", "☆": "*", "•": "·",
  "\u00a0": " ", "\u2009": " ", "\u202f": " ", "\u200b": "",
};

export function glyphFilter(fonts: PDFFont[]): (text: string) => string {
  const sets = fonts.map((f) => new Set(f.getCharacterSet()));
  const ok = (cp: number) => sets.every((set) => set.has(cp));
  return (text: string) => {
    let out = "";
    for (const ch of text) {
      const cp = ch.codePointAt(0)!;
      if (ch === "\n" || ok(cp)) out += ch;
      else if (GLYPH_FALLBACKS[ch] !== undefined && [...GLYPH_FALLBACKS[ch]].every((c) => ok(c.codePointAt(0)!))) out += GLYPH_FALLBACKS[ch];
    }
    return out;
  };
}

/** Every string in the book passed through `clean`; structure and non-strings untouched. */
export function makeBookPrintable<T>(value: T, clean: (text: string) => string): T {
  if (typeof value === "string") return clean(value) as T;
  if (Array.isArray(value)) return value.map((v) => makeBookPrintable(v, clean)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, makeBookPrintable(v, clean)])) as T;
  }
  return value;
}

// What the renderer may know about the person beyond the generated book — all
// optional: without it the idea pages simply leave out the company cell, the
// budget status and the derived "it fits" sentence.
export interface IdeaBookPdfContext {
  company?: string[]; // stored intake values, e.g. ["alone"]
  budget?: string; // "free" | "25" | "100" | "allin"
  timeAvailable?: string; // "hour" | "halfday" | "fullday" | "weekend"
  // "Het venster" fase 6: books from the image intake get the person's own window on the
  // cover (four panes of chosen images, public paths), the window sill and, for a gift, the
  // recipient's name. Without it the cover keeps its photo.
  window?: {
    panes: { label: string; images: string[]; placeholder?: string }[];
    sill: string;
    recipientName?: string;
    dateLabel: string;
  };
  // R2.2: per activity id the thread behind the door in one sentence ("Bij deze deur hoort het
  // beeld ... daarin lazen we ..."), added to "Waarom dit bij jou past". Only real connections.
  threadLines?: Record<string, string>;
}

export async function renderIdeaBookPdf(
  inputBook: GeneratedIdeaBook,
  title: string,
  locale: Locale,
  context: IdeaBookPdfContext = {}
): Promise<Uint8Array> {
  let book = inputBook;
  const dict = getDictionary(locale);
  const chrome = dict.pdfChrome;
  // Fase 5 (PDF & Share) — the printed book now reflects the same
  // Open Doors structure as the web experience (Fase 4): ideas are laid
  // out in door order rather than Claude's raw array order, a new
  // Possibility Map page mirrors the web's door legend + One Thing
  // highlight, and each idea page's eyebrow now names its door. Reuses
  // the exact same pure helpers the web viewer uses (src/lib/possibilityMap.ts)
  // so the two experiences can never quietly drift apart.
  const mapCopy = dict.plan.book;
  // Fixed page plan (cover, profile, overview, one page per ordered idea,
  // wildcard) — used to print real "p. N" references on the overview page
  // instead of a placeholder.
  const FIRST_IDEA_PAGE = 4;
  // An idea with extra layers (R2.3) has a second page, so later ideas move on by one.
  const pdfPages = pdfPageNumbers(orderIdeasByDoor(inputBook.ideas).map((e) => e.idea), FIRST_IDEA_PAGE);

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const [serifBytes, displayBytes, displayItalicBytes, sansBytes, sansBoldBytes] = await Promise.all([
    readFile(path.join(FONTS_DIR, "Newsreader-Medium.ttf")),
    readFile(path.join(FONTS_DIR, "CormorantGaramond-SemiBold.ttf")),
    readFile(path.join(FONTS_DIR, "CormorantGaramond-SemiBoldItalic.ttf")),
    readFile(path.join(FONTS_DIR, "PlusJakartaSans-Regular.ttf")),
    readFile(path.join(FONTS_DIR, "PlusJakartaSans-Bold.ttf")),
  ]);

  const fonts: Fonts = {
    display: await doc.embedFont(displayBytes, { subset: true }),
    displayItalic: await doc.embedFont(displayItalicBytes, { subset: true }),
    serif: await doc.embedFont(serifBytes, { subset: true }),
    sans: await doc.embedFont(sansBytes, { subset: true }),
    sansBold: await doc.embedFont(sansBoldBytes, { subset: true }),
  };
  // The brand fonts cover Latin text (all Dutch and English diacritics, €, curly quotes) but
  // not the long tail Noto had (arrows, symbols, emoji). Anything outside every font's
  // character set is replaced or dropped before drawing, so no glyph ever renders as a box.
  book = makeBookPrintable(book, glyphFilter([fonts.display, fonts.displayItalic, fonts.serif, fonts.sans, fonts.sansBold]));
  const orderedIdeas = orderIdeasByDoor(book.ideas);
  const oneThingIndex = pickOneThingIndex(book.ideas);

  const [coverBytes, backgroundBytes, logoCreamBytes, logoColorBytes] = await Promise.all([
    readFile(path.join(IMAGES_DIR, "cover.jpg")),
    readFile(path.join(IMAGES_DIR, "background.jpg")),
    readFile(path.join(LOGO_DIR, "windowinto-cream.png")),
    readFile(path.join(LOGO_DIR, "windowinto-color.png")),
  ]);

  const images: Images = {
    cover: await doc.embedJpg(coverBytes),
    background: await doc.embedJpg(backgroundBytes),
    logoCream: await doc.embedPng(logoCreamBytes),
    logoColor: await doc.embedPng(logoColorBytes),
    scrim: await doc.embedPng(buildScrimPng([PWA4_SCRIM_RGB.red * 255, PWA4_SCRIM_RGB.green * 255, PWA4_SCRIM_RGB.blue * 255].map(Math.round) as [number, number, number])),
  };
  smoothImage(doc, images.scrim);

  // One photo per idea (plus the wildcard), chosen by that idea's own
  // photo_category — see ideaCategoryPhoto()/PHOTO_CATEGORIES in
  // lib/illustrations.ts and the system prompt in generateIdeaBook.ts.
  // Loaded on demand here (still a local file read of a pre-generated,
  // committed asset — never a live Gemini call) rather than up front,
  // since which categories are needed depends on this specific book.
  const ideaPhotoCache = new Map<string, PDFImage>();
  // "Het venster" fase 5: an idea from the selection engine uses its activity's own photo.
  async function loadIdeaPhoto(idea: IdeaBookEntry, variantSeed: number): Promise<PDFImage> {
    const publicPath = ideaPhoto(idea, variantSeed);
    const cached = ideaPhotoCache.get(publicPath);
    if (cached) return cached;
    const bytes = await readFile(path.join(process.cwd(), "public", publicPath));
    const image = await doc.embedJpg(bytes);
    ideaPhotoCache.set(publicPath, image);
    return image;
  }

  // The person's window, drawn the way WindowFrame draws it on the site: an arch on top, four
  // panes with walnut mullions, each pane a collage of its chosen photos (clipped to its cell),
  // an empty pane in cream, a fine gold line along the inside of the frame.
  async function drawCoverWindow(
    target: PDFPage,
    panes: NonNullable<IdeaBookPdfContext["window"]>["panes"],
    x0: number,
    y0: number,
    w: number,
    h: number,
  ) {
    const pad = 7;
    const gap = 3.5;
    const ix = x0 + pad;
    const iy = y0 + pad;
    const iw = w - pad * 2;
    const ih = h - pad * 2;
    const top = iy + ih;
    const qw = (iw - gap) / 2;
    const qh = (ih - gap) / 2;
    const cells = [
      { x: ix, y: iy + qh + gap },
      { x: ix + qw + gap, y: iy + qh + gap },
      { x: ix, y: iy },
      { x: ix + qw + gap, y: iy },
    ];
    target.drawRectangle({ x: x0, y: y0, width: w, height: h, color: theme.cover.frame });

    for (const [i, pane] of panes.slice(0, 4).entries()) {
      const cell = cells[i];
      const photos = pane.images.slice(0, 4);
      if (photos.length === 0) {
        target.drawRectangle({ x: cell.x, y: cell.y, width: qw, height: qh, color: pane.placeholder ? PWA4_GOLD_LIGHT : rgb(0.949, 0.925, 0.882) });
        if (pane.placeholder) {
          const pw = fonts.serif.widthOfTextAtSize(pane.placeholder, 12);
          target.drawText(pane.placeholder, { x: cell.x + (qw - pw) / 2, y: cell.y + qh / 2 - 4, size: 12, font: fonts.serif, color: PWA4_INK });
        }
      } else {
        // 1 photo fills the cell; 2 side by side; 3 = one tall + two small; 4 = a 2x2 grid.
        const g = 1.5;
        const slots =
          photos.length === 1
            ? [{ x: 0, y: 0, w: qw, h: qh }]
            : photos.length === 2
              ? [{ x: 0, y: 0, w: (qw - g) / 2, h: qh }, { x: (qw + g) / 2, y: 0, w: (qw - g) / 2, h: qh }]
              : photos.length === 3
                ? [
                    { x: 0, y: 0, w: (qw - g) / 2, h: qh },
                    { x: (qw + g) / 2, y: (qh + g) / 2, w: (qw - g) / 2, h: (qh - g) / 2 },
                    { x: (qw + g) / 2, y: 0, w: (qw - g) / 2, h: (qh - g) / 2 },
                  ]
                : [
                    { x: 0, y: (qh + g) / 2, w: (qw - g) / 2, h: (qh - g) / 2 },
                    { x: (qw + g) / 2, y: (qh + g) / 2, w: (qw - g) / 2, h: (qh - g) / 2 },
                    { x: 0, y: 0, w: (qw - g) / 2, h: (qh - g) / 2 },
                    { x: (qw + g) / 2, y: 0, w: (qw - g) / 2, h: (qh - g) / 2 },
                  ];
        for (const [k, src] of photos.entries()) {
          const slot = slots[k];
          let img: PDFImage;
          try {
            img = await loadPublicJpg(src);
          } catch {
            continue; // a missing photo leaves its slot dark rather than failing the book
          }
          const fit = coverFitSize(img, slot.w, slot.h);
          const sx = cell.x + slot.x;
          const sy = cell.y + slot.y;
          target.pushOperators(pushGraphicsState(), rectangle(sx, sy, slot.w, slot.h), clip(), endPath());
          target.drawImage(img, { x: sx + (slot.w - fit.width) / 2, y: sy + (slot.h - fit.height) / 2, width: fit.width, height: fit.height });
          target.pushOperators(popGraphicsState());
        }
      }
      // Pane label on a soft dark band at the bottom of the cell.
      target.drawRectangle({ x: cell.x, y: cell.y, width: qw, height: 15, color: PWA4_SCRIM_RGB, opacity: 0.45 });
      target.drawText(pane.label.toUpperCase(), { x: cell.x + 5, y: cell.y + 4.5, size: 6.5, font: fonts.sansBold, color: PWA4_INK_INVERSE });
    }

    // The arch: fill the two top corners with the frame colour, then the gold line.
    const rx = iw / 2;
    const ry = ih * 0.3;
    const k = 0.5523;
    const frame = theme.cover.frame;
    const left = `M 0 0 L 0 ${ry} C 0 ${ry - k * ry} ${rx - k * rx} 0 ${rx} 0 Z`;
    const right = `M ${iw} 0 L ${iw} ${ry} C ${iw} ${ry - k * ry} ${rx + k * rx} 0 ${rx} 0 Z`;
    target.drawSvgPath(left, { x: ix, y: top, color: frame });
    target.drawSvgPath(right, { x: ix, y: top, color: frame });
    // The outer frame follows the same arch, a little larger, so the frame keeps its width.
    const orx = w / 2;
    const ory = ry + pad;
    const outerLeft = `M 0 0 L 0 ${ory} C 0 ${ory - k * ory} ${orx - k * orx} 0 ${orx} 0 Z`;
    const outerRight = `M ${w} 0 L ${w} ${ory} C ${w} ${ory - k * ory} ${orx + k * orx} 0 ${orx} 0 Z`;
    target.drawSvgPath(outerLeft, { x: x0, y: y0 + h, color: theme.cover.bg });
    target.drawSvgPath(outerRight, { x: x0, y: y0 + h, color: theme.cover.bg });
    // A hairline of the cover colour round the whole window hides the seam where the arch corners meet the frame (visible on a light cover).
    target.drawRectangle({ x: x0 - 0.75, y: y0 - 0.75, width: w + 1.5, height: h + 1.5, borderColor: theme.cover.bg, borderWidth: 3 });
    const outline = `M 0 ${ih} L 0 ${ry} C 0 ${ry - k * ry} ${rx - k * rx} 0 ${rx} 0 C ${rx + k * rx} 0 ${iw} ${ry - k * ry} ${iw} ${ry} L ${iw} ${ih} Z`;
    target.drawSvgPath(outline, { x: ix, y: top, borderColor: PWA4_GOLD_LIGHT, borderWidth: 0.9, opacity: 0, borderOpacity: 0.85 });
  }

  // Any public JPG (association and domain photos for the cover), cached per path.
  const publicJpgCache = new Map<string, PDFImage>();
  async function loadPublicJpg(publicPath: string): Promise<PDFImage> {
    const cached = publicJpgCache.get(publicPath);
    if (cached) return cached;
    const image = await doc.embedJpg(await readFile(path.join(process.cwd(), "public", publicPath)));
    publicJpgCache.set(publicPath, image);
    return image;
  }

  function addPage(): PDFPage {
    const newPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    newPage.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      color: PWA4_SURFACE_PAGE,
    });
    return newPage;
  }

  let page: PDFPage;
  let y = 0;
  // When true, every drawing helper below still moves the `y` cursor
  // exactly as it would when drawing for real, but skips the actual
  // page.draw* calls — lets a card's real height be measured by running
  // its own content-drawing function once "dry" before drawing it again
  // for real, instead of duplicating the layout logic in a second,
  // easy-to-desync measurement function.
  let dryRun = false;

  // A page-margin safety net only — the primary defense against overflow
  // is the tightened Claude schema (exactly 6 ideas, exactly 3 steps) plus
  // the maxLines caps below. This just stops a pathological response from
  // corrupting the layout instead of guaranteeing the fixed card zones.
  function newPageIfNeeded(nextLineHeight: number) {
    if (!dryRun && y - nextLineHeight < MARGIN) {
      page = addPage();
      y = PAGE_HEIGHT - MARGIN;
    }
  }

  // Draws one line of text with manual per-character advance — pdf-lib has
  // no native letter-spacing/tracking, so a tracked look (used for the
  // small-caps section labels, for that editorial feel) means placing
  // each glyph by hand instead of one drawText call.
  function drawTrackedLine(
    text: string,
    font: PDFFont,
    size: number,
    color: RGB,
    x: number,
    lineY: number,
    tracking: number
  ) {
    let cursor = x;
    for (const ch of text) {
      if (!dryRun) page.drawText(ch, { x: cursor, y: lineY, size, font, color });
      cursor += font.widthOfTextAtSize(ch, size) + tracking;
    }
  }

  function drawParagraph(
    text: string,
    font: PDFFont,
    size: number,
    color = PWA4_INK,
    lineGap = 6,
    x = PWA4_BODY_PAD_X,
    maxWidth = PWA4_CONTENT_WIDTH,
    maxLines?: number,
    options?: { tracking?: number }
  ) {
    const tracking = options?.tracking ?? 0;
    const lines = wrapText(text, font, size, maxWidth, maxLines);
    for (const line of lines) {
      newPageIfNeeded(size + lineGap);
      if (tracking > 0) {
        drawTrackedLine(line, font, size, color, x, y, tracking);
      } else if (!dryRun) {
        page.drawText(line, { x, y, size, font, color });
      }
      y -= size + lineGap;
    }
  }

  // Fills the whole page with an image at "cover" size, centered by
  // default — any overflow beyond the page edges is simply outside the
  // MediaBox and never rendered, the standard full-bleed technique. An
  // optional horizontal pan (-1..1, a fraction of the available overflow)
  // gives the same shared background photo a slightly different crop from
  // page to page instead of looking pixel-identical seven times in a row.
  function drawFullBleedImage(image: PDFImage, panX = 0) {
    const { width, height } = coverFitSize(image, PAGE_WIDTH, PAGE_HEIGHT);
    const maxShiftX = Math.max(0, (width - PAGE_WIDTH) / 2);
    const x = (PAGE_WIDTH - width) / 2 + panX * maxShiftX;
    const y0 = (PAGE_HEIGHT - height) / 2;
    page.drawImage(image, { x, y: y0, width, height });
  }

  // Draws an image top-aligned across the full page width, cover-fit to
  // `bandHeight`, then paints any cover-fit overflow below the band back
  // to the page surface colour — the same "fill then mask the overflow"
  // technique pwa4DrawHero already uses for the idea-page hero.
  function drawPhotoBand(image: PDFImage, bandHeight: number, panX = 0) {
    const { width, height } = coverFitSize(image, PAGE_WIDTH, bandHeight);
    const maxShiftX = Math.max(0, (width - PAGE_WIDTH) / 2);
    const x = (PAGE_WIDTH - width) / 2 + panX * maxShiftX;
    page.drawImage(image, { x, y: PAGE_HEIGHT - height, width, height });
    page.drawRectangle({ x: 0, y: PAGE_HEIGHT - bandHeight, width: PAGE_WIDTH, height: bandHeight, color: theme.wash.color, opacity: theme.wash.opacity });
    page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT - bandHeight, color: PWA4_SURFACE_PAGE });
  }

  // A rounded, radius-full pill chip (must-have/preference tags on the
  // profile page) — hugs its own text width rather than the full content
  // width, like pwa4DrawCostChip's inline-chip treatment.
  function drawPill(text: string, x: number, topY: number, bg: RGB, textColor: RGB): number {
    const size = 9.75;
    const padX = PWA4_SPACE_3;
    const height = size + 10;
    const textWidth = fonts.sansBold.widthOfTextAtSize(text, size);
    const width = textWidth + padX * 2;
    if (!dryRun) {
      page.drawSvgPath(roundedRectPath(width, height, height / 2), { x, y: topY, color: bg });
      page.drawText(text, { x: x + padX, y: topY - height + (height - size) / 2 + 1, size, font: fonts.sansBold, color: textColor });
    }
    return width;
  }

  // Flows a row of pills left-to-right at the page's body margin, wrapping
  // onto as many rows as needed, and moves the shared `y` cursor down by
  // the total height used.
  function drawPillRow(items: string[], bg: RGB, textColor: RGB) {
    const rowHeight = 9.75 + 10;
    let cursorX = PWA4_BODY_PAD_X;
    let rowY = y;
    for (const item of items) {
      const width = fonts.sansBold.widthOfTextAtSize(item, 9.75) + PWA4_SPACE_3 * 2;
      if (cursorX + width > PWA4_BODY_PAD_X + PWA4_CONTENT_WIDTH && cursorX > PWA4_BODY_PAD_X) {
        cursorX = PWA4_BODY_PAD_X;
        rowY -= rowHeight + PWA4_SPACE_2;
      }
      drawPill(item, cursorX, rowY, bg, textColor);
      cursorX += width + PWA4_SPACE_2;
    }
    y = rowY - rowHeight;
  }

  // --- Page 1: Cover. Image-intake books: the person's own window on walnut ("Het venster"
  // fase 6). Everyone else: the full-bleed photo with a scrim, as before.
  page = addPage();
  if (context.window) {
    const win = context.window;
    page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: theme.cover.bg });
    if (theme.cover.collector) {
      // A fine double line round the page, like the border of a collector's edition.
      page.drawRectangle({ x: 16, y: 16, width: PAGE_WIDTH - 32, height: PAGE_HEIGHT - 32, borderColor: PWA4_ACCENT, borderWidth: 1.2 });
      page.drawRectangle({ x: 21, y: 21, width: PAGE_WIDTH - 42, height: PAGE_HEIGHT - 42, borderColor: PWA4_GOLD_LIGHT, borderWidth: 0.5 });
    }

    const coverLogo = theme.cover.logo === "color" ? images.logoColor : images.logoCream;
    const logoHeight = 16;
    const logoWidth = logoHeight * (coverLogo.width / coverLogo.height);
    page.drawImage(coverLogo, { x: (PAGE_WIDTH - logoWidth) / 2, y: PAGE_HEIGHT - 56, width: logoWidth, height: logoHeight });

    // The window: 300pt wide, 4:3 portrait, centred.
    const w = 300;
    const h = (w * 4) / 3;
    const x0 = (PAGE_WIDTH - w) / 2;
    const y0 = PAGE_HEIGHT - 100 - h;
    await drawCoverWindow(page, win.panes, x0, y0, w, h);

    // Sill: the text answers under the window, on a slightly lighter walnut band.
    let cursor = y0 - 6;
    if (win.sill) {
      const lines = wrapText(win.sill, fonts.sans, 9.5, w + 40, 2);
      const bandH = lines.length * 13 + 12;
      page.drawRectangle({ x: x0 - 20 + 6, y: cursor - bandH, width: w + 40 - 12, height: bandH, color: theme.cover.sillBand });
      let ly = cursor - 15;
      for (const line of lines) {
        const lw = fonts.sans.widthOfTextAtSize(line, 9.5);
        page.drawText(line, { x: (PAGE_WIDTH - lw) / 2, y: ly, size: 9.5, font: fonts.sans, color: theme.cover.sillText });
        ly -= 13;
      }
      cursor -= bandH;
    }

    const centred = (text: string, font: PDFFont, size: number, color: RGB, atY: number, tracking = 0) => {
      const tw = [...text].reduce((sum, ch) => sum + font.widthOfTextAtSize(ch, size) + tracking, 0) - tracking;
      drawTrackedLine(text, font, size, color, (PAGE_WIDTH - tw) / 2, atY, tracking);
    };
    const v = dict.venster;
    const name = (win.recipientName ?? "").trim();
    const coverTitle = name ? v.pdf.coverTitleGift.replace("{name}", name) : v.pdf.coverTitle;
    cursor -= 40;
    centred(`${chrome.coverEyebrow} · ${win.dateLabel}`.toUpperCase(), fonts.sansBold, 8.5, theme.cover.eyebrow, cursor, 1.1);
    cursor -= 52;
    for (const line of wrapText(coverTitle, fonts.display, 52, PWA4_CONTENT_WIDTH, 2)) {
      centred(line, fonts.display, 52, theme.cover.title, cursor);
      cursor -= 52;
    }
    if (theme.cover.collector) {
      // A small rule with a diamond in the middle, between the title and the tagline.
      const mid = PAGE_WIDTH / 2;
      page.drawLine({ start: { x: mid - 52, y: cursor + 18 }, end: { x: mid - 9, y: cursor + 18 }, thickness: 0.7, color: PWA4_ACCENT });
      page.drawLine({ start: { x: mid + 9, y: cursor + 18 }, end: { x: mid + 52, y: cursor + 18 }, thickness: 0.7, color: PWA4_ACCENT });
      page.drawSvgPath("M 0 -4 L 4 0 L 0 4 L -4 0 Z", { x: mid, y: cursor + 18, color: PWA4_ACCENT });
      cursor -= 14;
    }
    cursor -= 2;
    for (const line of wrapText(chrome.coverTagline, fonts.displayItalic, 18, 400, 3)) {
      centred(line, fonts.displayItalic, 18, theme.cover.tagline, cursor);
      cursor -= 23;
    }
    centred("WINDOWINTO.NL", fonts.sansBold, 7.5, theme.cover.eyebrow, 40, 1.6);
  } else {
  // Full-bleed photo, a bottom scrim (the same gradient image as the idea pages' hero), the cream wordmark near the top, and the eyebrow/title/tagline set into the
  // dark part of the scrim.
  {
    drawFullBleedImage(images.cover);

    const scrimHeight = PAGE_HEIGHT * 0.58;
    page.drawImage(images.scrim, { x: 0, y: 0, width: PAGE_WIDTH, height: scrimHeight, opacity: 0.82 });

    // A soft fade behind the wordmark at the top, independent of the scrim below: the cover
    // photo can vary in brightness there, and the mark needs to read reliably regardless. The
    // same gradient image, turned upside down so it is dark at the top edge. (A plain
    // rectangle here showed as a hard-edged grey box in the corner.)
    const logoHeight = 16;
    const logoWidth = logoHeight * (images.logoCream.width / images.logoCream.height);
    page.drawImage(images.scrim, {
      x: PAGE_WIDTH,
      y: PAGE_HEIGHT,
      width: PAGE_WIDTH,
      height: 110,
      rotate: degrees(180),
      opacity: 0.7,
    });
    page.drawImage(images.logoCream, {
      x: PWA4_BODY_PAD_X,
      y: PAGE_HEIGHT - PWA4_BODY_PAD_X - logoHeight,
      width: logoWidth,
      height: logoHeight,
    });

    // Eyebrow, title and tagline, each with enough clearance for the
    // serif title's own ascenders (NotoSerif-Bold's cap-height runs well
    // above its nominal size) not to crowd the line above it.
    y = 262; // the title is large now: start high enough that title and tagline stay on the cover
    drawTrackedLine(chrome.coverEyebrow, fonts.sansBold, 9, PWA4_INK_INVERSE, PWA4_BODY_PAD_X, y, 0.9);
    y -= 9 + PWA4_SPACE_7 + 16;
    drawParagraph(title, fonts.display, 46, PWA4_INK_INVERSE, 8, PWA4_BODY_PAD_X, PWA4_CONTENT_WIDTH, 2);
    y -= PWA4_SPACE_3;
    drawParagraph(chrome.coverTagline, fonts.displayItalic, 18, PWA4_INK_INVERSE, 5, PWA4_BODY_PAD_X, PWA4_CONTENT_WIDTH, 2);
  }

  }

  // --- Page 2: Profile — a top photo band (no overlay — the text sits on
  // the plain page below, per the design system), the profile summary, and
  // (if present) must-have/preference pill rows.
  page = addPage();
  {
    const bandHeight = 280;
    drawPhotoBand(images.background, bandHeight, 0.15);

    y = PAGE_HEIGHT - bandHeight - PWA4_SPACE_7;
    drawTrackedLine(chrome.profileEyebrow, fonts.sansBold, 8.25, PWA4_INK_MUTED, PWA4_BODY_PAD_X, y, 0.9);
    y -= 8.25 + PWA4_SPACE_2 + 16; // room for the tall italic line below
    drawParagraph(book.profile_summary, fonts.displayItalic, 21, PWA4_INK, 7, PWA4_BODY_PAD_X, PWA4_CONTENT_WIDTH, 7);

    if (book.must_haves.length > 0) {
      y -= PWA4_SPACE_5;
      drawTrackedLine(chrome.mustHaves, fonts.sansBold, 8.25, PWA4_INK_MUTED, PWA4_BODY_PAD_X, y, 0.9);
      y -= 8.25 + PWA4_SPACE_2;
      drawPillRow(book.must_haves, PWA4_SURFACE_INVERSE, PWA4_INK_INVERSE);
    }

    if (book.preferences.length > 0) {
      y -= PWA4_SPACE_5;
      drawTrackedLine(chrome.preferences, fonts.sansBold, 8.25, PWA4_INK_MUTED, PWA4_BODY_PAD_X, y, 0.9);
      y -= 8.25 + PWA4_SPACE_2;
      drawPillRow(book.preferences, PWA4_SURFACE_PANEL, PWA4_INK);
    }
  }

  // --- Page 3: Possibility Map — no photo. A plain header, one
  // surface-panel door card per door that has ideas in it (title,
  // description, and a numbered mini-list with real "p. N" page
  // references), and the "if you only pick one" dark CTA panel (reusing
  // pwa4DrawCta, defined below — function declarations are hoisted, so
  // calling it here before its own declaration is safe).
  page = addPage();
  {
    y = PAGE_HEIGHT - MARGIN;
    drawTrackedLine(mapCopy.mapEyebrow, fonts.sansBold, 8.25, PWA4_INK_MUTED, PWA4_BODY_PAD_X, y, 0.9);
    y -= 8.25 + PWA4_SPACE_3 + 18; // room for the large heading below
    drawParagraph(mapCopy.mapHeading, fonts.display, 31, PWA4_INK, 6, PWA4_BODY_PAD_X, PWA4_CONTENT_WIDTH, 2);
    y -= 2;
    drawParagraph(mapCopy.mapIntro, fonts.sans, 10.5, PWA4_INK_MUTED, 4, PWA4_BODY_PAD_X, PWA4_CONTENT_WIDTH, 2);
    y -= PWA4_SPACE_7;

    const doorsWithIdeas = DOOR_ORDER.filter((door) => orderedIdeas.some(({ idea }) => idea.door === door));
    const cardGap = PWA4_SPACE_4;
    const cardWidth = (PWA4_CONTENT_WIDTH - cardGap) / 2;
    const cardPad = PWA4_SPACE_4;
    let colX = PWA4_BODY_PAD_X;
    let rowTop = y;
    let rowMaxHeight = 0;

    doorsWithIdeas.forEach((door, i) => {
      const doorIdeas = orderedIdeas.filter(({ idea }) => idea.door === door);

      function drawCardContent() {
        y -= cardPad;
        drawTrackedLine(mapCopy.doors[door].label.toUpperCase(), fonts.sansBold, 8, PWA4_INK_MUTED, colX + cardPad, y, 0.8);
        y -= 8 + 4;
        drawParagraph(mapCopy.doors[door].description, fonts.sans, 8.75, PWA4_INK_MUTED, 3, colX + cardPad, cardWidth - cardPad * 2, 2);
        y -= PWA4_SPACE_2;
        doorIdeas.forEach(({ idea, originalIndex }) => {
          const pageNum = pdfPages.ideas[orderedIdeas.findIndex((e) => e.originalIndex === originalIndex)];
          const isOneThing = originalIndex === oneThingIndex;
          drawParagraph(
            `${idea.title}  ·  p. ${pageNum}`,
            fonts.sans,
            9,
            isOneThing ? PWA4_INK : PWA4_INK_MUTED,
            3,
            colX + cardPad,
            cardWidth - cardPad * 2,
            2
          );
        });
        y -= cardPad;
      }

      const measureStart = rowTop;
      y = measureStart;
      dryRun = true;
      drawCardContent();
      const cardHeight = measureStart - y;
      dryRun = false;

      y = measureStart;
      page.drawSvgPath(roundedRectPath(cardWidth, cardHeight, PWA4_RADIUS_MD), { x: colX, y, color: PWA4_SURFACE_PANEL });
      drawCardContent();
      rowMaxHeight = Math.max(rowMaxHeight, cardHeight);

      if (i % 2 === 1 || i === doorsWithIdeas.length - 1) {
        colX = PWA4_BODY_PAD_X;
        rowTop = rowTop - rowMaxHeight - cardGap;
        rowMaxHeight = 0;
      } else {
        colX = PWA4_BODY_PAD_X + cardWidth + cardGap;
      }
    });

    y = rowTop - PWA4_SPACE_5;

    if (oneThingIndex !== null && book.ideas[oneThingIndex]) {
      pwa4DrawCta(mapCopy.oneThingBadge, `${book.ideas[oneThingIndex].title}. ${mapCopy.oneThingCaption}`);
    }
  }

  // Closing CTA — surface-inverse panel, the spark glyph in accent beside
  // the "BEGIN HIER" eyebrow (in ink-inverse), then the instruction line.
  function pwa4DrawCta(label: string, body: string) {
    if (!body) return;
    const padX = PWA4_SPACE_5;
    const padY = PWA4_SPACE_5;
    const eyebrowSize = 8.25;
    const bodySize = 12;
    const bodyLineHeight = 18;
    const innerWidth = PWA4_CONTENT_WIDTH - padX * 2;
    const bodyLines = wrapText(body, fonts.sansBold, bodySize, innerWidth, 2);
    const boxHeight = padY * 2 + eyebrowSize + PWA4_SPACE_2 + bodyLines.length * bodyLineHeight;
    newPageIfNeeded(boxHeight + PWA4_SPACE_5);
    const boxTop = y;
    const boxBottom = boxTop - boxHeight;
    if (!dryRun) {
      page.drawSvgPath(roundedRectPath(PWA4_CONTENT_WIDTH, boxHeight, PWA4_RADIUS_MD), {
        x: PWA4_BODY_PAD_X,
        y: boxTop,
        color: PWA4_SURFACE_INVERSE,
      });
      let ty = boxTop - padY - eyebrowSize;
      const sparkSize = eyebrowSize;
      page.drawSvgPath(scaleLinearSvgPath(PWA4_SPARK_PATH_24, sparkSize / 24), {
        x: PWA4_BODY_PAD_X + padX,
        y: ty + eyebrowSize,
        color: PWA4_ACCENT,
      });
      drawTrackedLine(
        label.toUpperCase(),
        fonts.sansBold,
        eyebrowSize,
        PWA4_INK_INVERSE,
        PWA4_BODY_PAD_X + padX + sparkSize + PWA4_SPACE_2,
        ty,
        0.9
      );
      ty -= eyebrowSize + PWA4_SPACE_2;
      for (const line of bodyLines) {
        page.drawText(line, { x: PWA4_BODY_PAD_X + padX, y: ty, size: bodySize, font: fonts.sansBold, color: PWA4_INK_INVERSE });
        ty -= bodyLineHeight;
      }
    }
    y = boxBottom;
  }

  // --- Pages 4-9 (ideas) and page 10 (wildcard): one full page each, laid out
  // as a small magazine spread inside the PossibilityPageA4 tokens above:
  // a hero (door badge, title, subtitle), then a personal-match panel, an
  // at-a-glance strip, an experience profile beside a possible schedule,
  // takeaways beside "make it yours", practical steps beside the investment +
  // location cards, a small editorial detail, and the "start here" panel.
  //
  // Everything on the page but the hero photo is measured first (each block
  // reports its own height), then the richest variant that fits on ONE page
  // is drawn, with the spare room shared out between the gaps and the hero
  // (see drawIdeaPage) — so a page is never half empty and never spills over.
  // All the extra content is rule-based (src/lib/pdf/ideaContent.ts): no
  // additional API call or generated text.
  const IDEA_BOTTOM = 56; // above the footer line
  const IDEA_GAP = 9;
  const IDEA_COL_GAP = 10;
  const HERO_MIN = 156;
  const HERO_MAX = 214;
  const HERO_TITLE_SIZE = 34;
  const HERO_SUB_SIZE = 10.5;
  const HERO_SUB_LH = 14.5;
  const LABEL_SIZE = 7.25;
  const BODY_SIZE = 10.5;
  const BODY_LH = 14;

  // A measured piece of the page: its natural height, and how to draw it into
  // a box of at least that height (panels stretch to fill a shared row).
  interface Block {
    height: number;
    draw: (x: number, top: number, h: number) => void;
  }

  // The vertical space a wrapped block of text takes / where its first
  // baseline sits, so measuring and drawing agree.
  const textBaseline = (topY: number, size: number, lh: number) => topY - (lh - size) / 2 - size * 0.78;

  function drawTextLines(lines: string[], x: number, topY: number, size: number, lh: number, font: PDFFont, color: RGB) {
    lines.forEach((line, i) => {
      page.drawText(line, { x, y: textBaseline(topY - i * lh, size, lh), size, font, color });
    });
  }

  function drawLabel(text: string, x: number, topY: number, color: RGB = PWA4_INK_MUTED) {
    drawTrackedLine(text.toUpperCase(), fonts.sansBold, LABEL_SIZE, color, x, topY - LABEL_SIZE, 0.85);
  }

  const drawPanel = (x: number, top: number, w: number, h: number, color: RGB, radius = PWA4_RADIUS_MD) =>
    page.drawSvgPath(roundedRectPath(w, h, radius), { x, y: top, color });

  type IconKind = "clock" | "level" | "people" | "pin" | "type";

  // Simple line icons, drawn as vectors (the bundled fonts have no icon glyphs,
  // and several symbols we might reach for are missing from Noto Sans).
  function drawIcon(kind: IconKind, cx: number, cy: number, s: number, color: RGB) {
    const w = 0.9;
    if (kind === "clock") {
      page.drawCircle({ x: cx, y: cy, size: s / 2, borderColor: color, borderWidth: w });
      page.drawLine({ start: { x: cx, y: cy }, end: { x: cx, y: cy + s * 0.3 }, thickness: w, color });
      page.drawLine({ start: { x: cx, y: cy }, end: { x: cx + s * 0.22, y: cy - s * 0.06 }, thickness: w, color });
    } else if (kind === "level") {
      const bw = s * 0.24;
      [0.38, 0.68, 1].forEach((f, i) => {
        page.drawRectangle({ x: cx - s / 2 + i * (bw + s * 0.14), y: cy - s / 2, width: bw, height: s * f, color });
      });
    } else if (kind === "people") {
      page.drawCircle({ x: cx, y: cy + s * 0.2, size: s * 0.2, borderColor: color, borderWidth: w });
      page.drawEllipse({ x: cx, y: cy - s * 0.32, xScale: s * 0.36, yScale: s * 0.2, borderColor: color, borderWidth: w });
    } else if (kind === "pin") {
      page.drawCircle({ x: cx, y: cy + s * 0.12, size: s * 0.26, color });
      page.drawSvgPath(`M ${-s * 0.2},0 L ${s * 0.2},0 L 0,${s * 0.5} Z`, { x: cx, y: cy + s * 0.12 - s * 0.05, color });
    } else {
      page.drawSvgPath(scaleLinearSvgPath(PWA4_SPARK_PATH_24, s / 24), { x: cx - s / 2, y: cy + s / 2, color });
    }
  }

  // --- blocks ---------------------------------------------------------------

  function blockMatch(width: number, label: string, body: string): Block {
    const padX = 14;
    const padY = 11;
    const size = 15;
    const lh = 19.5;
    const lines = wrapText(body, fonts.displayItalic, size, width - padX * 2 - 4, 5);
    const height = padY * 2 + LABEL_SIZE + 6 + lines.length * lh;
    return {
      height,
      draw(x, top, h) {
        drawPanel(x, top, width, h, PWA4_SURFACE_PANEL);
        page.drawRectangle({ x, y: top - h, width: 2.25, height: h, color: PWA4_SURFACE_INVERSE });
        drawLabel(label, x + padX, top - padY);
        drawTextLines(lines, x + padX, top - padY - LABEL_SIZE - 6, size, lh, fonts.displayItalic, PWA4_INK);
      },
    };
  }

  interface GlanceCell {
    icon: IconKind;
    label: string;
    value: string;
  }

  function blockGlance(width: number, cells: GlanceCell[]): Block {
    const gap = 8;
    const cellW = (width - gap * (cells.length - 1)) / cells.length;
    const pad = 9;
    const valueSize = 9.75;
    const valueLh = 12.5;
    const wrapped = cells.map((c) => wrapText(c.value, fonts.sansBold, valueSize, cellW - pad * 2, 2));
    const maxLines = Math.max(1, ...wrapped.map((l) => l.length));
    const height = pad + 11 + 5 + maxLines * valueLh + pad - 2;
    return {
      height,
      draw(x, top, h) {
        cells.forEach((cell, i) => {
          const cx = x + i * (cellW + gap);
          drawPanel(cx, top, cellW, h, PWA4_SURFACE_PANEL, PWA4_RADIUS_SM);
          drawIcon(cell.icon, cx + pad + 5, top - pad - 5, 10, PWA4_INK_MUTED);
          drawTrackedLine(cell.label.toUpperCase(), fonts.sansBold, 6.75, PWA4_INK_MUTED, cx + pad + 15, top - pad - 7.5, 0.7);
          drawTextLines(wrapped[i], cx + pad, top - pad - 11 - 5, valueSize, valueLh, fonts.sansBold, PWA4_INK);
        });
      },
    };
  }

  function blockProfile(width: number, label: string, rows: { name: string; score: number }[]): Block {
    const padX = 13;
    const padY = 11;
    const rowH = 17;
    const height = padY * 2 + LABEL_SIZE + 8 + rows.length * rowH;
    return {
      height,
      draw(x, top, h) {
        drawPanel(x, top, width, h, PWA4_SURFACE_PANEL);
        drawLabel(label, x + padX, top - padY);
        let rowTop = top - padY - LABEL_SIZE - 8;
        for (const row of rows) {
          drawTextLines([row.name], x + padX, rowTop, BODY_SIZE, rowH, fonts.sans, PWA4_INK);
          const dotR = 3.1;
          const step = 10;
          const startX = x + width - padX - (4 * step + dotR * 2) + dotR;
          for (let d = 0; d < 5; d++) {
            const filled = d < row.score;
            page.drawCircle({
              x: startX + d * step,
              y: rowTop - rowH / 2,
              size: dotR,
              ...(filled ? { color: PWA4_INK } : { borderColor: PWA4_INK_MUTED, borderWidth: 0.8 }),
            });
          }
          rowTop -= rowH;
        }
      },
    };
  }

  function blockSchedule(width: number, label: string, steps: { label: string; text: string }[]): Block {
    const padX = 13;
    const padY = 11;
    const textX = padX + 16;
    const wrapped = steps.map((s) => wrapText(s.text, fonts.sans, BODY_SIZE, width - textX - padX, 2));
    const stepHeights = wrapped.map((lines) => 11 + lines.length * 12.5 + 7);
    const height = padY * 2 + LABEL_SIZE + 8 + stepHeights.reduce((a, b) => a + b, 0) - 5;
    return {
      height,
      draw(x, top, h) {
        drawPanel(x, top, width, h, PWA4_SURFACE_PANEL);
        drawLabel(label, x + padX, top - padY);
        let stepTop = top - padY - LABEL_SIZE - 8;
        const dotX = x + padX + 4;
        steps.forEach((step, i) => {
          const dotY = stepTop - 5.5;
          if (i < steps.length - 1) {
            page.drawLine({
              start: { x: dotX, y: dotY },
              end: { x: dotX, y: dotY - stepHeights[i] },
              thickness: 0.8,
              color: PWA4_INK_MUTED,
              opacity: 0.7,
            });
          }
          page.drawCircle({ x: dotX, y: dotY, size: 3.4, color: i === 0 ? PWA4_ACCENT : PWA4_SURFACE_INVERSE });
          drawTrackedLine(step.label.toUpperCase(), fonts.sansBold, 7.5, PWA4_INK, x + textX, stepTop - 8, 0.7);
          drawTextLines(wrapped[i], x + textX, stepTop - 11, BODY_SIZE, 12.5, fonts.sans, PWA4_INK);
          stepTop -= stepHeights[i];
        });
      },
    };
  }

  function blockList(width: number, label: string, items: string[], marker: "dot" | "check"): Block {
    const padX = 13;
    const padY = 11;
    const textX = padX + 15;
    const wrapped = items.map((t) => wrapText(t, fonts.sans, BODY_SIZE, width - textX - padX, 2));
    const itemHeights = wrapped.map((lines) => lines.length * 12.5 + 6);
    const height = padY * 2 + LABEL_SIZE + 8 + itemHeights.reduce((a, b) => a + b, 0) - 4;
    return {
      height,
      draw(x, top, h) {
        drawPanel(x, top, width, h, PWA4_SURFACE_PANEL);
        drawLabel(label, x + padX, top - padY);
        let itemTop = top - padY - LABEL_SIZE - 8;
        items.forEach((_, i) => {
          const mid = itemTop - 6.2;
          if (marker === "check") {
            page.drawSvgPath(roundedRectPath(8, 8, 2), {
              x: x + padX,
              y: mid + 4,
              color: PWA4_SURFACE_PAGE,
              borderColor: PWA4_INK_MUTED,
              borderWidth: 0.9,
            });
          } else {
            page.drawCircle({ x: x + padX + 4, y: mid, size: 2.2, color: PWA4_ACCENT });
          }
          drawTextLines(wrapped[i], x + textX, itemTop, BODY_SIZE, 12.5, fonts.sans, PWA4_INK);
          itemTop -= itemHeights[i];
        });
      },
    };
  }

  function blockSteps(width: number, label: string, steps: string[]): Block {
    const numW = 30;
    const wrapped = steps.map((t) => wrapText(t, fonts.sans, BODY_SIZE, width - numW - 4, 4));
    const itemHeights = wrapped.map((lines) => lines.length * BODY_LH + 12);
    const height = LABEL_SIZE + 8 + itemHeights.reduce((a, b) => a + b, 0) - 6;
    return {
      height,
      draw(x, top) {
        drawLabel(label, x, top);
        let itemTop = top - LABEL_SIZE - 8;
        steps.forEach((_, i) => {
          page.drawText(String(i + 1).padStart(2, "0"), {
            x,
            y: itemTop - 14,
            size: 20,
            font: fonts.display,
            color: PWA4_ACCENT,
          });
          drawTextLines(wrapped[i], x + numW, itemTop, BODY_SIZE, BODY_LH, fonts.sans, PWA4_INK);
          if (i < steps.length - 1) {
            page.drawRectangle({ x, y: itemTop - itemHeights[i] + 6, width, height: 0.75, color: PWA4_SURFACE_PANEL });
          }
          itemTop -= itemHeights[i];
        });
      },
    };
  }

  function blockInvest(width: number, labels: IdeaPageLabels, cost: string, status: string | null): Block {
    const padX = 13;
    const padY = 11;
    const costLines = wrapText(cost, fonts.display, 23, width - padX * 2, 2);
    const statusLines = status ? wrapText(status, fonts.sansBold, 9, width - padX * 2, 4) : [];
    const height =
      padY * 2 + LABEL_SIZE + 6 + costLines.length * 25 + 2 + 11 + (statusLines.length > 0 ? 6 + statusLines.length * 12 : 0);
    return {
      height,
      draw(x, top, h) {
        drawPanel(x, top, width, h, PWA4_SURFACE_PANEL);
        drawLabel(labels.invest, x + padX, top - padY);
        let cursor = top - padY - LABEL_SIZE - 6;
        drawTextLines(costLines, x + padX, cursor, 23, 25, fonts.display, PWA4_INK);
        cursor -= costLines.length * 25 + 2;
        drawTextLines([labels.investIndication], x + padX, cursor, 8.5, 11, fonts.sans, PWA4_INK_MUTED);
        cursor -= 11 + 6;
        drawTextLines(statusLines, x + padX, cursor, 9, 12, fonts.sansBold, PWA4_INK);
      },
    };
  }

  function blockLocation(width: number, labels: IdeaPageLabels, idea: IdeaBookEntry): Block {
    const padX = 13;
    const padY = 11;
    const location = idea.location!;
    const nameLines = wrapText(location.name, fonts.sansBold, 10.5, width - padX * 2 - 16, 3);
    const city = location.city || "";
    const mapText = chrome.mapLinkLabel;
    const height = padY * 2 + LABEL_SIZE + 6 + nameLines.length * 14 + (city ? 13 : 0) + 6 + 12;
    return {
      height,
      draw(x, top, h) {
        drawPanel(x, top, width, h, PWA4_SURFACE_PANEL);
        drawLabel(labels.where, x + padX, top - padY);
        let cursor = top - padY - LABEL_SIZE - 6;
        drawIcon("pin", x + padX + 4, cursor - 8, 11, PWA4_INK);
        drawTextLines(nameLines, x + padX + 16, cursor, 10.5, 14, fonts.sansBold, PWA4_INK);
        cursor -= nameLines.length * 14;
        if (city) drawTextLines([city], x + padX + 16, cursor, 9.5, 13, fonts.sans, PWA4_INK_MUTED);
        // Pinned to the bottom of the (possibly stretched) card so the link
        // always lines up with the card's lower edge.
        const linkTop = top - h + padY + 12;
        const textW = fonts.sans.widthOfTextAtSize(mapText, 9);
        const linkX = x + padX + 16;
        drawTextLines([mapText], linkX, linkTop, 9, 12, fonts.sans, PWA4_INK);
        page.drawLine({
          start: { x: linkX, y: linkTop - 10.5 },
          end: { x: linkX + textW, y: linkTop - 10.5 },
          thickness: 0.5,
          color: PWA4_INK,
        });
        const ay = linkTop - 6;
        const ax = linkX + textW + 4;
        page.drawLine({ start: { x: ax, y: ay }, end: { x: ax + 8, y: ay }, thickness: 0.8, color: PWA4_INK });
        page.drawLine({ start: { x: ax + 5, y: ay + 2.4 }, end: { x: ax + 8, y: ay }, thickness: 0.8, color: PWA4_INK });
        page.drawLine({ start: { x: ax + 5, y: ay - 2.4 }, end: { x: ax + 8, y: ay }, thickness: 0.8, color: PWA4_INK });
        addLinkAnnotation(
          page,
          { x: linkX, y: linkTop - 12, width: textW + 12, height: 14 },
          mapsSearchUrl(location.name, location.city)
        );
      },
    };
  }

  function blockEditorial(width: number, label: string, text: string): Block {
    const lines = wrapText(text, fonts.serif, 10.5, width - 16, 2);
    return {
      height: LABEL_SIZE + 5 + lines.length * 14.5,
      draw(x, top, h) {
        page.drawRectangle({ x, y: top - h, width: 2.25, height: h, color: PWA4_ACCENT });
        drawLabel(label, x + 11, top);
        drawTextLines(lines, x + 11, top - LABEL_SIZE - 5, 10.5, 14.5, fonts.serif, PWA4_INK);
      },
    };
  }

  function blockStart(width: number, label: string, url: { display: string; href: string } | null, body: string): Block {
    const padX = 15;
    const padY = 13;
    // A long address shrinks (down to a floor) and is then cut with an ellipsis
    // rather than running out of the panel; the link itself stays complete.
    const urlMaxWidth = width - padX * 2;
    let urlSize = 15;
    let urlText = url ? url.display : null;
    if (urlText) {
      while (urlSize > 10 && fonts.serif.widthOfTextAtSize(urlText, urlSize) > urlMaxWidth) urlSize -= 0.5;
      if (fonts.serif.widthOfTextAtSize(urlText, urlSize) > urlMaxWidth) {
        let cut = urlText;
        while (cut.length > 1 && fonts.serif.widthOfTextAtSize(`${cut}…`, urlSize) > urlMaxWidth) cut = cut.slice(0, -1);
        urlText = `${cut}…`;
      }
    }
    const bodyLines = wrapText(body, fonts.sansBold, BODY_SIZE, width - padX * 2, 2);
    const height = padY * 2 + LABEL_SIZE + 7 + (urlText ? 21 : 0) + bodyLines.length * BODY_LH;
    return {
      height,
      draw(x, top, h) {
        drawPanel(x, top, width, h, PWA4_SURFACE_INVERSE);
        page.drawSvgPath(scaleLinearSvgPath(PWA4_SPARK_PATH_24, LABEL_SIZE / 24), {
          x: x + padX,
          y: top - padY,
          color: PWA4_ACCENT,
        });
        drawTrackedLine(label.toUpperCase(), fonts.sansBold, LABEL_SIZE, PWA4_INK_INVERSE, x + padX + LABEL_SIZE + 6, top - padY - LABEL_SIZE, 0.85);
        let cursor = top - padY - LABEL_SIZE - 7;
        if (urlText && url) {
          drawTextLines([urlText], x + padX, cursor, urlSize, 21, fonts.serif, PWA4_ACCENT);
          const uw = fonts.serif.widthOfTextAtSize(urlText, urlSize);
          page.drawLine({
            start: { x: x + padX, y: cursor - 18 },
            end: { x: x + padX + uw, y: cursor - 18 },
            thickness: 0.7,
            color: PWA4_ACCENT,
          });
          addLinkAnnotation(page, { x: x + padX, y: cursor - 20, width: uw, height: 21 }, url.href);
          cursor -= 21;
        }
        drawTextLines(bodyLines, x + padX, cursor, BODY_SIZE, BODY_LH, fonts.sansBold, PWA4_INK_INVERSE);
      },
    };
  }

  interface Row {
    // widths as fractions of the content width (they get the column gap taken
    // out); one entry = a full-width row.
    cols: { block: Block; frac: number }[];
  }

  function rowHeight(row: Row): number {
    return Math.max(...row.cols.map((c) => c.block.height));
  }

  function drawRow(row: Row, top: number) {
    const h = rowHeight(row);
    const gaps = IDEA_COL_GAP * (row.cols.length - 1);
    let x = PWA4_BODY_PAD_X;
    for (const col of row.cols) {
      const w = (PWA4_CONTENT_WIDTH - gaps) * col.frac;
      col.block.draw(x, top, h);
      x += w + IDEA_COL_GAP;
    }
    return h;
  }

  // The widths a row's blocks are built for, so wrapping matches drawing.
  const colWidth = (fracs: number[], i: number) =>
    (PWA4_CONTENT_WIDTH - IDEA_COL_GAP * (fracs.length - 1)) * fracs[i];

  // The person's own answers (when the caller passes them) feed the company
  // cell, the budget status and one derived "it fits" sentence.
  const intakeDict = dict.intake;
  const optionLabel = (options: { value: string; label: string }[], value: string | undefined) =>
    value ? options.find((o) => o.value === value)?.label ?? null : null;
  const pageLabels = ideaPageLabels(locale);
  const usedTakeaways = new Set<string>();
  const usedSuggestions = new Set<string>();

  function drawIdeaPage(idea: IdeaBookEntry, photo: PDFImage, opts: { number: number | null; badge: string }) {
    const kind = activityKindFor(idea);
    const copy = kindCopy(kind, locale);
    const profile = experienceProfileFor(idea, { company: context.company });

    // --- content ---
    const costText = idea.practical.estimated_cost;
    const durationText = idea.practical.duration;
    const levelText = DIFFICULTY_LABELS[locale][idea.practical.difficulty];
    const status = costText ? budgetStatusFor(costText, context.budget) : null;
    const statusText =
      status === "within"
        ? pageLabels.budgetWithin
        : status === "slightlyAbove"
          ? pageLabels.budgetSlightlyAbove
          : status === "above"
            ? pageLabels.budgetAbove
            : idea.practical.preparation || null;

    const timeLabel = optionLabel(intakeDict.timeAvailable.options, context.timeAvailable);
    const budgetLabel = optionLabel(intakeDict.budget.options, context.budget);
    let fitSentence: string | null = null;
    if (timeLabel && timeFits(durationText, context.timeAvailable)) {
      fitSentence =
        status === "within" && budgetLabel
          ? fillTemplate(pageLabels.matchTimeBudget, { time: timeLabel.toLowerCase(), budget: budgetLabel.toLowerCase() })
          : fillTemplate(pageLabels.matchTime, { time: timeLabel.toLowerCase() });
    }
    const threadLine = idea.activity_id ? context.threadLines?.[idea.activity_id] : undefined;
    const matchText = [idea.why_it_fits, fitSentence, threadLine].filter(Boolean).join(" ");

    const companyLabels = (context.company ?? [])
      .map((v) => optionLabel(intakeDict.company.options, v))
      .filter((l): l is string => Boolean(l));
    const place = idea.location ? idea.location.city || idea.location.name : "";
    const glanceCells: GlanceCell[] = [
      durationText ? { icon: "clock" as const, label: pageLabels.time, value: durationText } : null,
      levelText ? { icon: "level" as const, label: pageLabels.level, value: levelText } : null,
      companyLabels.length > 0 ? { icon: "people" as const, label: pageLabels.company, value: companyLabels.join(", ") } : null,
      place ? { icon: "pin" as const, label: pageLabels.place, value: place } : null,
      { icon: "type" as const, label: pageLabels.type, value: copy.label },
    ].filter((c): c is GlanceCell => c !== null);

    const profileRows = EXPERIENCE_DIMENSIONS.map((d) => ({ name: pageLabels.dimensions[d], score: profile[d] }));
    // B5 / V1: lines written for this very idea (only exist for books made with KNOWLEDGE_ENGINE_V2 on); re-checked here
    // because a stored book is read back as it was saved. Without them: the per-kind templates, as always.
    const fill = idea.fill ? normalizeFill(idea.fill) : undefined;
    const activity = idea.activity_id ? getActivity(idea.activity_id) : undefined;
    const fillCtx = activity ? fillContext(activity, null, context.company) : null;
    const ownFill = fill && !(fillCtx && fillConflicts(fill, fillCtx).length > 0) ? fill : undefined;
    // With the flag on, a template line that contradicts the idea (a solo idea that says "bring someone you enjoy") is skipped too.
    const v2 = knowledgeWritingV2Enabled();
    const templateLines = (lines: readonly string[]) => (v2 && fillCtx ? withoutConflicts(lines, fillCtx) : [...lines]);
    const schedule = ownFill ? scheduleFromLines(ownFill.timeline, durationText, locale) : scheduleFor(kind, durationText, locale);

    // Prefer lines no earlier page of this book has used, so several ideas of
    // the same kind don't all carry the same checklist.
    const seed = idea.title;
    const takeaways = ownFill ? ownFill.takeaways : pickStable(templateLines(copy.takeaways), 3, seed, usedTakeaways);
    const suggestions = ownFill ? ownFill.suggestions : pickStable(templateLines(copy.suggestions), 3, seed + "·", usedSuggestions);
    if (!ownFill) {
      takeaways.forEach((t) => usedTakeaways.add(t));
      suggestions.forEach((t) => usedSuggestions.add(t));
    }
    const editorial = editorialFor(idea.door, seed, locale);

    // Steps: the idea's own steps, plus what to bring when the idea lists
    // requirements (existing data, not invented) — at most three.
    const steps = [...idea.details];
    if (steps.length < 3 && idea.requirements.length > 0) {
      steps.push(`${pageLabels.bring}: ${idea.requirements.join(", ")}`);
    }
    const practicalSteps = steps.slice(0, 3);

    const url = extractUrl(idea.first_action);
    const startLabel = book.labels.first_action_heading || pageLabels.startHere;

    const subtitleLines = wrapText(idea.intro, fonts.sans, HERO_SUB_SIZE, PWA4_CONTENT_WIDTH, 2);
    // A long title steps down in size before it is ever cut short.
    let titleSize = HERO_TITLE_SIZE;
    let titleLines = wrapText(idea.title, fonts.display, titleSize, PWA4_CONTENT_WIDTH);
    for (const smaller of [28, 24]) {
      if (titleLines.length <= 2) break;
      titleSize = smaller;
      titleLines = wrapText(idea.title, fonts.display, titleSize, PWA4_CONTENT_WIDTH);
    }
    titleLines = wrapText(idea.title, fonts.display, titleSize, PWA4_CONTENT_WIDTH, 2);
    const heroNeed = 14 + subtitleLines.length * HERO_SUB_LH + 6 + titleLines.length * (titleSize + 4) + 50;
    const heroMin = Math.max(HERO_MIN, heroNeed);

    // --- variants, richest first; the first that fits on one page wins ---
    function buildRows(level: number): Row[] {
      const rows: Row[] = [];
      rows.push({ cols: [{ block: blockMatch(PWA4_CONTENT_WIDTH, pageLabels.match, matchText), frac: 1 }] });
      rows.push({ cols: [{ block: blockGlance(PWA4_CONTENT_WIDTH, glanceCells), frac: 1 }] });

      const f2 = [0.46, 0.54];
      rows.push({
        cols: [
          { block: blockProfile(colWidth(f2, 0), pageLabels.experience, profileRows), frac: f2[0] },
          { block: blockSchedule(colWidth(f2, 1), pageLabels.schedule, schedule), frac: f2[1] },
        ],
      });

      if (level < 3) {
        const n = level >= 2 ? 2 : 3;
        const f = [0.5, 0.5];
        rows.push({
          cols: [
            { block: blockList(colWidth(f, 0), pageLabels.takeaways, takeaways.slice(0, n), "dot"), frac: f[0] },
            { block: blockList(colWidth(f, 1), pageLabels.personalise, suggestions.slice(0, n), "check"), frac: f[1] },
          ],
        });
      }

      // Steps on the left; the investment and location cards side by side
      // to their right (or just the one that exists), so the row is only as
      // tall as its tallest card rather than a stacked pair.
      const hasLocation = Boolean(idea.location);
      const hasCost = Boolean(costText);
      const fracs = hasLocation && hasCost ? [0.44, 0.28, 0.28] : hasLocation || hasCost ? [0.6, 0.4] : [1];
      const cols: Row["cols"] = [
        { block: blockSteps(colWidth(fracs, 0), pageLabels.steps, practicalSteps), frac: fracs[0] },
      ];
      let next = 1;
      if (hasCost) {
        cols.push({ block: blockInvest(colWidth(fracs, next), pageLabels, costText, statusText), frac: fracs[next] });
        next++;
      }
      if (hasLocation) {
        cols.push({ block: blockLocation(colWidth(fracs, next), pageLabels, idea), frac: fracs[next] });
      }
      rows.push({ cols });

      if (level < 1) {
        rows.push({ cols: [{ block: blockEditorial(PWA4_CONTENT_WIDTH, editorial.label, editorial.text), frac: 1 }] });
      }
      rows.push({ cols: [{ block: blockStart(PWA4_CONTENT_WIDTH, startLabel, url, url ? replaceUrl(idea.first_action, pageLabels.addressAbove) : idea.first_action), frac: 1 }] });
      return rows;
    }

    let rows: Row[] = [];
    let level = 0;
    for (; level <= 3; level++) {
      rows = buildRows(level);
      const total = rows.reduce((sum, r) => sum + rowHeight(r), 0) + IDEA_GAP * (rows.length - 1);
      if (PAGE_HEIGHT - heroMin - 12 - total >= IDEA_BOTTOM) break;
    }
    level = Math.min(level, 3);

    const total = rows.reduce((sum, r) => sum + rowHeight(r), 0) + IDEA_GAP * (rows.length - 1);
    const spare = Math.max(0, PAGE_HEIGHT - heroMin - 12 - total - IDEA_BOTTOM);
    const heroExtra = Math.min(spare * 0.4, HERO_MAX - heroMin);
    const gapExtra = rows.length > 1 ? Math.min((spare - heroExtra) / (rows.length - 1), 12) : 0;
    const heroHeight = heroMin + Math.max(0, heroExtra);

    // --- draw ---
    drawHero(photo, {
      height: heroHeight,
      badge: opts.number !== null ? `${String(opts.number).padStart(2, "0")}  ·  ${opts.badge}` : opts.badge,
      titleLines,
      titleSize,
      subtitleLines,
    });

    let top = PAGE_HEIGHT - heroHeight - 12;
    rows.forEach((row) => {
      top -= drawRow(row, top) + IDEA_GAP + gapExtra;
    });
  }

  // Hero photo (top-aligned, any cover-fit overflow hidden by the opaque body
  // rectangle drawn afterwards), a bottom-anchored scrim (one alpha-gradient image, see
  // scrim.ts — stacked rectangles left a visible line at every band edge), the door/wildcard badge top-left, and the title
  // with the subtitle beneath it.
  function drawHero(
    photo: PDFImage,
    hero: { height: number; badge: string; titleLines: string[]; titleSize: number; subtitleLines: string[] }
  ) {
    const heroBottomY = PAGE_HEIGHT - hero.height;
    const { width, height } = coverFitSize(photo, PAGE_WIDTH, hero.height);
    page.drawImage(photo, { x: (PAGE_WIDTH - width) / 2, y: PAGE_HEIGHT - height, width, height });

    page.drawImage(images.scrim, { x: 0, y: heroBottomY, width: PAGE_WIDTH, height: hero.height, opacity: 0.9 });
    page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: heroBottomY, color: PWA4_SURFACE_PAGE });

    const padX = PWA4_SPACE_4;
    const size = 8.25;
    const label = hero.badge.toUpperCase();
    const pillWidth = trackedTextWidth(label, fonts.sansBold, size, 0.9) + padX * 2;
    const pillHeight = 19;
    const pillTop = PAGE_HEIGHT - PWA4_SPACE_5;
    page.drawSvgPath(roundedRectPath(pillWidth, pillHeight, pillHeight / 2), {
      x: PWA4_BODY_PAD_X,
      y: pillTop,
      color: PWA4_ACCENT,
    });
    drawTrackedLine(label, fonts.sansBold, size, PWA4_INK, PWA4_BODY_PAD_X + padX, pillTop - pillHeight / 2 - size / 2.6, 0.9);

    // Subtitle sits at the bottom of the hero, the title just above it.
    let cursor = heroBottomY + 14 + hero.subtitleLines.length * HERO_SUB_LH;
    hero.subtitleLines.forEach((line, i) => {
      page.drawText(line, {
        x: PWA4_BODY_PAD_X,
        y: textBaseline(heroBottomY + 14 + (hero.subtitleLines.length - i) * HERO_SUB_LH, HERO_SUB_SIZE, HERO_SUB_LH),
        size: HERO_SUB_SIZE,
        font: fonts.sans,
        color: PWA4_INK_INVERSE,
        opacity: 0.92,
      });
    });
    cursor += 6;
    const titleLh = hero.titleSize + 4;
    hero.titleLines.forEach((line, i) => {
      page.drawText(line, {
        x: PWA4_BODY_PAD_X,
        y: textBaseline(cursor + (hero.titleLines.length - i) * titleLh, hero.titleSize, titleLh),
        size: hero.titleSize,
        font: fonts.display,
        color: PWA4_INK_INVERSE,
      });
    });
  }

  // Counts how many times each category has been used so far in this book,
  // so two ideas sharing a category get the category's two different
  // photo variants instead of both landing on the same one (which a
  // page-index-based seed would do whenever two same-category ideas happen
  // to land on pages of the same parity).
  // --- R2.3 "Meer over deze deur": the second page of an idea that has the extra layers (how it
  // feels, three sizes, real places, related activities, what next). Same tokens as the idea page,
  // a slim photo band on top so the two pages read as one spread. Ideas without any layer (every
  // book made before R2.3) get no second page, so their PDFs are unchanged.
  //
  // Every block is measured first. The text is bounded by the layer limits (ideaLayers.ts), but a
  // book with every layer at its limit is tall, so the page picks the roomiest of three spacings
  // that still ends above the footer: a smaller photo band, tighter gaps, and as the last resort
  // no one-line notes under the places. Nothing is ever cut off or drawn over the footer.
  const moreCopy = dict.venster.more;

  function drawMorePage(idea: IdeaBookEntry, photo: PDFImage, badge: string) {
    const x0 = PWA4_BODY_PAD_X;
    const W = PWA4_CONTENT_WIDTH;
    const PAD = 12;
    const PILL_ROW = 9.75 + 10;

    const titleLines = wrapText(idea.title, fonts.display, 32, W, 2);
    const feelsLines = idea.feels_like ? wrapText(idea.feels_like, fonts.displayItalic, 17, W - PAD * 2 - 6) : null;
    const feelsH = feelsLines ? PAD * 2 + LABEL_SIZE + 7 + feelsLines.length * 22 : 0;

    const colGap = 9;
    const colW = (W - colGap * 2) / 3;
    const inner = colW - PAD * 2;
    const sizeCards = (idea.sizes ?? []).map((size, i) => {
      const titleL = wrapText(size.title, fonts.sansBold, 10.25, inner);
      const descL = wrapText(size.description, fonts.sans, 9, inner);
      const metaL = wrapText(`${size.estimated_cost} · ${size.duration}`, fonts.sansBold, 8.75, inner);
      const h = PAD * 2 + LABEL_SIZE + 4 + 11 + 8 + titleL.length * 13.5 + 4 + descL.length * 12.5 + 6 + metaL.length * 12;
      return { i, titleL, descL, metaL, h };
    });
    const sizesRowH = sizeCards.length ? Math.max(...sizeCards.map((c) => c.h)) : 0;

    const placesNoteLines = idea.places?.length ? wrapText(moreCopy.placesNote, fonts.sans, 8.5, W) : [];
    const placeRows = (idea.places ?? []).map((place) => {
      const nameL = wrapText(place.city ? `${place.name}, ${place.city}` : place.name, fonts.sansBold, 10.25, W - PAD * 2);
      const noteL = place.note ? wrapText(place.note, fonts.sans, 9.25, W - PAD * 2, 2) : [];
      return { place, nameL, noteL };
    });
    const placeH = (r: { nameL: string[]; noteL: string[] }, withNotes: boolean) =>
      PAD * 2 + r.nameL.length * 13.5 + (withNotes && r.noteL.length ? 3 + r.noteL.length * 12.5 : 0) + 6 + 14;

    // Pill rows, counted the way drawPillRow wraps them.
    const relatedLabels = (idea.related ?? []).map((r) => r.label);
    let pillRows = 0;
    if (relatedLabels.length) {
      pillRows = 1;
      let cursorX = x0;
      for (const label of relatedLabels) {
        const w = fonts.sansBold.widthOfTextAtSize(label, 9.75) + PWA4_SPACE_3 * 2;
        if (cursorX + w > x0 + W && cursorX > x0) {
          pillRows += 1;
          cursorX = x0;
        }
        cursorX += w + PWA4_SPACE_2;
      }
    }
    const nextLines = idea.next_step ? wrapText(idea.next_step, fonts.sans, 11, W) : [];

    const levels = [
      { band: 96, gap: 18, notes: true },
      { band: 64, gap: 13, notes: true },
      { band: 40, gap: 10, notes: true },
      { band: 40, gap: 10, notes: false },
    ];
    const measure = (lv: (typeof levels)[number]) => {
      let h = lv.band + 22 + (LABEL_SIZE + 9) + (titleLines.length * 28 + 12) + 20;
      if (feelsLines) h += feelsH + lv.gap;
      if (sizeCards.length) h += LABEL_SIZE + 8 + sizesRowH + lv.gap;
      if (placeRows.length) {
        h += LABEL_SIZE + 6 + placesNoteLines.length * 11.5 + 8;
        for (const r of placeRows) h += placeH(r, lv.notes) + 7;
        h += lv.gap - 7;
      }
      if (pillRows) h += LABEL_SIZE + 8 + pillRows * PILL_ROW + (pillRows - 1) * PWA4_SPACE_2 + lv.gap;
      if (nextLines.length) h += LABEL_SIZE + 7 + nextLines.length * 15.5;
      return h;
    };
    const available = PAGE_HEIGHT - IDEA_BOTTOM;
    const level = levels.find((lv) => measure(lv) <= available) ?? levels[levels.length - 1];
    const GAP = level.gap;

    drawPhotoBand(photo, level.band);
    let top = PAGE_HEIGHT - level.band - 22;

    drawLabel(badge ? `${moreCopy.pdfEyebrow}  ·  ${badge}` : moreCopy.pdfEyebrow, x0, top, PWA4_ACCENT);
    top -= LABEL_SIZE + 9;
    drawTextLines(titleLines, x0, top, 32, 35, fonts.display, PWA4_INK);
    top -= titleLines.length * 35 + 12;
    page.drawRectangle({ x: x0, y: top, width: W, height: 0.75, color: PWA4_GOLD_LIGHT, opacity: 0.8 });
    top -= 20;

    if (feelsLines) {
      drawPanel(x0, top, W, feelsH, PWA4_SURFACE_PANEL);
      page.drawRectangle({ x: x0, y: top - feelsH + 12, width: 3, height: feelsH - 24, color: PWA4_ACCENT });
      drawLabel(moreCopy.feelsHeading, x0 + PAD + 6, top - PAD, PWA4_ACCENT);
      drawTextLines(feelsLines, x0 + PAD + 6, top - PAD - LABEL_SIZE - 7, 17, 22, fonts.displayItalic, PWA4_INK);
      top -= feelsH + GAP;
    }

    if (sizeCards.length) {
      drawLabel(moreCopy.sizesHeading, x0, top, PWA4_ACCENT);
      top -= LABEL_SIZE + 8;
      sizeCards.forEach((c, n) => {
        const cx = x0 + n * (colW + colGap);
        drawPanel(cx, top, colW, sizesRowH, PWA4_SURFACE_PANEL);
        let ty = top - PAD;
        drawLabel(moreCopy.sizeNames[c.i], cx + PAD, ty, PWA4_ACCENT);
        ty -= LABEL_SIZE + 4;
        page.drawText(moreCopy.sizeHints[c.i], { x: cx + PAD, y: textBaseline(ty, 8, 11), size: 8, font: fonts.sans, color: PWA4_INK_MUTED });
        ty -= 11 + 8;
        drawTextLines(c.titleL, cx + PAD, ty, 10.25, 13.5, fonts.sansBold, PWA4_INK);
        ty -= c.titleL.length * 13.5 + 4;
        drawTextLines(c.descL, cx + PAD, ty, 9, 12.5, fonts.sans, PWA4_INK_MUTED);
        ty -= c.descL.length * 12.5 + 6;
        drawTextLines(c.metaL, cx + PAD, ty, 8.75, 12, fonts.sansBold, PWA4_INK);
      });
      top -= sizesRowH + GAP;
    }

    if (placeRows.length) {
      drawLabel(moreCopy.placesHeading, x0, top, PWA4_ACCENT);
      top -= LABEL_SIZE + 6;
      drawTextLines(placesNoteLines, x0, top, 8.5, 11.5, fonts.sans, PWA4_INK_MUTED);
      top -= placesNoteLines.length * 11.5 + 8;
      for (const r of placeRows) {
        const h = placeH(r, level.notes);
        drawPanel(x0, top, W, h, PWA4_SURFACE_PANEL, PWA4_RADIUS_SM);
        let ty = top - PAD;
        drawTextLines(r.nameL, x0 + PAD, ty, 10.25, 13.5, fonts.sansBold, PWA4_INK);
        ty -= r.nameL.length * 13.5;
        if (level.notes && r.noteL.length) {
          ty -= 3;
          drawTextLines(r.noteL, x0 + PAD, ty, 9.25, 12.5, fonts.sans, PWA4_INK_MUTED);
          ty -= r.noteL.length * 12.5;
        }
        ty -= 6;
        // Links: a text label with an underline and a clickable region (same technique as the idea page).
        let lx = x0 + PAD;
        const links: { text: string; url: string }[] = [{ text: moreCopy.mapLink, url: mapsSearchUrl(r.place.name, r.place.city) }];
        if (r.place.url) links.push({ text: moreCopy.siteLink, url: r.place.url });
        for (const link of links) {
          const w = fonts.sansBold.widthOfTextAtSize(link.text, 9.25);
          const baseline = ty - 11;
          page.drawText(link.text, { x: lx, y: baseline, size: 9.25, font: fonts.sansBold, color: PWA4_INK });
          page.drawRectangle({ x: lx, y: baseline - 1.5, width: w, height: 0.6, color: PWA4_INK });
          addLinkAnnotation(page, { x: lx, y: baseline - 3, width: w, height: 14 }, link.url);
          lx += w + 16;
        }
        top -= h + 7;
      }
      top -= GAP - 7;
    }

    if (pillRows) {
      drawLabel(moreCopy.relatedHeading, x0, top, PWA4_ACCENT);
      top -= LABEL_SIZE + 8;
      y = top;
      drawPillRow(relatedLabels, PWA4_SURFACE_PANEL, PWA4_INK);
      top = y - GAP;
    }

    if (nextLines.length) {
      drawLabel(moreCopy.nextHeading, x0, top, PWA4_ACCENT);
      top -= LABEL_SIZE + 7;
      drawTextLines(nextLines, x0, top, 11, 15.5, fonts.sans, PWA4_INK);
    }
  }

  const categoryUseCount = new Map<string, number>();
  function nextPhotoVariant(category: string): number {
    const seed = categoryUseCount.get(category) ?? 0;
    categoryUseCount.set(category, seed + 1);
    return seed;
  }

  for (const [i, { idea }] of orderedIdeas.entries()) {
    page = addPage();
    const photo = await loadIdeaPhoto(idea, nextPhotoVariant(idea.photo_category));
    const doorBadge = dict.plan.book.doors[idea.door as "natural"]?.label ?? "";
    drawIdeaPage(idea, photo, { number: i + 1, badge: doorBadge });
    if (hasMoreLayers(idea)) {
      page = addPage();
      drawMorePage(idea, photo, doorBadge);
    }
  }

  // --- Page 10: Wildcard — the same page layout, its own photo (chosen the
  // same way, by its own photo_category), and its badge names it as the
  // wildcard instead of carrying a number and a door.
  page = addPage();
  {
    const wildcardPhoto = await loadIdeaPhoto(book.wildcard, nextPhotoVariant(book.wildcard.photo_category));
    drawIdeaPage(book.wildcard, wildcardPhoto, {
      number: null,
      badge: book.labels.wildcard_heading || chrome.wildcardFallbackHeading,
    });
    if (hasMoreLayers(book.wildcard)) {
      page = addPage();
      drawMorePage(book.wildcard, wildcardPhoto, book.labels.wildcard_heading || chrome.wildcardFallbackHeading);
    }
  }

  // Footer: the walnut wordmark + a short tagline + page number, on every
  // page except the cover (which already carries the full-size cream
  // wordmark up top). Every one of these pages now sits on
  // PWA4_SURFACE_PAGE's near-white, so one treatment covers all of them —
  // no more light/dark-page distinction to branch on.
  const allPages = doc.getPages();
  const footerLogoHeight = 8.5;
  const footerLogoWidth = footerLogoHeight * (images.logoColor.width / images.logoColor.height);
  allPages.forEach((footerPage, i) => {
    if (i === 0) return;
    footerPage.drawImage(images.logoColor, {
      x: PWA4_BODY_PAD_X,
      y: 32 - 1,
      width: footerLogoWidth,
      height: footerLogoHeight,
    });
    footerPage.drawText(`·  ${chrome.footerTagline}`, {
      x: PWA4_BODY_PAD_X + footerLogoWidth + 5,
      y: 32,
      size: 8,
      font: fonts.sans,
      color: PWA4_INK_MUTED,
    });
    const pageNumText = String(i + 1);
    const pageNumWidth = fonts.sans.widthOfTextAtSize(pageNumText, 8);
    footerPage.drawText(pageNumText, {
      x: PAGE_WIDTH - PWA4_BODY_PAD_X - pageNumWidth,
      y: 32,
      size: 8,
      font: fonts.sans,
      color: PWA4_INK_MUTED,
    });
  });

  return doc.save();
}
