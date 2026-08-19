-- Fix: sales.bill_number must be unique PER ISSUER COMPANY, per financial year.
--
-- Supersedes fix-sales-bill-number-per-fy.sql. Each issuer company keeps its own
-- bill-number series, so two issuer companies may both use bill "41" in the same
-- financial year. Uniqueness is therefore scoped to
--   (bill_number, issuer_company_id, financial-year).
--
-- NULL issuer_company_id rows are collapsed via coalesce(...,'') so they still
-- can't duplicate each other within a financial year. Run once in the Supabase
-- SQL editor.

-- 1) Drop the per-financial-year-only unique index from the previous migration.
drop index if exists public.idx_sales_bill_number_fy_unique;

-- 1b) Drop the rogue GLOBAL unique index on bill_number. It was created
--     manually (never in schema.sql), so earlier migrations missed it. This is
--     the real reason bill numbers could not be reused across issuers or years.
drop index if exists public.ux_sales_bill_number;

-- 2) Also drop the original global unique constraint if it is still present
--    (no-op if the per-FY migration already removed it).
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

-- 3) Enforce uniqueness of (bill_number, issuer_company, financial-year).
--    FY start year = calendar year, minus 1 when the month is Jan–Mar.
create unique index if not exists idx_sales_bill_number_issuer_fy_unique
  on public.sales (
    bill_number,
    coalesce(issuer_company_id, ''),
    (
      (extract(year from sale_date)::int)
      - (case when extract(month from sale_date) < 4 then 1 else 0 end)
    )
  );
