-- Reward for the buyer (Step 239): when a friend pays for a book with one of the friend codes (Step 238), the buyer who passed it on gets a code of EUR 2.50 of their own for a
-- next book (kind "reward"), by e-mail. The friend code remembers that its reward has been given (rewarded_at), so a payment confirmed twice (Stripe sends events again) never
-- gives it twice; a reward code remembers when its mail went out (mailed_at), so one that did not go out shows in the admin overview.
--
-- Run this in the Supabase SQL editor after 0029. The app keeps working without it: orders, friend codes and the mails are not touched; only the reward is not given (the
-- payment of the friend is never held up by it, and the log says why).

alter table discount_codes drop constraint if exists discount_codes_kind_check;
alter table discount_codes add constraint discount_codes_kind_check check (kind in ('order', 'compensation', 'friend', 'reward'));
alter table discount_codes add column if not exists rewarded_at timestamptz;
alter table discount_codes add column if not exists mailed_at timestamptz;
