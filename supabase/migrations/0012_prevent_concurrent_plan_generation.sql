-- Prevents a real, observed race: two concurrent /plan requests for the
-- same session (e.g. two open browser tabs, or a manual reload landing at
-- the same moment as the GeneratingScreen's own 5s poll) could each
-- independently see "no plan exists yet" and insert their own "pending"
-- row, triggering duplicate, fully redundant Claude+PDF generations for a
-- single purchase. Confirmed live: one test session ended up with three
-- separate "ready" rows, i.e. three full paid-tier generations for one
-- session_id — and, across the whole table, 9 sessions had this happen
-- (one with 13 duplicate "ready" rows).
--
-- Step 1: clean up the pre-existing duplicates/stale rows the index below
-- would otherwise reject outright. Verified directly against the database
-- first that every affected row has payment_id = null (test-bypass data
-- only, no real order ever produced a duplicate) before writing this.
-- Keeps the single most recent "pending"/"ready" row per session and
-- reclassifies everything else — the older duplicates, plus any "pending"
-- row old enough to be a crashed/abandoned attempt (mirrors
-- PENDING_TIMEOUT_MS in src/app/plan/data.ts) — as "failed" rather than
-- deleting them, preserving the audit trail.
with ranked as (
  select id,
         status,
         created_at,
         row_number() over (partition by session_id order by created_at desc) as rn
  from window_plans
  where status in ('pending', 'ready')
)
update window_plans
set status = 'failed'
where id in (
  select id from ranked
  where rn > 1
     or (status = 'pending' and created_at < now() - interval '90 seconds')
);

-- Step 2: a partial unique index allows at most one "active" (pending or
-- ready) row per session at a time from here on. A second concurrent
-- insert now fails with a unique-violation (Postgres error 23505) instead
-- of silently succeeding — see startPlanGeneration/ConcurrentGenerationError
-- in src/app/plan/data.ts for how that's turned into "wait for the other
-- request's result" instead of a hard error. A "failed" row is
-- deliberately excluded from the index so retryPlanGeneration can still
-- insert a fresh attempt after deleting a failed one, and
-- resolveExistingPlan now reclassifies a stale "pending" row as "failed"
-- itself (see its own comment) so a permanently stuck pending row can
-- never again block regeneration once this index exists.
create unique index if not exists window_plans_session_active_unique
  on window_plans (session_id)
  where status in ('pending', 'ready');
