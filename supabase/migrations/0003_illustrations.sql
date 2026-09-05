-- Gemini-generated illustrations for idea cards and the Window Plan hero
-- image. Public storage bucket mirrors window-plans (0002_storage.sql):
-- written only by the service-role client, publicly readable so the
-- <img> tags on /ideas and /plan don't need signed URLs.
alter table ideas add column image_url text;
alter table window_plans add column image_url text;

insert into storage.buckets (id, name, public)
values ('illustrations', 'illustrations', true)
on conflict (id) do nothing;
