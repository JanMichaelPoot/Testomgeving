import { describe, expect, it } from "vitest";
import { CODE_ALPHABET, expiryFrom, formatCode, generateCode, normalizeCode, voucherState } from "./code";
import { cleanLine, cleanMessage, isValidEmail } from "./text";

describe("voucher codes", () => {
  it("generates WIN-XXXX-XXXX-XXXX from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCode();
      expect(code).toMatch(/^WIN-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      for (const ch of code.replace(/-/g, "").slice(3)) expect(CODE_ALPHABET).toContain(ch);
    }
  });

  it("never uses a character that is easy to misread", () => {
    expect(CODE_ALPHABET).not.toMatch(/[01OIL]/);
  });

  it("is random enough that 2000 codes do not collide", () => {
    const seen = new Set(Array.from({ length: 2000 }, () => generateCode()));
    expect(seen.size).toBe(2000);
  });

  it("uses the injected random source (so the format is testable)", () => {
    expect(generateCode(() => 0)).toBe(formatCode("AAAAAAAAAAAA"));
  });

  it("accepts what people type: case, spaces, dashes and a missing prefix do not matter", () => {
    const code = "WIN-K7QM-4XRT-9PDH";
    expect(normalizeCode("win-k7qm-4xrt-9pdh")).toBe(code);
    expect(normalizeCode("  WIN K7QM 4XRT 9PDH ")).toBe(code);
    expect(normalizeCode("K7QM4XRT9PDH")).toBe(code);
    expect(normalizeCode("win k7qm4xrt9pdh")).toBe(code);
  });

  it("refuses anything that cannot be a code, including a likely typo", () => {
    expect(normalizeCode("")).toBeNull();
    expect(normalizeCode(null)).toBeNull();
    expect(normalizeCode("WIN-K7QM-4XRT")).toBeNull();
    expect(normalizeCode("WIN-K7QM-4XRT-9PDH-AAAA")).toBeNull();
    // 0 and O are not in the alphabet: a typo is refused, not guessed at.
    expect(normalizeCode("WIN-K7QM-4XRT-9PD0")).toBeNull();
    expect(normalizeCode("WIN-K7QM-4XRT-9PDO")).toBeNull();
  });
});

describe("expiry", () => {
  it("is twelve months after activation", () => {
    expect(expiryFrom(new Date("2026-10-30T10:00:00Z")).toISOString()).toBe("2027-10-30T10:00:00.000Z");
  });
  it("does not spill into the next month (31 January + 1 month is 28 February)", () => {
    expect(expiryFrom(new Date("2027-01-31T00:00:00Z"), 1).toISOString().slice(0, 10)).toBe("2027-02-28");
    expect(expiryFrom(new Date("2028-02-29T00:00:00Z")).toISOString().slice(0, 10)).toBe("2029-02-28");
  });
});

describe("voucher state", () => {
  const now = new Date("2026-11-01T00:00:00Z");
  it("is pending until it is paid", () => {
    expect(voucherState({ status: "pending", expires_at: null }, now)).toBe("pending");
  });
  it("can be redeemed while active and before it expires", () => {
    expect(voucherState({ status: "active", expires_at: "2027-10-30T00:00:00Z" }, now)).toBe("ok");
  });
  it("is expired exactly at the expiry moment and after", () => {
    expect(voucherState({ status: "active", expires_at: "2026-11-01T00:00:00Z" }, now)).toBe("expired");
    expect(voucherState({ status: "active", expires_at: "2026-10-31T23:59:59Z" }, now)).toBe("expired");
  });
  it("is single use, and void wins over everything", () => {
    expect(voucherState({ status: "redeemed", expires_at: "2027-10-30T00:00:00Z" }, now)).toBe("redeemed");
    expect(voucherState({ status: "void", expires_at: "2027-10-30T00:00:00Z" }, now)).toBe("void");
  });
});

describe("text on the card", () => {
  it("collapses whitespace, drops invisible characters and cuts by character", () => {
    expect(cleanLine("  Anna ​  de   Vries ", 40)).toBe("Anna de Vries");
    expect(cleanLine("a\u0000b", 10)).toBe("a b");
    expect(cleanLine("😀😀😀😀", 2)).toBe("😀😀");
    expect(cleanLine(42, 10)).toBe("");
  });
  it("keeps single line breaks in a message but not runs of blank lines", () => {
    expect(cleanMessage("Lieve Anna,\r\n\r\n\r\nVeel plezier!")).toBe("Lieve Anna,\n\nVeel plezier!");
    expect(cleanMessage("x".repeat(500)).length).toBe(280);
  });
  it("validates e-mail addresses loosely", () => {
    expect(isValidEmail("a@b.nl")).toBe(true);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});
