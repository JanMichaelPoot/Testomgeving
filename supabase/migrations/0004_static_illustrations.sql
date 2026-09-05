-- Superseded by fixed, pre-generated illustrations committed as static
-- assets (see src/lib/illustrations.ts and scripts/generate-illustrations.ts)
-- instead of a Gemini call + storage upload per idea/session. Removes the
-- now-unused per-idea image column and storage bucket from 0003.
-- window_plans.image_url stays — it's still populated, just with a fixed
-- per-lens path instead of a per-plan generated one.
alter table ideas drop column if exists image_url;

delete from storage.objects where bucket_id = 'illustrations';
delete from storage.buckets where id = 'illustrations';
