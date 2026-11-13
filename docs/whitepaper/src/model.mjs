// Shared model of the document: the order of the parts, the numbering of chapters, sections, figures and tables,
// and the inline markup parser used by both renderers.
import { leeswijzer, ch1, ch2, ch3 } from "./content-1.mjs";
import { ch4, ch5, ch6 } from "./content-2.mjs";
import { ch7 } from "./content-3.mjs";
import { ch8, ch9, ch10 } from "./content-4.mjs";
import { ch11, ch12, ch13, appA, appB, appC, appD, appE } from "./content-5.mjs";
import { allFigures } from "./figures.mjs";

export const FIGS = allFigures();
export const CHAPTERS = [ch1, ch2, ch3, ch4, ch5, ch6, ch7, ch8, ch9, ch10, ch11, ch12, ch13];
export const APPENDICES = [appA, appB, appC, appD, appE];
export const FRONT = [leeswijzer];
export const PARTS = [...FRONT, ...CHAPTERS, ...APPENDICES];

export const TITLE = "WindowInto";
export const SUBTITLE = "Productwhitepaper";
export const TAGLINE = "Hoe een eerste vraag en een reeks associatieve ontdekkingen veranderen in relevante, nieuwe en concrete mogelijkheden om te ondernemen";
export const BASIS = "Gebaseerd op de broncode, branch site-optimalisatie, commit 0844364, 13 november 2026";

/** Walks every block, also those nested in layer-B boxes. */
export function walk(blocks, fn) {
  for (const b of blocks) {
    fn(b);
    if (b.blocks && b.t !== "h1") walk(b.blocks, fn);
  }
}

// ---- numbering --------------------------------------------------------------------------------------------------
export const num = { fig: {}, tab: {}, order: [] };
export function number() {
  let chapter = 0;
  for (const part of PARTS) {
    let label;
    if (part.unnumbered) label = "";
    else if (part.appendix) label = part.appendix;
    else label = String(++chapter);
    part.label = label;
    let sec = 0;
    let fig = 0;
    let tab = 0;
    walk(part.blocks, (b) => {
      if (b.t === "h2") {
        b.title = b.title.replace(/^\d+\.\d+\s+/, "");
        b.label = label ? `${label}.${++sec}` : "";
      }
      if (b.t === "fig") {
        b.label = `${label || "0"}.${++fig}`;
        num.fig[b.id] = b.label;
        if (!FIGS[b.id]) throw new Error(`Unknown figure id "${b.id}"`);
      }
      if (b.t === "tab") {
        b.label = `${label || "0"}.${++tab}`;
        if (b.id) num.tab[b.id] = b.label;
      }
    });
  }
}
number();

// ---- inline markup -----------------------------------------------------------------------------------------------
const RE = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`|\{(?:fig|tab):[a-zA-Z0-9]+\})/g;

/** Splits text into tokens: {k:"text"|"b"|"i"|"code", v}. References are resolved to plain text. */
export function inline(text) {
  const out = [];
  let last = 0;
  const src = String(text);
  for (const m of src.matchAll(RE)) {
    if (m.index > last) out.push({ k: "text", v: src.slice(last, m.index) });
    const tok = m[0];
    if (tok.startsWith("**")) out.push({ k: "b", v: tok.slice(2, -2) });
    else if (tok.startsWith("`")) out.push({ k: "code", v: tok.slice(1, -1) });
    else if (tok.startsWith("{fig:")) {
      const id = tok.slice(5, -1);
      if (!num.fig[id]) throw new Error(`Unknown figure reference ${tok}`);
      out.push({ k: "text", v: `Figuur ${num.fig[id]}` });
    } else if (tok.startsWith("{tab:")) {
      const id = tok.slice(5, -1);
      if (!num.tab[id]) throw new Error(`Unknown table reference ${tok}`);
      out.push({ k: "text", v: `Tabel ${num.tab[id]}` });
    } else out.push({ k: "i", v: tok.slice(1, -1) });
    last = m.index + tok.length;
  }
  if (last < src.length) out.push({ k: "text", v: src.slice(last) });
  return out;
}

export const plain = (text) => inline(text).map((t) => t.v).join("");
