import { describe, expect, it } from "vitest";
import { ageOptionsFor } from "@/lib/ageOptions";
import { getDictionary } from "@/lib/i18n/dictionaries";

describe("ageOptionsFor", () => {
  for (const locale of ["nl", "en"] as const) {
    const options = getDictionary(locale).intake.ageCategory.options;

    it(`${locale}: for yourself the rows start at 18-24`, () => {
      const values = ageOptionsFor(options, false, "").map((o) => o.value);
      expect(values[0]).toBe("18-24");
      expect(values).not.toContain("under18");
      expect(values).toHaveLength(options.length - 1);
    });

    it(`${locale}: a gift keeps every category`, () => {
      expect(ageOptionsFor(options, true, "").map((o) => o.value)).toEqual(options.map((o) => o.value));
    });

    it(`${locale}: an answer that was already chosen is never hidden`, () => {
      expect(ageOptionsFor(options, false, "under18").map((o) => o.value)).toContain("under18");
    });
  }
});
