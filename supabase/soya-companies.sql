-- ============================================================================
-- SOYA BUSINESS LINE — Company layer + GST identity
-- ============================================================================
-- Safe / idempotent: every statement is "create ... if not exists" or an
-- "add column if not exists", so this can be re-run without effect.
--
-- Still fully independent of the maize tables. Nothing here references
-- public.sales, public.companies, public.bilty, public.purchases, public.bills
-- or any other maize object, and no maize object is altered.
--
-- WHY NOW: soya_factory_entries and soya_party_entries are both empty, and the
-- masters hold three rows between them. Re-shaping the schema costs nothing
-- today and would cost a data migration once invoicing starts.
--
-- WHAT THIS ADDS
--   1. public.soya_companies — the trading firm an invoice is raised from.
--      Each has its own GSTIN, its own invoice series, its own ledgers.
--   2. company_id on every Soya table, so Factory and Parties become per
--      company rather than global.
--   3. GST identity (GSTIN, state code, registration type, address) on the
--      factory and party masters — none of which existed.
--   4. IGST columns. soya_party_entries could only express CGST + SGST, so an
--      inter-state sale had nowhere to put its tax.
-- ============================================================================

-- ---------------------------------------------------------------- safety gate
-- A DIFFERENT public.soya_companies existed in the first cut of the Soya line:
-- a clone of the maize companies table, with a type in ('issuer','buyer',
-- 'supplier'). It was dropped from the live project on 2026-09-11. If some
-- environment still has it, "create table if not exists" below would silently
-- do nothing and leave the wrong columns in place, and every read would fail in
-- a confusing way. Stop loudly instead.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'soya_companies'
      and column_name = 'type'
  ) then
    raise exception using message =
      'public.soya_companies already exists in its SUPERSEDED form (it has a "type" column). '
      'Run supabase/soya-drop-superseded-tables.sql first, then re-run this file.';
  end if;
end $$;

-- ------------------------------------------------------------ company master
create table if not exists public.soya_companies (
  id text primary key,
  -- Short name for the switcher; legal_name is what prints on the invoice.
  name text not null,
  legal_name text not null default '',
  gstin text not null default '',
  -- First two digits of the GSTIN. Stored rather than derived so that the
  -- tax split does not depend on re-parsing a string on every calculation.
  state_code text not null default '',
  address text not null default '',
  place text not null default '',
  pincode text not null default '',
  phone text not null default '',
  email text not null default '',
  -- Invoice series prefix, e.g. 'SGT' -> SGT/2026-27/0001.
  invoice_prefix text not null default '',
  is_active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_soya_companies_name_unique
  on public.soya_companies (upper(name));

-- A GSTIN identifies one registration, so it cannot be shared by two firms.
-- Partial, because the column is '' until the user fills it in.
create unique index if not exists idx_soya_companies_gstin_unique
  on public.soya_companies (gstin)
  where gstin <> '';

-- ----------------------------------------------- factory master: scope + GST
alter table public.soya_factories
  add column if not exists company_id text
    references public.soya_companies(id) on delete restrict;
alter table public.soya_factories add column if not exists gstin text not null default '';
alter table public.soya_factories add column if not exists state_code text not null default '';
alter table public.soya_factories add column if not exists registration_type text not null default 'regular';
alter table public.soya_factories add column if not exists address text not null default '';
alter table public.soya_factories add column if not exists place text not null default '';
alter table public.soya_factories add column if not exists pincode text not null default '';
alter table public.soya_factories add column if not exists phone text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'soya_factories_registration_type_check'
  ) then
    alter table public.soya_factories
      add constraint soya_factories_registration_type_check
      check (registration_type in ('regular','composition','unregistered','consumer'));
  end if;
end $$;

-- The same mill can be a counterparty of two of our firms, so the name is
-- unique per company rather than globally. Replaces the table-level UNIQUE
-- created with the table.
alter table public.soya_factories drop constraint if exists soya_factories_name_key;
create unique index if not exists idx_soya_factories_company_name_unique
  on public.soya_factories (company_id, upper(name));
create index if not exists idx_soya_factories_company_id
  on public.soya_factories (company_id);

-- ------------------------------------------------- party master: scope + GST
alter table public.soya_parties
  add column if not exists company_id text
    references public.soya_companies(id) on delete restrict;
alter table public.soya_parties add column if not exists gstin text not null default '';
alter table public.soya_parties add column if not exists state_code text not null default '';
alter table public.soya_parties add column if not exists registration_type text not null default 'regular';
alter table public.soya_parties add column if not exists address text not null default '';
alter table public.soya_parties add column if not exists place text not null default '';
alter table public.soya_parties add column if not exists pincode text not null default '';
alter table public.soya_parties add column if not exists phone text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'soya_parties_registration_type_check'
  ) then
    alter table public.soya_parties
      add constraint soya_parties_registration_type_check
      check (registration_type in ('regular','composition','unregistered','consumer'));
  end if;
end $$;

alter table public.soya_parties drop constraint if exists soya_parties_name_key;
create unique index if not exists idx_soya_parties_company_name_unique
  on public.soya_parties (company_id, upper(name));
create index if not exists idx_soya_parties_company_id
  on public.soya_parties (company_id);

-- --------------------------------------------- factory entries: scope + IGST
alter table public.soya_factory_entries
  add column if not exists company_id text
    references public.soya_companies(id) on delete restrict;
-- A purchase from the mill is an INWARD supply: the mill raises the invoice and
-- we record it. Splitting the single gst_amount lets input credit reconcile
-- against GSTR-2B, where the three heads are reported separately.
alter table public.soya_factory_entries add column if not exists cgst numeric(16,4) not null default 0;
alter table public.soya_factory_entries add column if not exists sgst numeric(16,4) not null default 0;
alter table public.soya_factory_entries add column if not exists igst numeric(16,4) not null default 0;
-- Where the goods landed, which decides the split. Defaults from the factory's
-- state but is overridable, because ship-to can differ from bill-to.
alter table public.soya_factory_entries add column if not exists place_of_supply_code text not null default '';

create index if not exists idx_soya_factory_entries_company_id
  on public.soya_factory_entries (company_id);

-- ----------------------------------------------- party entries: scope + IGST
alter table public.soya_party_entries
  add column if not exists company_id text
    references public.soya_companies(id) on delete restrict;
alter table public.soya_party_entries add column if not exists igst numeric(16,4) not null default 0;
alter table public.soya_party_entries add column if not exists place_of_supply_code text not null default '';

create index if not exists idx_soya_party_entries_company_id
  on public.soya_party_entries (company_id);

-- Our own bill series is per company now: two firms both issuing bill 1 in the
-- same financial year is correct, the same number twice within one firm is not.
drop index if exists public.idx_soya_party_entries_bill_no_fy_unique;
create unique index if not exists idx_soya_party_entries_company_bill_no_fy_unique
  on public.soya_party_entries (
    company_id,
    bill_no,
    (
      (extract(year from date)::int)
      - (case when extract(month from date) < 4 then 1 else 0 end)
    )
  );

-- ============================================================================
-- company_id is deliberately NULLABLE.
--
-- The three master rows that already exist (SANDEEO, DHANRAJ, ANNAM) predate
-- companies, so a NOT NULL would fail this migration. They show as
-- "Unassigned" in the UI until moved to a company; the app requires a company
-- on every new record. Once the three are assigned, NOT NULL can be added.
-- ============================================================================
