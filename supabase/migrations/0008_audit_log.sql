-- Volledig geanonimiseerd logboek van elke gegenereerde Idea Book, voor
-- interne kwaliteits-/auditdoeleinden (zie /admin). Deze tabel bevat
-- bewust GEEN session_id, user_id of e-mailadres — anders dan elke andere
-- tabel in dit schema is een rij hier nooit terug te herleiden naar een
-- sessie, laat staan een persoon, ook niet door een admin met volledige
-- databasetoegang. `email_delivered` registreert alleen OF de PDF is
-- gemaild, niet naar wie.

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  locale text not null,
  -- De volledige intake-antwoorden (zie IntakeAnswers in
  -- src/app/intake/actions.ts) — inhoudelijk hetzelfde als
  -- intake_answers.raw_json, maar hier zonder de koppeling naar
  -- sessions.id die dat record wel heeft.
  input_json jsonb not null default '{}'::jsonb,
  output_profile_summary text,
  output_must_haves text[] not null default '{}',
  output_preferences text[] not null default '{}',
  output_ideas_json jsonb not null default '[]'::jsonb,
  output_wildcard_json jsonb,
  email_delivered boolean not null default false
);

create index audit_log_created_at_idx on audit_log (created_at desc);

alter table audit_log enable row level security;
-- Zelfde patroon als de rest van het schema (zie 0001_init.sql): geen
-- anon/authenticated policies. Alle toegang loopt via de service-role
-- client (src/app/admin/*), die RLS toch al omzeilt.
