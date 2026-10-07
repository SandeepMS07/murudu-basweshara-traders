-- ============================================================================
-- SOYA — why is a party missing from the Party master? (READ ONLY)
-- ============================================================================
-- Changes nothing. Run each query and send the results back.
-- The search words below match spellings loosely (SANTOS / SANTHOSH,
-- BHARAT / BHARATH MALNAD ...). Edit them to look for another party.
-- ============================================================================

-- 1. The party records, in every company, including deleted ones.
--    A party is listed only under ITS company and only if deleted_at is empty.
select
  p.name,
  coalesce(c.name, '(no company)') as company,
  p.deleted_at,
  p.gstin,
  p.id
from public.soya_parties p
left join public.soya_companies c on c.id = p.company_id
where p.name ilike any (array['%santo%', '%santh%', '%malnad%', '%bharat%'])
order by p.name, company;

-- 2. Their sales bills, grouped by the exact name on the bill and the company
--    the bill is in. A bill whose name or company differs from the party
--    record above is the usual reason it "doesn't show".
select
  e.party as name_on_bill,
  coalesce(c.name, '(no company)') as company,
  count(*) as bills,
  sum(e.total_amount) as total,
  min(e.date) as first_bill,
  max(e.date) as last_bill
from public.soya_party_entries e
left join public.soya_companies c on c.id = e.company_id
where e.party ilike any (array['%santo%', '%santh%', '%malnad%', '%bharat%'])
group by e.party, c.name
order by e.party, company;

-- 3. Their payments, and which company's party record they hang on.
select
  p.name,
  coalesce(c.name, '(no company)') as company,
  count(pp.id) as payments,
  sum(pp.amount) as received
from public.soya_parties p
left join public.soya_companies c on c.id = p.company_id
join public.soya_party_payments pp on pp.party_id = p.id
where p.name ilike any (array['%santo%', '%santh%', '%malnad%', '%bharat%'])
group by p.name, c.name
order by p.name, company;

-- 4. Same check on the factory side, in case they were entered as a factory.
select
  f.name,
  coalesce(c.name, '(no company)') as company,
  f.deleted_at
from public.soya_factories f
left join public.soya_companies c on c.id = f.company_id
where f.name ilike any (array['%santo%', '%santh%', '%malnad%', '%bharat%'])
order by f.name, company;
