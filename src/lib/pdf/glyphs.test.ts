import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { glyphFilter, makeBookPrintable } from "./ideaBook";

async function brandFonts() {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const dir = path.join(process.cwd(), "src/lib/pdf/fonts");
  return Promise.all(
    ["Newsreader-Medium.ttf", "PlusJakartaSans-Regular.ttf", "PlusJakartaSans-Bold.ttf"].map(async (f) =>
      doc.embedFont(await readFile(path.join(dir, f)), { subset: true }),
    ),
  );
}

describe("glyphFilter", () => {
  it("keeps Dutch text with accents and the euro sign intact", async () => {
    const clean = glyphFilter(await brandFonts());
    expect(clean("Café, naïef, €35–50 · één")).toBe("Café, naïef, €35–50 · één");
  });

  it("maps arrows and checkmarks to characters the fonts have and drops unknown symbols", async () => {
    const clean = glyphFilter(await brandFonts());
    expect(clean("Open → boek ✓")).toBe("Open – boek v");
    expect(clean("Kijk 🌲 hier")).toBe("Kijk  hier");
  });

  it("cleans every string of a nested book but leaves the structure alone", async () => {
    const clean = glyphFilter(await brandFonts());
    const book = { title: "A → B", n: 3, list: ["✓ klaar", null], nested: { x: "★" } };
    expect(makeBookPrintable(book, clean)).toEqual({ title: "A – B", n: 3, list: ["v klaar", null], nested: { x: "*" } });
  });
});
