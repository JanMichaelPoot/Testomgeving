-- "Verleiding" Fase 2 — the buyer can press "Dit ga ik doen" on the /plan
-- reveal page to say which idea they actually intend to try. Stored as the
-- same key format as feedback_json ("idea-<index in ideas_json>" or
-- "wildcard", see 0009_idea_feedback.sql), so the first-action reminder cron
-- can look the idea up directly instead of always nudging about ideas[0].
--
-- Both columns are nullable: null means "nothing chosen (yet)", which is
-- exactly the state every existing row is in.
alter table window_plans
  add column if not exists committed_idea_key text;

alter table window_plans
  add column if not exists committed_at timestamptz;
