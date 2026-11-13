-- Two more answers of the tester questionnaire: did the places and providers in the book fit the tester's
-- surroundings, and did the e-mail with the book arrive. Only a number and a fixed word: no text.
--
--   places_score  1-5   "Klopten de plekken en aanbieders in je boek met jouw omgeving?"
--   mail_status   'inbox' (arrived), 'spam' (arrived in the spam folder), 'missing' (not arrived)
--
-- The app keeps working without this migration: it then stores the older answers only (and logs it).
-- Run this in the Supabase SQL editor before sharing the test version.

alter table test_feedback
  add column if not exists places_score smallint check (places_score between 1 and 5),
  add column if not exists mail_status text check (mail_status in ('inbox', 'spam', 'missing'));
