-- Run this in Supabase SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  role text not null check (role in ('admin', 'operator')),
  created_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id text primary key,
  bill_no bigint,
  date date not null,
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
  source text not null check (source in ('manual', 'app')) default 'app',
  payment_through text not null check (payment_through in ('RTGS', 'UPI', 'none')) default 'none',
  less_weight numeric(12,2) not null default 0,
  net_weight numeric(12,2) not null default 0,
  amount numeric(14,2) not null default 0,
  final_total numeric(14,2) not null default 0,
  bag_avg numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence if not exists public.purchases_bill_no_seq start with 1 increment by 1;

alter table public.purchases
  add column if not exists bill_no bigint;

alter table public.purchases
  alter column bill_no set default nextval('public.purchases_bill_no_seq');

with ranked_purchases as (
  select id, row_number() over (order by created_at asc, id asc) as rn
  from public.purchases
  where bill_no is null
)
update public.purchases p
set bill_no = r.rn
from ranked_purchases r
where p.id = r.id;

do $$
declare
  max_purchase_bill_no bigint;
begin
  select coalesce(max(bill_no), 0) into max_purchase_bill_no from public.purchases;
  if max_purchase_bill_no = 0 then
    perform setval('public.purchases_bill_no_seq', 1, false);
  else
    perform setval('public.purchases_bill_no_seq', max_purchase_bill_no, true);
  end if;
end $$;

create unique index if not exists idx_purchases_bill_no_unique on public.purchases (bill_no);

alter table public.purchases add column if not exists name text not null default '';
alter table public.purchases add column if not exists place text not null default '';
alter table public.purchases add column if not exists mob text not null default '';
alter table public.purchases add column if not exists bags numeric(12,2) not null default 0;
alter table public.purchases add column if not exists bag_avg numeric(12,2) not null default 0;
alter table public.purchases add column if not exists payment_through text not null default 'none' check (payment_through in ('RTGS', 'UPI', 'none'));

