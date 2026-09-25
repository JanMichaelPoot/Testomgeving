import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFString, rgb, type PDFFont, type PDFPage, type PDFImage, type RGB } from "pdf-lib";
import { DIFFICULTY_LABELS, type GeneratedIdeaBook, type IdeaBookEntry } from "@/lib/claude/generateIdeaBook";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/language";
import { mapsSearchUrl } from "@/lib/maps";
import { ideaCategoryPhoto } from "@/lib/illustrations";
import { DOOR_ORDER, orderIdeasByDoor, pickOneThingIndex } from "@/lib/possibilityMap";
import {
  EXPERIENCE_DIMENSIONS,
  activityKindFor,
  budgetStatusFor,
  editorialFor,
  experienceProfileFor,
  extractUrl,
  fillTemplate,
  ideaPageLabels,
  kindCopy,
  pickStable,
  scheduleFor,
  timeFits,
  type IdeaPageLabels,
} from "@/lib/pdf/ideaContent";

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
const PWA4_INK = rgb(0.227, 0.157, 0.125); // #3A2820
const PWA4_INK_MUTED = rgb(0.42, 0.369, 0.298); // #6B5E4C
const PWA4_INK_INVERSE = rgb(1, 0.988, 0.965); // #FFFCF6
const PWA4_SURFACE_PAGE = rgb(1, 0.996, 0.984); // #FFFEFB
const PWA4_SURFACE_PANEL = rgb(0.965, 0.953, 0.933); // #F6F3EE
const PWA4_SURFACE_INVERSE = PWA4_INK; // #3A2820 — same value, named per the design token
const PWA4_ACCENT = rgb(0.851, 0.549, 0.29); // #D98C4A
const PWA4_SCRIM_RGB = rgb(0.102, 0.071, 0.047); // rgba(26,18,12,*)

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
  serif: PDFFont;
  sans: PDFFont;
  sansBold: PDFFont;
}

interface Images {
  cover: PDFImage;
  background: PDFImage;
  logoCream: PDFImage; // reversed wordmark — for dark photo/scrim backgrounds
  logoColor: PDFImage; // walnut wordmark — for light surface-page backgrounds
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

// What the renderer may know about the person beyond the generated book — all
// optional: without it the idea pages simply leave out the company cell, the
// budget status and the derived "it fits" sentence.
export interface IdeaBookPdfContext {
  company?: string[]; // stored intake values, e.g. ["alone"]
  budget?: string; // "free" | "25" | "100" | "allin"
  timeAvailable?: string; // "hour" | "halfday" | "fullday" | "weekend"
}

export async function renderIdeaBookPdf(
  book: GeneratedIdeaBook,
  title: string,
  locale: Locale,
  context: IdeaBookPdfContext = {}
): Promise<Uint8Array> {
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
  const orderedIdeas = orderIdeasByDoor(book.ideas);
  const oneThingIndex = pickOneThingIndex(book.ideas);
  // Fixed page plan (cover, profile, overview, one page per ordered idea,
  // wildcard) — used to print real "p. N" references on the overview page
  // instead of a placeholder.
  const FIRST_IDEA_PAGE = 4;

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const [serifBytes, sansBytes, sansBoldBytes] = await Promise.all([
    readFile(path.join(FONTS_DIR, "NotoSerif-Bold.ttf")),
    readFile(path.join(FONTS_DIR, "NotoSans-Regular.ttf")),
    readFile(path.join(FONTS_DIR, "NotoSans-Bold.ttf")),
  ]);

  const fonts: Fonts = {
    serif: await doc.embedFont(serifBytes),
    sans: await doc.embedFont(sansBytes),
    sansBold: await doc.embedFont(sansBoldBytes),
  };

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
  };

