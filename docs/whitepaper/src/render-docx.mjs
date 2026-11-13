// DOCX renderer: the same blocks as the HTML, as an editable Word document. Figures are inserted as PNG screenshots of the SVGs.
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, AlignmentType, ImageRun, PageOrientation, Footer, Header, PageNumber, TableOfContents, LevelFormat, PageBreak, VerticalAlign, TableLayoutType } from "docx";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { inline, FIGS, PARTS, TITLE, SUBTITLE, TAGLINE, BASIS } from "./model.mjs";

const WALNUT = "3C2920";
const GOLD = "B08A4A";
const MUTED = "6A655D";
const FONT = "Calibri";
const SERIF = "Georgia";
const MONO = "Consolas";
const PORTRAIT_W = 9638; // A4 minus 2 cm margins, in twips
const LANDSCAPE_W = 14570;

const NOTE = { "let-op": ["Let op", "B08A4A", "FBF6EA"], bevinding: ["Bevinding", "A4452C", "FBF3F0"], eerlijk: ["Eerlijk over de grenzen", "3E5C76", "F2F6FA"], feit: ["Goed om te weten", "5E8A5B", "F3F8F2"] };

function runs(text, base = {}) {
  return inline(text).map((t) => {
    if (t.k === "b") return new TextRun({ ...base, text: t.v, bold: true });
    if (t.k === "i") return new TextRun({ ...base, text: t.v, italics: true });
    if (t.k === "code") return new TextRun({ ...base, text: t.v, font: MONO, size: (base.size ?? 20) - 2, shading: { type: ShadingType.CLEAR, fill: "F1EEE7", color: "auto" } });
    return new TextRun({ ...base, text: t.v });
  });
}

const border = (color = "DED8CE", size = 4) => ({ style: BorderStyle.SINGLE, size, color });
const cellBorders = { top: border(), bottom: border(), left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } };

