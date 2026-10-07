-- ============================================================================
-- SOYA — credit days per party
-- ============================================================================
-- Safe / idempotent: "add column if not exists" only. Nothing maize is touched.
--
-- How many days a party gets to pay a bill (e.g. 15, 20, 30). Empty means not
-- set: the Parties overview then shows only how old an unpaid bill is, without
-- a due date.
--
-- The app works before this is run (credit days just can't be set yet), but
-- run it on prod together with the deploy.
-- ============================================================================

alter table public.soya_parties
  add column if not exists credit_days integer
  check (credit_days is null or (credit_days >= 0 and credit_days <= 365));
