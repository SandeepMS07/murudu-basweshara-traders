-- Fix: sales.bill_number must be unique PER FINANCIAL YEAR (Apr–Mar), not globally.
--
-- The original DDL declared `bill_number text not null unique`, a global unique
-- constraint. The application, however, only checks bill-number uniqueness within
-- the current financial year (see createSale/updateSale and getNextSaleIdentifiersForDate).
-- Reusing a bill number in a later FY (e.g. "41" every year) therefore passed the
-- app check but failed the global DB constraint with a 23505 violation -> 500 error
-- when adding a sale.
--
-- This migration replaces the global unique with a composite unique index scoped
-- to the sale's financial year. Run once in the Supabase SQL editor.

-- 1) Drop the existing single-column unique constraint on bill_number,
--    whatever its generated name is.
do $$
declare
  c text;
begin
  select con.conname
    into c
  from pg_constraint con
  where con.conrelid = 'public.sales'::regclass
    and con.contype = 'u'
    and con.conkey = array[
      (select att.attnum
         from pg_attribute att
        where att.attrelid = 'public.sales'::regclass
          and att.attname = 'bill_number')
    ];
  if c is not null then
    execute format('alter table public.sales drop constraint %I', c);
  end if;
end $$;

-- 2) Enforce uniqueness of (bill_number, financial-year-start-year) instead.
--    FY start year = calendar year, minus 1 when the month is Jan–Mar.
create unique index if not exists idx_sales_bill_number_fy_unique
  on public.sales (
    bill_number,
    (
      (extract(year from sale_date)::int)
      - (case when extract(month from sale_date) < 4 then 1 else 0 end)
    )
  );
