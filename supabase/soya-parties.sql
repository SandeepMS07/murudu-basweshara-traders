-- ============================================================================
-- SOYA BUSINESS LINE — part 1: master data (companies) + Parties module
-- ============================================================================
-- Safe / idempotent: every statement is "create ... if not exists", so this can
-- be re-run without effect.
--
-- Fully independent of the maize tables. Nothing here references public.sales,
-- public.companies, public.bilty or public.bills, and NO existing object is
-- altered — there is no "alter table" on any maize table, and no change to
-- bills_bill_no_seq, bilty_bill_no_seq, company_invoice_counters or
-- next_company_invoice_seq.
--
-- NAMING NOTE: soya_sales mirrors public.sales column-for-column (sale_date,
-- sale_company_id, issuer_company_id, and sale_id in the allocation table)
-- because the Soya "Parties" module is a clone of the maize Sales module.
-- Keeping the names identical lets the app reuse the maize *pure* helpers
-- (computeEffectiveSalePending, CompanyStatementView) with no adapter layer.
-- ============================================================================

-- ---------------------------------------------------------------- master data
create table if not exists public.soya_companies (
  id text primary key,
  type text not null check (type in ('issuer', 'buyer')),
  name text not null,
  display_name text not null default '',
  code text not null default '',
  address text not null default '',
  phone text not null default '',
  email text not null default '',
  gstin text not null default '',
  bank_name text not null default '',
  bank_account_no text not null default '',
  bank_branch_ifsc text not null default '',
  invoice_prefix text not null default '',
  is_active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_soya_companies_type
  on public.soya_companies (type);
create index if not exists idx_soya_companies_name
  on public.soya_companies (name);
-- One directory per crop, one row per (type, name).
create unique index if not exists idx_soya_companies_type_name_unique
  on public.soya_companies (type, upper(name));

-- ------------------------------------------------- parties records (sales-shaped)
create table if not exists public.soya_sales (
  id text primary key,
  sl_no integer null,
  bill_number text not null,
  sale_date date not null,
  issuer_company_id text null references public.soya_companies(id),
  dispatch_through text not null default 'TRUCK'
    check (dispatch_through in ('TRUCK', 'TRACTORY')),
  lorry_number text not null default '',
  goods_name text not null default 'SOYA',
  destination text not null default '',
  party text not null default '',
  sale_company_id text null references public.soya_companies(id),
  payment_terms text not null default '',
  bags numeric(12,2) not null default 0,
  net_weight numeric(12,2) not null default 0,
  factory_weight numeric(12,2) not null default 0,
  rate numeric(12,2) not null default 0,
  flight numeric(12,2) not null default 0,
  amount numeric(14,2) not null default 0,
  bag_avg numeric(12,2) not null default 0,
  factory_rate numeric(12,4) not null default 0,
  factory_amount numeric(14,2) not null default 0,
  pending_amount numeric(14,2) not null default 0,
  source text not null check (source in ('manual', 'import')) default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_soya_sales_sale_date
  on public.soya_sales (sale_date desc);
create index if not exists idx_soya_sales_bill_number
  on public.soya_sales (bill_number);
create index if not exists idx_soya_sales_party
  on public.soya_sales (party);
create index if not exists idx_soya_sales_sale_company_id
  on public.soya_sales (sale_company_id);
create index if not exists idx_soya_sales_issuer_company_id
  on public.soya_sales (issuer_company_id);

-- bill_number unique per issuer company, per financial year (Apr-Mar).
-- Same expression as idx_sales_bill_number_issuer_fy_unique on public.sales.
create unique index if not exists idx_soya_sales_bill_number_issuer_fy_unique
  on public.soya_sales (
    bill_number,
    coalesce(issuer_company_id, ''),
    (
      (extract(year from sale_date)::int)
      - (case when extract(month from sale_date) < 4 then 1 else 0 end)
    )
  );

-- ------------------------------------------------------------- payment ledger
create table if not exists public.soya_sale_payments (
  id text primary key,
  company_id text not null
    references public.soya_companies(id) on delete cascade,
  paid_on date not null,
  amount numeric(14,2) not null default 0,
  payment_mode text not null
    check (payment_mode in ('none', 'cash', 'rtgs')) default 'none',
  rtgs_name text not null default '',
  note text not null default '',
  credit_hold_amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_soya_sale_payments_company_id
  on public.soya_sale_payments (company_id);
create index if not exists idx_soya_sale_payments_paid_on
  on public.soya_sale_payments (paid_on desc);

create table if not exists public.soya_sale_payment_allocations (
  id text primary key,
  payment_id text not null
    references public.soya_sale_payments(id) on delete cascade,
  sale_id text not null
    references public.soya_sales(id) on delete restrict,
  amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payment_id, sale_id)
);

create index if not exists idx_soya_sale_payment_allocations_sale_id
  on public.soya_sale_payment_allocations (sale_id);
create index if not exists idx_soya_sale_payment_allocations_payment_id
  on public.soya_sale_payment_allocations (payment_id);
