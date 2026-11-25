-- The check-in mail a week after a book (Step 243): "did you do anything with it?", answered by one click, and what came of it.
--
-- window_plans.checkin_sent_at    when the check-in mail went out (once per book, claimed before sending, like followup_sent_at).
-- book_checkins                   the buyer's answer (done / planned / not) and, optionally, one sentence; with consent only the
--                                 "done" sentence may be shown on the site (anonymously). One row per book.
-- mail_optouts                    people who do not want this kind of mail again: a salted hash of the address, never the address
--                                 itself. The cron skips a buyer whose hash is here, for every future book.
--
-- Row level security is on for both tables with no policies: the browser (anon key) can neither read nor write. The app only
-- reads and writes from server code with the service role.
--
-- Run this in the Supabase SQL editor. Until it has run the cron sends nothing (it says so in the log and in /admin) and the
-- answer page cannot store anything.

alter table window_plans add column if not exists checkin_sent_at timestamptz;

create table if not exists book_checkins (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null unique references window_plans(id) on delete cascade,
  answer text not null check (answer in ('done', 'planned', 'not')),
  comment text check (char_length(comment) <= 600),
  quote_consent boolean not null default false,
  locale text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table book_checkins enable row level security;

create table if not exists mail_optouts (
  email_hash text primary key,
  created_at timestamptz not null default now()
);

alter table mail_optouts enable row level security;
