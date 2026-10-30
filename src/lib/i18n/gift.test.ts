import { describe, expect, it } from "vitest";
import { fill, getGiftCopy } from "./gift";
import { buildVoucherEmail } from "@/lib/email/voucher";

// Both languages say the same thing in the same shape, every placeholder a text needs is there in both, and nothing is empty by accident.

function leaves(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, `${path}[${i}]`));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  return [];
}

describe("gift voucher copy", () => {
  const nl = leaves(getGiftCopy("nl"));
  const en = leaves(getGiftCopy("en"));

  it("has the same keys in Dutch and English", () => {
    expect(nl.map(([k]) => k)).toEqual(en.map(([k]) => k));
  });

  it("uses the same placeholders in both languages", () => {
    const tokens = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    nl.forEach(([key, text], i) => expect(tokens(en[i][1]), key).toEqual(tokens(text)));
  });

  it("has no empty text except where an English sentence has no closing words", () => {
    for (const [key, text] of [...nl, ...en]) {
      if (key === "panel.termsLabelSuffix") continue;
      expect(text.trim().length, key).toBeGreaterThan(0);
    }
  });

  it("speaks to the reader as je, never u, and has no placeholder text left", () => {
    for (const [key, text] of nl) {
      expect(text, key).not.toMatch(/\b(u|uw)\b/i);
      expect(text, key).not.toMatch(/lorem|TODO|\[Bedrijfsnaam\]/i);
    }
  });

  it("fills placeholders and leaves unknown ones visible", () => {
    expect(fill("Voor {name}, geldig tot {date}", { name: "Judith", date: "1 november" })).toBe("Voor Judith, geldig tot 1 november");
    expect(fill("{missing}", {})).toBe("{missing}");
  });
});

describe("the voucher e-mail", () => {
  const input = {
    code: "WIN-K7QM-4XRT-9PDH",
    recipientName: "Judith",
    expiresAt: new Date("2027-11-01T10:00:00Z"),
    redeemUrl: "https://www.windowinto.nl/cadeau/WIN-K7QM-4XRT-9PDH",
    readyUrl: "https://www.windowinto.nl/cadeaubon/klaar?checkout_session_id=cs_1",
    order: { orderNumber: "WI-2026-000042", amountCents: 1495, currency: "eur", orderDate: new Date("2026-11-01T10:00:00Z") },
    siteUrl: "http://localhost:3000",
  };

  it("shows the code, the link, the validity, the order and the withdrawal note", () => {
    const mail = buildVoucherEmail({ ...input, locale: "nl" });
    expect(mail.subject).toBe("Je cadeaubon voor Judith staat klaar");
    for (const part of [input.code, input.redeemUrl, "1 november 2027", "WI-2026-000042", "€14,95", "14 dagen", "KvK"]) expect(mail.html + mail.text, part).toContain(part);
    expect(mail.html + mail.text).not.toMatch(/\{\w+\}/);
  });

  it("works without a recipient name, and in English", () => {
    expect(buildVoucherEmail({ ...input, recipientName: null, locale: "nl" }).subject).toBe("Je cadeaubon staat klaar");
    const en = buildVoucherEmail({ ...input, locale: "en" });
    expect(en.subject).toBe("Your gift voucher for Judith is ready");
    expect(en.text).toContain("€14.95");
  });

  it("writes what a person typed as text, never as markup", () => {
    const mail = buildVoucherEmail({ ...input, locale: "nl", recipientName: "<script>alert(1)</script>" });
    expect(mail.html).not.toContain("<script>alert(1)</script>");
    expect(mail.html).toContain("&lt;script&gt;");
  });
});
