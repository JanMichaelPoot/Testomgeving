-- Real numbers on the waiting screen (WINDOW "Route 1 + 2", P0-2).
--
--   progress_meta   what the generation knew when it passed a step, so the waiting screen can
--                   say "7 doors chosen" and "12 places found" with numbers that are true:
--                     { "ideas": 7 }    set together with progress_stage = 'selected'
--                     { "places": 12 }  set together with progress_stage = 'researched'
--                   Counts only, never text. Absent or null = the pipeline did not know a number
--                   (the classic pipeline), and the screen then shows the step without one.
--
-- Run this in the Supabase SQL editor. Until it has been run the app keeps working: the stage is
-- still written, only the numbers are left out.

alter table window_plans
  add column if not exists progress_meta jsonb;

notify pgrst, 'reload schema';
