"use server";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { cleanTestFeedback, testFeedbackEnabled, type TestFeedbackInput } from "@/lib/testFeedback";

// Stores one tester answer (fase 8). Refuses unless the questionnaire is switched on, so the
// action cannot be used on Production where the form is not shown.
export async function submitTestFeedback(
  planId: string,
  locale: string,
  input: Partial<TestFeedbackInput>,
): Promise<{ ok: boolean }> {
  if (!testFeedbackEnabled(process.env.NEXT_PUBLIC_TEST_FEEDBACK)) return { ok: false };
  const clean = cleanTestFeedback(input);
  if (!clean) return { ok: false };
  const { error } = await createServiceRoleClient()
    .from("test_feedback")
    .insert({
      plan_id: /^[0-9a-f-]{36}$/i.test(planId) ? planId : null,
      flow_score: clean.flowScore,
      would_pay: clean.wouldPay,
      doubt: clean.doubt || null,
      locale: locale === "en" ? "en" : "nl",
    });
  if (error) {
    console.error("WINDOW: test feedback insert failed", error.message);
    return { ok: false };
  }
  return { ok: true };
}
