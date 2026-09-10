-- ============================================================================
-- SOYA BUSINESS LINE — part 2: Factory module (the bilty record shape)
-- ============================================================================
-- Safe / idempotent: every statement is "create ... if not exists", so this can
-- be re-run without effect.
--
-- Fully independent of the maize tables. Nothing here references public.bilty,
-- public.bilty_parties, public.bilty_party_payments or public.bills, and NO
-- existing object is altered — there is no "alter table" on any maize table.
--
-- IMPORTANT — no shared sequence. The maize bilty "Generate Bill" flow writes
-- public.bills, whose bills_bill_no_seq is shared with maize Purchases; a Soya
-- bill written there would silently consume a maize bill number. Soya Factory
-- therefore has no bill-generation flow and no sequence of its own: bill_no is
-- always supplied by the application and validated unique per financial year
-- (which is what the service layer already enforces), so nothing on the maize
-- side can be advanced by Soya activity.
--
-- NAMING NOTE: soya_bilty mirrors public.bilty column-for-column so the app can
-- reuse the maize *pure* helpers (calculateBilty, BiltyPartyStatementView) with
-- no adapter layer. In the UI these are labelled "Factory".
-- ============================================================================

-- --------------------------------------------------------- factory parties
create table if not exists public.soya_bilty_parties (
  id text primary key,
  name text not null unique,
  place text not null default '',
  mob text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_soya_bilty_parties_name
  on public.soya_bilty_parties (name);

-- --------------------------------------------------------- factory records
create table if not exists public.soya_bilty (
  id text primary key,
  bill_no bigint,
  date date not null,
  party text not null default '',
  name text not null default '',
  place text not null default '',
  mob text not null default '',
  bags numeric(12,2) not null default 0,
  weight numeric(12,2) not null default 0,
  less_percent numeric(6,2) not null default 0,
  rate numeric(12,2) not null default 0,
  bag_less numeric(12,2) not null default 0,
  add_amount numeric(12,2) not null default 0,
  cash_paid numeric(12,2) not null default 0,
  upi_paid numeric(12,2) not null default 0,
  payment_date date null,
  source text not null check (source in ('manual', 'app')) default 'app',
  -- CASH is allowed from the start here; the maize check predates it.
  payment_through text not null
    check (payment_through in ('RTGS', 'UPI', 'CASH', 'none')) default 'none',
  less_weight numeric(12,2) not null default 0,
  net_weight numeric(12,2) not null default 0,
  amount numeric(14,2) not null default 0,
  final_total numeric(14,2) not null default 0,
  bag_avg numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_soya_bilty_date
  on public.soya_bilty (date desc);
create index if not exists idx_soya_bilty_party
  on public.soya_bilty (party);

-- bill_no unique per financial year (Apr-Mar), restarting at 1 each April.
-- The maize side is globally unique instead; that index is left untouched.
create unique index if not exists idx_soya_bilty_bill_no_fy_unique
  on public.soya_bilty (
    bill_no,
    (
      (extract(year from date)::int)
      - (case when extract(month from date) < 4 then 1 else 0 end)
    )
  );

-- ---------------------------------------------------- factory party payments
create table if not exists public.soya_bilty_party_payments (
  id text primary key,
  party_id text not null
    references public.soya_bilty_parties(id) on delete cascade,
  paid_on date not null,
  amount numeric(14,2) not null default 0,
  payment_mode text not null
    check (payment_mode in ('none', 'cash', 'upi', 'rtgs')) default 'none',
  rtgs_name text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_soya_bilty_party_payments_party_id
  on public.soya_bilty_party_payments (party_id);
create index if not exists idx_soya_bilty_party_payments_paid_on
  on public.soya_bilty_party_payments (paid_on desc);
