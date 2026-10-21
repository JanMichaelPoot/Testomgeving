-- The thread per door (WINDOW "Route 1 + 2", R2.2).
--
--   association_sources   how the doors of an image-intake book came about, at the moment the book
--                         was written: per activity the chosen images and the tags through which
--                         images and activity meet, so /plan can show "jouw beeld -> wat we erin
--                         lazen -> deze deur -> de echte plek" and the PDF can say the same in one
--                         line, also when the image library is edited later:
--                           { "version": 2,
--                             "sources":    { "<activity id>": ["<image id>", ...] },
--                             "sourceTags": { "<activity id>": ["<tag id>", ...] } }
--                         Null for books made before this column or with another intake: the thread
--                         is then simply not shown.
--
-- Run this in the Supabase SQL editor. Until it has been run the app keeps working: books are still
-- saved (without the thread), and a log line says the column is missing.

alter table window_plans
  add column if not exists association_sources jsonb;

notify pgrst, 'reload schema';
