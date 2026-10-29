// The budget choices of the intake. "Gratis" is no longer a choice a visitor can make (improvement plan D5,
// docs/verbeterplan-windowinto.md): the paid book is about concrete ideas, and free ideas stay in it anyway because the lowest
// band ("up to €25") includes everything that costs nothing. Old drafts and old sessions can still carry "free"; the engine
// understands it, and new submissions turn it into the lowest band.

export const BUDGET_VALUES = ["25", "100", "allin"] as const;

/** A budget as it should be stored from now on: "free" (an old draft or tab) becomes the lowest band. */
export function currentBudget(budget: string): string {
  return budget === "free" ? "25" : budget;
}
