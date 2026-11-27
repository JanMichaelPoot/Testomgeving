// How much time the price check and the fact check may take (Step 252). A book is made inside one function that the platform stops after
// 300 s (maxDuration in app/plan/page.tsx). Both checks read other people's websites, which can be slow, so each has its own time per book
// and a latest moment, counted from the start of the book. Out of time they are cut short: a book without a found price says "ask the
// price", and that is better than no book.
//
// Pure apart from the timer in within().

export const CHECK_TIMES = {
  /** All the price checking of one book together. */
  priceTotalMs: 35_000,
  /** No price work after this point in the book: the writing (about 100 s) still has to come. */
  priceLatestEndMs: 160_000,
  /** The fact check of one book. */
  factTotalMs: 30_000,
  /** The fact check is done by then: the link check, the PDF, the upload and the e-mail still have to fit in the last minute. */
  factLatestEndMs: 240_000,
  /** Less than this is not worth starting: pages would be opened and a model asked with no time to use the answer. */
  minUsefulMs: 6_000,
} as const;

/**
 * The time one step may take now: what is left of its own total, never past its latest moment in the book. 0 when that is too little to be
 * worth starting.
 */
export function timeFor(bookStartedAt: number, now: number, totalLeftMs: number, latestEndMs: number): number {
  const left = Math.min(totalLeftMs, bookStartedAt + latestEndMs - now);
  return left >= CHECK_TIMES.minUsefulMs ? left : 0;
}

/** What `work` gives, or `fallback` when it takes longer than `ms` or fails. The work itself is not stopped here (give it its own time limit). */
export function within<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), Math.max(0, ms));
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}
