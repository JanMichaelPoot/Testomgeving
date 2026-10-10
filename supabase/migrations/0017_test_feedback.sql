-- Tester feedback on the test preview (WINDOW bouwopdracht "Het venster", fase 8).
-- Shown under the reveal only when NEXT_PUBLIC_TEST_FEEDBACK=1. The free-text answer lives
-- here and never in analytics; PostHog only gets the score and the pay answer.
--
-- Row level security is on with no policies: the browser (anon key) can neither read nor write.
-- The app only inserts, from a server action with the service role (src/app/plan/feedbackActions.ts).
--
-- Run this in the Supabase SQL editor before sharing the preview.

create table if not exists test_feedback (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references window_plans(id) on delete set null,
  flow_score smallint check (flow_score between 1 and 5),
  would_pay text check (would_pay in ('yes', 'maybe', 'no')),
  doubt text check (char_length(doubt) <= 1000),
  locale text,
  created_at timestamptz not null default now()
);

alter table test_feedback enable row level security;
