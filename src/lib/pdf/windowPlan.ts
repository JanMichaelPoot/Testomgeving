import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { GeneratedWindowPlan } from "@/lib/claude/plan";

const PAGE_WIDTH = 595.28; // A4 in points
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const INK = rgb(0.102, 0.102, 0.18); // #1A1A2E
const ACCENT_DARK = rgb(0.294, 0.165, 0.651); // #4B2AA6
const MUTED = rgb(0.4, 0.4, 0.45);

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
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
  return lines;
}

export async function renderWindowPlanPdf(
  plan: GeneratedWindowPlan
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const serif = await doc.embedFont(StandardFonts.TimesRomanBold);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const sansBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function newPageIfNeeded(nextLineHeight: number) {
    if (y - nextLineHeight < MARGIN) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  }

  function drawParagraph(
    text: string,
    font: PDFFont,
    size: number,
    color = INK,
    lineGap = 6
  ) {
    const lines = wrapText(text, font, size, CONTENT_WIDTH);
    for (const line of lines) {
      newPageIfNeeded(size + lineGap);
      page.drawText(line, { x: MARGIN, y, size, font, color });
      y -= size + lineGap;
    }
  }

  // Eyebrow
  drawParagraph("YOUR WINDOW PLAN", sansBold, 10, ACCENT_DARK, 4);
  y -= 6;

  // Title
  drawParagraph(plan.title, serif, 24, INK, 8);
  y -= 10;

  // Why it fits
  drawParagraph(plan.why_it_fits, sans, 12, MUTED, 5);
  y -= 16;

  // Steps heading
  drawParagraph("STEPS", sansBold, 11, ACCENT_DARK, 4);
  y -= 4;

  plan.steps.forEach((step, index) => {
    drawParagraph(`${index + 1}. ${step}`, sans, 12, INK, 5);
    y -= 4;
  });

  y -= 12;

  // First action callout — measure the wrapped height first so the
  // background rectangle can be drawn before the text sits on top of it.
  // verticalPadding leaves room for the heading's ascent above its own
  // baseline — without it the box's top edge cuts through the glyphs.
  const actionLines = wrapText(plan.first_action, sans, 12, CONTENT_WIDTH);
  const innerContentHeight = 10 + 4 + actionLines.length * (12 + 5);
  const verticalPadding = 14;
  const calloutHeight = innerContentHeight + verticalPadding * 2;
  newPageIfNeeded(calloutHeight + 16);

  const calloutTop = y;
  page.drawRectangle({
    x: MARGIN - 12,
    y: calloutTop - calloutHeight,
    width: CONTENT_WIDTH + 24,
    height: calloutHeight,
    borderColor: ACCENT_DARK,
    borderWidth: 1,
    color: rgb(0.965, 0.957, 0.933), // cream
  });

  y = calloutTop - verticalPadding;
  drawParagraph("FIRST ACTION", sansBold, 10, ACCENT_DARK, 4);
  drawParagraph(plan.first_action, sans, 12, INK, 5);

  y = calloutTop - calloutHeight - 20;

  // Cost / time estimate row
  newPageIfNeeded(30);
  drawEstimateRow(page, sansBold, sans, MARGIN, y, plan);
  y -= 30;

  return doc.save();
}

function drawEstimateRow(
  page: PDFPage,
  labelFont: PDFFont,
  valueFont: PDFFont,
  x: number,
  y: number,
  plan: GeneratedWindowPlan
) {
  page.drawText("TIME", { x, y, size: 9, font: labelFont, color: ACCENT_DARK });
  page.drawText(plan.time_estimate, {
    x,
    y: y - 14,
    size: 12,
    font: valueFont,
    color: INK,
  });

  const secondColumnX = x + CONTENT_WIDTH / 2;
  page.drawText("COST", {
    x: secondColumnX,
    y,
    size: 9,
    font: labelFont,
    color: ACCENT_DARK,
  });
  page.drawText(plan.cost_estimate, {
    x: secondColumnX,
    y: y - 14,
    size: 12,
    font: valueFont,
    color: INK,
  });
}
