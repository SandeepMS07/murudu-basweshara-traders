-- Minimal setup for sales invoice generation.
-- Run this in Supabase SQL Editor, then retry generating the sales bill.

create table if not exists public.company_invoice_counters (
  issuer_company_id text primary key references public.companies(id) on delete cascade,
  last_seq bigint not null default 0,
  updated_at timestamptz not null default now()
);

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
