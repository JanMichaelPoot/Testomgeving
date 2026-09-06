-- Two independent additions to window_plans, both part of "Fase 1" of the
-- product improvement plan:
--
-- 1. `status` turns generation into an explicit state machine (pending ->
--    ready|failed) instead of "a row only exists once generation fully
--    succeeded". Without this, a page reload during the ~20-60s generation
--    window finds no row and starts a second, fully redundant Claude call +
--    PDF render + upload — confirmed happening live during testing this
--    project. Existing rows default to 'ready' since they were only ever
--    written after a successful generation.
--
-- 2. The Actionability Layer fields live inside `ideas_json`/`wildcard_json`
--    (jsonb, already schema-less) so no column changes are needed for
--    those — this migration only adds `status`.

alter table window_plans
  add column if not exists status text not null default 'ready';

alter table window_plans
  add constraint window_plans_status_check
  check (status in ('pending', 'ready', 'failed'));
