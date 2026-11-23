-- One-time discount codes (Step 230): after an order the buyer gets a code in the e-mail that takes EUR 2.50 off one next book.
--
-- One code per paid order (issued_for_payment_id is unique), single use, valid for 90 days. The code is chosen at the checkout, held for the
-- order while it is being paid (reserved_until: a Stripe Checkout Session lasts at most an hour when a code is used, the hold is longer, so a
-- code can never be spent twice) and used up when Stripe confirms the payment (redeemed_at). A payment that fails or expires lets the code go again.
--
-- The app keeps working without this migration: it then issues no codes and offers no code field. Run it in the Supabase SQL editor.
--
-- Row level security is on with no policies: the browser (anon key) can neither read nor write. Only the server, with the service role.

create table if not exists discount_codes (
  id uuid primary key default gen_random_uuid(),
  -- "WI-ABCD-EFGH": capitals and digits without 0, O, 1, I (32 signs, 8 of them chosen at random: about 10^12 possible codes).
  code text not null unique,
  amount_cents integer not null default 250 check (amount_cents > 0),
  -- The order that earned the code. One code per order, also when the book is sent again.
  issued_for_payment_id uuid not null unique references payments(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  -- Held for an order that is being paid; free again when this time has passed or the payment fails.
  reserved_until timestamptz,
  -- Used up by this order.
  redeemed_by_payment_id uuid references payments(id) on delete set null,
  redeemed_at timestamptz
);

alter table discount_codes enable row level security;

create index if not exists discount_codes_redeemed_idx on discount_codes (redeemed_at) where redeemed_at is not null;

-- What an order used: the code and how much it took off (the amount charged is in payments.amount, after the discount).
alter table payments add column if not exists discount_code_id uuid references discount_codes(id) on delete set null;
alter table payments add column if not exists discount_cents integer;
