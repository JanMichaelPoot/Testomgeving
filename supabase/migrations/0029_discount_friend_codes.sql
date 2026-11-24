-- Friend codes (Step 238): the mail with the book gives the buyer a few extra one-time codes of EUR 2.50 to pass on to friends (kind "friend"), next to the one the order
-- earned itself (kind "order") and the ones sent as compensation (kind "compensation", Step 235). A friend code is a code like any other: one use, one book, 90 days.
--
-- Run this in the Supabase SQL editor after 0028. The app keeps working without it: ordering, the code in the mail and the compensation codes are not touched; only the block
-- with the friend codes is left out of the mail (the admin overview then shows an amber note that says why).

alter table discount_codes drop constraint if exists discount_codes_kind_check;
alter table discount_codes add constraint discount_codes_kind_check check (kind in ('order', 'compensation', 'friend'));
