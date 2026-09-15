-- ============================================================================
-- SOYA BUSINESS LINE — Item master, tax invoices, e-Invoice + e-Way Bill
-- ============================================================================
-- Run AFTER supabase/soya-companies.sql. Safe / idempotent: every statement is
-- "create ... if not exists" or an "add column if not exists".
--
-- Still fully independent of the maize tables. Nothing here references
-- public.sales, public.companies, public.bilty, public.purchases, public.bills,
-- public.company_invoice_counters or any other maize object, and no maize
-- object is altered. In particular the maize invoice sequence
-- next_company_invoice_seq() is NOT reused — Soya numbers its own invoices.
--
-- WHAT THIS ADDS
--   1. public.soya_items — the item master. HSN lives here, and the e-Invoice
--      portal rejects any line without one.
--   2. public.soya_invoices — the tax invoice itself. Carries the three
--      addresses the portal asks for separately (bill-to, ship-to,
--      dispatch-from), the tax split, the transport block, and the e-Invoice /
--      e-Way Bill response fields.
--   3. public.soya_invoice_items — the invoice lines.
--
-- WHY THE ADDRESSES ARE SNAPSHOTTED ONTO THE INVOICE
--   A filed invoice is a legal record of what was sent to the government. If a
--   party later moves premises, last year's invoice must still print the
--   address that was actually filed. So the party's name, GSTIN and addresses
--   are COPIED onto soya_invoices at save time rather than joined at read time.
-- ============================================================================

-- ---------------------------------------------------------------- safety gate
-- soya_companies must exist in its CURRENT form, or the foreign keys below
-- would attach to the superseded table. Fail loudly rather than half-apply.
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'soya_companies'
  ) then
    raise exception using message =
      'public.soya_companies does not exist. Run supabase/soya-companies.sql first.';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'soya_companies'
      and column_name = 'type'
  ) then
    raise exception using message =
      'public.soya_companies is in its SUPERSEDED form (it has a "type" column). '
      'Fix that before running this file.';
  end if;
end $$;

-- ------------------------------------------------ 30-day reporting exposure
-- From 1 April 2025 a filer whose aggregate annual turnover is ₹10 crore or
-- more must report each invoice to the IRP within 30 days of its date; the
-- portal refuses the IRN afterwards. BELOW that turnover there is no such
-- window, so refusing to file an older invoice would block a perfectly legal
-- one. We cannot infer turnover, so it is recorded per company and the
-- readiness check treats the age of an invoice as blocking only when set.
alter table public.soya_companies
  add column if not exists aato_over_10cr boolean not null default false;

comment on column public.soya_companies.aato_over_10cr is
  'Aggregate annual turnover >= Rs 10 crore. Drives the IRP 30-day reporting window.';

