// Pure checks for the tester questionnaire (fase 8), shared by the form and the server action.
export type WouldPay = "yes" | "maybe" | "no";

export interface TestFeedbackInput {
  flowScore: number | null;
  wouldPay: WouldPay | null;
  doubt: string;
}

export const DOUBT_MAX = 1000;

export function testFeedbackEnabled(raw: string | undefined): boolean {
  return raw === "1";
}

/** Cleaned input, or null when there is nothing worth storing. */
export function cleanTestFeedback(input: Partial<TestFeedbackInput>): TestFeedbackInput | null {
  const score = Number.isInteger(input.flowScore) && input.flowScore! >= 1 && input.flowScore! <= 5 ? input.flowScore! : null;
  const pay = input.wouldPay === "yes" || input.wouldPay === "maybe" || input.wouldPay === "no" ? input.wouldPay : null;
  const doubt = typeof input.doubt === "string" ? input.doubt.trim().slice(0, DOUBT_MAX) : "";
  if (score === null && pay === null && doubt === "") return null;
  return { flowScore: score, wouldPay: pay, doubt };
}
