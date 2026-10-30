// Whether a stored draft may be continued when the intake opens. Pure, so the rule is tested without a browser.
//
// The landing page's gift button carries a one-time `s` value in its link: an arrival with a value this tab has not seen starts clean (a
// gift never inherits someone's earlier answers), the same value again is a reload and keeps the answers. A gift link without that value
// (typed or shared) only continues a gift that is already under way. A visit that is not a gift never continues a gift draft.

export interface ArrivalInput {
  purpose: "self" | "gift";
  /** The `s` value of the link, if any. */
  arrival: string | null;
  /** The `s` value this tab last started a gift with. */
  seenArrival: string | null;
  /** The stored draft, if there is one. */
  draft: { purpose: string | undefined; page: number } | null;
}

export type ArrivalDecision = "keep" | "discard";

export function decideDraft({ purpose, arrival, seenArrival, draft }: ArrivalInput): ArrivalDecision {
  if (!draft) return "keep";
  if (purpose === "gift") {
    if (arrival) return arrival === seenArrival ? "keep" : "discard";
    return draft.purpose === "gift" && draft.page > 0 ? "keep" : "discard";
  }
  return draft.purpose === "gift" ? "discard" : "keep";
}
