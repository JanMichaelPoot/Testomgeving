-- WindowInto as a Model C digital PDF sale: a formal product model, and
-- order-linked, versioned, timestamped consent for (a) the Algemene
-- Voorwaarden and (b) immediate digital delivery + loss of the statutory
-- 14-day right of withdrawal (art. 6:230p BW / EU Richtlijn 2011/83/EU
-- art. 16(m)).
--
-- Deliberately separate from audit_log (0008_audit_log.sql), which stays
-- unlinkable to any session/order by design (see that migration's own
-- comment). The tables below are the opposite on purpose: every row here
-- must be traceable back to exactly one order, because that traceability
-- is the entire point — it is what proves what a specific customer agreed
-- to, and when, should that ever be disputed.

-- 1. A formal, database-backed product instead of a hardcoded price
--    constant, so a future price/description change doesn't require a
--    code deploy. Seeded with exactly one row — this is not meant to
--    become a general product catalog.
create table products (
  id text primary key,
  name text not null,
  description text not null,
  price_cents integer not null,
  currency text not null default 'eur',
  digital_content boolean not null default true,
  delivery_type text not null default 'pdf',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into products (id, name, description, price_cents, currency, digital_content, delivery_type, active)
values (
  'windowinto-pdf',
  'WindowInto Personalised PDF',
  'A personalised digital WindowInto Idea Book, generated from the customer''s own intake answers.',
  350,
  'eur',
  true,
  'pdf',
  true
)
on conflict (id) do nothing;

-- 2. `payments` already holds exactly one row per Stripe Checkout attempt
--    (pending/succeeded/failed/refunded) — in effect, this already is the
--    order record. Rather than introduce a redundant parallel `orders`
--    table, it gets the two columns the rest of this migration needs:
--    a human-readable order number, and which product was bought.
alter table payments add column if not exists order_number text unique;
alter table payments add column if not exists product_id text not null default 'windowinto-pdf' references products (id);

-- Order numbers are assigned by the application (src/lib/orderNumber.ts)
-- via this function at order-creation time, not by a client-side counter —
-- a Postgres sequence is the only part of this that needs to be race-free
-- under concurrent checkouts.
create sequence if not exists order_number_seq start 1;

create or replace function next_order_number() returns text
language sql
as $$
  select 'WI-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('order_number_seq')::text, 6, '0');
$$;

-- 3. Terms (Algemene Voorwaarden) acceptance — one immutable row per order.
--    consent_text_hash is a sha-256 of the exact, locale-specific checkbox
--    label shown at the moment of acceptance, so the wording behind a given
--    terms_version stays independently verifiable even if that version's
--    dictionary copy is later edited by mistake.
create table terms_acceptance (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references payments (id) on delete cascade,
  accepted boolean not null,
  terms_version text not null,
  consent_text_hash text not null,
  accepted_at timestamptz not null default now()
);

create index terms_acceptance_order_id_idx on terms_acceptance (order_id);

-- 4. Digital delivery consent + withdrawal-right acknowledgement — one
--    immutable row per order. Both are driven by the single combined
--    checkbox on /checkout (see CheckoutPanel.tsx), stored as two named
--    fields so each can be reported on independently in the admin order
--    view and in the confirmation e-mail.
--
--    ip_address/user_agent: kept as evidentiary support for a disputed
--    order, not for behavioural tracking — only ever readable from the
--    new admin order-detail view, never from the anonymous audit_log.
--    Retention period for these two columns specifically is flagged as an
--    open legal question (see the Fase 2/3 chat and the final compliance
--    report) rather than assumed here; no automatic deletion job exists
--    yet.
create table digital_delivery_consent (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references payments (id) on delete cascade,
  consent boolean not null,
  consent_version text not null,
  consent_timestamp timestamptz not null default now(),
  withdrawal_acknowledged boolean not null,
  withdrawal_acknowledged_version text not null,
  withdrawal_acknowledged_timestamp timestamptz not null default now(),
  consent_text_hash text not null,
  ip_address inet,
  user_agent text
);

create index digital_delivery_consent_order_id_idx on digital_delivery_consent (order_id);

-- 5. Legal document version registry. The actual legal copy stays in
--    src/lib/i18n/dictionaries.ts (nl/en) — that already works well and
--    this migration does not replace it with a database CMS. This table
--    is only the version pointer: which version of which document is
--    currently active, per locale. A text change means new dictionary
--    copy plus a new row here (a deploy), not a live content edit.
create table legal_documents (
  id uuid primary key default gen_random_uuid(),
  document_type text not null
    check (document_type in ('terms', 'digital_delivery_consent', 'withdrawal_information', 'privacy')),
  version text not null,
  locale text not null,
  published_at timestamptz not null default now(),
  is_active boolean not null default true,
  unique (document_type, version, locale)
);

create index legal_documents_active_idx on legal_documents (document_type, locale) where is_active;

insert into legal_documents (document_type, version, locale, is_active) values
  ('terms', 'v1.0', 'nl', true),
  ('terms', 'v1.0', 'en', true),
  ('digital_delivery_consent', 'v1.0', 'nl', true),
  ('digital_delivery_consent', 'v1.0', 'en', true),
  ('withdrawal_information', 'v1.0', 'nl', true),
  ('withdrawal_information', 'v1.0', 'en', true),
  ('privacy', 'v1.0', 'nl', true),
  ('privacy', 'v1.0', 'en', true)
on conflict (document_type, version, locale) do nothing;

-- 6. window_plans gets the order link and the delivery timestamps needed
--    to make an order's full legal status reproducible end to end
--    (see src/app/plan/data.ts).
alter table window_plans add column if not exists payment_id uuid references payments (id);
alter table window_plans add column if not exists generated_at timestamptz;
alter table window_plans add column if not exists email_sent_at timestamptz;
alter table window_plans add column if not exists pdf_version integer not null default 1;

alter table products enable row level security;
alter table terms_acceptance enable row level security;
alter table digital_delivery_consent enable row level security;
alter table legal_documents enable row level security;
-- Same pattern as the rest of this schema (see 0001_init.sql): no
-- anon/authenticated policies — all reads and writes go through the
-- service-role client.
