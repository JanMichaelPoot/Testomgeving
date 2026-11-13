// A tiny SVG drawing kit for the whitepaper diagrams. Everything is plain strings, so the same figure goes into the HTML
// (and from there into the PDF) and, as a screenshot, into the DOCX and the diagram appendix.
//
// Colour coding (used in every figure, explained in the legend of the whitepaper):
//   user  gold      what the visitor does or decides
//   app   walnut    what WindowInto's own code does (browser and server)
//   data  slate     data that is stored or passed on
//   ext   sage      external sources and services
//   ai    plum      a language-model call (Anthropic Claude)

export const COL = {
  user: { f: "#F8EFD9", s: "#B08A4A", t: "#4A3611" },
  app: { f: "#EFE4DB", s: "#5B3F2F", t: "#33221A" },
  data: { f: "#E1EAF2", s: "#3E5C76", t: "#1F3447" },
  ext: { f: "#E2EEE0", s: "#5E8A5B", t: "#27431F" },
  ai: { f: "#EEE2F1", s: "#7A4E7E", t: "#3E2144" },
  neutral: { f: "#FFFFFF", s: "#CFC8BC", t: "#202020" },
  soft: { f: "#F7F5F0", s: "#DED8CE", t: "#202020" },
  ink: "#202020",
  muted: "#6A655D",
  line: "#8C857A",
  gold: "#B08A4A",
  walnut: "#5B3F2F",
};

export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Rough text width in SVG units for the Plus Jakarta Sans family (a little generous on purpose, so text never runs out of its box). */
export function textWidth(str, size = 11, weight = 400) {
  const k = weight >= 600 ? 0.6 : 0.555;
  return String(str).length * size * k;
}

/** Greedy word wrap to a pixel width. Explicit "\n" are kept. */
export function wrap(str, maxW, size = 11, weight = 400) {
  const out = [];
  for (const para of String(str).split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (textWidth(next, size, weight) <= maxW || !line) line = next;
      else {
        out.push(line);
        line = w;
      }
    }
    out.push(line);
  }
  return out;
}

