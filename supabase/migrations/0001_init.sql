-- WINDOW — initial schema
--
-- Design principle (AVG/GDPR): behavioural data (intake_answers, ideas,
-- window_plans) is keyed off the anonymous `sessions.id`, never directly off
-- `users.email`. A session only gets linked to a user once someone pays or
-- opts in, keeping the amount of directly identifiable data we store to a
-- minimum.
--
-- RLS: enabled on every table with no anon/authenticated policies. All
-- reads and writes go through server-side route handlers / server actions
-- using the Supabase service role client (src/lib/supabase/server.ts ->
-- createServiceRoleClient), which bypasses RLS. The publishable anon key is
-- only used for Supabase Auth itself.

create extension if not exists "pgcrypto";

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now(),
  marketing_opt_in boolean not null default false
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  status text not null default 'started'
    check (status in ('started', 'diverging', 'converged', 'paid', 'abandoned'))
);

create index sessions_user_id_idx on sessions (user_id);

create table intake_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  topic text,
  time_available text,
  budget text,
  desired_surprise text,
  company text,
  raw_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index intake_answers_session_id_idx on intake_answers (session_id);

create table ideas (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  lens text not null,
  title text not null,
  description text not null,
  status text not null default 'generated'
    check (status in ('generated', 'liked', 'skipped', 'refined')),
  created_at timestamptz not null default now()
);

create index ideas_session_id_idx on ideas (session_id);

create table window_plans (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  chosen_idea_id uuid not null references ideas (id),
  title text not null,
  why_it_fits text not null,
  steps_json jsonb not null default '[]'::jsonb,
  first_action text not null,
  cost_estimate text,
  time_estimate text,
  pdf_url text,
  created_at timestamptz not null default now()
);

create index window_plans_session_id_idx on window_plans (session_id);

create table payments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  stripe_payment_id text not null unique,
  amount integer not null,
  currency text not null default 'eur',
  status text not null
    check (status in ('pending', 'succeeded', 'failed', 'refunded')),
  -- Legal requirement: explicit confirmation that the user understands the
  -- statutory 14-day right of withdrawal is waived because the digital
  -- Window Plan is delivered immediately. session_id above supplies the
  -- session link; this column supplies the timestamp.
  withdrawal_waiver_confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create index payments_session_id_idx on payments (session_id);

alter table users enable row level security;
alter table sessions enable row level security;
alter table intake_answers enable row level security;
alter table ideas enable row level security;
alter table window_plans enable row level security;
alter table payments enable row level security;