-- --------------------------------------------------------------- item master
-- Soya trades a handful of items (SOYA MEAL, SOYA DOC, SOYA OIL). Each needs an
-- HSN code, a unit from the portal's fixed list, and a GST rate. The rate lives
-- on the item because it is a property of the goods, not of the sale.
create table if not exists public.soya_items (
  id text primary key,
  company_id text references public.soya_companies(id) on delete restrict,
  name text not null,
  -- 4, 6 or 8 digits. Soya meal is 2304, soya oil 1507. Stored as text because
  -- leading zeros are significant (e.g. 0713 for pulses).
  hsn text not null default '',
  -- Unit Quantity Code from the e-Invoice master list: MTS, KGS, BAG, LTR...
  unit text not null default 'MTS',
  -- Whole percent, e.g. 5. Split into CGST+SGST or charged as IGST at
  -- calculation time; never stored pre-split on the master.
  gst_rate numeric(6,3) not null default 0,
  default_rate numeric(16,4) not null default 0,
  description text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_soya_items_company_name_unique
  on public.soya_items (company_id, upper(name));
create index if not exists idx_soya_items_company_id
  on public.soya_items (company_id);

-- ------------------------------------------------------------- tax invoices
create table if not exists public.soya_invoices (
  id text primary key,
  company_id text not null references public.soya_companies(id) on delete restrict,

  -- Our own series. Unique per company per financial year, never globally:
  -- two firms both issuing invoice 1 in the same year is correct.
  invoice_no text not null,
  invoice_date date not null,
  -- Stored rather than derived so the unique index below stays a plain index
  -- on columns, and so a date correction cannot silently move an invoice into
  -- another year's series.
  fy_start_year integer not null,

  -- INV / CRN (credit note) / DBN (debit note), the portal's DOCTYP.
  doc_type text not null default 'INV',
  -- B2B / SEZWP / SEZWOP / EXPWP / EXPWOP / DEXP, the portal's SUPTYP.
  supply_type text not null default 'B2B',
  reverse_charge boolean not null default false,

  -- --- buyer, snapshotted (see header note) ---
  party_id text,
  party_name text not null default '',
  party_legal_name text not null default '',
  party_gstin text not null default '',
  party_state_code text not null default '',
  party_registration_type text not null default 'regular',
  bill_to_address text not null default '',
  bill_to_place text not null default '',
  bill_to_pincode text not null default '',
  party_phone text not null default '',
  party_email text not null default '',

  -- --- where the goods actually go; blank means "same as bill-to" ---
  ship_to_name text not null default '',
  ship_to_gstin text not null default '',
  ship_to_address text not null default '',
  ship_to_place text not null default '',
  ship_to_pincode text not null default '',
  ship_to_state_code text not null default '',

  -- --- where the goods actually leave from; blank means "our own premises" ---
  -- On a drop-ship this is the mill, in a different state from both parties.
  -- It is an e-Way Bill address ONLY. It must never feed the tax split: the
  -- 12-Sep-2026 voucher dispatches from Maharashtra and is still a local
  -- Karnataka sale, because both registrations are Karnataka.
  dispatch_from_name text not null default '',
  dispatch_from_address text not null default '',
  dispatch_from_place text not null default '',
  dispatch_from_pincode text not null default '',
  dispatch_from_state_code text not null default '',

  -- The state whose tax is charged. Decides CGST+SGST versus IGST, together
  -- with the company's own state.
  place_of_supply_code text not null default '',

  -- --- money. Line values are summed into these at save time. ---
  taxable_value numeric(16,2) not null default 0,
  cgst numeric(16,2) not null default 0,
  sgst numeric(16,2) not null default 0,
  igst numeric(16,2) not null default 0,
  cess numeric(16,2) not null default 0,
  other_charges numeric(16,2) not null default 0,
  round_off numeric(16,2) not null default 0,
  total_value numeric(16,2) not null default 0,

  -- --- transport, for the e-Way Bill half of the submission ---
  transporter_name text not null default '',
  transporter_id text not null default '',
  -- 1 Road, 2 Rail, 3 Air, 4 Ship.
  transport_mode text not null default '',
  vehicle_no text not null default '',
  -- R Regular, O Over Dimensional Cargo.
  vehicle_type text not null default '',
  distance_km integer not null default 0,
  transport_doc_no text not null default '',
  transport_doc_date date,

  -- --- e-Invoice response ---
  -- pending -> generated -> cancelled, or failed. 'pending' also covers
  -- "never submitted", which is every invoice until the portal is wired up.
  einvoice_status text not null default 'pending',
  irn text not null default '',
  ack_no text not null default '',
  ack_date timestamptz,
  signed_qr text not null default '',
  einvoice_error text not null default '',
  irn_cancelled_at timestamptz,
  irn_cancel_reason text not null default '',

  -- --- e-Way Bill response ---
  ewb_status text not null default 'pending',
  ewb_no text not null default '',
  ewb_date timestamptz,
  ewb_valid_until timestamptz,
  ewb_error text not null default '',
  ewb_cancelled_at timestamptz,

  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'soya_invoices_doc_type_check') then
    alter table public.soya_invoices add constraint soya_invoices_doc_type_check
      check (doc_type in ('INV','CRN','DBN'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'soya_invoices_einvoice_status_check') then
    alter table public.soya_invoices add constraint soya_invoices_einvoice_status_check
      check (einvoice_status in ('pending','generated','cancelled','failed','not_applicable'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'soya_invoices_ewb_status_check') then
    alter table public.soya_invoices add constraint soya_invoices_ewb_status_check
      check (ewb_status in ('pending','generated','cancelled','failed','not_applicable'));
  end if;
end $$;

-- One invoice number per company per financial year.
create unique index if not exists idx_soya_invoices_company_no_fy_unique
  on public.soya_invoices (company_id, upper(invoice_no), fy_start_year);

-- An IRN is issued once and identifies exactly one document nationally, so a
-- duplicate here means we recorded the same portal response twice.
create unique index if not exists idx_soya_invoices_irn_unique
  on public.soya_invoices (irn) where irn <> '';

create index if not exists idx_soya_invoices_company_id on public.soya_invoices (company_id);
create index if not exists idx_soya_invoices_date on public.soya_invoices (invoice_date);
create index if not exists idx_soya_invoices_party_id on public.soya_invoices (party_id);
create index if not exists idx_soya_invoices_einvoice_status on public.soya_invoices (einvoice_status);

-- ------------------------------------------------------------ invoice lines
create table if not exists public.soya_invoice_items (
  id text primary key,
  invoice_id text not null references public.soya_invoices(id) on delete cascade,
  line_no integer not null default 1,

  -- item_id is the master it came from; item_name/hsn/unit are snapshotted for
  -- the same reason the addresses are. ON DELETE SET NULL so retiring an item
  -- from the master never rewrites a filed invoice.
  item_id text references public.soya_items(id) on delete set null,
  item_name text not null default '',
  description text not null default '',
  hsn text not null default '',
  unit text not null default 'MTS',

  quantity numeric(16,3) not null default 0,
  rate numeric(16,4) not null default 0,
  -- quantity x rate, before discount.
  amount numeric(16,2) not null default 0,
  discount numeric(16,2) not null default 0,
  -- amount - discount. What the tax is charged on.
  taxable_value numeric(16,2) not null default 0,

  gst_rate numeric(6,3) not null default 0,
  cgst numeric(16,2) not null default 0,
  sgst numeric(16,2) not null default 0,
  igst numeric(16,2) not null default 0,
  cess numeric(16,2) not null default 0,
  total_value numeric(16,2) not null default 0,

  created_at timestamptz not null default now()
);

create index if not exists idx_soya_invoice_items_invoice_id
  on public.soya_invoice_items (invoice_id);
create unique index if not exists idx_soya_invoice_items_line_unique
  on public.soya_invoice_items (invoice_id, line_no);

-- ============================================================================
-- Invoice numbers are allocated in application code as max+1 per company per
-- financial year, exactly like soya_party_entries.bill_no, rather than by a
-- sequence. Two reasons: a sequence cannot restart per company per year, and
-- GST requires an unbroken series — a rolled-back transaction that consumed a
-- sequence value leaves a gap that has to be explained. The unique index above
-- is what makes the read-then-write safe: a racing insert fails rather than
-- duplicating, and the caller retries.
-- ============================================================================
