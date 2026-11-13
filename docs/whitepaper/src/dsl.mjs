// The content language of the whitepaper: plain objects that the HTML and the DOCX renderers both read.
// Inline markup inside any text: **bold**, *italic*, `code`, {fig:id}, {tab:id}.

export const h1 = (id, title, opts = {}) => ({ t: "h1", id, title, ...opts });
export const h2 = (title) => ({ t: "h2", title });
export const h3 = (title) => ({ t: "h3", title });
export const p = (text) => ({ t: "p", text });
export const ul = (items) => ({ t: "ul", items });
export const ol = (items) => ({ t: "ol", items });
/** Layer A: a plain-language lead (an analogy or the short version). */
export const laagA = (text) => ({ t: "laagA", text });
/** Layer B: a technical box with its own blocks. */
export const laagB = (title, blocks) => ({ t: "laagB", title, blocks });
export const fig = (id, caption, o = {}) => ({ t: "fig", id, caption, ...o });
export const tab = (id, caption, head, rows, o = {}) => ({ t: "tab", id, caption, head, rows, ...o });
export const code = (text, lang = "") => ({ t: "code", text, lang });
/** A call-out: kind is "let-op" (watch out), "bevinding" (finding), "eerlijk" (an honest limit) or "feit". */
export const note = (kind, text) => ({ t: "note", kind, text });
/** Key facts as label/value pairs. */
export const facts = (rows) => ({ t: "facts", rows });
export const pb = () => ({ t: "pb" });
export const steps = (rows) => ({ t: "steps", rows });
