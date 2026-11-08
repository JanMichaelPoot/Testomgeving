-- Phase 4 of the A-D improvement brief: a single e-mail follow-up and price-test bookkeeping.
-- Run by hand in the Supabase SQL editor, like the earlier migrations.
-- (An earlier version of this file also created a gift-voucher table and product; the gift voucher was removed again. If that earlier
-- version was already run, the table can go: drop table if exists gift_vouchers; delete from products where id = 'windowinto-gift-voucher';)

-- 1. Price test (B6): which price variant an order was shown, and the buyer's consent to one follow-up e-mail.
--    price_variant is null for every order while the test is off (the default).
alter table payments add column if not exists price_variant text;
alter table payments add column if not exists followup_consent_at timestamptz;

-- 2. Follow-up e-mail ("Tijd voor een nieuw venster?"): sent once, six weeks after the book, only to the address of the person who
--    ticked the box (followup_email).
alter table window_plans add column if not exists followup_email text;
alter table window_plans add column if not exists followup_sent_at timestamptz;
create index if not exists window_plans_followup_idx on window_plans (created_at) where followup_email is not null and followup_sent_at is null;
