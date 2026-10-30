-- Phase 4 of the A-D improvement brief: gift vouchers, a single e-mail follow-up, and price-test bookkeeping.
-- Run by hand in the Supabase SQL editor, like the earlier migrations.

-- 1. Gift vouchers. The giver pays once, receives a code (and a printable card); the recipient redeems it and does the intake
--    themselves. One row per voucher.
--
--    status: 'pending' (checkout started, not paid), 'active' (paid, can be redeemed), 'redeemed' (used), 'void' (refunded or
--    withdrawn). "Expired" is not stored: it is an active voucher whose expires_at has passed (12 months after activation).
--
--    code is the secret the card carries, so it is unique and never shown to anyone but the giver and whoever the giver gives it to.
--    plan_token is a second, separate secret created at redemption: it opens the finished book, so the giver (who knows the code)
--    cannot read the recipient's profile.
create table if not exists gift_vouchers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'redeemed', 'void')),
  amount_cents integer not null,
  currency text not null default 'eur',
  locale text not null default 'nl' check (locale in ('nl', 'en')),
  giver_name text,
  recipient_name text,
  message text,
  -- The session/order of the purchase (the giver has no intake, the session only anchors the order and its consent records).
  buyer_session_id uuid references sessions (id) on delete set null,
  payment_id uuid references payments (id) on delete set null,
  stripe_checkout_id text unique,
  -- Where the code and the card are sent: the address typed at Stripe, or the one typed on our page.
  buyer_email text,
  price_variant text,
  -- The recipient's own optional address (typed when redeeming): the book is also mailed there, and the follow-up goes there if they ticked it.
  redeemer_email text,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  expires_at timestamptz,
  email_sent_at timestamptz,
  redeemed_at timestamptz,
  redeemed_session_id uuid references sessions (id) on delete set null,
  plan_token text unique
);

create index if not exists gift_vouchers_status_idx on gift_vouchers (status);
create index if not exists gift_vouchers_redeemed_session_idx on gift_vouchers (redeemed_session_id);

alter table gift_vouchers enable row level security;
-- Same pattern as the rest of the schema: no anon/authenticated policies, only the service role reads and writes.

-- 2. The product row for the voucher (payments.product_id references products).
insert into products (id, name, description, price_cents, currency, digital_content, delivery_type, active)
values (
  'windowinto-gift-voucher',
  'WindowInto Gift Voucher',
  'A voucher for one personalised WindowInto Idea Book. The recipient redeems the code and answers the intake themselves.',
  1495,
  'eur',
  false,
  'voucher',
  true
)
on conflict (id) do nothing;

-- 3. Price test (B6): which price variant an order was shown, and the buyer's consent to one follow-up e-mail.
--    price_variant is null for every order while the test is off (the default).
alter table payments add column if not exists price_variant text;
alter table payments add column if not exists followup_consent_at timestamptz;

-- 4. Follow-up e-mail ("Tijd voor een nieuw venster?"): sent once, six weeks after the book, only to the address of the person who
--    ticked the box (followup_email), never to a gift recipient who did not consent.
alter table window_plans add column if not exists followup_email text;
alter table window_plans add column if not exists followup_sent_at timestamptz;
create index if not exists window_plans_followup_idx on window_plans (created_at) where followup_email is not null and followup_sent_at is null;