export class Svg {
  constructor(w, h, label = "") {
    this.w = w;
    this.h = h;
    this.label = label;
    this.parts = [];
  }
  add(s) {
    this.parts.push(s);
    return this;
  }
  /** Plain or wrapped text. `lines` may be a string (wrapped to maxW) or an array of lines. Returns the y after the last line. */
  text(x, y, content, o = {}) {
    const size = o.size ?? 11;
    const weight = o.weight ?? 400;
    const lh = o.lh ?? size * 1.28;
    const lines = Array.isArray(content) ? content : o.maxW ? wrap(content, o.maxW, size, weight) : String(content).split("\n");
    const anchor = o.anchor ?? "start";
    const fill = o.fill ?? COL.ink;
    const style = o.italic ? ' font-style="italic"' : "";
    const sp = o.spacing ? ` letter-spacing="${o.spacing}"` : "";
    lines.forEach((ln, i) => {
      this.add(`<text x="${x}" y="${(y + i * lh).toFixed(1)}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${style}${sp}>${esc(ln)}</text>`);
    });
    return y + lines.length * lh;
  }
  rect(x, y, w, h, o = {}) {
    const c = o.cat ? COL[o.cat] : null;
    const fill = o.fill ?? c?.f ?? "none";
    const stroke = o.stroke ?? c?.s ?? "none";
    const dash = o.dash ? ` stroke-dasharray="${o.dash}"` : "";
    this.add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.r ?? 8}" fill="${fill}" stroke="${stroke}" stroke-width="${o.sw ?? 1.2}"${dash}${o.opacity ? ` opacity="${o.opacity}"` : ""}/>`);
    return this;
  }
  /**
   * A box with an optional bold title and lines of text, vertically padded. Returns the box height so callers can stack boxes.
   * If `h` is not given, the height follows the text.
   */
  box(x, y, w, o = {}) {
    const size = o.size ?? 10.5;
    const tsize = o.tsize ?? size + 0.5;
    const pad = o.pad ?? 8;
    const c = o.cat ? COL[o.cat] : COL.neutral;
    const inner = w - pad * 2;
    const titleLines = o.title ? wrap(o.title, inner, tsize, 700) : [];
    const bodyLines = o.body ? (Array.isArray(o.body) ? o.body.flatMap((b) => wrap(b, inner, size)) : wrap(o.body, inner, size)) : [];
    const lh = size * 1.3;
    const tlh = tsize * 1.28;
    const contentH = titleLines.length * tlh + (titleLines.length && bodyLines.length ? 3 : 0) + bodyLines.length * lh;
    const need = contentH + pad * 2 - 1;
    const h = o.h ?? need;
    if (o.h && need > o.h + 1.5) console.warn(`[svg] box too small (${o.title ?? o.body ?? ""}`.slice(0, 70) + `): needs ${Math.ceil(need)}, has ${o.h}`);
    this.rect(x, y, w, h, { cat: o.cat, r: o.r ?? 7, dash: o.dash, fill: o.fill, stroke: o.stroke, sw: o.sw });
    const align = o.align ?? "left";
    const tx = align === "center" ? x + w / 2 : x + pad;
    const anchor = align === "center" ? "middle" : "start";
    let cy = y + pad + tsize * 0.9;
    if (o.h && o.valign === "middle") cy = y + (h - contentH) / 2 + tsize * 0.9;
    if (titleLines.length) {
      this.text(tx, cy, titleLines, { size: tsize, weight: 700, fill: c.t, anchor, lh: tlh });
      cy += titleLines.length * tlh + 3;
    }
    if (bodyLines.length) this.text(tx, cy - (titleLines.length ? 0 : tsize * 0.0), bodyLines, { size, fill: o.bodyFill ?? c.t, anchor, lh });
    return h;
  }
  line(x1, y1, x2, y2, o = {}) {
    const dash = o.dash ? ` stroke-dasharray="${o.dash}"` : "";
    this.add(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${o.stroke ?? COL.line}" stroke-width="${o.sw ?? 1.2}"${dash}/>`);
    return this;
  }
  /** A straight or elbow arrow. `via` is a list of intermediate points. */
  arrow(x1, y1, x2, y2, o = {}) {
    const pts = [[x1, y1], ...(o.via ?? []), [x2, y2]];
    const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(" ");
    const dash = o.dash ? ` stroke-dasharray="${o.dash}"` : "";
    const both = o.both ? ` marker-start="url(#ah-s)"` : "";
    this.add(`<path d="${d}" fill="none" stroke="${o.stroke ?? COL.line}" stroke-width="${o.sw ?? 1.4}"${dash} marker-end="url(#ah)"${both} stroke-linejoin="round"/>`);
    if (o.label) {
      const mid = pts[Math.floor(pts.length / 2)];
      const lx = o.lx ?? (pts.length === 2 ? (x1 + x2) / 2 : mid[0]);
      const ly = o.ly ?? (pts.length === 2 ? (y1 + y2) / 2 - 4 : mid[1] - 4);
      this.text(lx, ly, o.label, { size: o.lsize ?? 9.5, anchor: "middle", fill: o.lfill ?? COL.muted, italic: true });
    }
    return this;
  }
  circle(cx, cy, r, o = {}) {
    const c = o.cat ? COL[o.cat] : null;
    this.add(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${o.fill ?? c?.f ?? "none"}" stroke="${o.stroke ?? c?.s ?? "none"}" stroke-width="${o.sw ?? 1.2}"/>`);
    return this;
  }
  /** A numbered dot. */
  dot(cx, cy, n, o = {}) {
    const c = COL[o.cat ?? "app"];
    this.add(`<circle cx="${cx}" cy="${cy}" r="${o.r ?? 9}" fill="${c.s}"/>`);
    this.text(cx, cy + 3.6, String(n), { size: o.size ?? 10.5, weight: 700, fill: "#fff", anchor: "middle" });
    return this;
  }
  /** A small legend row: colour swatches with labels. */
  legend(x, y, items, o = {}) {
    let cx = x;
    for (const [cat, label] of items) {
      this.rect(cx, y - 8, 13, 13, { cat, r: 3 });
      this.text(cx + 19, y + 2.5, label, { size: o.size ?? 10, fill: COL.muted });
      cx += 19 + textWidth(label, o.size ?? 10) + 16;
    }
    return this;
  }
  toString(extraStyle = "") {
    const defs = `<defs>
<marker id="ah" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${COL.line}"/></marker>
<marker id="ah-s" viewBox="0 0 10 10" refX="1.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M10 0 L0 5 L10 10 z" fill="${COL.line}"/></marker>
</defs>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.w} ${this.h}" width="${this.w}" height="${this.h}" role="img" aria-label="${esc(this.label)}" font-family="'Plus Jakarta Sans', 'Segoe UI', Arial, sans-serif">${extraStyle}${defs}${this.parts.join("\n")}</svg>`;
  }
}
