-- ============================================================================
-- SOYA — soft delete for the party and factory masters
-- ============================================================================
-- Safe / idempotent: "add column if not exists" only. Nothing maize is touched.
--
-- RUN THIS BEFORE DEPLOYING the code that reads it: every Soya party and
-- factory list filters on deleted_at, and fails if the column is missing.
--
-- A deleted row is hidden everywhere — lists, dropdowns, ledgers, invoicing,
-- the dashboard — but kept, so it can come back: adding the same name again in
-- the same company restores the row rather than creating a second one.
--
-- The app only allows deleting a row that has no bills and no payments in its
-- company, so hiding one can never hide money.
-- ============================================================================

alter table public.soya_parties
  add column if not exists deleted_at timestamptz;

alter table public.soya_factories
  add column if not exists deleted_at timestamptz;
