-- ============================================================================
-- SOYA — move party records to the company that holds their bills
-- ============================================================================
-- Fixes parties that don't show in the Party master although they have bills
-- (found: BHARAT MALNAD FARM and SANTHOSH POULTRY FA — records in OM SRI ENT,
-- every bill in SREE GURU).
--
-- A party is moved only when ALL of these hold:
--   * it has no bills in its own company,
--   * all its bills are in exactly ONE other company,
--   * that company has no party of the same name yet.
-- Its payments follow automatically (they link to the party record).
-- Nothing else changes: no bills, no payments rows, nothing Maize.
--
-- Run STEP 1, check the list, then run STEP 2. Dev first if you can.
-- ============================================================================


-- ---------------------------------------------------------------- STEP 1
-- Preview (read only): what would move.
with
  dflt as (
    select id from public.soya_companies where is_active
    order by is_default desc, created_at asc limit 1
  ),
  bills as (
    select upper(trim(e.party)) as pname,
           coalesce(e.company_id, (select id from dflt)) as company_id
    from public.soya_party_entries e
  ),
  candidates as (
    select p.id, p.name,
           coalesce(p.company_id, (select id from dflt)) as from_id,
           (select min(b.company_id) from bills b where b.pname = upper(trim(p.name))) as to_id,
           (select count(distinct b.company_id) from bills b where b.pname = upper(trim(p.name))) as bill_companies,
           (select count(*) from bills b where b.pname = upper(trim(p.name))) as bill_count
    from public.soya_parties p
    where p.deleted_at is null
  )
select c.name, fc.name as from_company, tc.name as to_company, c.bill_count,
       (select count(*) from public.soya_party_payments pp where pp.party_id = c.id) as payments_moving_too
from candidates c
join public.soya_companies fc on fc.id = c.from_id
join public.soya_companies tc on tc.id = c.to_id
where c.bill_companies = 1
  and c.to_id <> c.from_id
  and not exists (
    select 1 from public.soya_parties t
    where t.company_id = c.to_id and upper(trim(t.name)) = upper(trim(c.name))
  )
order by c.name;


-- ---------------------------------------------------------------- STEP 2
-- The move. Same rules as STEP 1; prints how many records moved.
begin;

with
  dflt as (
    select id from public.soya_companies where is_active
    order by is_default desc, created_at asc limit 1
  ),
  bills as (
    select upper(trim(e.party)) as pname,
           coalesce(e.company_id, (select id from dflt)) as company_id
    from public.soya_party_entries e
  ),
  candidates as (
    select p.id, p.name,
           coalesce(p.company_id, (select id from dflt)) as from_id,
           (select min(b.company_id) from bills b where b.pname = upper(trim(p.name))) as to_id,
           (select count(distinct b.company_id) from bills b where b.pname = upper(trim(p.name))) as bill_companies
    from public.soya_parties p
    where p.deleted_at is null
  ),
  moved as (
    update public.soya_parties p
    set company_id = c.to_id, updated_at = now()
    from candidates c
    where p.id = c.id
      and c.bill_companies = 1
      and c.to_id <> c.from_id
      and not exists (
        select 1 from public.soya_parties t
        where t.company_id = c.to_id and upper(trim(t.name)) = upper(trim(c.name))
      )
    returning p.name
  )
select count(*) as parties_moved, string_agg(name, ', ') as names from moved;

commit;
