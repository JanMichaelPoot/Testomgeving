import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { COMPANY, COMPANY_LINE } from "@/lib/company";
import { getDictionary } from "@/lib/i18n/dictionaries";

describe("company details", () => {
  it("shows the registered company, with no placeholder left, in the footer data, the privacy page and the mail", () => {
    for (const locale of ["nl", "en"] as const) {
      const dict = getDictionary(locale);
      const line = COMPANY_LINE[locale];
      for (const part of [COMPANY.tradeName, COMPANY.kvk, COMPANY.branchNumber, "Breeweg 9", "1251 DX", "Laren"]) expect(line).toContain(part);
      expect(dict.email.companyInfo).toBe(line);
      const section = dict.legal.privacySections.find((s) => s.id === "bedrijfsgegevens");
      expect(section?.body).toBe(line);
      expect(line).not.toMatch(/\[|\]/);
    }
  });
});

describe("no way to get a book without paying", () => {
  const read = (...p: string[]) => readFileSync(path.join(process.cwd(), ...p), "utf8");
  it("has no skip-payment action or button any more", () => {
    expect(read("src", "app", "checkout", "actions.ts")).not.toContain("skipPaymentForTesting");
    expect(read("src", "components", "window", "TestModeBanner.tsx")).not.toMatch(/skipPayment|onClick/);
  });
  it("opens a book by session id only for a logged-in admin", () => {
    const page = read("src", "app", "plan", "page.tsx");
    expect(page).toMatch(/test_session_id === "string" && \(await isAdminAuthenticated\(\)\)/);
  });
});
