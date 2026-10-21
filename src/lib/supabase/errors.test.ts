import { describe, expect, it } from "vitest";
import { isMissingColumnError } from "@/lib/supabase/errors";

describe("isMissingColumnError", () => {
  it("recognises both shapes of 'the column does not exist'", () => {
    expect(isMissingColumnError({ code: "42703", message: 'column "x" does not exist' })).toBe(true);
    expect(isMissingColumnError({ code: "PGRST204", message: "Could not find the 'door_kind' column of 'test_feedback' in the schema cache" })).toBe(true);
    expect(isMissingColumnError({ message: "Could not find the 'association_sources' column of 'window_plans' in the schema cache" })).toBe(true);
  });

  it("does not mistake other errors for it", () => {
    expect(isMissingColumnError(null)).toBe(false);
    expect(isMissingColumnError(undefined)).toBe(false);
    expect(isMissingColumnError({ code: "23505", message: "duplicate key value violates unique constraint" })).toBe(false);
    expect(isMissingColumnError({ code: "XX000", message: "boom" })).toBe(false);
  });
});
