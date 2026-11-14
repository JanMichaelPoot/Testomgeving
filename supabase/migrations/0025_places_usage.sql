-- A monthly counter for Google Places lookups (src/lib/claude/placesRatings.ts): the Google score of a place costs one Text Search
-- request (the "Enterprise" SKU: the first 1,000 a month are free, then USD 0.035 each). Every lookup first takes a ticket here, and the
-- counter stops at a limit below the free tier, so the bill cannot grow by accident.
--
-- The app keeps working without this migration: it then makes no Google lookups at all (and logs it).
-- Run this in the Supabase SQL editor before setting GOOGLE_PLACES_API_KEY.

create table if not exists places_usage (
  month text primary key,               -- "2026-11"
  lookups integer not null default 0
);

alter table places_usage enable row level security; -- no policies: only the service role reads or writes it

-- Hands out up to p_n lookups for the month without passing p_limit; returns how many were granted (p_n, or 0 when the limit is reached).
create or replace function places_usage_take(p_month text, p_n integer, p_limit integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  granted integer;
begin
  insert into places_usage (month, lookups) values (p_month, 0) on conflict (month) do nothing;
  update places_usage
     set lookups = lookups + p_n
   where month = p_month and lookups + p_n <= p_limit
  returning p_n into granted;
  return coalesce(granted, 0);
end;
$$;

revoke all on function places_usage_take(text, integer, integer) from public, anon, authenticated;
grant execute on function places_usage_take(text, integer, integer) to service_role;
