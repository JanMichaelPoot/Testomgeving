-- Prevents a real, observed race: two concurrent /plan requests for the
-- same session (e.g. two open browser tabs, or a manual reload landing at
-- the same moment as the GeneratingScreen's own 5s poll) could each
-- independently see "no plan exists yet" and insert their own "pending"
-- row, triggering duplicate, fully redundant Claude+PDF generations for a
-- single purchase. Confirmed live: one test session ended up with three
-- separate "ready" rows, i.e. three full paid-tier generations for one
-- session_id.
--
-- A partial unique index allows at most one "active" (pending or ready)
-- row per session at a time. A second concurrent insert now fails with a
-- unique-violation (Postgres error 23505) instead of silently succeeding
-- — see startPlanGeneration/ConcurrentGenerationError in
-- src/app/plan/data.ts for how that's turned into "wait for the other
-- request's result" instead of a hard error. A "failed" row is
-- deliberately excluded from the index so retryPlanGeneration can still
-- insert a fresh attempt after deleting a failed one.
create unique index if not exists window_plans_session_active_unique
  on window_plans (session_id)
  where status in ('pending', 'ready');
