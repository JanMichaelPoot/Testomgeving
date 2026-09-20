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
const MARGIN = 60;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// "Warm Walnut" — the same palette as the live website's design tokens
// (src/app/globals.css: --color-accent-dark/--color-gold/--color-paper/
// --color-cream), so the printed book finally reads as the same product as
// the site instead of the older, disconnected "sheer curtain" pastel theme.
// Every page's text still lives inside a translucent walnut "glass" card
// (a light photo calls for a dark transparent overlay, per the original
// brief) so contrast never depends on guessing what's behind it.
const PANEL_FILL = rgb(0.235, 0.161, 0.125); // walnut-dark glass (--color-accent-dark #3C2920)
const PANEL_BORDER = rgb(0.69, 0.541, 0.29); // antique gold hairline (--color-gold #B08A4A)
const TEXT_LIGHT = rgb(1, 0.992, 0.98); // near-white — primary text on panels (--color-paper #FFFDFA)
const TEXT_MUTED = rgb(0.824, 0.718, 0.478); // light gold-tan — secondary text (--color-gold-light #D2B77A)
const ACCENT = rgb(0.69, 0.541, 0.29); // antique gold — labels, hairlines, links (--color-gold)
const CREAM = rgb(0.969, 0.961, 0.941); // page fallback (--color-cream #F7F5F0, full-bleed covers it)
const SHADOW_TINT = rgb(0.07, 0.05, 0.04);

// Idea/wildcard pages (only) use a second, lighter palette — matching the
// web's own IdeaDetail card design token-for-token (see CLAUDE.md's Stap 26
// "Warm Walnut" values), on explicit request to make the printed idea pages
// look like the same product as the /plan web card instead of the separate
// full-bleed-photo "quiet luxury" language above, which the cover/profile/
// possibility-map pages keep unchanged.
const INK = rgb(0.125, 0.125, 0.125); // --color-ink #202020
const MUTED = rgb(0.467, 0.451, 0.424); // --color-muted #77736C
const WALNUT = rgb(0.357, 0.247, 0.184); // --color-accent #5B3F2F
const SURFACE_TINT = rgb(0.949, 0.925, 0.882); // --color-surface-active #F2ECE1
const PAPER = rgb(1, 0.992, 0.98); // --color-paper #FFFDFA

const FONTS_DIR = path.join(process.cwd(), "src/lib/pdf/fonts");
const IMAGES_DIR = path.join(process.cwd(), "public/illustrations/idea-book");

