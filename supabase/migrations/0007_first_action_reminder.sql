-- Fase 3 (WINDOW Ervaringsontwerp roadmap): a scheduled "did you take your
-- first step yet?" reminder email, sent a few days after an Idea Book was
-- generated. Two additions, both nullable so existing rows are unaffected:
--
-- 1. `recipient_email` — the email the Idea Book was actually delivered to
--    (buyer or gift recipient, see src/app/plan/data.ts's `deliveryEmail`).
--    Not derivable later from Stripe alone without re-querying it per plan,
--    so it's captured once at generation time instead.
-- 2. `first_action_reminder_sent_at` — set once the reminder goes out, so
--    the cron job never double-sends and can safely re-run on a schedule.

alter table window_plans
  add column if not exists recipient_email text;

alter table window_plans
  add column if not exists first_action_reminder_sent_at timestamptz;
