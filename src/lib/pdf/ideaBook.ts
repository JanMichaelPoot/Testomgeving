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
// live site keeps its own brand tokens; this file's chrome is deliberately
// a separate, print-only treatment: a warm near-black ink, a deep emerald
// wash over every full-bleed photo, and a muted antique gold (never a
// bright/yellow gold) for accents, badges and the action bar. pdf-lib has
// no gaussian blur or gradient-fill anything, so "frosted glass" and
// "metallic foil" below are approximated with layered semi-transparent
// shapes and two-tone offset text rather than true blur/gradients.
const INK = rgb(0.086, 0.098, 0.086); // warm near-black
const ACCENT_DARK = rgb(0.086, 0.184, 0.157); // deep emerald
const ACCENT = rgb(0.706, 0.573, 0.31); // muted antique gold
const GOLD_LIGHT = rgb(0.831, 0.729, 0.482); // pale gold sheen/highlight
const GOLD_DEEP = rgb(0.427, 0.333, 0.161); // recessed gold shadow
const CREAM = rgb(0.973, 0.957, 0.925); // warm ivory page background
const WHITE = rgb(1, 1, 1);
const CHAMPAGNE_LIGHT = rgb(0.89, 0.83, 0.68); // pale warm text-on-image
const SHADOW_TINT = rgb(0.086, 0.098, 0.086);

const FONTS_DIR = path.join(process.cwd(), "src/lib/pdf/fonts");
// The Idea Book's single, fixed illustration set (no user-facing style
// choice — see scripts/generate-idea-book-illustrations.ts).
const IMAGES_DIR = path.join(process.cwd(), "public/illustrations/idea-book");

