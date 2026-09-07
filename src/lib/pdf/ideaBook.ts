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
const MARGIN = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// "Quiet luxury" print palette for the Idea Book PDF specifically — the
// live site keeps WINDOW's own purple/cream brand (see tailwind config);
// this file's chrome is deliberately a separate, print-only treatment: a
// warm near-black ink, a deep emerald for dark bands/borders/labels, and a
// muted antique gold (never a bright/yellow gold) for accents and foil
// details. pdf-lib has no gaussian blur or gradient-fill text, so "frosted
// glass" and "metallic foil" below are approximated with layered
// semi-transparent shapes and two-tone offset text rather than true
// blur/gradients.
const INK = rgb(0.086, 0.098, 0.086); // warm near-black
const ACCENT_DARK = rgb(0.086, 0.184, 0.157); // deep emerald
const ACCENT = rgb(0.706, 0.573, 0.31); // muted antique gold
const GOLD_LIGHT = rgb(0.831, 0.729, 0.482); // pale gold sheen/highlight
const GOLD_DEEP = rgb(0.427, 0.333, 0.161); // recessed gold shadow
const MUTED = rgb(0.42, 0.4, 0.36);
const CREAM = rgb(0.973, 0.957, 0.925); // warm ivory page background
const WHITE = rgb(1, 1, 1);
const CHAMPAGNE_LIGHT = rgb(0.89, 0.83, 0.68); // pale warm text-on-dark-band
const SHADOW_TINT = rgb(0.086, 0.098, 0.086);
const LUX_PANEL = rgb(0.918, 0.898, 0.851); // warm "frosted" fill panel

const FONTS_DIR = path.join(process.cwd(), "src/lib/pdf/fonts");
// The Idea Book's single, fixed illustration set (no more user-facing
// style choice — see scripts/generate-idea-book-illustrations.ts).
const IMAGES_DIR = path.join(process.cwd(), "public/illustrations/idea-book");

// Side-column layout shared by the profile page and each idea page.
const SIDE_COL_WIDTH = 180;
const SIDE_COL_GAP = 24;
const TEXT_COL_X = MARGIN + SIDE_COL_WIDTH + SIDE_COL_GAP;
const TEXT_COL_WIDTH = CONTENT_WIDTH - SIDE_COL_WIDTH - SIDE_COL_GAP;

// Wildcard's framed photo-on-color-field header — sized to leave enough
// body room for the same amount of content an idea page carries (practical
// info, an optional location, a requirements list, a first-action
// callout), just laid out full-width below the banner instead of beside a
// side column.
const WILDCARD_TOP_HEIGHT = 260;
const WILDCARD_IMAGE_HEIGHT = 170;

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

interface Fonts {
  serif: PDFFont;
  sans: PDFFont;
  sansBold: PDFFont;
}

interface Images {
  cover: PDFImage;
  wildcard: PDFImage;
  moods: PDFImage[];
}

function imageHeightForWidth(image: PDFImage, width: number): number {
  return width * (image.height / image.width);
}

