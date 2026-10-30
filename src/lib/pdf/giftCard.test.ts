import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { renderGiftCardPdf, formatCardDate } from "./giftCard";

const base = { code: "WIN-K7QM-4XRT-9PDH", expiresAt: new Date("2027-10-30T10:00:00Z"), host: "windowinto.nl", locale: "nl" as const };

async function pageOf(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes);
  return { count: doc.getPageCount(), size: doc.getPage(0).getSize() };
}

describe("the gift card", () => {
  it("is one A5 landscape page by default", async () => {
    const { count, size } = await pageOf(await renderGiftCardPdf(base));
    expect(count).toBe(1);
    expect(size.width).toBeCloseTo(595.28, 1);
    expect(size.height).toBeCloseTo(419.53, 1);
  });

  it("is exactly half an A5 as A6 (same card, scaled)", async () => {
    const { count, size } = await pageOf(await renderGiftCardPdf({ ...base, format: "a6" }));
    expect(count).toBe(1);
    expect(size.width).toBeCloseTo(420.94, 0);
    expect(size.height).toBeCloseTo(296.65, 0);
  });

  it("holds up to a long name, the longest message and characters the fonts do not have", async () => {
    const bytes = await renderGiftCardPdf({
      ...base,
      recipientName: "Alexandra Wilhelmina Johanna van Oranje-Nassau",
      giverName: "Jan-Michaël",
      message: `Gefeliciteerd! 😀 ${"Een heel lang bericht zonder einde. ".repeat(12)}`.slice(0, 280),
      locale: "en",
    });
    expect((await pageOf(bytes)).count).toBe(1);
  });

  it("needs no name and no message", async () => {
    expect((await pageOf(await renderGiftCardPdf({ ...base, recipientName: null, giverName: null, message: null }))).count).toBe(1);
    expect((await pageOf(await renderGiftCardPdf({ ...base, recipientName: "  ", message: "" }))).count).toBe(1);
  });

  it("names the voucher in the document properties", async () => {
    const doc = await PDFDocument.load(await renderGiftCardPdf(base));
    expect(doc.getTitle()).toBe("WindowInto cadeaubon");
  });

  it("writes the expiry date the way the person reads it", () => {
    expect(formatCardDate(new Date("2027-10-30T10:00:00Z"), "nl")).toBe("30 oktober 2027");
    expect(formatCardDate(new Date("2027-10-30T10:00:00Z"), "en")).toBe("30 October 2027");
  });
});
