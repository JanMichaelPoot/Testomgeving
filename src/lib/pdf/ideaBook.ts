import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage, type PDFImage } from "pdf-lib";
import { DIFFICULTY_LABELS, type GeneratedIdeaBook, type IdeaBookEntry } from "@/lib/claude/generateIdeaBook";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/language";
import { resolveStylePreset } from "@/lib/styleEngine";

const PAGE_WIDTH = 595.28; // A4 in points
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const CONTENT_HEIGHT = PAGE_HEIGHT - MARGIN * 2;

const INK = rgb(0.102, 0.102, 0.18); // #1A1A2E
const ACCENT_DARK = rgb(0.294, 0.165, 0.651); // #4B2AA6
const ACCENT = rgb(0.424, 0.235, 0.914); // #6C3CE9
const MUTED = rgb(0.4, 0.4, 0.45);
const CREAM = rgb(0.965, 0.957, 0.933); // #F5F3EE
const WHITE = rgb(1, 1, 1);
const LAVENDER_LIGHT = rgb(0.86, 0.81, 0.97);

const FONTS_DIR = path.join(process.cwd(), "src/lib/pdf/fonts");
const STYLES_DIR = path.join(process.cwd(), "public/illustrations/styles");

// Side-column layout shared by the profile page and the idea half-slots.
const SIDE_COL_WIDTH = 180;
const SIDE_COL_GAP = 24;
const TEXT_COL_X = MARGIN + SIDE_COL_WIDTH + SIDE_COL_GAP;
const TEXT_COL_WIDTH = CONTENT_WIDTH - SIDE_COL_WIDTH - SIDE_COL_GAP;

// Two ideas per page, split into equal-height slots.
const IDEA_SLOT_GAP = 20;
const IDEA_SLOT_HEIGHT = (CONTENT_HEIGHT - IDEA_SLOT_GAP) / 2;

