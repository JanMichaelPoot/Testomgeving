-- Public storage bucket for generated Window Plan PDFs. Files are written
-- only by the service-role client (src/lib/supabase/server.ts); public
-- read access lets the "Download PDF" link and emailed copy work without a
-- signed URL.
insert into storage.buckets (id, name, public)
values ('window-plans', 'window-plans', true)
on conflict (id) do nothing;
