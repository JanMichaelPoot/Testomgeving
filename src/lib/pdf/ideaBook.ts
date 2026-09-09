import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFString, rgb, type PDFFont, type PDFPage, type PDFImage, type RGB } from "pdf-lib";
import { DIFFICULTY_LABELS, type GeneratedIdeaBook, type IdeaBookEntry } from "@/lib/claude/generateIdeaBook";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/language";
import { mapsSearchUrl } from "@/lib/maps";

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

// A calm, editorial palette built around the user's own supplied
// photograph (soft, airy, warm-white interiors with sheer curtains) —
// replaces the earlier "quiet luxury" gold/emerald print theme entirely,
// on explicit request. Every page's text lives inside a translucent warm
// charcoal "glass" card (per the brief's own rule: a light photo calls for
// a dark transparent overlay) so contrast never depends on guessing what's
// behind it — one consistent rule instead of per-page judgement calls.
const PANEL_FILL = rgb(0.122, 0.106, 0.094); // warm charcoal glass
const PANEL_BORDER = rgb(0.78, 0.7, 0.58); // soft warm taupe hairline
const TEXT_LIGHT = rgb(0.976, 0.965, 0.941); // warm ivory — primary text on panels
const TEXT_MUTED = rgb(0.78, 0.73, 0.65); // warm taupe-cream — secondary text
const ACCENT = rgb(0.78, 0.68, 0.55); // warm taupe — labels, hairlines, links
const CREAM = rgb(0.973, 0.957, 0.925); // page fallback (full-bleed covers it)
const SHADOW_TINT = rgb(0.05, 0.04, 0.03);

const FONTS_DIR = path.join(process.cwd(), "src/lib/pdf/fonts");
const IMAGES_DIR = path.join(process.cwd(), "public/illustrations/idea-book");