export async function renderIdeaBookPdf(
  book: GeneratedIdeaBook,
  title: string,
  locale: Locale
): Promise<Uint8Array> {
  const chrome = getDictionary(locale).pdfChrome;
  const panelTint = LUX_PANEL;

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

  // The wildcard banner reuses the cover shot (rather than a 5th generated
  // image) — both are "special moment" full-bleed banners.
  const [coverBytes, mood1Bytes, mood2Bytes, mood3Bytes] = await Promise.all([
    readFile(path.join(IMAGES_DIR, "cover.jpg")),
    readFile(path.join(IMAGES_DIR, "mood-1.jpg")),
    readFile(path.join(IMAGES_DIR, "mood-2.jpg")),
    readFile(path.join(IMAGES_DIR, "mood-3.jpg")),
  ]);

  const coverImage = await doc.embedJpg(coverBytes);
  const images: Images = {
    cover: coverImage,
    wildcard: coverImage,
    moods: [
      await doc.embedJpg(mood1Bytes),
      await doc.embedJpg(mood2Bytes),
      await doc.embedJpg(mood3Bytes),
    ],
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

  // A page-margin safety net only — the primary defense against overflow
  // is the tightened Claude schema (exactly 6 ideas, exactly 3 steps) plus
  // the maxLines caps below. This just stops a pathological response from
  // corrupting the layout instead of guaranteeing the 6-page count.
  function newPageIfNeeded(nextLineHeight: number) {
    if (y - nextLineHeight < MARGIN) {
      page = addPage();
      y = PAGE_HEIGHT - MARGIN;
    }
  }

  // Draws one line of text with manual per-character advance — pdf-lib has
  // no native letter-spacing/tracking, so a tracked look (used for the
  // small-caps section labels, for that "perfecte letter-spacing" editorial
  // feel) means placing each glyph by hand instead of one drawText call.
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
      page.drawText(ch, { x: cursor, y: lineY, size, font, color });
      cursor += font.widthOfTextAtSize(ch, size) + tracking;
    }
  }

  function drawParagraph(
    text: string,
    font: PDFFont,
    size: number,
    color = INK,
    lineGap = 6,
    x = MARGIN,
    maxWidth = CONTENT_WIDTH,
    maxLines?: number,
    options?: { tracking?: number; foil?: boolean }
  ) {
    const tracking = options?.tracking ?? 0;
    const foil = options?.foil ?? false;
    const lines = wrapText(text, font, size, maxWidth, maxLines);
    for (const line of lines) {
      newPageIfNeeded(size + lineGap);
      if (foil) {
        // A cheap stand-in for a metallic gold gradient: a deeper-gold pass
        // offset by half a point, then a pale-gold pass on top — reads as a
        // soft foil sheen without pdf-lib's lack of gradient-fill text.
        drawTrackedLine(line, font, size, GOLD_DEEP, x + 0.5, y - 0.5, tracking);
        drawTrackedLine(line, font, size, GOLD_LIGHT, x, y, tracking);
      } else if (tracking > 0) {
        drawTrackedLine(line, font, size, color, x, y, tracking);
      } else {
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
    maxWidth = CONTENT_WIDTH
  ) {
    for (const item of items) {
      const lines = wrapText(`•  ${item}`, font, size, maxWidth, 2);
      for (const line of lines) {
        newPageIfNeeded(size + 6);
        page.drawText(line, { x, y, size, font, color: INK });
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
    maxLinesPerItem?: number
  ) {
    items.forEach((item, i) => {
      const lines = wrapText(`${i + 1}.  ${item}`, font, size, maxWidth, maxLinesPerItem);
      for (const line of lines) {
        newPageIfNeeded(size + 5);
        page.drawText(line, { x, y, size, font, color: INK });
        y -= size + 5;
      }
      y -= 3;
    });
  }

  function drawCallout(
    heading: string,
    body: string,
    x = MARGIN,
    width = CONTENT_WIDTH
  ) {
    const bodyLines = wrapText(body, fonts.sans, 12, width - 28);
    const innerContentHeight = 10 + 5 + bodyLines.length * (12 + 5);
    const verticalPadding = 16;
    const calloutHeight = innerContentHeight + verticalPadding * 2;
    newPageIfNeeded(calloutHeight + 16);

    const calloutTop = y;
    const boxX = x - 14;
    const boxY = calloutTop - calloutHeight;
    const boxWidth = width + 28;

    // A soft, low-opacity offset duplicate of the box reads as a gentle
    // floating shadow — pdf-lib has no native drop-shadow, so this is the
    // standard fake: draw the shadow shape first, the real box on top.
    page.drawRectangle({
      x: boxX + 2.5,
      y: boxY - 2.5,
      width: boxWidth,
      height: calloutHeight,
      color: SHADOW_TINT,
      opacity: 0.14,
    });

    page.drawRectangle({
      x: boxX,
      y: boxY,
      width: boxWidth,
      height: calloutHeight,
      borderColor: ACCENT,
      borderWidth: 1,
      color: WHITE,
    });
    // A thin inset gold line just inside the main border reads as a foil
    // double-edge rather than a single flat stroke.
    page.drawRectangle({
      x: boxX + 2.5,
      y: boxY + 2.5,
      width: boxWidth - 5,
      height: calloutHeight - 5,
      borderColor: GOLD_LIGHT,
      borderWidth: 0.5,
    });

    y = calloutTop - verticalPadding;
    drawParagraph(heading, fonts.sansBold, 10, ACCENT_DARK, 5, x, width, undefined, { tracking: 0.6 });
    drawParagraph(body, fonts.sans, 12, INK, 5, x, width);
    y = calloutTop - calloutHeight - 20;
  }

  // A warm emerald + golden-hour color-grade wash over an already-drawn
  // image — layered semi-transparent fills, not a pixel edit of the source
  // JPEG. This is the intentional choice over regenerating the Style
  // Engine's illustrations: it's a real, cheap "edit" of the existing
  // image at render time (deeper, warmer, more cinematic) rather than a
  // brand new AI generation.
  function applyMoodColorGrade(x: number, imgY: number, width: number, height: number) {
    page.drawRectangle({ x, y: imgY, width, height, color: ACCENT_DARK, opacity: 0.16 });
    page.drawRectangle({
      x,
      y: imgY,
      width,
      height: height * 0.55,
      color: ACCENT,
      opacity: 0.14,
    });
  }

  // A side-column image at its natural (undistorted) aspect ratio, with a
  // tinted panel filling whatever height is left down to `bottomY` — this
  // is what guarantees the column always reads as visually "full", however
  // tall or short the image's natural proportions make it, without ever
  // stretching the photo. Returns the image's own bottom edge.
  function drawSideColumn(
    x: number,
    topY: number,
    colWidth: number,
    bottomY: number,
    image: PDFImage,
    badgeIndex?: number
  ): number {
    const imgHeight = Math.min(imageHeightForWidth(image, colWidth), topY - bottomY);
    const imgY = topY - imgHeight;

    page.drawImage(image, { x, y: imgY, width: colWidth, height: imgHeight });
    applyMoodColorGrade(x, imgY, colWidth, imgHeight);

    const panelHeight = imgY - bottomY;
    if (panelHeight > 0) {
      page.drawRectangle({ x, y: bottomY, width: colWidth, height: panelHeight, color: panelTint, opacity: 0.72 });
    }

    // Foil-edge frame: a slightly heavier deep-gold outer line with a
    // hairline pale-gold inset, instead of one flat solid stroke.
    page.drawRectangle({
      x,
      y: bottomY,
      width: colWidth,
      height: topY - bottomY,
      borderColor: ACCENT,
      borderWidth: 1.1,
    });
    page.drawRectangle({
      x: x + 2,
      y: bottomY + 2,
      width: colWidth - 4,
      height: topY - bottomY - 4,
      borderColor: GOLD_LIGHT,
      borderWidth: 0.4,
    });

    if (typeof badgeIndex === "number") {
      const badgeRadius = 15;
      const badgeX = x + 6;
      const badgeY = imgY + 6;
      // Layered gold badge: a recessed shadow disc, the gold base, then a
      // small offset highlight disc to fake a metallic sheen — pdf-lib
      // can't fill a circle with a gradient, so the "shine" is a second,
      // smaller, lighter circle instead.
      page.drawCircle({ x: badgeX + 1, y: badgeY - 1, size: badgeRadius, color: SHADOW_TINT, opacity: 0.25 });
      page.drawCircle({ x: badgeX, y: badgeY, size: badgeRadius, color: ACCENT });
      page.drawCircle({
        x: badgeX - 4,
        y: badgeY + 4,
        size: badgeRadius * 0.55,
        color: GOLD_LIGHT,
        opacity: 0.55,
      });
      page.drawCircle({ x: badgeX, y: badgeY, size: badgeRadius, borderColor: GOLD_DEEP, borderWidth: 0.75 });

      const numText = String(badgeIndex);
      const numWidth = fonts.sansBold.widthOfTextAtSize(numText, 13);
      page.drawText(numText, {
        x: badgeX - numWidth / 2,
        y: badgeY - 4.5,
        size: 13,
        font: fonts.sansBold,
        color: INK,
      });
    }

    return imgY;
  }

  // --- Page 1: Cover — image fills the top, the dark band fills exactly
  // whatever remains down to the page bottom, so the page is always full
  // by construction regardless of the image's exact proportions.
  page = addPage();
  {
    const bannerHeight = imageHeightForWidth(images.cover, PAGE_WIDTH);
    page.drawImage(images.cover, {
      x: 0,
      y: PAGE_HEIGHT - bannerHeight,
      width: PAGE_WIDTH,
      height: bannerHeight,
    });
    applyMoodColorGrade(0, PAGE_HEIGHT - bannerHeight, PAGE_WIDTH, bannerHeight);

    const bandHeight = PAGE_HEIGHT - bannerHeight;
    page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: bandHeight, color: ACCENT_DARK });
    // A hairline gold seam between the image and the dark band — a small
    // touch that reads as a foil-edged frame rather than a plain color cut.
    page.drawRectangle({ x: 0, y: bandHeight - 1, width: PAGE_WIDTH, height: 1.5, color: ACCENT });

    y = bandHeight - 40;
    drawParagraph(chrome.coverEyebrow, fonts.sansBold, 10, CHAMPAGNE_LIGHT, 4, MARGIN, CONTENT_WIDTH, undefined, {
      tracking: 1.2,
    });
    y -= 10;
    drawParagraph(title, fonts.serif, 26, WHITE, 8, MARGIN, CONTENT_WIDTH, 3, { foil: true });
    y -= 4;
    drawParagraph(chrome.coverTagline, fonts.sans, 12, CHAMPAGNE_LIGHT, 5, MARGIN, CONTENT_WIDTH, 2);
  }

  // --- Page 2: Profile — full-height side column, profile text alongside.
  page = addPage();
  {
    const topY = PAGE_HEIGHT - MARGIN;
    const bottomY = MARGIN;
    drawSideColumn(MARGIN, topY, SIDE_COL_WIDTH, bottomY, images.moods[0]);

    y = topY;
    drawParagraph(chrome.profileEyebrow, fonts.sansBold, 10, ACCENT_DARK, 4, TEXT_COL_X, TEXT_COL_WIDTH, undefined, { tracking: 0.8 });
    y -= 6;
    drawParagraph(book.profile_summary, fonts.serif, 17, INK, 7, TEXT_COL_X, TEXT_COL_WIDTH, 8);

    if (book.must_haves.length > 0) {
      y -= 12;
      drawParagraph(chrome.mustHaves, fonts.sansBold, 10, ACCENT_DARK, 4, TEXT_COL_X, TEXT_COL_WIDTH, undefined, { tracking: 0.8 });
      y -= 2;
      drawBulletList(book.must_haves, fonts.sans, 11.5, TEXT_COL_X, TEXT_COL_WIDTH);
    }

    if (book.preferences.length > 0) {
      y -= 10;
      drawParagraph(chrome.preferences, fonts.sansBold, 10, ACCENT_DARK, 4, TEXT_COL_X, TEXT_COL_WIDTH, undefined, { tracking: 0.8 });
      y -= 2;
      drawBulletList(book.preferences, fonts.sans, 11.5, TEXT_COL_X, TEXT_COL_WIDTH);
    }

    // Same "fill leftover space with a tinted panel" backstop as the
    // wildcard page — a short profile (no must-haves/preferences stated)
    // would otherwise leave the text column visibly emptier than the
    // full-height image column beside it.
    if (y - bottomY > 12) {
      page.drawRectangle({
        x: TEXT_COL_X,
        y: bottomY,
        width: TEXT_COL_WIDTH,
        height: y - bottomY,
        color: panelTint,
        opacity: 0.72,
      });
    }
  }

  // A single compact "meta" line — used for the short practical/location
  // facts on an idea page. Kept to one line each; requirements (which can
  // run to several items) get a real bullet list instead, see below. When
  // linkUrl is given, the value itself becomes a real clickable link
  // (underlined, accent-colored) — used for the "view on map" location
  // line, a safe, key-less Google Maps search link rather than a
  // fabricated exact address (see the improvement plan's section 9).
  function drawMetaLine(label: string, value: string, x: number, maxWidth: number, linkUrl?: string) {
    if (!value) return;
    newPageIfNeeded(9 + 4);
    const labelWidth = fonts.sansBold.widthOfTextAtSize(`${label}: `, 9);
    page.drawText(`${label}:`, { x, y, size: 9, font: fonts.sansBold, color: ACCENT_DARK });
    const lines = wrapText(value, fonts.sans, 9, maxWidth - labelWidth, 1);
    if (lines[0]) {
      const valueColor = linkUrl ? ACCENT_DARK : INK;
      const textWidth = fonts.sans.widthOfTextAtSize(lines[0], 9);
      page.drawText(lines[0], { x: x + labelWidth, y, size: 9, font: fonts.sans, color: valueColor });
      if (linkUrl) {
        page.drawLine({
          start: { x: x + labelWidth, y: y - 1.5 },
          end: { x: x + labelWidth + textWidth, y: y - 1.5 },
          thickness: 0.5,
          color: ACCENT_DARK,
        });
        addLinkAnnotation(
          page,
          { x: x + labelWidth, y: y - 2, width: textWidth, height: 9 + 3 },
          linkUrl
        );
      }
    }
    y -= 9 + 4;
  }

  // --- Pages 3-8: ideas, one full page each, six total. Earlier this
  // packed two ideas into fixed-height half-page slots with tight maxLines
  // caps to guarantee a fixed 6-page book — but the real Actionability
  // Layer content (practical info, location, a requirements list, a first
  // action) reliably overran those caps and got cut off mid-sentence with
  // an ellipsis, which is worse than a longer, complete book. A full page
  // per idea gives real content room to breathe; the "fill the remainder
  // with a tinted panel" trick still keeps every page looking intentional
  // regardless of exactly how much a given idea's text runs.
  function drawIdeaPage(idea: IdeaBookEntry, index: number, moodImage: PDFImage) {
    const topY = PAGE_HEIGHT - MARGIN;
    const bottomY = MARGIN;
    drawSideColumn(MARGIN, topY, SIDE_COL_WIDTH, bottomY, moodImage, index);

    y = topY;
    drawParagraph(chrome.possibilityEyebrow, fonts.sansBold, 10, ACCENT_DARK, 4, TEXT_COL_X, TEXT_COL_WIDTH, undefined, { tracking: 0.8 });
    y -= 4;
    drawParagraph(idea.title, fonts.serif, 21, INK, 7, TEXT_COL_X, TEXT_COL_WIDTH, 2);
    y -= 5;
    drawParagraph(idea.intro, fonts.sans, 12, MUTED, 5, TEXT_COL_X, TEXT_COL_WIDTH, 4);
    y -= 6;
    drawParagraph(idea.why_it_fits, fonts.sans, 12, INK, 5, TEXT_COL_X, TEXT_COL_WIDTH, 4);
    y -= 12;
    drawParagraph(
      book.labels.steps_heading || chrome.stepsFallback,
      fonts.sansBold,
      11,
      ACCENT_DARK,
      4,
      TEXT_COL_X,
      TEXT_COL_WIDTH
    );
    y -= 2;
    drawNumberedList(idea.details, fonts.sans, 12, TEXT_COL_X, TEXT_COL_WIDTH, 3);
    y -= 6;

    const practicalLine = [
      idea.practical.estimated_cost,
      idea.practical.duration,
      DIFFICULTY_LABELS[locale][idea.practical.difficulty],
    ]
      .filter(Boolean)
      .join("  ·  ");
    drawMetaLine(book.labels.cost_label || chrome.practicalFallback, practicalLine, TEXT_COL_X, TEXT_COL_WIDTH);

    if (idea.location) {
      const locationLine = [idea.location.name, idea.location.city].filter(Boolean).join(", ");
      drawMetaLine(
        book.labels.location_heading || chrome.locationFallback,
        locationLine,
        TEXT_COL_X,
        TEXT_COL_WIDTH,
        mapsSearchUrl(idea.location.name, idea.location.city)
      );
    }

    if (idea.requirements.length > 0) {
      y -= 4;
      drawParagraph(
        book.labels.requirements_heading || chrome.requirementsFallback,
        fonts.sansBold,
        10.5,
        ACCENT_DARK,
        4,
        TEXT_COL_X,
        TEXT_COL_WIDTH
      );
      y -= 1;
      drawBulletList(idea.requirements, fonts.sans, 11, TEXT_COL_X, TEXT_COL_WIDTH);
    }
    y -= 8;

    drawCallout(
      book.labels.first_action_heading || chrome.firstActionFallback,
      idea.first_action,
      TEXT_COL_X,
      TEXT_COL_WIDTH
    );

    // Same fill-the-remainder backstop as the profile/wildcard pages, so a
    // terser idea never reads as visually lighter than a richer one.
    if (y - bottomY > 10) {
      page.drawRectangle({
        x: TEXT_COL_X,
        y: bottomY,
        width: TEXT_COL_WIDTH,
        height: y - bottomY,
        color: panelTint,
        opacity: 0.72,
      });
    }
  }

  book.ideas.forEach((idea, i) => {
    page = addPage();
    drawIdeaPage(idea, i + 1, images.moods[i % images.moods.length]);
  });

  // --- Page 6: Wildcard — a framed photo on a colored field up top (the
  // book's other "special" moment, echoing the cover), body content below.
  page = addPage();
  {
    page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - WILDCARD_TOP_HEIGHT,
      width: PAGE_WIDTH,
      height: WILDCARD_TOP_HEIGHT,
      color: ACCENT_DARK,
    });

    const imgWidth =
      WILDCARD_IMAGE_HEIGHT * (images.wildcard.width / images.wildcard.height);
    const imgX = (PAGE_WIDTH - imgWidth) / 2;
    page.drawImage(images.wildcard, {
      x: imgX,
      y: PAGE_HEIGHT - WILDCARD_IMAGE_HEIGHT,
      width: imgWidth,
      height: WILDCARD_IMAGE_HEIGHT,
    });
    applyMoodColorGrade(imgX, PAGE_HEIGHT - WILDCARD_IMAGE_HEIGHT, imgWidth, WILDCARD_IMAGE_HEIGHT);
    page.drawRectangle({
      x: imgX,
      y: PAGE_HEIGHT - WILDCARD_IMAGE_HEIGHT,
      width: imgWidth,
      height: WILDCARD_IMAGE_HEIGHT,
      borderColor: ACCENT,
      borderWidth: 1,
    });

    y = PAGE_HEIGHT - WILDCARD_IMAGE_HEIGHT - 34;
    drawParagraph(
      book.labels.wildcard_heading || chrome.wildcardFallbackHeading,
      fonts.sansBold,
      10,
      CHAMPAGNE_LIGHT,
      4,
      MARGIN,
      CONTENT_WIDTH,
      1,
      { tracking: 1.2 }
    );
    y -= 8;
    drawParagraph(book.wildcard.title, fonts.serif, 22, WHITE, 7, MARGIN, CONTENT_WIDTH, 2, { foil: true });

    y = PAGE_HEIGHT - WILDCARD_TOP_HEIGHT - 28;
    drawParagraph(book.wildcard.intro, fonts.sans, 12, MUTED, 5, MARGIN, CONTENT_WIDTH, 3);
    y -= 6;
    drawParagraph(book.wildcard.why_it_fits, fonts.sans, 12, INK, 5, MARGIN, CONTENT_WIDTH, 3);
    y -= 10;
    drawParagraph(
      book.labels.steps_heading || chrome.stepsFallback,
      fonts.sansBold,
      11,
      ACCENT_DARK,
      4
    );
    y -= 2;
    drawNumberedList(book.wildcard.details, fonts.sans, 12, MARGIN, CONTENT_WIDTH, 2);
    y -= 4;

    const wildcardPractical = [
      book.wildcard.practical.estimated_cost,
      book.wildcard.practical.duration,
      DIFFICULTY_LABELS[locale][book.wildcard.practical.difficulty],
    ]
      .filter(Boolean)
      .join("  ·  ");
    drawMetaLine(book.labels.cost_label || chrome.practicalFallback, wildcardPractical, MARGIN, CONTENT_WIDTH);
    if (book.wildcard.location) {
      const wildcardLocationLine = [book.wildcard.location.name, book.wildcard.location.city]
        .filter(Boolean)
        .join(", ");
      drawMetaLine(
        book.labels.location_heading || chrome.locationFallback,
        wildcardLocationLine,
        MARGIN,
        CONTENT_WIDTH,
        mapsSearchUrl(book.wildcard.location.name, book.wildcard.location.city)
      );
    }
    if (book.wildcard.requirements.length > 0) {
      y -= 4;
      drawParagraph(
        book.labels.requirements_heading || chrome.requirementsFallback,
        fonts.sansBold,
        10.5,
        ACCENT_DARK,
        4,
        MARGIN,
        CONTENT_WIDTH
      );
      y -= 1;
      drawBulletList(book.wildcard.requirements, fonts.sans, 11.5, MARGIN, CONTENT_WIDTH);
    }
    y -= 6;

    drawCallout(
      book.labels.first_action_heading || chrome.firstActionFallback,
      book.wildcard.first_action
    );

    // Fill whatever's left down to the bottom margin with a tinted panel,
    // the same "let a color block guarantee full coverage" technique used
    // for the side columns elsewhere — a single page's leftover space is
    // the one spot that trick doesn't reach on its own.
    if (y - MARGIN > 12) {
      page.drawRectangle({
        x: MARGIN,
        y: MARGIN,
        width: CONTENT_WIDTH,
        height: y - MARGIN,
        color: panelTint,
        opacity: 0.72,
      });
    }
  }

  // Footer: page number + wordmark on every page except the cover.
  const allPages = doc.getPages();
  allPages.forEach((footerPage, i) => {
    if (i === 0) return;
    footerPage.drawText(chrome.footerWordmark, {
      x: MARGIN,
      y: 28,
      size: 8,
      font: fonts.sans,
      color: MUTED,
    });
    const pageNumText = String(i + 1);
    const pageNumWidth = fonts.sans.widthOfTextAtSize(pageNumText, 8);
    footerPage.drawText(pageNumText, {
      x: PAGE_WIDTH - MARGIN - pageNumWidth,
      y: 28,
      size: 8,
      font: fonts.sans,
      color: MUTED,
    });
  });

  return doc.save();
}
