-- ============================================================================
-- SOYA BUSINESS LINE — Factory module (the buy side)
-- ============================================================================
-- Safe / idempotent: every statement is "create ... if not exists", so this can
-- be re-run without effect.
--
-- Fully independent of the maize tables. Nothing here references public.bilty,
-- public.bilty_parties, public.purchases, public.bills or any other maize
-- object, NO existing object is altered (no "alter table" on a maize table),
-- and no sequence is shared — so nothing on the maize side can be advanced by
-- Soya activity.
--
-- Columns follow the FACTORY half of the SALES sheet in the customer's workbook
-- (columns 1-12), plus the PARTY column its per-factory ledger tabs carry:
--
--   1 SL NO · 2 FACTORY · 3 DATE · 4 P B NO · 5 LORRY · 6 BAGS · 7 WEIGHT
--   8 RATE · 9 AMOUNT · 10 GST 5 % · 11 TCS · 12 AMOUNT
--
-- AMOUNT appears twice in the sheet: column 9 is the taxable value (amount) and
-- column 12 the invoice total (total_amount).
--
-- P B NO is text, not a number: the workbook has values like 'MI/75'.
-- ============================================================================

-- ------------------------------------------------------------ factory master
create table if not exists public.soya_factories (
  id text primary key,
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_soya_factories_name
  on public.soya_factories (name);

-- ----------------------------------------------------------- factory entries
create table if not exists public.soya_factory_entries (
  id text primary key,
  sl_no integer null,
  -- The factory name is denormalized here (as in the sheet) and matched to
  -- soya_factories by name, the same way maize bilty relates to bilty_parties.
  factory text not null default '',
  date date not null,
  pb_no text not null default '',
  lorry text not null default '',
  bags numeric(12,2) not null default 0,
  weight numeric(12,2) not null default 0,
  rate numeric(12,2) not null default 0,
  -- Derived (see src/features/soya-factory/utils/calculations.ts):
  --   amount = weight * rate, gst_amount = amount * 5%,
  --   total_amount = amount + gst_amount + tcs
  amount numeric(16,2) not null default 0,
  gst_amount numeric(16,4) not null default 0,
  tcs numeric(16,4) not null default 0,
  total_amount numeric(16,4) not null default 0,
  -- Which party the lorry was sold on to; the ledger tabs record it.
  party text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_soya_factory_entries_date
  on public.soya_factory_entries (date desc);
create index if not exists idx_soya_factory_entries_factory
  on public.soya_factory_entries (factory);
create index if not exists idx_soya_factory_entries_pb_no
  on public.soya_factory_entries (pb_no);
create index if not exists idx_soya_factory_entries_party
  on public.soya_factory_entries (party);

-- P B NO is the *factory's* own bill number, not ours, so it is deliberately
-- not made unique — two factories can legitimately reuse a series.

-- ---------------------------------------------------------- factory payments
-- Payments made TO a factory. Mirrors the four-column block on the per-factory
-- ledger tabs: SL NO · DATE · BANK · AMOUNT.
create table if not exists public.soya_factory_payments (
  id text primary key,
  factory_id text not null
    references public.soya_factories(id) on delete cascade,
  paid_on date not null,
  bank text not null default '',
  amount numeric(16,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_soya_factory_payments_factory_id
  on public.soya_factory_payments (factory_id);
create index if not exists idx_soya_factory_payments_paid_on
  on public.soya_factory_payments (paid_on desc);
