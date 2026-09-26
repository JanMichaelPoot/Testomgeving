-- Shared cache of local research results, per activity and place.
--
-- Finding real, current options ("where can I take a pottery trial class in
-- Utrecht?") is the most expensive part of generating an Idea Book (web search plus
-- the search results as input). The answer does not depend on who asks, so it is
-- stored once and reused for the next person with the same activity in the same
-- place. Nothing personal is stored: only an activity id, a place and public
-- business information.
--
--   place_key   normalised place plus search radius, e.g. 'utrecht|city',
--               'utrecht|region', 'nl|nl' (see src/lib/claude/localResearch.ts)
--   options     [{ name, city, url, note }]; an empty array means "searched, found
--               nothing verifiable" (remembered for a shorter time so a miss is not
--               paid for again on every order)
--   expires_at  found options age (opening hours, prices, businesses closing), so
--               they are trusted for 30 days; empty results for 7 days
--
-- Run this in the Supabase SQL editor. Until it has been run, the app simply does
-- not cache (every book researches its own options), nothing breaks.

create table if not exists local_research_cache (
  id uuid primary key default gen_random_uuid(),
  activity_id text not null,
  place_key text not null,
  locale text not null,
  options jsonb not null default '[]'::jsonb,
  searched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (activity_id, place_key, locale)
);

create index if not exists local_research_cache_expires_idx on local_research_cache (expires_at);

alter table local_research_cache enable row level security;
-- No anon/authenticated policies (same pattern as the rest of the schema, see
-- 0001_init.sql): all access goes through the service-role key on the server.
