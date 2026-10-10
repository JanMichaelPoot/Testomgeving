-- Honest waiting (WINDOW bouwopdracht "Het venster", fase 0).
--
--   progress_stage       how far a pending Idea Book has come, so the waiting screen shows the
--                        real step instead of rotating messages:
--                          null        just started (the pending row exists)
--                          selected    the selection engine chose the seven ideas
--                          researched  local places were looked up
--                          written     Claude wrote the ideas
--                          rendered    the PDF is made (the row turns "ready" right after)
--
-- Run this in the Supabase SQL editor. Until it has been run the app keeps working: the
-- waiting screen stays on its first step (the write is best effort and never blocks a book).

alter table window_plans
  add column if not exists progress_stage text
    check (progress_stage is null or progress_stage in ('selected', 'researched', 'written', 'rendered'));