// Wildcard's framed photo-on-color-field header.
const WILDCARD_TOP_HEIGHT = 360;
const WILDCARD_IMAGE_HEIGHT = 230;

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
  locale: Locale,
  styleId?: string
): Promise<Uint8Array> {
  const chrome = getDictionary(locale).pdfChrome;
  const style = resolveStylePreset(styleId);
  const panelTint = rgb(...style.panelTint);

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

  // The wildcard banner reuses the style's cover shot (rather than a 5th
  // generated image per style) — both are "special moment" full-bleed
  // banners, so sharing one image keeps the Style Engine to a 6x4 image
  // matrix instead of 6x5.
  const styleDir = path.join(STYLES_DIR, style.id);
  const [coverBytes, mood1Bytes, mood2Bytes, mood3Bytes] = await Promise.all([
    readFile(path.join(styleDir, "cover.jpg")),
    readFile(path.join(styleDir, "mood-1.jpg")),
    readFile(path.join(styleDir, "mood-2.jpg")),
    readFile(path.join(styleDir, "mood-3.jpg")),
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

  function drawParagraph(
    text: string,
    font: PDFFont,
    size: number,
    color = INK,
    lineGap = 6,
    x = MARGIN,
    maxWidth = CONTENT_WIDTH,
    maxLines?: number
  ) {
    const lines = wrapText(text, font, size, maxWidth, maxLines);
    for (const line of lines) {
      newPageIfNeeded(size + lineGap);
      page.drawText(line, { x, y, size, font, color });
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
    const bodyLines = wrapText(body, fonts.sans, 12, width - 24);
    const innerContentHeight = 10 + 4 + bodyLines.length * (12 + 5);
    const verticalPadding = 14;
    const calloutHeight = innerContentHeight + verticalPadding * 2;
    newPageIfNeeded(calloutHeight + 16);

    const calloutTop = y;
    page.drawRectangle({
      x: x - 12,
      y: calloutTop - calloutHeight,
      width: width + 24,
      height: calloutHeight,
      borderColor: ACCENT_DARK,
      borderWidth: 1,
      color: WHITE,
    });

    y = calloutTop - verticalPadding;
    drawParagraph(heading, fonts.sansBold, 10, ACCENT_DARK, 4, x, width);
    drawParagraph(body, fonts.sans, 12, INK, 5, x, width);
    y = calloutTop - calloutHeight - 20;
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

    const panelHeight = imgY - bottomY;
    if (panelHeight > 0) {
      page.drawRectangle({ x, y: bottomY, width: colWidth, height: panelHeight, color: panelTint });
    }

    page.drawRectangle({
      x,
      y: bottomY,
      width: colWidth,
      height: topY - bottomY,
      borderColor: ACCENT_DARK,
      borderWidth: 1,
    });

    if (typeof badgeIndex === "number") {
      const badgeRadius = 15;
      const badgeX = x + 6;
      const badgeY = imgY + 6;
      page.drawCircle({ x: badgeX, y: badgeY, size: badgeRadius, color: ACCENT });
      const numText = String(badgeIndex);
      const numWidth = fonts.sansBold.widthOfTextAtSize(numText, 13);
      page.drawText(numText, {
        x: badgeX - numWidth / 2,
        y: badgeY - 4.5,
        size: 13,
        font: fonts.sansBold,
        color: WHITE,
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

    const bandHeight = PAGE_HEIGHT - bannerHeight;
    page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: bandHeight, color: ACCENT_DARK });

    y = bandHeight - 40;
    drawParagraph(chrome.coverEyebrow, fonts.sansBold, 10, LAVENDER_LIGHT, 4);
    y -= 10;
    drawParagraph(title, fonts.serif, 26, WHITE, 8, MARGIN, CONTENT_WIDTH, 3);
    y -= 4;
    drawParagraph(chrome.coverTagline, fonts.sans, 12, LAVENDER_LIGHT, 5, MARGIN, CONTENT_WIDTH, 2);
  }

  // --- Page 2: Profile — full-height side column, profile text alongside.
  page = addPage();
  {
    const topY = PAGE_HEIGHT - MARGIN;
    const bottomY = MARGIN;
    drawSideColumn(MARGIN, topY, SIDE_COL_WIDTH, bottomY, images.moods[0]);

    y = topY;
    drawParagraph(chrome.profileEyebrow, fonts.sansBold, 10, ACCENT_DARK, 4, TEXT_COL_X, TEXT_COL_WIDTH);
    y -= 6;
    drawParagraph(book.profile_summary, fonts.serif, 17, INK, 7, TEXT_COL_X, TEXT_COL_WIDTH, 8);

    if (book.must_haves.length > 0) {
      y -= 12;
      drawParagraph(chrome.mustHaves, fonts.sansBold, 10, ACCENT_DARK, 4, TEXT_COL_X, TEXT_COL_WIDTH);
      y -= 2;
      drawBulletList(book.must_haves, fonts.sans, 11.5, TEXT_COL_X, TEXT_COL_WIDTH);
    }

    if (book.preferences.length > 0) {
      y -= 10;
      drawParagraph(chrome.preferences, fonts.sansBold, 10, ACCENT_DARK, 4, TEXT_COL_X, TEXT_COL_WIDTH);
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
      });
    }
  }

  // A single compact "meta" line — used for the practical/location/
  // requirements rows in the tight half-page idea slots. Fase 1 keeps
  // these to one line each (Fase 2 gives content-rich ideas their own
  // full page instead of squeezing everything into a half-page slot).
  function drawMetaLine(label: string, value: string, x: number, maxWidth: number) {
    if (!value) return;
    newPageIfNeeded(9 + 4);
    const labelWidth = fonts.sansBold.widthOfTextAtSize(`${label}: `, 9);
    page.drawText(`${label}:`, { x, y, size: 9, font: fonts.sansBold, color: ACCENT_DARK });
    const lines = wrapText(value, fonts.sans, 9, maxWidth - labelWidth, 1);
    if (lines[0]) {
      page.drawText(lines[0], { x: x + labelWidth, y, size: 9, font: fonts.sans, color: INK });
    }
    y -= 9 + 4;
  }

  // --- Pages 3-5: ideas, two per page, six total — each in a fixed-height
  // half-slot so the page is always full regardless of how much text a
  // given idea got.
  function drawIdeaSlot(idea: IdeaBookEntry, index: number, moodImage: PDFImage, slotTopY: number) {
    const slotBottomY = slotTopY - IDEA_SLOT_HEIGHT;
    drawSideColumn(MARGIN, slotTopY, SIDE_COL_WIDTH, slotBottomY, moodImage, index);

    y = slotTopY;
    drawParagraph(chrome.possibilityEyebrow, fonts.sansBold, 9.5, ACCENT_DARK, 3, TEXT_COL_X, TEXT_COL_WIDTH);
    y -= 2;
    drawParagraph(idea.title, fonts.serif, 15.5, INK, 5, TEXT_COL_X, TEXT_COL_WIDTH, 2);
    y -= 3;
    drawParagraph(idea.intro, fonts.sans, 10, MUTED, 4, TEXT_COL_X, TEXT_COL_WIDTH, 2);
    y -= 4;
    drawParagraph(idea.why_it_fits, fonts.sans, 10, INK, 4, TEXT_COL_X, TEXT_COL_WIDTH, 2);
    y -= 6;
    drawParagraph(
      book.labels.steps_heading || chrome.stepsFallback,
      fonts.sansBold,
      9,
      ACCENT_DARK,
      3,
      TEXT_COL_X,
      TEXT_COL_WIDTH
    );
    y -= 1;
    drawNumberedList(idea.details, fonts.sans, 9.5, TEXT_COL_X, TEXT_COL_WIDTH, 2);
    y -= 3;

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
        TEXT_COL_WIDTH
      );
    }

    if (idea.requirements.length > 0) {
      drawMetaLine(
        book.labels.requirements_heading || chrome.requirementsFallback,
        idea.requirements.join(", "),
        TEXT_COL_X,
        TEXT_COL_WIDTH
      );
    }

    y -= 2;
    drawParagraph(
      book.labels.first_action_heading || chrome.firstActionFallback,
      fonts.sansBold,
      8.5,
      ACCENT_DARK,
      2,
      TEXT_COL_X,
      TEXT_COL_WIDTH
    );
    drawParagraph(idea.first_action, fonts.sans, 9.5, INK, 3, TEXT_COL_X, TEXT_COL_WIDTH, 2);

    // Same fill-the-remainder backstop as the profile/wildcard pages, so a
    // terser idea doesn't read as visually lighter than its neighbor slot.
    if (y - slotBottomY > 10) {
      page.drawRectangle({
        x: TEXT_COL_X,
        y: slotBottomY,
        width: TEXT_COL_WIDTH,
        height: y - slotBottomY,
        color: panelTint,
      });
    }
  }

  for (let i = 0; i < book.ideas.length; i += 2) {
    page = addPage();
    const topSlotTop = PAGE_HEIGHT - MARGIN;
    const bottomSlotTop = topSlotTop - IDEA_SLOT_HEIGHT - IDEA_SLOT_GAP;

    drawIdeaSlot(book.ideas[i], i + 1, images.moods[i % images.moods.length], topSlotTop);
    if (book.ideas[i + 1]) {
      drawIdeaSlot(
        book.ideas[i + 1],
        i + 2,
        images.moods[(i + 1) % images.moods.length],
        bottomSlotTop
      );
    }
  }

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

    y = PAGE_HEIGHT - WILDCARD_IMAGE_HEIGHT - 34;
    drawParagraph(
      book.labels.wildcard_heading || chrome.wildcardFallbackHeading,
      fonts.sansBold,
      10,
      LAVENDER_LIGHT,
      4,
      MARGIN,
      CONTENT_WIDTH,
      1
    );
    y -= 8;
    drawParagraph(book.wildcard.title, fonts.serif, 22, WHITE, 7, MARGIN, CONTENT_WIDTH, 2);

    y = PAGE_HEIGHT - WILDCARD_TOP_HEIGHT - 32;
    drawParagraph(book.wildcard.intro, fonts.sans, 13.5, MUTED, 6, MARGIN, CONTENT_WIDTH, 2);
    y -= 8;
    drawParagraph(book.wildcard.why_it_fits, fonts.sans, 13.5, INK, 6, MARGIN, CONTENT_WIDTH, 3);
    y -= 14;
    drawParagraph(
      book.labels.steps_heading || chrome.stepsFallback,
      fonts.sansBold,
      12,
      ACCENT_DARK,
      5
    );
    y -= 2;
    drawNumberedList(book.wildcard.details, fonts.sans, 13.5, MARGIN, CONTENT_WIDTH, 2);
    y -= 6;

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
        CONTENT_WIDTH
      );
    }
    if (book.wildcard.requirements.length > 0) {
      drawMetaLine(
        book.labels.requirements_heading || chrome.requirementsFallback,
        book.wildcard.requirements.join(", "),
        MARGIN,
        CONTENT_WIDTH
      );
    }
    y -= 4;

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