  // One photo per idea (plus the wildcard), chosen by that idea's own
  // photo_category — see ideaCategoryPhoto()/PHOTO_CATEGORIES in
  // lib/illustrations.ts and the system prompt in generateIdeaBook.ts.
  // Loaded on demand here (still a local file read of a pre-generated,
  // committed asset — never a live Gemini call) rather than up front,
  // since which categories are needed depends on this specific book.
  const ideaPhotoCache = new Map<string, PDFImage>();
  async function loadIdeaPhoto(category: IdeaBookEntry["photo_category"], variantSeed: number): Promise<PDFImage> {
    const publicPath = ideaCategoryPhoto(category, variantSeed);
    const cached = ideaPhotoCache.get(publicPath);
    if (cached) return cached;
    const bytes = await readFile(path.join(process.cwd(), "public", publicPath));
    const image = await doc.embedJpg(bytes);
    ideaPhotoCache.set(publicPath, image);
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

  // --- Page 1: Cover — full-bleed photo, a bottom scrim (the same stacked-
  // band technique as the idea pages' hero), the cream wordmark near the
  // top, and the eyebrow/title/tagline set into the dark part of the scrim.
  page = addPage();
  {
    drawFullBleedImage(images.cover);

    const scrimHeight = PAGE_HEIGHT * 0.58;
    const steps = 40;
    const bandHeight = scrimHeight / steps;
    for (let i = 0; i < steps; i++) {
      const t = 1 - i / steps;
      page.drawRectangle({
        x: 0,
        y: i * bandHeight,
        width: PAGE_WIDTH,
        height: bandHeight + 1,
        color: PWA4_SCRIM_RGB,
        opacity: 0.82 * t * t,
      });
    }

    // A soft vignette behind the top-left wordmark, independent of the
    // scrim below — the cover photo can vary in brightness at that corner,
    // and the mark needs to read reliably regardless.
    const logoHeight = 16;
    const logoWidth = logoHeight * (images.logoCream.width / images.logoCream.height);
    page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - PWA4_BODY_PAD_X * 2 - logoHeight,
      width: logoWidth + PWA4_BODY_PAD_X * 2,
      height: PWA4_BODY_PAD_X * 2 + logoHeight,
      color: PWA4_SCRIM_RGB,
      opacity: 0.3,
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
    y = 168;
    drawTrackedLine(chrome.coverEyebrow, fonts.sansBold, 9, PWA4_INK_INVERSE, PWA4_BODY_PAD_X, y, 0.9);
    y -= 9 + PWA4_SPACE_7;
    drawParagraph(title, fonts.serif, 34, PWA4_INK_INVERSE, 8, PWA4_BODY_PAD_X, PWA4_CONTENT_WIDTH, 2);
    y -= PWA4_SPACE_3;
    drawParagraph(chrome.coverTagline, fonts.sans, 12, PWA4_INK_INVERSE, 5, PWA4_BODY_PAD_X, PWA4_CONTENT_WIDTH, 2);
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
    y -= 8.25 + PWA4_SPACE_2;
    drawParagraph(book.profile_summary, fonts.serif, 15, PWA4_INK, 7, PWA4_BODY_PAD_X, PWA4_CONTENT_WIDTH, 7);

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
    y -= 8.25 + PWA4_SPACE_3;
    drawParagraph(mapCopy.mapHeading, fonts.serif, 21, PWA4_INK, 6, PWA4_BODY_PAD_X, PWA4_CONTENT_WIDTH, 2);
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
          const pageNum = FIRST_IDEA_PAGE + orderedIdeas.findIndex((e) => e.originalIndex === originalIndex);
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
  const HERO_TITLE_SIZE = 23;
  const HERO_SUB_SIZE = 10.5;
  const HERO_SUB_LH = 14.5;
  const LABEL_SIZE = 7.25;
  const BODY_SIZE = 9.75;
  const BODY_LH = 13;

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
    const size = 10.5;
    const lh = 15;
    const lines = wrapText(body, fonts.sans, size, width - padX * 2 - 4, 5);
    const height = padY * 2 + LABEL_SIZE + 6 + lines.length * lh;
    return {
      height,
      draw(x, top, h) {
        drawPanel(x, top, width, h, PWA4_SURFACE_PANEL);
        page.drawRectangle({ x, y: top - h, width: 2.25, height: h, color: PWA4_SURFACE_INVERSE });
        drawLabel(label, x + padX, top - padY);
        drawTextLines(lines, x + padX, top - padY - LABEL_SIZE - 6, size, lh, fonts.sans, PWA4_INK);
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
              opacity: 0.45,
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
            size: 14,
            font: fonts.serif,
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
    const costLines = wrapText(cost, fonts.serif, 16, width - padX * 2, 2);
    const statusLines = status ? wrapText(status, fonts.sansBold, 9, width - padX * 2, 4) : [];
    const height =
      padY * 2 + LABEL_SIZE + 6 + costLines.length * 20 + 2 + 11 + (statusLines.length > 0 ? 6 + statusLines.length * 12 : 0);
    return {
      height,
      draw(x, top, h) {
        drawPanel(x, top, width, h, PWA4_SURFACE_PANEL);
        drawLabel(labels.invest, x + padX, top - padY);
        let cursor = top - padY - LABEL_SIZE - 6;
        drawTextLines(costLines, x + padX, cursor, 16, 20, fonts.serif, PWA4_INK);
        cursor -= costLines.length * 20 + 2;
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
    const matchText = [idea.why_it_fits, fitSentence].filter(Boolean).join(" ");

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
    const schedule = scheduleFor(kind, durationText, locale);

    // Prefer lines no earlier page of this book has used, so several ideas of
    // the same kind don't all carry the same checklist.
    const seed = idea.title;
    const takeaways = pickStable(copy.takeaways, 3, seed, usedTakeaways);
    const suggestions = pickStable(copy.suggestions, 3, seed + "·", usedSuggestions);
    takeaways.forEach((t) => usedTakeaways.add(t));
    suggestions.forEach((t) => usedSuggestions.add(t));
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
    let titleLines = wrapText(idea.title, fonts.serif, titleSize, PWA4_CONTENT_WIDTH);
    for (const smaller of [20, 17.5]) {
      if (titleLines.length <= 2) break;
      titleSize = smaller;
      titleLines = wrapText(idea.title, fonts.serif, titleSize, PWA4_CONTENT_WIDTH);
    }
    titleLines = wrapText(idea.title, fonts.serif, titleSize, PWA4_CONTENT_WIDTH, 2);
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
      rows.push({ cols: [{ block: blockStart(PWA4_CONTENT_WIDTH, startLabel, url, idea.first_action), frac: 1 }] });
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
  // rectangle drawn afterwards), a bottom-anchored scrim (stacked bands — pdf-lib
  // has no real gradient fill), the door/wildcard badge top-left, and the title
  // with the subtitle beneath it.
  function drawHero(
    photo: PDFImage,
    hero: { height: number; badge: string; titleLines: string[]; titleSize: number; subtitleLines: string[] }
  ) {
    const heroBottomY = PAGE_HEIGHT - hero.height;
    const { width, height } = coverFitSize(photo, PAGE_WIDTH, hero.height);
    page.drawImage(photo, { x: (PAGE_WIDTH - width) / 2, y: PAGE_HEIGHT - height, width, height });

    const steps = 8;
    const bandHeight = hero.height / steps;
    for (let i = 0; i < steps; i++) {
      const t = 1 - i / steps;
      page.drawRectangle({
        x: 0,
        y: heroBottomY + i * bandHeight,
        width: PAGE_WIDTH,
        height: bandHeight + 1,
        color: PWA4_SCRIM_RGB,
        opacity: 0.78 * t * t,
      });
    }
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
        font: fonts.serif,
        color: PWA4_INK_INVERSE,
      });
    });
  }

  // Counts how many times each category has been used so far in this book,
  // so two ideas sharing a category get the category's two different
  // photo variants instead of both landing on the same one (which a
  // page-index-based seed would do whenever two same-category ideas happen
  // to land on pages of the same parity).
  const categoryUseCount = new Map<string, number>();
  function nextPhotoVariant(category: string): number {
    const seed = categoryUseCount.get(category) ?? 0;
    categoryUseCount.set(category, seed + 1);
    return seed;
  }

  for (const [i, { idea }] of orderedIdeas.entries()) {
    page = addPage();
    const photo = await loadIdeaPhoto(idea.photo_category, nextPhotoVariant(idea.photo_category));
    drawIdeaPage(idea, photo, { number: i + 1, badge: dict.plan.book.doors[idea.door as "natural"]?.label ?? "" });
  }

  // --- Page 10: Wildcard — the same page layout, its own photo (chosen the
  // same way, by its own photo_category), and its badge names it as the
  // wildcard instead of carrying a number and a door.
  page = addPage();
  {
    const wildcardPhoto = await loadIdeaPhoto(
      book.wildcard.photo_category,
      nextPhotoVariant(book.wildcard.photo_category)
    );
    drawIdeaPage(book.wildcard, wildcardPhoto, {
      number: null,
      badge: book.labels.wildcard_heading || chrome.wildcardFallbackHeading,
    });
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
