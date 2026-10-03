-- ============================================================================
-- SOYA — give unassigned Factory / Parties rows to the default company
-- ============================================================================
-- Run AFTER supabase/soya-companies.sql. Safe to re-run: the second run finds
-- nothing unassigned and changes nothing.
--
-- WHY
-- Rows saved before company_id existed have it NULL, and nobody can say which
-- firm each one belonged to. The app already shows them under the DEFAULT
-- company (src/features/soya/lib/company-scope.ts), so running this changes
-- nothing on screen — it just writes that assignment down, so the database's
-- per-company bill-number index can see those rows too.
--
-- Any row that was really another company's can then be moved from its edit
-- form (Company field).
--
-- WHAT IT TOUCHES
--   soya_factories, soya_parties, soya_factory_entries, soya_party_entries —
--   only rows where company_id IS NULL. Payments have no company column; they
--   follow their factory / party. Nothing maize is read or written.
--
-- BEFORE RUNNING
--   Check which company is the default (Soya → Companies). Everything
--   unassigned goes there:
--     select id, name, is_default, is_active from public.soya_companies;
--
-- It stops without changing anything if giving a row to the default company
-- would clash with one already there (same party / factory name, or same bill
-- number in the same financial year), and names the clashes.
-- ============================================================================

begin;

do $$
declare
  target text;
  target_name text;
  clashes text;
  n_factories int;
  n_parties int;
  n_factory_entries int;
  n_party_entries int;
begin
  -- Same rule as getDefaultSoyaCompany(): the active default, else the first
  -- active company.
  select id, name into target, target_name
  from public.soya_companies
  where is_active
  order by is_default desc, created_at asc
  limit 1;

  if target is null then
    raise exception 'No active Soya company exists. Create one in Soya → Companies first.';
  end if;

  -- Masters: a name may exist once per company.
  select string_agg(distinct u.name, ', ') into clashes
  from public.soya_parties u
  join public.soya_parties a
    on a.company_id = target and upper(a.name) = upper(u.name)
  where u.company_id is null;
  if clashes is not null then
    raise exception 'Parties already in % under the same name: %. Rename or merge them first.', target_name, clashes;
  end if;

  select string_agg(distinct u.name, ', ') into clashes
  from public.soya_factories u
  join public.soya_factories a
    on a.company_id = target and upper(a.name) = upper(u.name)
  where u.company_id is null;
  if clashes is not null then
    raise exception 'Factories already in % under the same name: %. Rename or merge them first.', target_name, clashes;
  end if;

  -- Party bill numbers: unique per company per financial year.
  select string_agg(distinct u.bill_no || ' (' || to_char(u.date, 'DD-MM-YYYY') || ')', ', ') into clashes
  from public.soya_party_entries u
  join public.soya_party_entries a
    on a.company_id = target
   and a.bill_no = u.bill_no
   and (extract(year from a.date)::int - (case when extract(month from a.date) < 4 then 1 else 0 end))
     = (extract(year from u.date)::int - (case when extract(month from u.date) < 4 then 1 else 0 end))
  where u.company_id is null;
  if clashes is not null then
    raise exception 'Bill numbers already used in % in the same financial year: %. Change them first.', target_name, clashes;
  end if;

  update public.soya_factories set company_id = target, updated_at = now() where company_id is null;
  get diagnostics n_factories = row_count;
  update public.soya_parties set company_id = target, updated_at = now() where company_id is null;
  get diagnostics n_parties = row_count;
  update public.soya_factory_entries set company_id = target, updated_at = now() where company_id is null;
  get diagnostics n_factory_entries = row_count;
  update public.soya_party_entries set company_id = target, updated_at = now() where company_id is null;
  get diagnostics n_party_entries = row_count;

  raise notice 'Assigned to %: % factories, % parties, % factory entries, % party entries.',
    target_name, n_factories, n_parties, n_factory_entries, n_party_entries;
end $$;

commit;
