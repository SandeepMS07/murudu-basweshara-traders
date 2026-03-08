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
  less_weight numeric(12,2) not null default 0,
  net_weight numeric(12,2) not null default 0,
  amount numeric(14,2) not null default 0,
  final_total numeric(14,2) not null default 0,
  bag_avg numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.purchases add column if not exists name text not null default '';
alter table public.purchases add column if not exists place text not null default '';
alter table public.purchases add column if not exists mob text not null default '';
alter table public.purchases add column if not exists bags numeric(12,2) not null default 0;
alter table public.purchases add column if not exists bag_avg numeric(12,2) not null default 0;

create table if not exists public.bills (
  id text primary key,
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

insert into public.users (email, password_hash, role)
values
  ('admin@gmail.com', '$2b$10$mtlXo3dxE2pjFidG2wnXK.S0wtVnsGatekCL/YbUd.wGn4xGQS3si', 'admin'),
  ('operator@gmail.com', '$2b$10$L4Hx79oYMsI/ZuYVeiJGP.tVuaCUbe5OmPNzzyGgovdE6vjk07SY.', 'operator')
on conflict (email) do update
set password_hash = excluded.password_hash,
    role = excluded.role;
