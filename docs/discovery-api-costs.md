# API usage and cost of one Idea Book

Measured with `scripts/measure-generation.ts` (real API calls, timings and `usage` taken from the
`WINDOW: ...` log lines) and `scripts/experiment-research.ts`. Prices: Sonnet 5 $2 / $10 per MTok
(input / output), Haiku 4.5 $1 / $5, prompt-cache write 1.25x input, cache read 0.1x input,
web search $0.01 per search. Image generation is a separate Gemini bill.

## 1. How the calls were used before phase 4 (classic pipeline)

| Call | Model | Time | Cost | Share |
|---|---|---|---|---|
| Research pass: 4 web searches, ~36k tokens written to the prompt cache | Sonnet 5 | 25-45 s | ~$0.16 | ~74% |
| Main generation: profile + brief in, six ideas + wildcard out (~5k in, ~3k out) | Sonnet 5 | 35-47 s | ~$0.055 | ~26% |
| **Total** | | ~80-110 s | **~$0.216** (about EUR 0.19) | |

Two things stand out. The research pass is three quarters of the bill, and it is per book: two people
in Utrecht who both want pottery each pay for the same search. And it sat inside the retry loop, so a
malformed main answer paid for a second research pass.

## 2. What can be grouped, and what cannot

Photo generation is already grouped: one 3x3 sheet is cut into nine images, because Gemini charges
per generated image. The same idea applies to text, with a different mechanism:

- **Research: yes, group it.** All seeds that still need an answer go into ONE call. The model
  combines searches where one query covers several activities ("creatieve workshops Utrecht"), and
  the fixed prompt overhead is paid once, not per activity.
- **Research: share it between people.** The answer for one (activity x place) does not depend on
  who asks. It is stored in `local_research_cache` (migration 0014, 30 days when something was found,
  7 days when nothing was verifiable) and reused for the next person.
- **Research: use the smaller model.** Reading search results and writing down names and URLs does
  not need the writing model.
- **Writing: not groupable across people.** Every book is written from one person's profile; there is
  nothing to share. Instead the output is made smaller: the engine already supplies door, photo
  category, scores and image scene, so Claude writes only the text fields.
- **Batch API (50% off): only for non-live work.** A buyer waits for the book, so it cannot be used for
  orders. It is useful for evaluation runs and for pre-warming the cache.

## 3. Experiments on the research pass (same profile, real calls)

| Variant | Cost | Time | Result |
|---|---|---|---|
| Baseline (Sonnet, 4 searches, per book) | $0.174 | 45 s | reference |
| Dynamic filtering search tool (`web_search_20260209`) | $0.118 | - | failed: "tool use limit exceeded", 0 results. Rejected. |
| Haiku 4.5, one call for all seeds | ~$0.10 | ~15 s | briefs of the same kind, with URLs |
| Two Haiku calls | not cheaper | slower | rejected |

Haiku is about half the price and twice as fast. Quality was checked by reading the briefs on a few
profiles, not by a blind comparison; that is still open (see section 6).

## 4. Shared cache: what it is worth

Simulated with `scripts/simulate-research-cache.ts` (Zipf-like popularity of activities, a handful of
large places plus a long tail; assumptions are in the script). Share of seed lookups served from the
cache:

| Orders in the cache window | Hit rate |
|---|---|
| 100-300 | 5-9% |
| 1,000 | ~24% |
| 3,000 | ~43% |

So at launch volume the cache saves almost nothing; the saving comes from grouping and from Haiku.
The cache pays off as volume grows, at no extra cost per book. The table is created by migration 0014;
without it the code keeps working and just does not cache (one warning in the log).

## 5. The seed pipeline, measured

One real book on the card wizard ("Utrecht, kunst en klei"), cold cache:

| Call | Model | Time | Cost |
|---|---|---|---|
| Research: 7 seeds in one call, 5 searches (35k in, 1.4k out) | Haiku 4.5 | 15 s | ~$0.10 |
| Writing: 5.3k in, 3.1k out | Sonnet 5 | 35 s | $0.042 |
| **Total** | | ~50 s | **~$0.14-0.15** |

That is about 30-35% cheaper than $0.216 and about 40% faster. With a warm cache the research line
shrinks toward zero for popular combinations. The measurement script now prices each call with its own
model's rates (an earlier version priced the Haiku call at Sonnet rates and overstated it as $0.135).

## 6. Limits and open points

- One sample of the seed pipeline was measured; the range above is an estimate from that sample plus
  the separate Haiku experiment. Measure more profiles before quoting a hard number.
- Haiku research quality has been spot-checked, not compared blind. Suggested: 20 profiles, both
  pipelines, blind rating by Jan. On the real API that costs about $28 for 200 books (about half via
  the Batch API).
- The post-generation check flags websites in the text that do not occur in the research
  (`unverified_website`); the rate over many books is unknown yet.
- Seeds that come out of the engine are always written, so the engine's bias (popular "hub"
  activities) shows in the books; watch this in the evaluation.
- Only people who used the interest step go through the seed pipeline (`shouldUseEngine`). Everyone
  else, and any failure of the seed pipeline, uses the classic pipeline unchanged.
