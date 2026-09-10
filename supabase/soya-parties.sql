-- ============================================================================
-- SOYA BUSINESS LINE — Parties module (the sell side)
-- ============================================================================
-- Safe / idempotent: every statement is "create ... if not exists", so this can
-- be re-run without effect.
--
-- Fully independent of the maize tables. Nothing here references public.sales,
-- public.companies, public.company_payments or any other maize object, NO
-- existing object is altered (no "alter table" on a maize table), and no
-- sequence is shared — so nothing on the maize side can be advanced by Soya
-- activity.
--
-- Columns follow the PARTIES half of the SALES sheet in the customer's workbook
-- (columns 13-26), plus the LORRY NO and FACTORY columns its per-party ledger
-- tabs carry:
--
--   13 SL NO · 14 DATE · 15 BILL NO · 16 BAGS · 17 NET WT · 18 RATE
--   19 AMOUNT · 20 2.5%CGST · 21 2.5%SGST · 22 TCS · 23 AMOUNT
--   24 FREIGHT · 25 PARTY · 26 FRIGHT
--
-- AMOUNT appears twice in the sheet: column 19 is the taxable value (amount)
-- and column 23 the invoice total (total_amount).
--
-- FREIGHT (24) and FRIGHT (26) are two separate columns, not a typo of one:
-- 24 holds a per-trip rate (260, 270) and 26 a lump amount (90480, 82080).
-- Neither is derived from the other in the source data.
--
-- BILL NO is text, not a number: the workbook opens the year with '29*1'.
-- ============================================================================

-- -------------------------------------------------------------- party master
create table if not exists public.soya_parties (
  id text primary key,
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_soya_parties_name
  on public.soya_parties (name);

-- ------------------------------------------------------------- party entries
create table if not exists public.soya_party_entries (
  id text primary key,
  sl_no integer null,
  date date not null,
  bill_no text not null default '',
  lorry_no text not null default '',
  bags numeric(12,2) not null default 0,
  net_wt numeric(12,2) not null default 0,
  rate numeric(12,2) not null default 0,
  -- Derived (see src/features/soya-parties/utils/calculations.ts):
  --   amount = net_wt * rate, cgst = sgst = amount * 2.5%,
  --   total_amount = amount + cgst + sgst + tcs
  amount numeric(16,2) not null default 0,
  cgst numeric(16,4) not null default 0,
  sgst numeric(16,4) not null default 0,
  tcs numeric(16,4) not null default 0,
  total_amount numeric(16,4) not null default 0,
  freight numeric(16,2) not null default 0,
  fright numeric(16,2) not null default 0,
  -- The party name is denormalized here (as in the sheet) and matched to
  -- soya_parties by name, the same way maize bilty relates to bilty_parties.
  party text not null default '',
  -- Which factory the goods came from; the ledger tabs record it.
  factory text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_soya_party_entries_date
  on public.soya_party_entries (date desc);
create index if not exists idx_soya_party_entries_party
  on public.soya_party_entries (party);
create index if not exists idx_soya_party_entries_bill_no
  on public.soya_party_entries (bill_no);
create index if not exists idx_soya_party_entries_factory
  on public.soya_party_entries (factory);

-- BILL NO is ours to issue, so it is unique per financial year (Apr-Mar) and
-- restarts each April — which is what the service layer validates.
create unique index if not exists idx_soya_party_entries_bill_no_fy_unique
  on public.soya_party_entries (
    bill_no,
    (
      (extract(year from date)::int)
      - (case when extract(month from date) < 4 then 1 else 0 end)
    )
  );

-- ------------------------------------------------------------ party payments
-- Payments received FROM a party. Mirrors the five-column block on the
-- per-party ledger tabs: SL NO · DATE · BANK · AMOUNT · REMRKS.
create table if not exists public.soya_party_payments (
  id text primary key,
  party_id text not null
    references public.soya_parties(id) on delete cascade,
  paid_on date not null,
  bank text not null default '',
  amount numeric(16,2) not null default 0,
  remarks text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_soya_party_payments_party_id
  on public.soya_party_payments (party_id);
create index if not exists idx_soya_party_payments_paid_on
  on public.soya_party_payments (paid_on desc);