create table if not exists public.bills (
  id text primary key,
  bill_no bigint,
  bill_date date not null,
  net_weight numeric(12,2) not null default 0,
  rate numeric(12,2) not null default 0,
  freight numeric(12,2) not null default 0,
  payment_term_days integer not null default 0,
  source text not null check (source in ('manual', 'app')) default 'app',
  amount numeric(14,2) not null default 0,
  final_amount numeric(14,2) not null default 0,
  due_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence if not exists public.bills_bill_no_seq start with 1 increment by 1;

alter table public.bills
  add column if not exists bill_no bigint;

alter table public.bills
  alter column bill_no set default nextval('public.bills_bill_no_seq');

with ranked_bills as (
  select id, row_number() over (order by created_at asc, id asc) as rn
  from public.bills
  where bill_no is null
)
update public.bills b
set bill_no = r.rn
from ranked_bills r
where b.id = r.id;

do $$
declare
  max_bill_no bigint;
begin
  select coalesce(max(bill_no), 0) into max_bill_no from public.bills;
  if max_bill_no = 0 then
    perform setval('public.bills_bill_no_seq', 1, false);
  else
    perform setval('public.bills_bill_no_seq', max_bill_no, true);
  end if;
end $$;

create unique index if not exists idx_bills_bill_no_unique on public.bills (bill_no);

create table if not exists public.sales (
  id text primary key,
  sl_no integer null,
  bill_number text not null unique,
  sale_date date not null,
  issuer_company_id text null,
  dispatch_through text not null default 'TRUCK' check (dispatch_through in ('TRUCK', 'TRACTORY')),
  lorry_number text not null default '',
  goods_name text not null default 'MAIZE',
  destination text not null default '',
  party text not null default '',
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
  sale_company_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sales_sale_date on public.sales (sale_date desc);
create index if not exists idx_sales_bill_number on public.sales (bill_number);
create index if not exists idx_sales_party on public.sales (party);
create index if not exists idx_sales_sale_company_id on public.sales (sale_company_id);
create index if not exists idx_sales_issuer_company_id on public.sales (issuer_company_id);

create table if not exists public.companies (
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

create index if not exists idx_companies_type on public.companies (type);
create index if not exists idx_companies_name on public.companies (name);

create table if not exists public.company_invoice_counters (
  issuer_company_id text primary key references public.companies(id) on delete cascade,
  last_seq bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.company_payments (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  paid_on date not null,
  amount numeric(14,2) not null default 0,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_company_payments_company_id on public.company_payments (company_id);
create index if not exists idx_company_payments_paid_on on public.company_payments (paid_on desc);

create table if not exists public.company_payment_allocations (
  id text primary key,
  payment_id text not null references public.company_payments(id) on delete cascade,
  sale_id text not null references public.sales(id) on delete restrict,
  amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payment_id, sale_id)
);

create index if not exists idx_company_payment_allocations_sale_id on public.company_payment_allocations (sale_id);
create index if not exists idx_company_payment_allocations_payment_id on public.company_payment_allocations (payment_id);

-- Backward-compatible migration for older installs where the counter table
-- used `company_id` instead of `issuer_company_id`.
alter table public.company_invoice_counters
  add column if not exists issuer_company_id text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'company_invoice_counters'
      and column_name = 'company_id'
  ) then
    execute '
      update public.company_invoice_counters
      set issuer_company_id = company_id
      where issuer_company_id is null
    ';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'company_invoice_counters_pkey'
      and conrelid = 'public.company_invoice_counters'::regclass
  ) then
    alter table public.company_invoice_counters
      drop constraint company_invoice_counters_pkey;
  end if;
end $$;

alter table public.company_invoice_counters
  alter column issuer_company_id set not null;

alter table public.company_invoice_counters
  add constraint company_invoice_counters_pkey primary key (issuer_company_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'company_invoice_counters_issuer_company_id_fkey'
      and conrelid = 'public.company_invoice_counters'::regclass
  ) then
    alter table public.company_invoice_counters
      add constraint company_invoice_counters_issuer_company_id_fkey
      foreign key (issuer_company_id) references public.companies(id) on delete cascade;
  end if;
end $$;

create table if not exists public.sales_invoices (
  id text primary key,
  issuer_company_id text not null references public.companies(id),
  buyer_company_id text not null references public.companies(id),
  invoice_no text not null unique,
  invoice_seq bigint not null,
  issued_on date not null,
  subtotal numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  snapshot_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (issuer_company_id, invoice_seq)
);

create index if not exists idx_sales_invoices_issued_on on public.sales_invoices (issued_on desc);
create index if not exists idx_sales_invoices_buyer_company_id on public.sales_invoices (buyer_company_id);

create table if not exists public.sales_invoice_items (
  id text primary key,
  sales_invoice_id text not null references public.sales_invoices(id) on delete cascade,
  sale_id text not null references public.sales(id) on delete restrict,
  description text not null default '',
  bags numeric(12,2) not null default 0,
  net_weight numeric(12,2) not null default 0,
  rate numeric(12,2) not null default 0,
  amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sales_invoice_items_invoice_id on public.sales_invoice_items (sales_invoice_id);
create index if not exists idx_sales_invoice_items_sale_id on public.sales_invoice_items (sale_id);

alter table public.sales add column if not exists sale_company_id text null;
alter table public.sales add column if not exists issuer_company_id text null;
alter table public.sales add column if not exists dispatch_through text not null default 'TRUCK';
alter table public.sales add column if not exists goods_name text not null default 'MAIZE';
alter table public.sales add column if not exists destination text not null default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sales_dispatch_through_check'
      and conrelid = 'public.sales'::regclass
  ) then
    alter table public.sales
      add constraint sales_dispatch_through_check
      check (dispatch_through in ('TRUCK', 'TRACTORY'));
  end if;
end $$;
alter table public.companies add column if not exists invoice_prefix text not null default '';
alter table public.companies add column if not exists bank_name text not null default '';
alter table public.companies add column if not exists bank_account_no text not null default '';
alter table public.companies add column if not exists bank_branch_ifsc text not null default '';

update public.companies
set
  bank_name = 'ICICI BANK',
  bank_account_no = '378205000703',
  bank_branch_ifsc = 'HONNALI & ICIC0003782',
  updated_at = now()
where type = 'issuer'
  and upper(name) = 'SRI MURUDA BASAVESHWARA TRADERS'
  and coalesce(bank_name, '') = ''
  and coalesce(bank_account_no, '') = ''
  and coalesce(bank_branch_ifsc, '') = '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sales_sale_company_id_fkey'
  ) then
    alter table public.sales
      add constraint sales_sale_company_id_fkey
      foreign key (sale_company_id) references public.companies(id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sales_issuer_company_id_fkey'
  ) then
    alter table public.sales
      add constraint sales_issuer_company_id_fkey
      foreign key (issuer_company_id) references public.companies(id);
  end if;
end $$;

create or replace function public.next_company_invoice_seq(p_issuer_company_id text)
returns bigint
language plpgsql
as $$
declare
  v_next bigint;
begin
  insert into public.company_invoice_counters (issuer_company_id, last_seq, updated_at)
  values (p_issuer_company_id, 1, now())
  on conflict (issuer_company_id)
  do update
    set last_seq = public.company_invoice_counters.last_seq + 1,
        updated_at = now()
  returning last_seq into v_next;

  return v_next;
end;
$$;

insert into public.users (email, password_hash, role)
values
  ('admin@gmail.com', '$2b$10$mtlXo3dxE2pjFidG2wnXK.S0wtVnsGatekCL/YbUd.wGn4xGQS3si', 'admin'),
  ('operator@gmail.com', '$2b$10$L4Hx79oYMsI/ZuYVeiJGP.tVuaCUbe5OmPNzzyGgovdE6vjk07SY.', 'operator')
on conflict (email) do update
set password_hash = excluded.password_hash,
    role = excluded.role;
