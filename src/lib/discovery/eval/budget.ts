// A spending meter for the harness' paid mode (--full). It wraps `anthropic.messages.create`, adds up what
// every answer cost from its own `usage` (prices of docs/discovery-api-costs.md) and refuses to start a call
// that could take the total over the cap. So "at most $1.00" is enforced by code, not by an estimate.
//
// Pure apart from the object it wraps; no network, no SDK import, so the tests can use a fake client.

export interface UsageLike {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
}

/** USD per million tokens (input, output). Unknown models are priced as Sonnet, the dearer of the two we use. */
const RATES = { sonnet: { input: 2, output: 10 }, haiku: { input: 1, output: 5 } } as const;
const WEB_SEARCH_USD = 0.01;

export function priceOf(model: string, usage: UsageLike | null | undefined): number {
  if (!usage) return 0;
  const rate = /haiku/i.test(model) ? RATES.haiku : RATES.sonnet;
  const input = (usage.input_tokens ?? 0) * rate.input;
  const output = (usage.output_tokens ?? 0) * rate.output;
  // Writing to the prompt cache costs 1.25x the input price, reading from it 0.1x.
  const cacheWrite = (usage.cache_creation_input_tokens ?? 0) * rate.input * 1.25;
  const cacheRead = (usage.cache_read_input_tokens ?? 0) * rate.input * 0.1;
  const searches = (usage.server_tool_use?.web_search_requests ?? 0) * WEB_SEARCH_USD;
  return (input + output + cacheWrite + cacheRead) / 1_000_000 + searches;
}

export class BudgetExceededError extends Error {
  constructor(
    readonly spent: number,
    readonly cap: number,
  ) {
    super(`Budget stop: $${spent.toFixed(3)} spent of $${cap.toFixed(2)}; the next call could go over the cap, so it was not started.`);
  }
}

type Create = (...args: never[]) => Promise<unknown>;

export class BudgetMeter {
  spent = 0;
  calls = 0;
  private inFlight = 0;

  /**
   * @param capUsd hard cap on the total.
   * @param reserveUsd what one call may cost at the very most (a writing call at max_tokens 9000 is about $0.11,
   *   a research call with five searches about $0.12); every call in flight keeps this much of the cap free.
   */
  constructor(
    readonly capUsd: number,
    readonly reserveUsd = 0.12,
  ) {}

  get remaining(): number {
    return this.capUsd - this.spent;
  }

  /** True when one more whole book (about $0.25 at worst) still fits under the cap. */
  canStartBook(worstCaseUsd = 0.3): boolean {
    return this.spent + this.inFlight * this.reserveUsd + worstCaseUsd <= this.capUsd;
  }

  /** Replaces `target.create` by a metered version. Returns a function that puts the original back. */
  wrap(target: { create: Create }): () => void {
    const original = target.create.bind(target) as (args: { model?: string }) => Promise<{ usage?: UsageLike }>;
    const previous = target.create;
    target.create = (async (args: { model?: string }) => {
      if (this.spent + (this.inFlight + 1) * this.reserveUsd > this.capUsd) throw new BudgetExceededError(this.spent, this.capUsd);
      this.inFlight++;
      try {
        const message = await original(args);
        this.spent += priceOf(args?.model ?? "", message.usage);
        this.calls++;
        return message;
      } finally {
        this.inFlight--;
      }
    }) as unknown as Create;
    return () => {
      target.create = previous;
    };
  }
}
