-- ============================================================================
-- SOYA — drop the superseded first-cut tables
-- ============================================================================
-- Run this ONCE, and only if you already ran an earlier version of
-- supabase/soya-parties.sql or supabase/soya-factory.sql.
--
-- Those first versions modelled Soya on the maize Sales/Bilty column sets. The
-- modules were since rebuilt on the customer's own workbook columns (SL NO,
-- FACTORY, P B NO, LORRY, WEIGHT, GST 5 %, NET WT, 2.5%CGST, FREIGHT, FRIGHT,
-- ...), which live in differently-shaped tables. The tables below are no longer
-- read or written by any code.
--
-- SAFETY: this script REFUSES TO DROP ANYTHING if any of these tables contains
-- even one row, so it cannot silently destroy data entered in the meantime. If
-- it aborts, tell me and we will migrate the rows across instead of dropping.
--
-- Nothing here touches a maize table.
-- ============================================================================

do $$
declare
  t text;
  n bigint;
  nonempty text[] := '{}';
begin
  foreach t in array array[
    'soya_sale_payment_allocations',
    'soya_sale_payments',
    'soya_sales',
    'soya_companies',
    'soya_bilty_party_payments',
    'soya_bilty',
    'soya_bilty_parties'
  ]
  loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      execute format('select count(*) from public.%I', t) into n;
      if n > 0 then
        nonempty := nonempty || format('%s (%s rows)', t, n);
      end if;
    end if;
  end loop;

  if array_length(nonempty, 1) > 0 then
    raise exception
      'Aborted: these superseded tables are not empty: %. Nothing was dropped.',
      array_to_string(nonempty, ', ');
  end if;

  -- Children before parents so the foreign keys are satisfied without cascade.
  drop table if exists public.soya_sale_payment_allocations;
  drop table if exists public.soya_sale_payments;
  drop table if exists public.soya_sales;
  drop table if exists public.soya_companies;
  drop table if exists public.soya_bilty_party_payments;
  drop table if exists public.soya_bilty;
  drop table if exists public.soya_bilty_parties;

  raise notice 'Superseded Soya tables dropped.';
end
$$;
