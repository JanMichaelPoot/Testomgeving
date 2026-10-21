"use server";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { isMissingColumnError } from "@/lib/supabase/errors";
import { cleanTestFeedback, testFeedbackEnabled, type TestFeedbackInput } from "@/lib/testFeedback";


// Stores one tester answer (fase 8, extended in R2.4). Refuses unless the questionnaire is switched
// on, so the action cannot be used on Production where the form is not shown.
export async function submitTestFeedback(
  planId: string,
  locale: string,
  input: Partial<TestFeedbackInput>,
): Promise<{ ok: boolean }> {
  if (!testFeedbackEnabled(process.env.NEXT_PUBLIC_TEST_FEEDBACK)) return { ok: false };
  const clean = cleanTestFeedback(input);
  if (!clean) return { ok: false };
  const supabase = createServiceRoleClient();
  const base = {
    plan_id: /^[0-9a-f-]{36}$/i.test(planId) ? planId : null,
    flow_score: clean.flowScore,
    would_pay: clean.wouldPay,
    doubt: clean.doubt || null,
    locale: locale === "en" ? "en" : "nl",
  };
  let { error } = await supabase.from("test_feedback").insert({
    ...base,
    profile_score: clean.profileScore,
    doors_score: clean.doorsScore,
    door_pick: clean.doorPick,
    door_kind: clean.doorKind,
  });
  if (isMissingColumnError(error)) {
    // Migration 0020 has not been run yet: keep the older answers rather than lose everything.
    console.error(`WINDOW: test feedback saved without the R2.4 answers (run migration 0020?): ${error?.message}`);
    ({ error } = await supabase.from("test_feedback").insert(base));
  }
  if (error) {
    console.error("WINDOW: test feedback insert failed", error.message);
    return { ok: false };
  }
  return { ok: true };
}