// Fixed vertical zones shared by every content page (profile, ideas,
// wildcard) — a full-bleed photo behind all three, so the layout is a
// deterministic grid rather than text that flows until it runs out:
// header block (eyebrow/title/badge/intro/why) → a frosted glass content
// panel → (ideas/wildcard only) a solid gold action bar pinned to the
// bottom. Generous on purpose — the tightened Claude schema (exactly 3
// steps, capped word counts) means real content sits well inside these
// with room to spare, rather than needing to fill every pixel.
const HEADER_ZONE_HEIGHT = 280;
const GOLD_BAR_HEIGHT = 64;
const GOLD_BAR_BOTTOM_Y = 46;
const GOLD_BAR_TOP_Y = GOLD_BAR_BOTTOM_Y + GOLD_BAR_HEIGHT;
const GLASS_PANEL_TOP_Y = PAGE_HEIGHT - MARGIN - HEADER_ZONE_HEIGHT;
const GLASS_PANEL_BOTTOM_WITH_BAR = GOLD_BAR_TOP_Y + 12;
const GLASS_PANEL_BOTTOM_NO_BAR = 46;
const PANEL_PAD_X = 24;
const PANEL_PAD_Y = 22;
const BADGE_RADIUS = 24;

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

  // The wildcard page reuses the cover shot (rather than a 5th generated
  // image) — both are "special moment" full-bleed pages.
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
  // When true, every drawing helper below still moves the `y` cursor
  // exactly as it would when drawing for real, but skips the actual
  // page.draw* calls — lets a glass panel's real height be measured by
  // running its own content-drawing function once "dry" before drawing it
  // again for real, instead of duplicating the layout logic in a second,
  // easy-to-desync measurement function.
  let dryRun = false;

  // A page-margin safety net only — the primary defense against overflow
  // is the tightened Claude schema (exactly 6 ideas, exactly 3 steps) plus
  // the maxLines caps below. This just stops a pathological response from
  // corrupting the layout instead of guaranteeing the fixed page zones.
  function newPageIfNeeded(nextLineHeight: number) {
    if (!dryRun && y - nextLineHeight < MARGIN) {
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
      if (!dryRun) page.drawText(ch, { x: cursor, y: lineY, size, font, color });
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
    color = INK
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
    color = INK
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
    labelColor = ACCENT_DARK,
    valueColor = INK
  ) {
    if (!value) return;
    newPageIfNeeded(9 + 4);
    const labelWidth = fonts.sansBold.widthOfTextAtSize(`${label}: `, 9);
    if (!dryRun) page.drawText(`${label}:`, { x, y, size: 9, font: fonts.sansBold, color: labelColor });
    const lines = wrapText(value, fonts.sans, 9, maxWidth - labelWidth, 1);
    if (lines[0] && !dryRun) {
      const textWidth = fonts.sans.widthOfTextAtSize(lines[0], 9);
      page.drawText(lines[0], { x: x + labelWidth, y, size: 9, font: fonts.sans, color: valueColor });
      if (linkUrl) {
        page.drawLine({
          start: { x: x + labelWidth, y: y - 1.5 },
          end: { x: x + labelWidth + textWidth, y: y - 1.5 },
          thickness: 0.5,
          color: valueColor,
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

  // Fills the whole page with an image at "cover" size, centered — any
  // overflow beyond the page edges is simply outside the MediaBox and
  // never rendered, which is the standard full-bleed technique.
  function drawFullBleedImage(image: PDFImage) {
    const { width, height } = coverFitSize(image, PAGE_WIDTH, PAGE_HEIGHT);
    page.drawImage(image, {
      x: (PAGE_WIDTH - width) / 2,
      y: (PAGE_HEIGHT - height) / 2,
      width,
      height,
    });
  }

  // A uniform emerald wash over the whole photo — this is what gives every
  // page its cinematic, jewel-toned mood regardless of the source photo's
  // own colors, and is a real render-time "edit" of the existing Idea Book
  // illustration set rather than a new AI generation.
  function drawOverlayWash(opacity: number) {
    page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: ACCENT_DARK, opacity });
  }

  // Approximates a bottom-to-top fade (darkest at y=0, transparent at
  // `topY`) by stacking many thin, decreasingly-opaque bands — pdf-lib has
  // no native gradient fill, so this is the standard workaround. This is
  // what keeps text legible over a busy photo without needing a solid
  // color block that would hide the image entirely.
  function drawBottomGradient(topY: number, maxOpacity: number, bands = 16) {
    const bandHeight = topY / bands;
    for (let i = 0; i < bands; i++) {
      const opacity = maxOpacity * (1 - i / (bands - 1));
      page.drawRectangle({
        x: 0,
        y: i * bandHeight,
        width: PAGE_WIDTH,
        height: bandHeight + 1,
        color: INK,
        opacity,
      });
    }
  }

  // The frosted-glass content card every content page's steps/practical
  // info/requirements sit inside — a semi-opaque dark fill (so it reads as
  // glass over the photo behind it, not a solid card) with a thin gold
  // foil double-edge, the same technique used elsewhere in this file for
  // "metallic" borders.
  function drawGlassPanel(x: number, panelY: number, width: number, height: number) {
    page.drawRectangle({ x, y: panelY, width, height, color: ACCENT_DARK, opacity: 0.58 });
    page.drawRectangle({ x, y: panelY, width, height, borderColor: ACCENT, borderWidth: 1 });
    page.drawRectangle({
      x: x + 2,
      y: panelY + 2,
      width: width - 4,
      height: height - 4,
      borderColor: GOLD_LIGHT,
      borderWidth: 0.4,
    });
  }

  // The layered gold "coin" badge used for each idea's number — a
  // recessed shadow disc, the gold base, a small offset highlight disc to
  // fake a metallic sheen (pdf-lib can't fill a circle with a gradient),
  // and a thin contour ring.
  function drawGoldBadge(centerX: number, centerY: number, label: string) {
    page.drawCircle({ x: centerX + 1.5, y: centerY - 1.5, size: BADGE_RADIUS, color: SHADOW_TINT, opacity: 0.3 });
    page.drawCircle({ x: centerX, y: centerY, size: BADGE_RADIUS, color: ACCENT });
    page.drawCircle({
      x: centerX - 6,
      y: centerY + 6,
      size: BADGE_RADIUS * 0.55,
      color: GOLD_LIGHT,
      opacity: 0.55,
    });
    page.drawCircle({ x: centerX, y: centerY, size: BADGE_RADIUS, borderColor: GOLD_DEEP, borderWidth: 0.75 });

    const labelWidth = fonts.sansBold.widthOfTextAtSize(label, 15);
    page.drawText(label, {
      x: centerX - labelWidth / 2,
      y: centerY - 5.5,
      size: 15,
      font: fonts.sansBold,
      color: INK,
    });
  }

  // The solid gold action bar pinned to the bottom of every idea/wildcard
  // page — deliberately the one fully opaque (non-glass) element on the
  // page, so the single most important instruction on the page (what to
  // literally do first) reads as an unmissable call to action.
  function drawGoldActionBar(label: string, text: string) {
    const barX = MARGIN;
    const barY = GOLD_BAR_BOTTOM_Y;
    const barWidth = CONTENT_WIDTH;
    const barHeight = GOLD_BAR_HEIGHT;

    page.drawRectangle({
      x: barX + 2,
      y: barY - 2,
      width: barWidth,
      height: barHeight,
      color: SHADOW_TINT,
      opacity: 0.22,
    });
    page.drawRectangle({ x: barX, y: barY, width: barWidth, height: barHeight, color: ACCENT });
    page.drawRectangle({
      x: barX,
      y: barY,
      width: barWidth,
      height: barHeight,
      borderColor: GOLD_DEEP,
      borderWidth: 0.75,
    });

    const innerX = barX + 22;
    const innerWidth = barWidth - 44;
    const textLines = wrapText(text, fonts.sansBold, 12.5, innerWidth, 2);
    const blockHeight = 12 + (textLines.length - 1) * 16;
    let localY = barY + (barHeight + blockHeight) / 2 - 2;

    drawTrackedLine(label, fonts.sansBold, 9, INK, innerX, localY, 1);
    localY -= 17;
    for (const line of textLines) {
      page.drawText(line, { x: innerX, y: localY, size: 12.5, font: fonts.sansBold, color: INK });
      localY -= 16;
    }
  }

  // --- Page 1: Cover — full-bleed image, a strong bottom fade for the
  // title block to sit on, matching the same full-bleed language every
  // other page in the book now uses.
  page = addPage();
  {
    drawFullBleedImage(images.cover);
    drawOverlayWash(0.14);
    drawBottomGradient(PAGE_HEIGHT * 0.6, 0.92);

    y = 210;
    drawParagraph(chrome.coverEyebrow, fonts.sansBold, 10, CHAMPAGNE_LIGHT, 4, MARGIN, CONTENT_WIDTH, undefined, {
      tracking: 1.2,
    });
    y -= 10;
    drawParagraph(title, fonts.serif, 30, WHITE, 9, MARGIN, CONTENT_WIDTH, 3, { foil: true });
    y -= 6;
    drawParagraph(chrome.coverTagline, fonts.sans, 12.5, CHAMPAGNE_LIGHT, 5, MARGIN, CONTENT_WIDTH, 2);
  }

  // --- Page 2: Profile — same full-bleed + glass-panel language as the
  // idea pages, just without a badge or gold action bar (there's no
  // single "first action" for a profile summary).
  page = addPage();
  {
    drawFullBleedImage(images.moods[0]);
    drawOverlayWash(0.4);
    drawBottomGradient(PAGE_HEIGHT - MARGIN, 0.6);

    y = PAGE_HEIGHT - MARGIN;
    drawParagraph(chrome.profileEyebrow, fonts.sansBold, 10, CHAMPAGNE_LIGHT, 4, MARGIN, CONTENT_WIDTH, undefined, {
      tracking: 1,
    });
    y -= 8;
    drawParagraph(book.profile_summary, fonts.serif, 18, WHITE, 8, MARGIN, CONTENT_WIDTH, 6);

    const panelTop = GLASS_PANEL_TOP_Y;
    const maxPanelHeight = panelTop - GLASS_PANEL_BOTTOM_NO_BAR;
    const textX = MARGIN + PANEL_PAD_X;
    const textWidth = CONTENT_WIDTH - PANEL_PAD_X * 2;

    function drawPanelContent() {
      y = panelTop - PANEL_PAD_Y;
      if (book.must_haves.length > 0) {
        drawParagraph(chrome.mustHaves, fonts.sansBold, 10, GOLD_LIGHT, 4, textX, textWidth, undefined, {
          tracking: 0.8,
        });
        y -= 2;
        drawBulletList(book.must_haves, fonts.sans, 11.5, textX, textWidth, WHITE);
        y -= 10;
      }
      if (book.preferences.length > 0) {
        drawParagraph(chrome.preferences, fonts.sansBold, 10, GOLD_LIGHT, 4, textX, textWidth, undefined, {
          tracking: 0.8,
        });
        y -= 2;
        drawBulletList(book.preferences, fonts.sans, 11.5, textX, textWidth, WHITE);
      }
    }

    // No must-haves and no preferences stated at all — skip the panel
    // entirely rather than drawing an empty glass card.
    if (book.must_haves.length > 0 || book.preferences.length > 0) {
      // Measure first (dry run — same code path, no actual drawing) so the
      // glass panel behind the text is only ever as tall as its real
      // content, never a mostly-empty card when must-haves/preferences
      // are short.
      const measureStart = panelTop - PANEL_PAD_Y;
      dryRun = true;
      drawPanelContent();
      const contentHeight = measureStart - y;
      dryRun = false;

      const panelHeight = Math.min(maxPanelHeight, contentHeight + PANEL_PAD_Y * 2);
      drawGlassPanel(MARGIN, panelTop - panelHeight, CONTENT_WIDTH, panelHeight);
      drawPanelContent();
    }
  }

  // --- Pages 3-8: ideas, one full page each, six total. Every page is a
  // fixed grid — header block (eyebrow, title, gold badge, intro,
  // why-it-fits) over the top of the photo, a glass panel with the real
  // Actionability Layer content, and a solid gold action bar pinned to the
  // bottom for the first step. Generous fixed zones (see the constants
  // above) rather than dynamic flow-until-full — the tightened Claude
  // schema (exactly 3 steps, capped word counts) reliably fits inside
  // them with room to spare.
  function drawIdeaPage(idea: IdeaBookEntry, index: number, moodImage: PDFImage) {
    drawFullBleedImage(moodImage);
    drawOverlayWash(0.4);
    drawBottomGradient(PAGE_HEIGHT - MARGIN, 0.68);

    const badgeCenterX = PAGE_WIDTH - MARGIN - BADGE_RADIUS;
    const badgeCenterY = PAGE_HEIGHT - MARGIN - BADGE_RADIUS + 6;
    drawGoldBadge(badgeCenterX, badgeCenterY, String(index));

    const titleMaxWidth = CONTENT_WIDTH - (BADGE_RADIUS * 2 + 20);
    y = PAGE_HEIGHT - MARGIN;
    drawParagraph(chrome.possibilityEyebrow, fonts.sansBold, 10, CHAMPAGNE_LIGHT, 4, MARGIN, titleMaxWidth, undefined, {
      tracking: 0.8,
    });
    y -= 4;
    drawParagraph(idea.title, fonts.serif, 22, WHITE, 7, MARGIN, titleMaxWidth, 2, { foil: true });
    y -= 6;
    drawParagraph(idea.intro, fonts.sans, 11.5, CHAMPAGNE_LIGHT, 5, MARGIN, CONTENT_WIDTH, 3);
    y -= 6;
    drawParagraph(idea.why_it_fits, fonts.sans, 12, WHITE, 5, MARGIN, CONTENT_WIDTH, 3);

    const panelTop = GLASS_PANEL_TOP_Y;
    const maxPanelHeight = panelTop - GLASS_PANEL_BOTTOM_WITH_BAR;
    const textX = MARGIN + PANEL_PAD_X;
    const textWidth = CONTENT_WIDTH - PANEL_PAD_X * 2;

    function drawPanelContent() {
      y = panelTop - PANEL_PAD_Y;
      drawParagraph(
        book.labels.steps_heading || chrome.stepsFallback,
        fonts.sansBold,
        10.5,
        GOLD_LIGHT,
        4,
        textX,
        textWidth,
        undefined,
        { tracking: 0.8 }
      );
      y -= 2;
      drawNumberedList(idea.details, fonts.sans, 11.5, textX, textWidth, 3, WHITE);
      y -= 4;

      const practicalLine = [
        idea.practical.estimated_cost,
        idea.practical.duration,
        DIFFICULTY_LABELS[locale][idea.practical.difficulty],
      ]
        .filter(Boolean)
        .join("  ·  ");
      drawMetaLine(
        book.labels.cost_label || chrome.practicalFallback,
        practicalLine,
        textX,
        textWidth,
        undefined,
        GOLD_LIGHT,
        CHAMPAGNE_LIGHT
      );

      if (idea.location) {
        const locationLine = [idea.location.name, idea.location.city].filter(Boolean).join(", ");
        drawMetaLine(
          book.labels.location_heading || chrome.locationFallback,
          locationLine,
          textX,
          textWidth,
          mapsSearchUrl(idea.location.name, idea.location.city),
          GOLD_LIGHT,
          CHAMPAGNE_LIGHT
        );
      }

      if (idea.requirements.length > 0) {
        y -= 3;
        drawParagraph(
          book.labels.requirements_heading || chrome.requirementsFallback,
          fonts.sansBold,
          10,
          GOLD_LIGHT,
          4,
          textX,
          textWidth,
          undefined,
          { tracking: 0.6 }
        );
        y -= 1;
        drawBulletList(idea.requirements, fonts.sans, 10.5, textX, textWidth, CHAMPAGNE_LIGHT);
      }
    }

    // Measure first (dry run), then draw the glass panel only as tall as
    // this idea's actual content needs — a short idea (no location, no
    // requirements) gets a tighter card instead of a mostly-empty one.
    const measureStart = panelTop - PANEL_PAD_Y;
    dryRun = true;
    drawPanelContent();
    const contentHeight = measureStart - y;
    dryRun = false;

    const panelHeight = Math.min(maxPanelHeight, Math.max(140, contentHeight + PANEL_PAD_Y * 2));
    drawGlassPanel(MARGIN, panelTop - panelHeight, CONTENT_WIDTH, panelHeight);
    drawPanelContent();

    drawGoldActionBar(book.labels.first_action_heading || chrome.firstActionFallback, idea.first_action);
  }

  book.ideas.forEach((idea, i) => {
    page = addPage();
    drawIdeaPage(idea, i + 1, images.moods[i % images.moods.length]);
  });

  // --- Page 9: Wildcard — the same full-bleed/glass-panel/gold-bar grid
  // as an idea page, distinguished by a thin full-page gold frame instead
  // of a numbered badge (it deliberately sits outside the "idea 1-6"
  // numbering) and its own framing copy.
  page = addPage();
  {
    drawFullBleedImage(images.wildcard);
    drawOverlayWash(0.42);
    drawBottomGradient(PAGE_HEIGHT - MARGIN, 0.68);

    page.drawRectangle({
      x: 18,
      y: 18,
      width: PAGE_WIDTH - 36,
      height: PAGE_HEIGHT - 36,
      borderColor: ACCENT,
      borderWidth: 1.5,
    });

    y = PAGE_HEIGHT - MARGIN;
    drawParagraph(
      book.labels.wildcard_heading || chrome.wildcardFallbackHeading,
      fonts.sansBold,
      10,
      GOLD_LIGHT,
      4,
      MARGIN,
      CONTENT_WIDTH,
      1,
      { tracking: 1.2 }
    );
    y -= 4;
    drawParagraph(book.wildcard.title, fonts.serif, 22, WHITE, 7, MARGIN, CONTENT_WIDTH, 2, { foil: true });
    y -= 6;
    drawParagraph(book.wildcard.intro, fonts.sans, 11.5, CHAMPAGNE_LIGHT, 5, MARGIN, CONTENT_WIDTH, 3);
    y -= 6;
    drawParagraph(book.wildcard.why_it_fits, fonts.sans, 12, WHITE, 5, MARGIN, CONTENT_WIDTH, 3);

    const panelTop = GLASS_PANEL_TOP_Y;
    const maxPanelHeight = panelTop - GLASS_PANEL_BOTTOM_WITH_BAR;
    const textX = MARGIN + PANEL_PAD_X;
    const textWidth = CONTENT_WIDTH - PANEL_PAD_X * 2;

    function drawPanelContent() {
      y = panelTop - PANEL_PAD_Y;
      drawParagraph(
        book.labels.steps_heading || chrome.stepsFallback,
        fonts.sansBold,
        10.5,
        GOLD_LIGHT,
        4,
        textX,
        textWidth,
        undefined,
        { tracking: 0.8 }
      );
      y -= 2;
      drawNumberedList(book.wildcard.details, fonts.sans, 11.5, textX, textWidth, 3, WHITE);
      y -= 4;

      const wildcardPractical = [
        book.wildcard.practical.estimated_cost,
        book.wildcard.practical.duration,
        DIFFICULTY_LABELS[locale][book.wildcard.practical.difficulty],
      ]
        .filter(Boolean)
        .join("  ·  ");
      drawMetaLine(
        book.labels.cost_label || chrome.practicalFallback,
        wildcardPractical,
        textX,
        textWidth,
        undefined,
        GOLD_LIGHT,
        CHAMPAGNE_LIGHT
      );
      if (book.wildcard.location) {
        const wildcardLocationLine = [book.wildcard.location.name, book.wildcard.location.city]
          .filter(Boolean)
          .join(", ");
        drawMetaLine(
          book.labels.location_heading || chrome.locationFallback,
          wildcardLocationLine,
          textX,
          textWidth,
          mapsSearchUrl(book.wildcard.location.name, book.wildcard.location.city),
          GOLD_LIGHT,
          CHAMPAGNE_LIGHT
        );
      }
      if (book.wildcard.requirements.length > 0) {
        y -= 3;
        drawParagraph(
          book.labels.requirements_heading || chrome.requirementsFallback,
          fonts.sansBold,
          10,
          GOLD_LIGHT,
          4,
          textX,
          textWidth,
          undefined,
          { tracking: 0.6 }
        );
        y -= 1;
        drawBulletList(book.wildcard.requirements, fonts.sans, 10.5, textX, textWidth, CHAMPAGNE_LIGHT);
      }
    }

    const measureStart = panelTop - PANEL_PAD_Y;
    dryRun = true;
    drawPanelContent();
    const contentHeight = measureStart - y;
    dryRun = false;

    const panelHeight = Math.min(maxPanelHeight, Math.max(140, contentHeight + PANEL_PAD_Y * 2));
    drawGlassPanel(MARGIN, panelTop - panelHeight, CONTENT_WIDTH, panelHeight);
    drawPanelContent();

    drawGoldActionBar(
      book.labels.first_action_heading || chrome.firstActionFallback,
      book.wildcard.first_action
    );
  }

  // Footer: page number + wordmark on every page except the cover — every
  // one of those pages is now a full-bleed dark photo, so the footer's
  // color moved from a muted gray (meant for the old cream background) to
  // a pale champagne that stays legible over the image.
  const allPages = doc.getPages();
  allPages.forEach((footerPage, i) => {
    if (i === 0) return;
    footerPage.drawText(chrome.footerWordmark, {
      x: MARGIN,
      y: 28,
      size: 8,
      font: fonts.sans,
      color: CHAMPAGNE_LIGHT,
    });
    const pageNumText = String(i + 1);
    const pageNumWidth = fonts.sans.widthOfTextAtSize(pageNumText, 8);
    footerPage.drawText(pageNumText, {
      x: PAGE_WIDTH - MARGIN - pageNumWidth,
      y: 28,
      size: 8,
      font: fonts.sans,
      color: CHAMPAGNE_LIGHT,
    });
  });

  return doc.save();
}
