-- ============================================================================
-- SOYA — payment terms on sales bills (same as maize Sales)
-- ============================================================================
-- Safe / idempotent: "add column if not exists" only. Nothing maize is touched.
--
-- Free text like "30 Days", as on the maize Sale form. The due date is the
-- bill date plus the leading number of days; Parties overview colours each
-- bill overdue / due today / cleared / upcoming from it.
--
-- RUN THIS BEFORE DEPLOYING: saving a party entry writes this column and
-- fails if it is missing. Existing bills get '' (due on the bill date, as
-- maize treats a sale with no terms).
-- ============================================================================

alter table public.soya_party_entries
  add column if not exists payment_terms text not null default '';
