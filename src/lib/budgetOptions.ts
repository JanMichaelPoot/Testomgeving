// The budget choices of the intake. "Gratis" is no longer a choice a visitor can make (improvement plan D5,
// docs/verbeterplan-windowinto.md): the paid book is about concrete ideas, and free ideas stay in it anyway because the lowest
// band includes everything that costs nothing. Old drafts and old sessions can still carry "free"; the engine
// understands it, and new submissions turn it into the lowest band.
//
// The budget is a PER-PERSON amount on a slider of six steps (start page): up to €10, 25, 50, 100, 200, or "doesn't matter".
// The stored value is the step ("10", "25", "50", "100", "200", "allin"); the engine reads it as a cost class (constraints.ts),
// the writer and the researcher read it as words ("up to €25 per person"), the quality gate as a euro cap (ideaContent.ts).

export const BUDGET_VALUES = ["10", "25", "50", "100", "200", "allin"] as const;

/** The slider's steps in order, with the euro amount (null = no limit). */
export const BUDGET_STEPS: readonly { value: (typeof BUDGET_VALUES)[number]; euro: number | null }[] = [
  { value: "10", euro: 10 },
  { value: "25", euro: 25 },
  { value: "50", euro: 50 },
  { value: "100", euro: 100 },
  { value: "200", euro: 200 },
  { value: "allin", euro: null },
];

/** A budget as it should be stored from now on: "free" (an old draft or tab) becomes the lowest band that existed then. */
export function currentBudget(budget: string): string {
  return budget === "free" ? "25" : budget;
}

/** Index of a stored budget on the slider (-1 for nothing chosen or a value the slider does not know). */
export function budgetStepIndex(budget: string): number {
  return BUDGET_STEPS.findIndex((s) => s.value === currentBudget(budget));
}

/** The budget in words for a prompt. Always per person, so a group does not read it as a total. */
export function describeBudget(budget: string | undefined): string {
  const step = BUDGET_STEPS.find((s) => s.value === currentBudget(budget ?? ""));
  if (!step) return budget ? budget : "not stated";
  return step.euro === null ? "no limit" : `up to €${step.euro} per person`;
}
