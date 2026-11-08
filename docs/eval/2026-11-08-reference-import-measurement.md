# Import of the reference library: measurement before the photos

Date: 8 November 2026. Free (no API calls). Measures what the 124 activities imported from the reference library do to the selection if they
were shown, before spending money on their photos. Commands: `SHOW_PENDING=1 npx tsx scripts/reference-library/measure-with-pending.ts ../discovery-variety.ts 300`
and `../discovery-shadow.ts` (see that file). Same synthetic visitors in both runs (seed `variety-1`, 300 per wizard). Synthetic visitors, not people.

| | cards wizard, hidden | cards wizard, visible | image intake, hidden | image intake, visible |
|---|---|---|---|---|
| different activities used in 300 books | 490 | **576** | 461 | **532** |
| most frequent activity (share of books) | 11.7% (sterrenkijken) | **9.0%** | 13.0% (sterrenkijken) | 14.7% (sterrenkijken) |
| top 10 share of all idea slots | 8.5% | 8.0% | 12.2% | 11.4% |
| worlds per book | 5.96 | 6.06 | 6.30 | 6.25 |

Hard rules E1, E3, E4, E5, E6 (budget, repetition, one wildcard, social choice, supervision): **0 violations** with the imported activities visible, in
the cards run (200 profiles) and the image-intake run (300 profiles, with the profile sliders moved).

## What it says

- The library is wider in use: 70-86 more different activities appear in 300 books. That is the point of the import.
- The cards wizard gets more even (top 1 down from 11.7% to 9.0%). The image intake does not: `sterrenkijken` goes from 13.0% to 14.7% and `bloemenmarkt` from 9% to 13%,
  because the new creative and nature items share their tags with it and raise it as a neighbour. It is small and within the noise of 300 synthetic books, but it is the
  one number that moved the wrong way; re-measure after the photos exist and before anything goes live.
- `creative` goes from 57 to 129 of 702 activities (8% to 18%, `taxonomy:check` warns above 15%). The engine takes at most 2 ideas per world per book, so a book cannot fill
  with them, but the card pages will show more crafts. 72 of the 124 are creative because the reference library is craft-heavy (textile, wood, craft, drawing).
  Option: publish only part of them (for instance skip five of the drawing variants).

## What is not measured

Nothing here says the new activities are good. They are concepts, written by one author, with unreviewed tags and scenes. A visitor sees nothing of this yet.
