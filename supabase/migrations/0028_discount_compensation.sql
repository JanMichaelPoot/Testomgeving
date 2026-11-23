-- Compensation codes (Step 235): when a place in a book turns out to be wrong, the buyer gets an extra one-time discount code of EUR 2.50 as compensation, sent from
-- the admin (the order page). Such a code is another code for the same order, so an order may now have more than one: the one it earned by ordering (kind "order",
-- still at most one per order) and any number of compensation codes (kind "compensation", with a note on why).
--
-- Run this in the Supabase SQL editor after 0027. The app keeps working without it: ordering and the code in the mail are not touched; only sending a
-- compensation code from the admin needs it (it then says so).

alter table discount_codes add column if not exists kind text not null default 'order' check (kind in ('order', 'compensation'));
alter table discount_codes add column if not exists reason text;

-- One code per order was a table-wide rule (unique on issued_for_payment_id); it now holds for the "order" codes only.
alter table discount_codes drop constraint if exists discount_codes_issued_for_payment_id_key;
create unique index if not exists discount_codes_one_order_code on discount_codes (issued_for_payment_id) where kind = 'order';
create index if not exists discount_codes_payment_idx on discount_codes (issued_for_payment_id);
