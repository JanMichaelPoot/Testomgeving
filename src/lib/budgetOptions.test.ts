import { describe, expect, it } from "vitest";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { BUDGET_VALUES, currentBudget } from "@/lib/budgetOptions";

describe("budget choices (D5: no 'free' choice)", () => {
  it("turns an old 'free' into the lowest band and leaves the rest alone", () => {
    expect(currentBudget("free")).toBe("25");
    for (const b of ["25", "100", "allin", ""]) expect(currentBudget(b)).toBe(b);
  });

  it("offers exactly the current bands in both languages, and nowhere a 'free' option", () => {
    for (const locale of ["nl", "en"] as const) {
      const values = getDictionary(locale).intake.budget.options.map((o) => o.value);
      expect(values).toEqual([...BUDGET_VALUES]);
    }
  });
});