// Every content page (profile + each idea) is a fixed two-card grid: one
// main card (title/intro/why-it-fits/steps/practical info) and, for ideas
// and the wildcard, a small first-action card pinned to the bottom — both
// sized to their own real content via the dry-run measuring pass below,
// never a fixed height that leaves a card looking mostly empty.
const CARD_TOP_Y = PAGE_HEIGHT - MARGIN - 70; // leaves clear room for the badge above it
const CARD_RADIUS = 16;
const PANEL_PAD_X = 28;
const PANEL_PAD_Y = 26;
const FIRST_ACTION_MIN_HEIGHT = 90;
const FIRST_ACTION_MAX_HEIGHT = 150;
const CARD_GAP = 16;
const BADGE_RADIUS = 22;

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
  closing: PDFImage;
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
  const chrome = getDictionary(locale).pdfChrome;

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

  const [coverBytes, backgroundBytes, closingBytes] = await Promise.all([
    readFile(path.join(IMAGES_DIR, "cover.jpg")),
    readFile(path.join(IMAGES_DIR, "background.jpg")),
    readFile(path.join(IMAGES_DIR, "closing.jpg")),
  ]);

  const images: Images = {
    cover: await doc.embedJpg(coverBytes),
    background: await doc.embedJpg(backgroundBytes),
    closing: await doc.embedJpg(closingBytes),
  };

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

  function drawNumberedList(
    items: string[],
    font: PDFFont,
    size: number,
    x: number,
    maxWidth: number,
    maxLinesPerItem?: number,
    color = TEXT_LIGHT
  ) {
    items.forEach((item, i) => {
      const lines = wrapText(`${i + 1}.  ${item}`, font, size, maxWidth, maxLinesPerItem);
      for (const line of lines) {
        newPageIfNeeded(size + 5);
        if (!dryRun) page.drawText(line, { x, y, size, font, color });
        y -= size + 5;
      }
      y -= 3;
    });
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

  // The minimal glass badge used for each idea's number — same translucent
  // language as the cards (a soft shadow, the glass fill, a hairline ring)
  // rather than a separate decorative gold "coin", to keep the page's
  // visual vocabulary to one consistent, quiet idea.
  function drawBadge(centerX: number, centerY: number, label: string) {
    page.drawCircle({ x: centerX + 1.5, y: centerY - 1.5, size: BADGE_RADIUS, color: SHADOW_TINT, opacity: 0.22 });
    page.drawCircle({ x: centerX, y: centerY, size: BADGE_RADIUS, color: PANEL_FILL, opacity: 0.62 });
    page.drawCircle({ x: centerX, y: centerY, size: BADGE_RADIUS, borderColor: PANEL_BORDER, borderWidth: 0.75 });

    const labelWidth = fonts.sansBold.widthOfTextAtSize(label, 14);
    page.drawText(label, {
      x: centerX - labelWidth / 2,
      y: centerY - 5,
      size: 14,
      font: fonts.sansBold,
      color: TEXT_LIGHT,
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

  // --- Pages 3-8: ideas, one full page each, six total. A shared
  // photograph fills the page (a subtle per-page pan keeps it from
  // looking pixel-identical seven pages running), a small glass badge
  // marks the idea number, one main card carries title/intro/why-it-
  // fits/steps/practical info, and a compact second card holds the first
  // action — both sized to their own real content via the dry-run
  // measuring pass, so a short idea never leaves a card looking empty.
  const BACKGROUND_PANS = [-0.5, 0.5, -0.2, 0.3, 0, -0.35];

  function drawIdeaPage(idea: IdeaBookEntry, index: number, panX: number) {
    drawFullBleedImage(images.background, panX);
    drawOverlayWash(0.05);

    const badgeCenterX = PAGE_WIDTH - MARGIN - BADGE_RADIUS;
    const badgeCenterY = PAGE_HEIGHT - MARGIN - BADGE_RADIUS;
    drawBadge(badgeCenterX, badgeCenterY, String(index));

    const cardX = MARGIN;
    const textX = cardX + PANEL_PAD_X;
    const textWidth = CONTENT_WIDTH - PANEL_PAD_X * 2;

    // First-action card content + measurement (bottom-anchored, compact).
    function drawFirstActionContent() {
      y -= PANEL_PAD_Y;
      drawParagraph(
        book.labels.first_action_heading || chrome.firstActionFallback,
        fonts.sansBold,
        9.5,
        ACCENT,
        4,
        textX,
        textWidth,
        undefined,
        { tracking: 1 }
      );
      y -= 2;
      drawParagraph(idea.first_action, fonts.sansBold, 13, TEXT_LIGHT, 5, textX, textWidth, 2);
    }

    const faMeasureStart = 10000; // arbitrary fixed reference, only the delta matters
    y = faMeasureStart;
    dryRun = true;
    drawFirstActionContent();
    const faContentHeight = faMeasureStart - y - PANEL_PAD_Y;
    dryRun = false;
    const firstActionHeight = Math.min(
      FIRST_ACTION_MAX_HEIGHT,
      Math.max(FIRST_ACTION_MIN_HEIGHT, faContentHeight + PANEL_PAD_Y * 2)
    );
    const firstActionTop = MARGIN + firstActionHeight;

    // Main card content + measurement, capped so it never reaches the
    // first-action card below it.
    const maxMainHeight = CARD_TOP_Y - (firstActionTop + CARD_GAP);

    function drawMainCardContent() {
      y = CARD_TOP_Y - PANEL_PAD_Y;
      drawParagraph(chrome.possibilityEyebrow, fonts.sansBold, 10.5, ACCENT, 4, textX, textWidth, undefined, {
        tracking: 0.8,
      });
      y -= 4;
      drawParagraph(idea.title, fonts.serif, 24, TEXT_LIGHT, 7, textX, textWidth, 2);
      y -= 6;
      drawParagraph(idea.intro, fonts.sans, 12.5, TEXT_MUTED, 5, textX, textWidth, 3);
      y -= 6;
      drawParagraph(idea.why_it_fits, fonts.sans, 13, TEXT_LIGHT, 5, textX, textWidth, 3);
      y -= 12;

      drawParagraph(
        book.labels.steps_heading || chrome.stepsFallback,
        fonts.sansBold,
        11,
        ACCENT,
        4,
        textX,
        textWidth,
        undefined,
        { tracking: 0.8 }
      );
      y -= 2;
      drawNumberedList(idea.details, fonts.sans, 12.5, textX, textWidth, 3, TEXT_LIGHT);
      y -= 4;

      const practicalLine = [
        idea.practical.estimated_cost,
        idea.practical.duration,
        DIFFICULTY_LABELS[locale][idea.practical.difficulty],
      ]
        .filter(Boolean)
        .join("  ·  ");
      drawMetaLine(book.labels.cost_label || chrome.practicalFallback, practicalLine, textX, textWidth);

      if (idea.location) {
        const locationLine = [idea.location.name, idea.location.city].filter(Boolean).join(", ");
        drawMetaLine(
          book.labels.location_heading || chrome.locationFallback,
          locationLine,
          textX,
          textWidth,
          mapsSearchUrl(idea.location.name, idea.location.city)
        );
      }

      if (idea.requirements.length > 0) {
        y -= 3;
        drawParagraph(
          book.labels.requirements_heading || chrome.requirementsFallback,
          fonts.sansBold,
          10,
          ACCENT,
          4,
          textX,
          textWidth,
          undefined,
          { tracking: 0.6 }
        );
        y -= 1;
        drawBulletList(idea.requirements, fonts.sans, 10.5, textX, textWidth, TEXT_MUTED);
      }
    }

    const measureStart = CARD_TOP_Y - PANEL_PAD_Y;
    dryRun = true;
    drawMainCardContent();
    const contentHeight = measureStart - y;
    dryRun = false;

    const mainCardHeight = Math.min(maxMainHeight, Math.max(160, contentHeight + PANEL_PAD_Y * 2));
    drawCard(cardX, CARD_TOP_Y - mainCardHeight, CONTENT_WIDTH, mainCardHeight);
    drawMainCardContent();

    drawCard(cardX, MARGIN, CONTENT_WIDTH, firstActionHeight, 0.68);
    y = MARGIN + firstActionHeight;
    drawFirstActionContent();
  }

  book.ideas.forEach((idea, i) => {
    page = addPage();
    drawIdeaPage(idea, i + 1, BACKGROUND_PANS[i % BACKGROUND_PANS.length]);
  });

  // --- Page 9: Wildcard — the same two-card grid as an idea page, on its
  // own full-bleed closing photograph, distinguished by its own framing
  // copy rather than an extra decorative border.
  page = addPage();
  {
    drawFullBleedImage(images.closing);
    drawOverlayWash(0.05);

    const cardX = MARGIN;
    const textX = cardX + PANEL_PAD_X;
    const textWidth = CONTENT_WIDTH - PANEL_PAD_X * 2;

    function drawFirstActionContent() {
      y -= PANEL_PAD_Y;
      drawParagraph(
        book.labels.first_action_heading || chrome.firstActionFallback,
        fonts.sansBold,
        9.5,
        ACCENT,
        4,
        textX,
        textWidth,
        undefined,
        { tracking: 1 }
      );
      y -= 2;
      drawParagraph(book.wildcard.first_action, fonts.sansBold, 13, TEXT_LIGHT, 5, textX, textWidth, 2);
    }

    const faMeasureStart = 10000;
    y = faMeasureStart;
    dryRun = true;
    drawFirstActionContent();
    const faContentHeight = faMeasureStart - y - PANEL_PAD_Y;
    dryRun = false;
    const firstActionHeight = Math.min(
      FIRST_ACTION_MAX_HEIGHT,
      Math.max(FIRST_ACTION_MIN_HEIGHT, faContentHeight + PANEL_PAD_Y * 2)
    );
    const firstActionTop = MARGIN + firstActionHeight;
    const maxMainHeight = CARD_TOP_Y - (firstActionTop + CARD_GAP);

    function drawMainCardContent() {
      y = CARD_TOP_Y - PANEL_PAD_Y;
      drawParagraph(
        book.labels.wildcard_heading || chrome.wildcardFallbackHeading,
        fonts.sansBold,
        10.5,
        ACCENT,
        4,
        textX,
        textWidth,
        1,
        { tracking: 1.2 }
      );
      y -= 4;
      drawParagraph(book.wildcard.title, fonts.serif, 24, TEXT_LIGHT, 7, textX, textWidth, 2);
      y -= 6;
      drawParagraph(book.wildcard.intro, fonts.sans, 12.5, TEXT_MUTED, 5, textX, textWidth, 3);
      y -= 6;
      drawParagraph(book.wildcard.why_it_fits, fonts.sans, 13, TEXT_LIGHT, 5, textX, textWidth, 3);
      y -= 12;

      drawParagraph(
        book.labels.steps_heading || chrome.stepsFallback,
        fonts.sansBold,
        11,
        ACCENT,
        4,
        textX,
        textWidth,
        undefined,
        { tracking: 0.8 }
      );
      y -= 2;
      drawNumberedList(book.wildcard.details, fonts.sans, 12.5, textX, textWidth, 3, TEXT_LIGHT);
      y -= 4;

      const wildcardPractical = [
        book.wildcard.practical.estimated_cost,
        book.wildcard.practical.duration,
        DIFFICULTY_LABELS[locale][book.wildcard.practical.difficulty],
      ]
        .filter(Boolean)
        .join("  ·  ");
      drawMetaLine(book.labels.cost_label || chrome.practicalFallback, wildcardPractical, textX, textWidth);
      if (book.wildcard.location) {
        const wildcardLocationLine = [book.wildcard.location.name, book.wildcard.location.city]
          .filter(Boolean)
          .join(", ");
        drawMetaLine(
          book.labels.location_heading || chrome.locationFallback,
          wildcardLocationLine,
          textX,
          textWidth,
          mapsSearchUrl(book.wildcard.location.name, book.wildcard.location.city)
        );
      }
      if (book.wildcard.requirements.length > 0) {
        y -= 3;
        drawParagraph(
          book.labels.requirements_heading || chrome.requirementsFallback,
          fonts.sansBold,
          10,
          ACCENT,
          4,
          textX,
          textWidth,
          undefined,
          { tracking: 0.6 }
        );
        y -= 1;
        drawBulletList(book.wildcard.requirements, fonts.sans, 10.5, textX, textWidth, TEXT_MUTED);
      }
    }

    const measureStart = CARD_TOP_Y - PANEL_PAD_Y;
    dryRun = true;
    drawMainCardContent();
    const contentHeight = measureStart - y;
    dryRun = false;

    const mainCardHeight = Math.min(maxMainHeight, Math.max(160, contentHeight + PANEL_PAD_Y * 2));
    drawCard(cardX, CARD_TOP_Y - mainCardHeight, CONTENT_WIDTH, mainCardHeight);
    drawMainCardContent();

    drawCard(cardX, MARGIN, CONTENT_WIDTH, firstActionHeight, 0.68);
    y = MARGIN + firstActionHeight;
    drawFirstActionContent();
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