export async function buildDocx({ figDir, outPath }) {
  const numbering = [
    { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 460, hanging: 240 } } } }] },
  ];
  let olCount = 0;
  const newOl = () => {
    const reference = `ol-${++olCount}`;
    numbering.push({ reference, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 460, hanging: 300 } } } }] });
    return reference;
  };

  const para = (text, o = {}) => new Paragraph({ spacing: { after: o.after ?? 110, line: o.line ?? 276 }, ...o.p, children: runs(text, { font: FONT, size: o.size ?? 20, color: o.color, ...o.r }) });

  function table(b, width = PORTRAIT_W) {
    const widths = (b.widths ?? b.head.map(() => 100 / b.head.length)).map((w) => Math.round((w / 100) * width));
    const size = b.small ? 15 : 17;
    const head = new TableRow({ tableHeader: true, cantSplit: true, children: b.head.map((h, i) => new TableCell({ width: { size: widths[i], type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: WALNUT, color: "auto" }, margins: { top: 60, bottom: 60, left: 90, right: 90 }, children: [new Paragraph({ children: runs(h, { font: FONT, size, bold: true, color: "FFFFFF" }) })] })) });
    const rows = b.rows.map((r, ri) => new TableRow({ cantSplit: true, children: r.map((c, i) => new TableCell({ width: { size: widths[i], type: WidthType.DXA }, borders: cellBorders, shading: ri % 2 ? { type: ShadingType.CLEAR, fill: "FAF8F3", color: "auto" } : undefined, margins: { top: 50, bottom: 50, left: 90, right: 90 }, verticalAlign: VerticalAlign.TOP, children: [new Paragraph({ spacing: { after: 0, line: 252 }, children: runs(c, { font: FONT, size }) })] })) }));
    return new Table({ width: { size: width, type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED, rows: [head, ...rows] });
  }

  function stepsTable(b) {
    const widths = [Math.round(PORTRAIT_W * 0.17), PORTRAIT_W - Math.round(PORTRAIT_W * 0.17)];
    return new Table({
      width: { size: PORTRAIT_W, type: WidthType.DXA },
      columnWidths: widths,
      layout: TableLayoutType.FIXED,
      rows: b.rows.map(([k, v]) => new TableRow({ cantSplit: true, children: [
        new TableCell({ width: { size: widths[0], type: WidthType.DXA }, borders: cellBorders, shading: { type: ShadingType.CLEAR, fill: "F7F2E8", color: "auto" }, margins: { top: 50, bottom: 50, left: 90, right: 90 }, children: [new Paragraph({ spacing: { after: 0 }, children: runs(k, { font: FONT, size: 17, bold: true, color: "5B3F2F" }) })] }),
        new TableCell({ width: { size: widths[1], type: WidthType.DXA }, borders: cellBorders, margins: { top: 50, bottom: 50, left: 90, right: 90 }, children: [new Paragraph({ spacing: { after: 0, line: 252 }, children: runs(v, { font: FONT, size: 17 }) })] }),
      ] })),
    });
  }

  function figureElements(b) {
    const f = FIGS[b.id];
    const file = path.join(figDir, `fig-${b.id}.png`);
    const data = existsSync(file) ? readFileSync(file) : null;
    const out = [];
    if (data) {
      const maxW = f.landscape ? 960 : 640;
      const maxH = f.landscape ? 560 : 820;
      const scale = Math.min(maxW / f.svg.w, maxH / f.svg.h, 1.4);
      out.push(new Paragraph({ spacing: { before: 120, after: 60 }, alignment: AlignmentType.CENTER, keepNext: true, children: [new ImageRun({ type: "png", data, transformation: { width: Math.round(f.svg.w * scale), height: Math.round(f.svg.h * scale) }, altText: { title: `Figuur ${b.label}`, description: b.caption.replace(/[`*]/g, ""), name: `fig-${b.id}` } })] }));
    }
    out.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: `Figuur ${b.label}  `, bold: true, font: FONT, size: 17, color: "5B3F2F" }), ...runs(b.caption, { font: FONT, size: 17, color: MUTED })] }));
    return out;
  }

  /** Converts blocks to docx elements. Landscape figures end the current portrait run: the caller splits sections on them. */
  function convert(blocks, inLayerB = false) {
    const out = [];
    for (const b of blocks) {
      switch (b.t) {
        case "h2":
          out.push(new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, spacing: { before: 280, after: 100 }, children: [new TextRun({ text: `${b.label ? b.label + "  " : ""}${inline(b.title).map((t) => t.v).join("")}`, font: SERIF, size: 30, color: WALNUT })] }));
          break;
        case "h3":
          out.push(new Paragraph({ heading: HeadingLevel.HEADING_3, keepNext: true, spacing: { before: 200, after: 60 }, children: runs(b.title, { font: FONT, size: 22, bold: true, color: "5B3F2F" }) }));
          break;
        case "p":
          out.push(para(b.text));
          break;
        case "ul":
          for (const i of b.items) out.push(new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60, line: 270 }, children: runs(i, { font: FONT, size: 20 }) }));
          out.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
          break;
        case "ol": {
          const ref = newOl();
          for (const i of b.items) out.push(new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { after: 60, line: 270 }, children: runs(i, { font: FONT, size: 20 }) }));
          out.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
          break;
        }
        case "laagA":
          out.push(new Paragraph({ spacing: { before: 60, after: 160, line: 288 }, shading: { type: ShadingType.CLEAR, fill: "FBF6EA", color: "auto" }, border: { left: { style: BorderStyle.SINGLE, size: 24, color: GOLD, space: 8 } }, indent: { left: 140 }, children: [new TextRun({ text: "IN GEWONE WOORDEN", font: FONT, size: 14, bold: true, color: GOLD }), new TextRun({ text: "", break: 1 }), ...runs(b.text, { font: FONT, size: 21 })] }));
          break;
        case "laagB": {
          const inner = convert(b.blocks, true);
          if (inner.length === 0 || !(inner[inner.length - 1] instanceof Paragraph)) inner.push(new Paragraph({ children: [] }));
          out.push(new Table({ width: { size: PORTRAIT_W, type: WidthType.DXA }, columnWidths: [PORTRAIT_W], layout: TableLayoutType.FIXED, rows: [new TableRow({ children: [new TableCell({ width: { size: PORTRAIT_W, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: "F4F4F2", color: "auto" }, borders: { left: { style: BorderStyle.SINGLE, size: 24, color: WALNUT }, top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } }, margins: { top: 100, bottom: 60, left: 200, right: 160 }, children: [new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: `LAAG B · ${inline(b.title.replace(/^Laag B: /, "")).map((t) => t.v).join("").toUpperCase()}`, font: FONT, size: 14, bold: true, color: WALNUT })] }), ...inner] })] })] }));
          out.push(new Paragraph({ spacing: { after: 140 }, children: [] }));
          break;
        }
        case "fig":
          out.push(...figureElements(b));
          break;
        case "tab":
          out.push(new Paragraph({ keepNext: true, spacing: { before: 80, after: 60 }, children: [new TextRun({ text: `Tabel ${b.label}  `, bold: true, font: FONT, size: 17, color: "5B3F2F" }), ...runs(b.caption, { font: FONT, size: 17, color: MUTED })] }));
          out.push(table(b));
          out.push(new Paragraph({ spacing: { after: 140 }, children: [] }));
          break;
        case "steps":
          out.push(stepsTable(b));
          out.push(new Paragraph({ spacing: { after: 140 }, children: [] }));
          break;
        case "code":
          for (const [i, line] of b.text.split("\n").entries())
            out.push(new Paragraph({ spacing: { after: 0, line: 250 }, shading: { type: ShadingType.CLEAR, fill: "202020", color: "auto" }, indent: { left: 100, right: 100 }, keepLines: true, children: [new TextRun({ text: line || " ", font: MONO, size: 15, color: "F3EEE4" })] }));
          out.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
          break;
        case "note": {
          const [label, color, fill] = NOTE[b.kind] ?? NOTE["let-op"];
          out.push(new Paragraph({ spacing: { before: 40, after: 140, line: 270 }, shading: { type: ShadingType.CLEAR, fill, color: "auto" }, border: { left: { style: BorderStyle.SINGLE, size: 24, color, space: 8 } }, indent: { left: 140 }, children: [new TextRun({ text: label.toUpperCase(), font: FONT, size: 14, bold: true, color }), new TextRun({ text: "", break: 1 }), ...runs(b.text, { font: FONT, size: 19 })] }));
          break;
        }
        case "pb":
          out.push(new Paragraph({ children: [new PageBreak()] }));
          break;
        default:
          throw new Error(`docx: unknown block ${b.t}`);
      }
    }
    return out;
  }

  // sections: portrait runs, with a landscape section for each landscape figure
  const sections = [];
  let current = [];
  const flush = () => {
    if (current.length) sections.push({ landscape: false, children: current });
    current = [];
  };

  // cover
  const cover = [
    new Paragraph({ spacing: { before: 2400, after: 120 }, children: [new TextRun({ text: "PRODUCT- EN ARCHITECTUURDOCUMENT", font: FONT, size: 18, bold: true, color: GOLD })] }),
    new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: TITLE, font: SERIF, size: 120, color: WALNUT })] }),
    new Paragraph({ spacing: { after: 400 }, children: [new TextRun({ text: SUBTITLE, font: SERIF, size: 44, color: "5B3F2F" })] }),
    new Paragraph({ spacing: { after: 800, line: 330 }, children: [new TextRun({ text: TAGLINE, font: SERIF, italics: true, size: 28, color: "5B3F2F" })] }),
    new Paragraph({ children: [new TextRun({ text: BASIS + ".", font: FONT, size: 19, color: MUTED })] }),
    new Paragraph({ children: [new TextRun({ text: "Voor de oprichter en ontwikkelaar van WindowInto. Deze bewerkbare versie is gebouwd uit dezelfde bron als de PDF.", font: FONT, size: 19, color: MUTED })] }),
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: "Inhoud", font: SERIF, size: 44, color: WALNUT })] }),
    new TableOfContents("Inhoud", { hyperlink: true, headingStyleRange: "1-2" }),
    new Paragraph({ children: [new TextRun({ text: "Open dit document in Word en werk de velden bij (Ctrl+A, F9) om de inhoudsopgave met paginanummers te vullen.", font: FONT, size: 16, italics: true, color: MUTED })] }),
  ];
  current.push(...cover);

  for (const part of PARTS) {
    const headText = part.appendix ? part.title : part.unnumbered ? part.title : `${part.label}  ${part.title}`;
    current.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, spacing: { after: 220 }, children: [new TextRun({ text: part.appendix || part.unnumbered ? inline(headText).map((t) => t.v).join("") : `${part.label}  ${inline(part.title).map((t) => t.v).join("")}`, font: SERIF, size: 54, color: WALNUT })] }));
    // split on landscape figures
    for (const b of part.blocks) {
      if (b.t === "fig" && FIGS[b.id].landscape) {
        flush();
        sections.push({ landscape: true, children: figureElements(b) });
      } else current.push(...convert([b]));
    }
  }
  flush();

  const header = new Header({ children: [new Paragraph({ children: [new TextRun({ text: "WindowInto · productwhitepaper", font: FONT, size: 15, color: MUTED })] })] });
  const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: MUTED })] })] });
  const page = (landscape) => ({ page: { size: { width: 11906, height: 16838, orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } });

  const doc = new Document({
    creator: "WindowInto",
    title: "WindowInto productwhitepaper",
    description: BASIS,
    features: { updateFields: true },
    numbering: { config: numbering },
    styles: {
      default: { document: { run: { font: FONT, size: 20 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: SERIF, size: 54, color: WALNUT }, paragraph: { spacing: { before: 0, after: 220 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: SERIF, size: 30, color: WALNUT }, paragraph: { spacing: { before: 280, after: 100 }, outlineLevel: 1 } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 22, bold: true, color: "5B3F2F" }, paragraph: { spacing: { before: 200, after: 60 }, outlineLevel: 2 } },
      ],
    },
    sections: sections.map((s) => ({ properties: page(s.landscape), headers: { default: header }, footers: { default: footer }, children: s.children })),
  });
  const buffer = await Packer.toBuffer(doc);
  return buffer;
}
