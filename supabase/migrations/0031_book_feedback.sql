-- The buyer's own rating of a finished Idea Book (Step 241): one row per book, written from the book page.
-- A score of 1-5, an optional sentence, and whether the buyer lets WindowInto show that sentence (anonymously) on the site.
-- The sentence lives here and never in analytics; PostHog only gets the score, whether there was a sentence, and the consent.
--
-- Row level security is on with no policies: the browser (anon key) can neither read nor write.
-- The app writes only from a server action with the service role (src/app/plan/bookFeedbackActions.ts), after
-- checking that the visitor owns the book.
--
-- Run this in the Supabase SQL editor. Until it has run the rating buttons still work for the buyer (sharing is
-- shown), nothing is stored, and the admin feedback page says so.

create table if not exists book_feedback (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null unique references window_plans(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 600),
  quote_consent boolean not null default false,
  locale text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table book_feedback enable row level security;
