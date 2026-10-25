import { describe, expect, it } from "vitest";
import { isRealPayment, parseScope, selectForDeletion, type CleanupScope } from "@/lib/adminCleanup";

const scope = (over: Partial<CleanupScope> = {}): CleanupScope => ({ before: "2026-10-25", books: true, unfinished: true, feedback: false, log: false, ...over });
const get = (o: Record<string, string>) => ({ get: (n: string) => o[n] ?? null });

describe("parseScope", () => {
  it("needs a real date and at least one kind of data", () => {
    expect(parseScope(get({ before: "2026-10-25", books: "1" }))).toMatchObject({ before: "2026-10-25", books: true, log: false });
    expect(parseScope(get({ before: "2026-10-25" }))).toBeNull();
    expect(parseScope(get({ before: "morgen", books: "1" }))).toBeNull();
    expect(parseScope(get({ before: "2026-13-45", books: "1" }))).toBeNull();
    expect(parseScope(get({ books: "1" }))).toBeNull();
  });
});

describe("selectForDeletion", () => {
  const sessions = ["s-test", "s-nopay", "s-empty", "s-real", "s-mixed"].map((id) => ({ id, created_at: "2026-10-01T10:00:00Z" }));
  const plans = [
    { id: "p-test", session_id: "s-test", pdf_url: "s-test/idea-book.pdf" },
    { id: "p-nopay", session_id: "s-nopay", pdf_url: "s-nopay/idea-book.pdf" },
    { id: "p-real", session_id: "s-real", pdf_url: "s-real/idea-book.pdf" },
    { id: "p-mixed", session_id: "s-mixed", pdf_url: null },
  ];
  const payments = [
    { id: "o-test", session_id: "s-test", stripe_payment_id: "cs_test_abc" },
    { id: "o-real", session_id: "s-real", stripe_payment_id: "cs_live_xyz" },
    { id: "o-mixed-1", session_id: "s-mixed", stripe_payment_id: "cs_test_def" },
    { id: "o-mixed-2", session_id: "s-mixed", stripe_payment_id: "cs_live_def" },
  ];

  it("takes test books, test orders and the unfinished, but never a session with a real order", () => {
    const sel = selectForDeletion({ scope: scope(), sessions, plans, payments });
    expect(sel.sessionIds.sort()).toEqual(["s-empty", "s-nopay", "s-test"]);
    expect(sel.planIds.sort()).toEqual(["p-nopay", "p-test"]);
    expect(sel.paymentIds).toEqual(["o-test"]);
    expect(sel.pdfPaths.sort()).toEqual(["s-nopay/idea-book.pdf", "s-test/idea-book.pdf"]);
    expect(sel.keptReal).toBe(2);
    // the real order and everything hanging on it stays: its book, and the test order of the same session
    expect(sel.planIds).not.toContain("p-real");
    expect(sel.paymentIds).not.toContain("o-mixed-1");
  });

  it("respects the scope: books only, or unfinished only", () => {
    expect(selectForDeletion({ scope: scope({ unfinished: false }), sessions, plans, payments }).sessionIds.sort()).toEqual(["s-nopay", "s-test"]);
    expect(selectForDeletion({ scope: scope({ books: false }), sessions, plans, payments }).sessionIds).toEqual(["s-empty"]);
    expect(selectForDeletion({ scope: scope({ books: false, unfinished: false, feedback: true }), sessions, plans, payments }).sessionIds).toEqual([]);
  });

  it("treats anything that is not a Stripe test session as a real order", () => {
    expect(isRealPayment("cs_test_a1")).toBe(false);
    expect(isRealPayment("cs_live_a1")).toBe(true);
    expect(isRealPayment("pi_123")).toBe(true);
    expect(isRealPayment("")).toBe(true);
  });
});