// The cover/profile/possibility-map pages still use this fixed single-card
// layout (a card sized to its own content via the dry-run measuring pass
// below) — only the idea/wildcard pages were rebuilt into the banner+body
// layout further down.
const CARD_TOP_Y = PAGE_HEIGHT - MARGIN - 70; // leaves clear room for the badge above it
const CARD_RADIUS = 16;
const PANEL_PAD_X = 28;
const PANEL_PAD_Y = 26;

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

  const [coverBytes, backgroundBytes] = await Promise.all([
    readFile(path.join(IMAGES_DIR, "cover.jpg")),
    readFile(path.join(IMAGES_DIR, "background.jpg")),
  ]);

  const images: Images = {
    cover: await doc.embedJpg(coverBytes),
    background: await doc.embedJpg(backgroundBytes),
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
      color: CREAM,
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
    color = TEXT_LIGHT,
    lineGap = 6,
    x = MARGIN,
    maxWidth = CONTENT_WIDTH,
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

  function drawBulletList(
    items: string[],
    font: PDFFont,
    size = 12,
    x = MARGIN,
    maxWidth = CONTENT_WIDTH,
    color = TEXT_MUTED
  ) {
    for (const item of items) {
      const lines = wrapText(`•  ${item}`, font, size, maxWidth, 2);
      for (const line of lines) {
        newPageIfNeeded(size + 6);
        if (!dryRun) page.drawText(line, { x, y, size, font, color });
        y -= size + 6;
      }
    }
  }

  // A single compact "meta" line — used for the short practical/location
  // facts. When linkUrl is given, the value itself becomes a real clickable
  // link (underlined) — used for the "view on map" location line, a safe,
  // key-less Google Maps search link rather than a fabricated exact
  // address (see the improvement plan's section 9).
  function drawMetaLine(
    label: string,
    value: string,
    x: number,
    maxWidth: number,
    linkUrl?: string,
    labelColor = ACCENT,
    valueColor = TEXT_MUTED
  ) {
    if (!value) return;
    newPageIfNeeded(9.5 + 4);
    const labelWidth = fonts.sansBold.widthOfTextAtSize(`${label}: `, 9.5);
    if (!dryRun) page.drawText(`${label}:`, { x, y, size: 9.5, font: fonts.sansBold, color: labelColor });
    const lines = wrapText(value, fonts.sans, 9.5, maxWidth - labelWidth, 1);
    if (lines[0] && !dryRun) {
      const linkColor = linkUrl ? ACCENT : valueColor;
      const textWidth = fonts.sans.widthOfTextAtSize(lines[0], 9.5);
      page.drawText(lines[0], { x: x + labelWidth, y, size: 9.5, font: fonts.sans, color: linkColor });
      if (linkUrl) {
        page.drawLine({
          start: { x: x + labelWidth, y: y - 1.5 },
          end: { x: x + labelWidth + textWidth, y: y - 1.5 },
          thickness: 0.5,
          color: linkColor,
        });
        addLinkAnnotation(
          page,
          { x: x + labelWidth, y: y - 2, width: textWidth, height: 9.5 + 3 },
          linkUrl
        );
      }
    }
    y -= 9.5 + 4;
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

  // A very light warm wash for tonal cohesion across cover/closing/shared
  // background photos — not for text contrast (every card carries its own
  // contrast via its glass fill), just a subtle unifying grade.
  function drawOverlayWash(opacity: number) {
    page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: PANEL_FILL, opacity });
  }

  // The translucent "glass" card every page's text lives inside — a warm
  // charcoal fill (dark, so it reads clearly over this book's uniformly
  // light, airy photography) with a soft rounded corner and a hairline
  // warm-taupe border, never a hard edge or a solid opaque block.
  function drawCard(x: number, cardY: number, width: number, height: number, opacity = 0.6) {
    const shadowPath = roundedRectPath(width, height, CARD_RADIUS);
    page.drawSvgPath(shadowPath, {
      x: x + 2,
      y: cardY + height - 2,
      color: SHADOW_TINT,
      opacity: 0.22,
    });
    page.drawSvgPath(roundedRectPath(width, height, CARD_RADIUS), {
      x,
      y: cardY + height,
      color: PANEL_FILL,
      opacity,
      borderColor: PANEL_BORDER,
      borderWidth: 0.75,
      borderOpacity: 0.55,
    });
  }

  // --- Page 1: Cover — full-bleed image, a single card with the title.
  page = addPage();
  {
    drawFullBleedImage(images.cover);
    drawOverlayWash(0.05);

    const cardHeight = 190;
    const cardY = 130;
    drawCard(MARGIN, cardY, CONTENT_WIDTH, cardHeight, 0.6);

    y = cardY + cardHeight - PANEL_PAD_Y;
    const textX = MARGIN + PANEL_PAD_X;
    const textWidth = CONTENT_WIDTH - PANEL_PAD_X * 2;
    drawParagraph(chrome.coverEyebrow, fonts.sansBold, 10.5, ACCENT, 4, textX, textWidth, undefined, {
      tracking: 1.2,
    });
    y -= 8;
    drawParagraph(title, fonts.serif, 28, TEXT_LIGHT, 8, textX, textWidth, 2);
    y -= 4;
    drawParagraph(chrome.coverTagline, fonts.sans, 12.5, TEXT_MUTED, 5, textX, textWidth, 2);
  }

  // --- Page 2: Profile — shared background photo, one card with the
  // profile summary and (if present) must-haves/preferences.
  page = addPage();
  {
    drawFullBleedImage(images.background, 0.15);
    drawOverlayWash(0.05);

    const cardX = MARGIN;
    const maxCardHeight = CARD_TOP_Y - MARGIN;
    const textX = cardX + PANEL_PAD_X;
    const textWidth = CONTENT_WIDTH - PANEL_PAD_X * 2;

    function drawCardContent() {
      y = CARD_TOP_Y - PANEL_PAD_Y;
      drawParagraph(chrome.profileEyebrow, fonts.sansBold, 10.5, ACCENT, 4, textX, textWidth, undefined, {
        tracking: 1,
      });
      y -= 8;
      drawParagraph(book.profile_summary, fonts.serif, 19, TEXT_LIGHT, 8, textX, textWidth, 6);

      if (book.must_haves.length > 0) {
        y -= 12;
        drawParagraph(chrome.mustHaves, fonts.sansBold, 10.5, ACCENT, 4, textX, textWidth, undefined, {
          tracking: 0.8,
        });
        y -= 2;
        drawBulletList(book.must_haves, fonts.sans, 12, textX, textWidth, TEXT_MUTED);
      }

      if (book.preferences.length > 0) {
        y -= 10;
        drawParagraph(chrome.preferences, fonts.sansBold, 10.5, ACCENT, 4, textX, textWidth, undefined, {
          tracking: 0.8,
        });
        y -= 2;
        drawBulletList(book.preferences, fonts.sans, 12, textX, textWidth, TEXT_MUTED);
      }
    }

    const measureStart = CARD_TOP_Y - PANEL_PAD_Y;
    dryRun = true;
    drawCardContent();
    const contentHeight = measureStart - y;
    dryRun = false;

    const cardHeight = Math.min(maxCardHeight, contentHeight + PANEL_PAD_Y * 2);
    drawCard(cardX, CARD_TOP_Y - cardHeight, CONTENT_WIDTH, cardHeight);
    drawCardContent();
  }

  // --- Page 3: Possibility Map — the printed mirror of the web
  // experience's map screen: the four-door legend, every idea's title
  // grouped under its door, and the One Thing pick called out. Same
  // shared-background + single dry-run-measured card pattern as the
  // profile page above.
  page = addPage();
  {
    drawFullBleedImage(images.background, -0.15);
    drawOverlayWash(0.05);

    const cardX = MARGIN;
    const maxCardHeight = CARD_TOP_Y - MARGIN;
    const textX = cardX + PANEL_PAD_X;
    const textWidth = CONTENT_WIDTH - PANEL_PAD_X * 2;

    function drawCardContent() {
      y = CARD_TOP_Y - PANEL_PAD_Y;
      drawParagraph(mapCopy.mapEyebrow, fonts.sansBold, 10.5, ACCENT, 4, textX, textWidth, undefined, {
        tracking: 1,
      });
      y -= 6;
      drawParagraph(mapCopy.mapHeading, fonts.serif, 20, TEXT_LIGHT, 6, textX, textWidth, 2);
      y -= 2;
      drawParagraph(mapCopy.mapIntro, fonts.sans, 10.5, TEXT_MUTED, 4, textX, textWidth, 2);
      y -= 14;

      for (const door of DOOR_ORDER) {
        const doorIdeas = orderedIdeas.filter(({ idea }) => idea.door === door);
        if (doorIdeas.length === 0) continue;

        drawParagraph(mapCopy.doors[door].label, fonts.sansBold, 10.5, ACCENT, 3, textX, textWidth, undefined, {
          tracking: 0.8,
        });
        y -= 1;
        drawParagraph(mapCopy.doors[door].description, fonts.sans, 9, TEXT_MUTED, 3, textX, textWidth, 1);
        y -= 3;
        for (const { idea, originalIndex } of doorIdeas) {
          const isOneThing = originalIndex === oneThingIndex;
          drawParagraph(
            // "✦" isn't in the bundled NotoSans-Bold font (same class of
            // missing-glyph bug as Stap 23's "★") and rendered as an empty
            // box — the lighter text color already distinguishes the One
            // Thing pick, so this just drops the glyph rather than hunting
            // for another one, per that same precedent.
            `•  ${idea.title}`,
            fonts.sans,
            10.5,
            isOneThing ? TEXT_LIGHT : TEXT_MUTED,
            3,
            textX,
            textWidth,
            2
          );
        }
        y -= 10;
      }

      if (oneThingIndex !== null && book.ideas[oneThingIndex]) {
        drawParagraph(mapCopy.oneThingBadge, fonts.sansBold, 9, ACCENT, 3, textX, textWidth, undefined, {
          tracking: 1,
        });
        y -= 1;
        drawParagraph(mapCopy.oneThingCaption, fonts.sans, 10, TEXT_MUTED, 4, textX, textWidth, 2);
      }
    }

    const measureStart = CARD_TOP_Y - PANEL_PAD_Y;
    dryRun = true;
    drawCardContent();
    const contentHeight = measureStart - y;
    dryRun = false;

    const cardHeight = Math.min(maxCardHeight, contentHeight + PANEL_PAD_Y * 2);
    drawCard(cardX, CARD_TOP_Y - cardHeight, CONTENT_WIDTH, cardHeight);
    drawCardContent();
  }

  // --- Pages 4-9 (ideas) and page 10 (wildcard): one full page each,
  // rebuilt on request to match the live /plan web card (IdeaDetail.tsx)
  // instead of this book's own separate full-bleed-photo "quiet luxury"
  // language — photo banner at the top, everything else on a light paper
  // body below, so the printed book finally reads as the same card design
  // the buyer already saw on the website. Ideas are still laid out in door
  // order (natural → discovery → unexpected → stretch) rather than
  // Claude's raw array order, the same journey-from-comfort-zone arc as
  // the web viewer.
  const BANNER_HEIGHT = 250;
  const BODY_TOP_Y = PAGE_HEIGHT - BANNER_HEIGHT;
  const BODY_PAD = 30;
  const GOLD_TINT = rgb(0.969, 0.954, 0.929); // ~10% gold over white, for the wildcard's first-action box

  // Cover-fits the image into the banner box, top-aligned to the page's own
  // top edge so any excess simply extends downward — safely hidden a
  // moment later underneath the opaque paper body rectangle, the same
  // "let the page edge/a later opaque draw clip it" trick coverFitSize's
  // own full-bleed callers already rely on.
  function drawBannerImage(image: PDFImage) {
    const { width, height } = coverFitSize(image, PAGE_WIDTH, BANNER_HEIGHT);
    page.drawImage(image, { x: (PAGE_WIDTH - width) / 2, y: PAGE_HEIGHT - height, width, height });
  }

  // A bottom-heavy gradient inside the banner only (never a real gradient
  // fill in pdf-lib — this is the same "stack increasingly transparent
  // bands" technique used elsewhere in this file), so the title text
  // sitting at the bottom of the banner stays legible over any photo.
  function drawBannerGradient() {
    const steps = 8;
    const bandHeight = BANNER_HEIGHT / steps;
    for (let i = 0; i < steps; i++) {
      const t = 1 - i / steps;
      page.drawRectangle({
        x: 0,
        y: BODY_TOP_Y + i * bandHeight,
        width: PAGE_WIDTH,
        height: bandHeight + 1,
        color: PANEL_FILL,
        opacity: 0.78 * t * t,
      });
    }
  }

  // Mirrors the web card exactly: no separate eyebrow line, just the
  // (optionally numbered) title sitting at the bottom of the banner, plus
  // an optional pill badge top-right for the wildcard.
  function drawBannerText(titleLine: string, badgeLabel: string | null) {
    if (badgeLabel) {
      const padX = 12;
      const labelWidth = fonts.sansBold.widthOfTextAtSize(badgeLabel, 8.5);
      const pillWidth = labelWidth + padX * 2;
      const pillHeight = 22;
      const pillX = PAGE_WIDTH - MARGIN - pillWidth;
      const pillTop = PAGE_HEIGHT - 24;
      page.drawSvgPath(roundedRectPath(pillWidth, pillHeight, pillHeight / 2), {
        x: pillX,
        y: pillTop,
        color: ACCENT,
      });
      page.drawText(badgeLabel, {
        x: pillX + padX,
        y: pillTop - pillHeight + 7,
        size: 8.5,
        font: fonts.sansBold,
        color: PANEL_FILL,
      });
    }

    const textX = MARGIN;
    const textWidth = CONTENT_WIDTH;
    const titleSize = 21;
    const titleLines = wrapText(titleLine, fonts.serif, titleSize, textWidth, 2);
    let ty = BODY_TOP_Y + 22 + (titleLines.length - 1) * (titleSize + 4);
    for (const line of titleLines) {
      page.drawText(line, { x: textX, y: ty, size: titleSize, font: fonts.serif, color: TEXT_LIGHT });
      ty -= titleSize + 4;
    }
  }

  // The tan "why it fits" callout — a left accent bar + tinted fill, sized
  // to its own wrapped text via a direct wrapText call rather than the
  // dry-run mechanism above, since a leaf paragraph's line count is already
  // knowable up front without a second real draw pass.
  function drawWhyItFitsCallout(label: string, body: string) {
    const padX = 16;
    const padY = 13;
    const bodyLines = wrapText(body, fonts.sans, 11, CONTENT_WIDTH - padX * 2, 3);
    const boxHeight = padY * 2 + (9 + 8) + bodyLines.length * (11 + 4);
    newPageIfNeeded(boxHeight + 10);
    const boxTop = y;
    const boxBottom = boxTop - boxHeight;
    if (!dryRun) {
      page.drawRectangle({ x: MARGIN, y: boxBottom, width: CONTENT_WIDTH, height: boxHeight, color: SURFACE_TINT });
      page.drawRectangle({ x: MARGIN, y: boxBottom, width: 4, height: boxHeight, color: WALNUT });
      let ty = boxTop - padY - 9;
      drawTrackedLine(label.toUpperCase(), fonts.sansBold, 9, WALNUT, MARGIN + padX, ty, 0.8);
      ty -= 9 + 8;
      for (const line of bodyLines) {
        page.drawText(line, { x: MARGIN + padX, y: ty, size: 11, font: fonts.sans, color: INK });
        ty -= 11 + 4;
      }
    }
    y = boxBottom - 16;
  }

  // Steps as a numbered list with a small filled circle badge per step
  // (matching the web card's numbered-circle steps) instead of the plain
  // "1." text prefix drawNumberedList uses elsewhere in this file.
  function drawStepsWithBadges(label: string, steps: string[]) {
    if (steps.length === 0) return;
    newPageIfNeeded(9 + 4);
    drawTrackedLine(label.toUpperCase(), fonts.sansBold, 10, INK, MARGIN, y, 0.6);
    y -= 10 + 8;

    const badgeR = 9;
    const textX = MARGIN + badgeR * 2 + 10;
    const textWidth = CONTENT_WIDTH - (badgeR * 2 + 10);
    steps.forEach((step, i) => {
      const lines = wrapText(step, fonts.sans, 11, textWidth, 2);
      const blockHeight = lines.length * (11 + 4);
      newPageIfNeeded(blockHeight + 8);
      if (!dryRun) {
        const badgeCenterY = y - 7;
        page.drawCircle({ x: MARGIN + badgeR, y: badgeCenterY, size: badgeR, color: WALNUT });
        const num = String(i + 1);
        const numWidth = fonts.sansBold.widthOfTextAtSize(num, 9.5);
        page.drawText(num, {
          x: MARGIN + badgeR - numWidth / 2,
          y: badgeCenterY - 3.3,
          size: 9.5,
          font: fonts.sansBold,
          color: PAPER,
        });
        let ty = y;
        for (const line of lines) {
          page.drawText(line, { x: textX, y: ty, size: 11, font: fonts.sans, color: INK });
          ty -= 11 + 4;
        }
      }
      y -= blockHeight + 8;
    });
    y -= 8;
  }

  // One light "meta" box (cost/practical or requirements) — up to two sit
  // side by side via drawMetaBoxRow below.
  function drawMetaBox(x: number, width: number, label: string, lines: string[]) {
    const padX = 14;
    const padY = 12;
    const boxHeight = padY * 2 + (8.5 + 6) + lines.length * (10.5 + 4);
    if (!dryRun) {
      page.drawSvgPath(roundedRectPath(width, boxHeight, 10), { x, y: y + boxHeight, color: CREAM });
      let ty = y + boxHeight - padY - 8.5;
      drawTrackedLine(label.toUpperCase(), fonts.sansBold, 8.5, MUTED, x + padX, ty, 0.6);
      ty -= 8.5 + 6;
      for (const line of lines) {
        page.drawText(line, { x: x + padX, y: ty, size: 10.5, font: fonts.sans, color: INK });
        ty -= 10.5 + 4;
      }
    }
    return boxHeight;
  }

  function drawMetaBoxRow(
    costLabel: string,
    costLine: string,
    requirementsLabel: string,
    requirements: string[]
  ) {
    const hasCost = costLine.length > 0;
    const hasRequirements = requirements.length > 0;
    if (!hasCost && !hasRequirements) return;

    const gap = 14;
    const colWidth = hasCost && hasRequirements ? (CONTENT_WIDTH - gap) / 2 : CONTENT_WIDTH;
    const costLines = hasCost ? wrapText(costLine, fonts.sans, 10.5, colWidth - 28, 2) : [];
    const reqLines = hasRequirements
      ? requirements.flatMap((r) => wrapText(`•  ${r}`, fonts.sans, 10.5, colWidth - 28, 1))
      : [];

    const costHeight = hasCost ? 24 + 14.5 + costLines.length * 14.5 : 0;
    const reqHeight = hasRequirements ? 24 + 14.5 + reqLines.length * 14.5 : 0;
    const rowHeight = Math.max(costHeight, reqHeight);
    newPageIfNeeded(rowHeight + 12);
    y -= rowHeight;

    if (hasCost) drawMetaBox(MARGIN, colWidth, costLabel, costLines);
    if (hasRequirements) {
      const x = hasCost ? MARGIN + colWidth + gap : MARGIN;
      drawMetaBox(x, colWidth, requirementsLabel, reqLines);
    }
    y -= 16;
  }

  // The location line reuses drawMetaLine's link-annotation machinery, just
  // recolored for this page's light background instead of its dark-glass
  // default.
  function drawLocationLine(label: string, idea: IdeaBookEntry) {
    if (!idea.location) return;
    const line = [idea.location.name, idea.location.city].filter(Boolean).join(", ");
    drawMetaLine(label, line, MARGIN, CONTENT_WIDTH, mapsSearchUrl(idea.location.name, idea.location.city), WALNUT, MUTED);
    y -= 8;
  }

  // The "Begin hier" callout — a solid dark box for a regular idea (mirrors
  // the web's bg-accent-dark box), or a lighter gold-tinted, gold-bordered
  // box for the wildcard (mirrors the web's isWildcard variant) — sized to
  // its own text the same way the why-it-fits callout above is.
  function drawFirstActionCallout(label: string, body: string, isWildcard: boolean) {
    if (!body) return;
    const padX = 18;
    const padY = 16;
    const bodyLines = wrapText(body, fonts.sansBold, 13, CONTENT_WIDTH - padX * 2, 2);
    const boxHeight = padY * 2 + (9 + 8) + bodyLines.length * (13 + 5);
    newPageIfNeeded(boxHeight + 10);
    const boxTop = y;
    const boxBottom = boxTop - boxHeight;
    if (!dryRun) {
      const path = roundedRectPath(CONTENT_WIDTH, boxHeight, 14);
      if (isWildcard) {
        page.drawSvgPath(path, {
          x: MARGIN,
          y: boxBottom + boxHeight,
          color: GOLD_TINT,
          borderColor: ACCENT,
          borderWidth: 1.2,
        });
      } else {
        page.drawSvgPath(path, { x: MARGIN, y: boxBottom + boxHeight, color: PANEL_FILL });
      }
      let ty = boxTop - padY - 9;
      drawTrackedLine(label.toUpperCase(), fonts.sansBold, 9, ACCENT, MARGIN + padX, ty, 1);
      ty -= 9 + 8;
      const bodyColor = isWildcard ? INK : TEXT_LIGHT;
      for (const line of bodyLines) {
        page.drawText(line, { x: MARGIN + padX, y: ty, size: 13, font: fonts.sansBold, color: bodyColor });
        ty -= 13 + 5;
      }
    }
    y = boxBottom - 16;
  }

  function drawActionabilityPage(
    idea: IdeaBookEntry,
    photo: PDFImage,
    titleLine: string,
    badgeLabel: string | null,
    isWildcard: boolean
  ) {
    drawBannerImage(photo);
    drawBannerGradient();
    // Fills the body area (and, incidentally, any banner-image overflow
    // below BODY_TOP_Y — see drawBannerImage's own comment) with the same
    // paper surface color the web card's body uses.
    page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: BODY_TOP_Y, color: PAPER });
    drawBannerText(titleLine, badgeLabel);

    const practicalLine = [
      idea.practical.estimated_cost,
      idea.practical.duration,
      DIFFICULTY_LABELS[locale][idea.practical.difficulty],
    ]
      .filter(Boolean)
      .join("  ·  ");

    // The tightened schema (2 steps, short field limits — see
    // generateIdeaBook.ts) means most ideas' body content is noticeably
    // shorter than the full body area below the banner. Rather than always
    // anchoring to the top and leaving a large, uneven blank strip at the
    // bottom of shorter pages, measure the real content height with a dry
    // run first (same technique used elsewhere in this file) and start
    // from a padding that centers it — a page with more content (location,
    // requirements) still simply starts closer to the banner.
    function drawBody(topPad: number) {
      y = BODY_TOP_Y - topPad;
      drawParagraph(idea.intro, fonts.sans, 11.5, INK, 5, MARGIN, CONTENT_WIDTH, 3);
      y -= 12;
      drawWhyItFitsCallout(chrome.whyItFitsFallback, idea.why_it_fits);
      drawStepsWithBadges(book.labels.steps_heading || chrome.stepsFallback, idea.details);
      drawMetaBoxRow(
        book.labels.cost_label || chrome.practicalFallback,
        practicalLine,
        book.labels.requirements_heading || chrome.requirementsFallback,
        idea.requirements
      );
      drawLocationLine(book.labels.location_heading || chrome.locationFallback, idea);
      drawFirstActionCallout(book.labels.first_action_heading || chrome.firstActionFallback, idea.first_action, isWildcard);
    }

    dryRun = true;
    drawBody(BODY_PAD);
    const contentHeight = BODY_TOP_Y - BODY_PAD - y;
    dryRun = false;

    const availableHeight = BODY_TOP_Y - MARGIN;
    const idleSpace = Math.max(0, availableHeight - contentHeight);
    drawBody(BODY_PAD + idleSpace / 2);
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
    drawActionabilityPage(idea, photo, `${i + 1}. ${idea.title}`, null, false);
  }

  // --- Page 10: Wildcard — the same banner+body layout as an idea page,
  // its own photo (chosen the same way, by its own photo_category), and
  // distinguished by a small badge in the banner plus the gold-tinted
  // first-action box rather than an extra decorative page border.
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
      book.labels.wildcard_heading || chrome.wildcardFallbackHeading,
      true
    );
  }

  // Footer: page number + wordmark on every page except the cover — warm
  // taupe, legible against this book's uniformly light, airy photography.
  const allPages = doc.getPages();
  allPages.forEach((footerPage, i) => {
    if (i === 0) return;
    footerPage.drawText(chrome.footerWordmark, {
      x: MARGIN,
      y: 32,
      size: 8,
      font: fonts.sans,
      color: ACCENT,
    });
    const pageNumText = String(i + 1);
    const pageNumWidth = fonts.sans.widthOfTextAtSize(pageNumText, 8);
    footerPage.drawText(pageNumText, {
      x: PAGE_WIDTH - MARGIN - pageNumWidth,
      y: 32,
      size: 8,
      font: fonts.sans,
      color: ACCENT,
    });
  });

  return doc.save();
}
