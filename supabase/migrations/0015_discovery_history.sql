-- Optional repetition memory ("do not show me the same activities again").
--
-- Only for visitors who explicitly opt in on the checkout page. Opting in sets a
-- random device id in a first-party cookie (12 months); this table stores only the
-- SHA-256 hash of that id, never the id itself and never an e-mail address, so the
-- rows cannot be linked to a person (same principle as intake_answers, see
-- 0001_init.sql). One row per book that was made for an opted-in device:
--
--   session_id    the session the book belongs to (one row per session)
--   device_hash   sha256 of the device id in the cookie
--   activity_ids  the library activities that book showed (empty until the book has
--                 been generated; the row is created at checkout so the generation,
--                 which has no access to the visitor's cookies, knows which device it
--                 is for)
--
-- The next book for the same device does not repeat what the last two books showed,
-- unless the visitor picks it again (see src/lib/discovery/engine). Rows older than
-- 12 months are deleted whenever a new row is written; "forget this device" (privacy
-- page) and switching the option off delete all rows of the device at once.
--
-- Run this in the Supabase SQL editor. Until it has been run the app simply works
-- without a memory: opting in changes nothing, nothing breaks.

create table if not exists discovery_history (
  session_id uuid primary key references sessions(id) on delete cascade,
  device_hash text not null,
  activity_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists discovery_history_device_idx on discovery_history (device_hash, created_at desc);

alter table discovery_history enable row level security;
-- No anon/authenticated policies (same pattern as the rest of the schema): all access
-- goes through the service-role key on the server.
