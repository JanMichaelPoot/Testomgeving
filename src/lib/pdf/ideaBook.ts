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

const PWA4_HERO_HEIGHT = 225; // 300px
const PWA4_BODY_PAD_X = 21; // space-6, 28px
const PWA4_BODY_PAD_TOP = 15; // space-5, 20px
const PWA4_SPACE_2 = 6; // 8px
const PWA4_SPACE_3 = 9; // 12px
const PWA4_SPACE_4 = 12; // 16px
const PWA4_SPACE_5 = 15; // 20px
const PWA4_SPACE_7 = 30; // 40px
const PWA4_RADIUS_SM = 7.5; // 10px
const PWA4_RADIUS_MD = 15; // 20px
const PWA4_STEP_BADGE_D = 21; // 28px
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
  const words = text.split(/\s+/).filter(Boolean);
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

export async function renderIdeaBookPdf(
  book: GeneratedIdeaBook,
  title: string,
  locale: Locale
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

  // --- Pages 4-9 (ideas) and page 10 (wildcard): one full page each,
  // rebuilt to the PossibilityPageA4 design system (see the big comment
  // block near PWA4_INK above for the spec source and this
  // implementation's three deliberate departures from it). Ideas are still
  // laid out in door order (natural → discovery → unexpected → stretch)
  // rather than Claude's raw array order, the same journey-from-comfort-
  // zone arc as the web viewer.
  const pwa4HeroBottomY = PAGE_HEIGHT - PWA4_HERO_HEIGHT;

  // Hero photo (top-aligned, any cover-fit overflow hidden a moment later
  // under the opaque body rectangle — the same technique coverFitSize's
  // other full-bleed callers already rely on), its bottom-anchored scrim
  // gradient (stacked bands — pdf-lib has no real gradient fill), the
  // title, and an optional wildcard pill badge top-right.
  function pwa4DrawHero(photo: PDFImage, titleLine: string, badgeLabel: string | null) {
    const { width, height } = coverFitSize(photo, PAGE_WIDTH, PWA4_HERO_HEIGHT);
    page.drawImage(photo, { x: (PAGE_WIDTH - width) / 2, y: PAGE_HEIGHT - height, width, height });

    const steps = 8;
    const bandHeight = PWA4_HERO_HEIGHT / steps;
    for (let i = 0; i < steps; i++) {
      const t = 1 - i / steps;
      page.drawRectangle({
        x: 0,
        y: pwa4HeroBottomY + i * bandHeight,
        width: PAGE_WIDTH,
        height: bandHeight + 1,
        color: PWA4_SCRIM_RGB,
        opacity: 0.72 * t * t,
      });
    }

    // Fills the body area (and any hero-image/gradient overflow below the
    // hero) with the page surface colour.
    page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: pwa4HeroBottomY, color: PWA4_SURFACE_PAGE });

    if (badgeLabel) {
      const padX = PWA4_SPACE_4;
      const size = 8.25;
      const labelWidth = trackedTextWidth(badgeLabel.toUpperCase(), fonts.sansBold, size, 0.9);
      const pillWidth = labelWidth + padX * 2;
      const pillHeight = 19;
      const pillX = PAGE_WIDTH - PWA4_BODY_PAD_X - pillWidth;
      const pillTop = PAGE_HEIGHT - PWA4_SPACE_5;
      page.drawSvgPath(roundedRectPath(pillWidth, pillHeight, pillHeight / 2), {
        x: pillX,
        y: pillTop,
        color: PWA4_ACCENT,
      });
      drawTrackedLine(
        badgeLabel.toUpperCase(),
        fonts.sansBold,
        size,
        PWA4_INK,
        pillX + padX,
        pillTop - pillHeight / 2 - size / 2.6,
        0.9
      );
    }

    const titleSize = 25.5;
    const titleLineHeight = 30;
    const titleWidth = PAGE_WIDTH - PWA4_BODY_PAD_X * 2;
    const titleLines = wrapText(titleLine, fonts.serif, titleSize, titleWidth, 2);
    let ty = pwa4HeroBottomY + PWA4_SPACE_5 + (titleLines.length - 1) * titleLineHeight;
    for (const line of titleLines) {
      page.drawText(line, { x: PWA4_BODY_PAD_X, y: ty, size: titleSize, font: fonts.serif, color: PWA4_INK_INVERSE });
      ty -= titleLineHeight;
    }
  }

  // "Waarom dit bij jou past" — surface-panel fill, radius-md, a thin
  // surface-inverse accent bar on the left edge (the spec's
  // wnd-panel--accent-edge).
  function pwa4DrawWhyPanel(label: string, body: string) {
    const padX = PWA4_SPACE_5;
    const padY = PWA4_SPACE_5;
    const eyebrowSize = 8.25;
    const bodySize = 12;
    const bodyLineHeight = 18;
    const innerWidth = PWA4_CONTENT_WIDTH - padX * 2;
    const bodyLines = wrapText(body, fonts.sansBold, bodySize, innerWidth, 3);
    const boxHeight = padY * 2 + eyebrowSize + PWA4_SPACE_2 + bodyLines.length * bodyLineHeight;
    newPageIfNeeded(boxHeight + PWA4_SPACE_5);
    const boxTop = y;
    const boxBottom = boxTop - boxHeight;
    if (!dryRun) {
      page.drawSvgPath(roundedRectPath(PWA4_CONTENT_WIDTH, boxHeight, PWA4_RADIUS_MD), {
        x: PWA4_BODY_PAD_X,
        y: boxTop,
        color: PWA4_SURFACE_PANEL,
      });
      page.drawRectangle({ x: PWA4_BODY_PAD_X, y: boxBottom, width: 2.25, height: boxHeight, color: PWA4_SURFACE_INVERSE });
      let ty = boxTop - padY - eyebrowSize;
      drawTrackedLine(label.toUpperCase(), fonts.sansBold, eyebrowSize, PWA4_INK_MUTED, PWA4_BODY_PAD_X + padX, ty, 0.9);
      ty -= eyebrowSize + PWA4_SPACE_2;
      for (const line of bodyLines) {
        page.drawText(line, { x: PWA4_BODY_PAD_X + padX, y: ty, size: bodySize, font: fonts.sansBold, color: PWA4_INK });
        ty -= bodyLineHeight;
      }
    }
    y = boxBottom - PWA4_SPACE_5;
  }

  // "Stappen" — an eyebrow label, then surface-inverse circular radius-full
  // badges (numbered, ink-inverse digits) each paired with one body line.
  function pwa4DrawSteps(label: string, steps: string[]) {
    if (steps.length === 0) return;
    const eyebrowSize = 8.25;
    newPageIfNeeded(eyebrowSize + PWA4_SPACE_2);
    drawTrackedLine(label.toUpperCase(), fonts.sansBold, eyebrowSize, PWA4_INK_MUTED, PWA4_BODY_PAD_X, y, 0.9);
    y -= eyebrowSize + PWA4_SPACE_2;

    const badgeD = PWA4_STEP_BADGE_D;
    const badgeR = badgeD / 2;
    const textX = PWA4_BODY_PAD_X + badgeD + PWA4_SPACE_3;
    const textWidth = PWA4_CONTENT_WIDTH - (badgeD + PWA4_SPACE_3);
    const bodySize = 12;
    const bodyLineHeight = 18;
    const numSize = 9.75;

    steps.forEach((step, i) => {
      const lines = wrapText(step, fonts.sans, bodySize, textWidth, 2);
      const blockHeight = Math.max(badgeD, lines.length * bodyLineHeight);
      newPageIfNeeded(blockHeight + PWA4_SPACE_3);
      if (!dryRun) {
        const badgeCenterY = y - badgeR;
        page.drawCircle({ x: PWA4_BODY_PAD_X + badgeR, y: badgeCenterY, size: badgeR, color: PWA4_SURFACE_INVERSE });
        const num = String(i + 1);
        const numWidth = fonts.sansBold.widthOfTextAtSize(num, numSize);
        page.drawText(num, {
          x: PWA4_BODY_PAD_X + badgeR - numWidth / 2,
          y: badgeCenterY - numSize * 0.35,
          size: numSize,
          font: fonts.sansBold,
          color: PWA4_INK_INVERSE,
        });
        let ty = y - 2;
        for (const line of lines) {
          page.drawText(line, { x: textX, y: ty, size: bodySize, font: fonts.sans, color: PWA4_INK });
          ty -= bodyLineHeight;
        }
      }
      y -= blockHeight;
      if (i < steps.length - 1) y -= PWA4_SPACE_3;
    });
    y -= PWA4_SPACE_5;
  }

  // "Kosten" — an inline chip (hugs its own text width, not full-bleed
  // like the panels above).
  function pwa4DrawCostChip(label: string, value: string) {
    if (!value) return;
    const padX = PWA4_SPACE_4;
    const padY = PWA4_SPACE_4;
    const eyebrowSize = 8.25;
    const valueSize = 10.5;
    const valueLineHeight = 15;
    const maxInnerWidth = PWA4_CONTENT_WIDTH - padX * 2;
    const lines = wrapText(value, fonts.sans, valueSize, maxInnerWidth, 2);
    const labelWidth = trackedTextWidth(label.toUpperCase(), fonts.sansBold, eyebrowSize, 0.9);
    const contentWidth = Math.max(labelWidth, ...lines.map((l) => fonts.sans.widthOfTextAtSize(l, valueSize)));
    const chipWidth = Math.min(PWA4_CONTENT_WIDTH, contentWidth + padX * 2);
    const chipHeight = padY * 2 + eyebrowSize + PWA4_SPACE_2 + lines.length * valueLineHeight;
    newPageIfNeeded(chipHeight + PWA4_SPACE_5);
    const boxTop = y;
    if (!dryRun) {
      page.drawSvgPath(roundedRectPath(chipWidth, chipHeight, PWA4_RADIUS_SM), {
        x: PWA4_BODY_PAD_X,
        y: boxTop,
        color: PWA4_SURFACE_PANEL,
      });
      let ty = boxTop - padY - eyebrowSize;
      drawTrackedLine(label.toUpperCase(), fonts.sansBold, eyebrowSize, PWA4_INK_MUTED, PWA4_BODY_PAD_X + padX, ty, 0.9);
      ty -= eyebrowSize + PWA4_SPACE_2;
      for (const line of lines) {
        page.drawText(line, { x: PWA4_BODY_PAD_X + padX, y: ty, size: valueSize, font: fonts.sans, color: PWA4_INK });
        ty -= valueLineHeight;
      }
    }
    y = boxTop - chipHeight - PWA4_SPACE_5;
  }

  // Location line — a pin glyph (drawn as a simple filled circle + triangle
  // rather than reusing the app's arc-based pin path, which isn't safe to
  // scale numerically — see scaleLinearSvgPath's own comment), the location
  // in caption, and a right-aligned underlined caption map link.
  function pwa4DrawLocationLine(idea: IdeaBookEntry) {
    if (!idea.location) return;
    const locationText = [idea.location.name, idea.location.city].filter(Boolean).join(", ");
    const size = 9.75;
    newPageIfNeeded(size + PWA4_SPACE_7);
    if (!dryRun) {
      const headR = 2.6;
      const iconX = PWA4_BODY_PAD_X;
      const headCenterY = y - headR;
      page.drawCircle({ x: iconX + headR, y: headCenterY, size: headR, color: PWA4_INK_MUTED });
      page.drawSvgPath(
        `M ${headR - 1.6},${2 * headR - 0.6} L ${headR + 1.6},${2 * headR - 0.6} L ${headR},${2 * headR + 3} Z`,
        { x: iconX, y, color: PWA4_INK_MUTED }
      );

      const textX = iconX + headR * 2 + PWA4_SPACE_2 + 2;
      const textY = y - size * 0.8;
      page.drawText(locationText, { x: textX, y: textY, size, font: fonts.sans, color: PWA4_INK });

      // "→" (U+2192) isn't in the bundled NotoSans font (same class of
      // missing-glyph bug as the ✦/★ markers elsewhere in this file — see
      // Stap 23/33's precedent) and renders as an empty box. Drawn as a
      // small vector arrow instead of a text glyph, the same fix already
      // used for the pin/spark icons above, rather than dropping the arrow
      // entirely — the map link's affordance is worth keeping.
      const mapLabel = chrome.mapLinkLabel;
      const mapTextWidth = fonts.sans.widthOfTextAtSize(mapLabel, size);
      const arrowGap = 4;
      const arrowWidth = 8;
      const totalWidth = mapTextWidth + arrowGap + arrowWidth;
      const mapX = PWA4_BODY_PAD_X + PWA4_CONTENT_WIDTH - totalWidth;
      page.drawText(mapLabel, { x: mapX, y: textY, size, font: fonts.sans, color: PWA4_INK });
      page.drawLine({
        start: { x: mapX, y: textY - 1.5 },
        end: { x: mapX + mapTextWidth, y: textY - 1.5 },
        thickness: 0.5,
        color: PWA4_INK,
      });
      const arrowY = textY + size * 0.35;
      const arrowStartX = mapX + mapTextWidth + arrowGap;
      page.drawLine({
        start: { x: arrowStartX, y: arrowY },
        end: { x: arrowStartX + arrowWidth, y: arrowY },
        thickness: 0.8,
        color: PWA4_INK,
      });
      page.drawLine({
        start: { x: arrowStartX + arrowWidth - 3, y: arrowY + 2.4 },
        end: { x: arrowStartX + arrowWidth, y: arrowY },
        thickness: 0.8,
        color: PWA4_INK,
      });
      page.drawLine({
        start: { x: arrowStartX + arrowWidth - 3, y: arrowY - 2.4 },
        end: { x: arrowStartX + arrowWidth, y: arrowY },
        thickness: 0.8,
        color: PWA4_INK,
      });
      addLinkAnnotation(
        page,
        { x: mapX, y: textY - 2, width: totalWidth, height: size + 3 },
        mapsSearchUrl(idea.location.name, idea.location.city)
      );
    }
    y -= size + PWA4_SPACE_7;
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

  // `isWildcard` no longer changes the CTA's own styling — the source
  // design has no wildcard-specific CTA variant (unlike the previous
  // Stap 36 design's gold-bordered version) — it's kept only to select
  // the pill badge text via the caller, already handled by `badgeLabel`.
  function drawActionabilityPage(idea: IdeaBookEntry, photo: PDFImage, titleLine: string, badgeLabel: string | null) {
    pwa4DrawHero(photo, titleLine, badgeLabel);

    y = pwa4HeroBottomY - PWA4_BODY_PAD_TOP;
    drawParagraph(idea.intro, fonts.sans, 12, PWA4_INK, 6, PWA4_BODY_PAD_X, PWA4_CONTENT_WIDTH, 3);
    y -= PWA4_SPACE_5;

    pwa4DrawWhyPanel(chrome.whyItFitsFallback, idea.why_it_fits);
    pwa4DrawSteps(book.labels.steps_heading || chrome.stepsFallback, idea.details);

    const practicalLine = [
      idea.practical.estimated_cost,
      idea.practical.duration,
      DIFFICULTY_LABELS[locale][idea.practical.difficulty],
    ]
      .filter(Boolean)
      .join(" · ");
    pwa4DrawCostChip(book.labels.cost_label || chrome.practicalFallback, practicalLine);

    pwa4DrawLocationLine(idea);
    pwa4DrawCta(book.labels.first_action_heading || chrome.firstActionFallback, idea.first_action);
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
    drawActionabilityPage(idea, photo, `${i + 1}. ${idea.title}`, null);
  }

  // --- Page 10: Wildcard — the same PossibilityPageA4 layout as an idea
  // page, its own photo (chosen the same way, by its own photo_category),
  // and distinguished only by the pill badge in its hero (no separate CTA
  // styling in this design — see drawActionabilityPage's own comment).
  page = addPage();
  {
    const wildcardPhoto = await loadIdeaPhoto(
      book.wildcard.photo_category,
      nextPhotoVariant(book.wildcard.photo_category)
    );
    drawActionabilityPage(
      book.wildcard,
      wildcardPhoto,
      book.wildcard.title,
      book.labels.wildcard_heading || chrome.wildcardFallbackHeading
    );
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
