-- Test phase: at most N books per IP address (TEST_MAX_BOOKS_PER_IP, see src/lib/testQuota.ts).
-- The address itself is never stored, only a keyed hash of it (HMAC with a secret kept on the server), so a row says
-- "this connection started the book of this session" and cannot be turned back into an address.
-- A row goes away with its session (on delete cascade), so cleaning up test data also resets the counts.

create table if not exists test_quota (
  session_id uuid primary key references sessions (id) on delete cascade,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists test_quota_ip_hash_idx on test_quota (ip_hash);

alter table test_quota enable row level security;
-- Same pattern as the rest of the schema: no anon/authenticated policies, only the service role reads and writes.
