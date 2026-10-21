-- Three more answers of the tester questionnaire (Route 1 + 2, R2.4): was the person understood
-- by the profile screen, did they get why they received these doors, and which door would they
-- really do. Only numbers and a fixed door kind: no text. (The free text stays in `doubt`.)
--
--   profile_score  1-5   "Voelde je je begrepen door 'Zo kijken wij door jouw venster'?"
--   doors_score    1-5   "Snapte je waarom je deze deuren kreeg?"
--   door_pick      0-7   position of the chosen idea in the reveal (1-6 the doors, 7 the wildcard); 0 = none of them
--   door_kind      the kind of door that was picked (natural, discovery, unexpected, stretch, wildcard)
--
-- The app keeps working without this migration: it then stores the older answers only (and logs it).
-- Run this in the Supabase SQL editor before sharing the preview.

alter table test_feedback
  add column if not exists profile_score smallint check (profile_score between 1 and 5),
  add column if not exists doors_score smallint check (doors_score between 1 and 5),
  add column if not exists door_pick smallint check (door_pick between 0 and 7),
  add column if not exists door_kind text check (door_kind in ('natural', 'discovery', 'unexpected', 'stretch', 'wildcard'));
