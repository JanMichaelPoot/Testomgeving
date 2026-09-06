-- Replaces the single-idea "Window Plan" with a multi-idea "Idea Book":
-- one paid PDF containing a profile summary, 6-7 ideas, and one wildcard,
-- generated from a much richer intake profile. There is no more
-- convergence step (nothing is "chosen" from a candidate list), so
-- chosen_idea_id and the single-idea content columns are replaced with
-- the book's own structured content.
--
-- The `ideas` table is intentionally left in place, unused — no
-- destructive drop for a table that isn't hurting anything idle.

alter table window_plans drop constraint if exists window_plans_chosen_idea_id_fkey;
alter table window_plans drop column if exists chosen_idea_id;
alter table window_plans drop column if exists why_it_fits;
alter table window_plans drop column if exists steps_json;
alter table window_plans drop column if exists first_action;
alter table window_plans drop column if exists cost_estimate;
alter table window_plans drop column if exists time_estimate;

alter table window_plans add column if not exists language text not null default 'en';
alter table window_plans add column if not exists profile_summary text not null default '';
alter table window_plans add column if not exists must_haves jsonb not null default '[]';
alter table window_plans add column if not exists preferences jsonb not null default '[]';
alter table window_plans add column if not exists ideas_json jsonb not null default '[]';
alter table window_plans add column if not exists wildcard_json jsonb not null default '{}';
alter table window_plans add column if not exists labels_json jsonb not null default '{}';
