# Deployment & Push Guide

How to push code and take a release live for the MB Groups app (Next.js 16 + Supabase).

---

## 1. Branches

| Branch | What it is |
|---|---|
| `main` | Historical default branch — **behind**, do not deploy from it until synced. |
| `prod` | The branch production was last deployed from (pre-RBAC). |
| `feat/rbac` | **Latest work**: RBAC (per-user module permissions + `/users` admin screen), view-only UI gating, per-issuer/per-FY bill numbering fix, sales error surfacing, public marketing landing page at `/`. |

### Push workflow

```bash
# day-to-day work
git checkout feat/rbac          # or a new feature branch
git add -A
git commit -m "feat: ..."
git push origin feat/rbac

# when releasing: merge into prod and push
git checkout prod
git merge feat/rbac
git push origin prod
```

> Pushes are done with the `SandeepMS07` GitHub account. If a push is rejected,
> check `git remote -v` and your credentials (`gh auth status`).

---

## 2. Database migrations (run BEFORE deploying the code)

Run these in the Supabase SQL editor. **The live project is `hpeioufrdqrvaymkoggs`**
— there is only one, so migrations run there take effect in production immediately.

> Earlier versions of this guide named a separate production project,
> `pb-manager-prod` (`sexjbsgfkatkegualoxh`). **That project no longer exists**
> (its hostname does not resolve); `hpeioufrdqrvaymkoggs` is the live database.
> The commented-out block still sitting in `.env` points at the dead project and
> can be deleted. Since there is no separate staging database, treat every
> migration below as running against live data.

### 2.1 RBAC permissions table — required for `feat/rbac`

Run [`supabase/rbac-user-permissions.sql`](../supabase/rbac-user-permissions.sql).
Creates `user_permissions (user_id, module, level)` used by the new login/permission system.

### 2.2 Bill numbers per issuer per financial year — already applied

[`supabase/fix-sales-bill-number-per-issuer-fy.sql`](../supabase/fix-sales-bill-number-per-issuer-fy.sql)

- Already run on the live project (it also drops the rogue `ux_sales_bill_number` global index that caused the "add sales" 500).
- Run it on any new environment if sales inserts fail there with duplicate bill_number errors.
- Safe to re-run: it only drops/creates indexes (`if exists` / `if not exists`).

### 2.3 `company_payments.credit_hold_amount` — required for the "hold as credit" payment option

Run this on any database that doesn't already have the column (safe/idempotent):

```sql
alter table public.company_payments
  add column if not exists credit_hold_amount numeric(14,2) not null default 0;
```

Also included in the main `supabase/schema.sql`. Lets staff mark part of a payment
as an unapplied credit (instead of it auto-rolling onto the next bill) when
recording a payment in Companies → Payment Ledger. Shows as "Credit Balance" in
the app only — intentionally not shown on the customer-facing Statement of Account.

### 2.4 Soya business line — required for the Soya workspace

Soya is a **second, independent business line** (admin-only, everything under
`/soya`) with two modules, **Factory** (the buy side) and **Parties** (the sell
side). Its columns come from the customer's own workbook (`OM SRI ENTERPRISES.xlsx`,
SALES sheet): SL NO · FACTORY · DATE · P B NO · LORRY · BAGS · WEIGHT · RATE ·
AMOUNT · GST 5 % · TCS · AMOUNT on the Factory side, and SL NO · DATE · BILL NO ·
BAGS · NET WT · RATE · AMOUNT · 2.5%CGST · 2.5%SGST · TCS · AMOUNT · FREIGHT ·
PARTY · FRIGHT on the Parties side.

It has its own tables and shares none with maize, so these files are additive:
every statement is `create ... if not exists`, there is no `alter table` against
any maize table, no `soya_*` table has a foreign key into a maize table, and no
sequence is shared. Re-running them is a no-op.

Run both in the Supabase SQL editor. **Already applied to the live project on
2026-09-11** — listed here for the record and for any future environment:

| File | Creates |
|---|---|
| `supabase/soya-factory.sql` | `soya_factories` · `soya_factory_entries` · `soya_factory_payments` |
| `supabase/soya-parties.sql` | `soya_parties` · `soya_party_entries` · `soya_party_payments` |

Until they are applied, the Soya pages render an "Unavailable" notice naming the
file to run rather than erroring — the maize side is unaffected either way.

An earlier version of these two files created a first cut modelled on the maize
column sets (`soya_companies`, `soya_sales`, `soya_sale_payments`,
`soya_sale_payment_allocations`, `soya_bilty`, `soya_bilty_parties`,
`soya_bilty_party_payments`). Nothing reads those any more, and they were
dropped from the live project on 2026-09-11 with
[`supabase/soya-drop-superseded-tables.sql`](../supabase/soya-drop-superseded-tables.sql),
which **aborts without dropping anything** if any of them turns out to hold
rows. Nothing further to do unless you find those tables in some other
environment.

Two deliberate differences from the maize schema:

- **No shared sequence.** Maize bilty's "Generate Bill" writes `public.bills`,
  whose `bills_bill_no_seq` is shared with maize Purchases — a Soya bill written
  there would silently consume a maize bill number. Soya Factory therefore has
  **no bill-generation flow and no sequence**: identifiers are supplied by the
  app. Nothing on the maize side can be advanced by Soya activity.
- **Soya BILL NO is text and restarts each April** (unique per financial year),
  because the workbook opens a year with values like `29*1`. Maize's
  global-unique `idx_bilty_bill_no_unique` is left untouched.

### 2.5 Cleanup (optional, after confidence)

```sql
-- backup created during the SRI LAKSHMI '*' bill-number cleanup (2026-08-19)
drop table if exists public.sales_billnumber_backup_20260819;
```

---

## 3. Deploying the app

Deploys are **manual** (no auto-deploy on push).

```bash
git checkout prod          # after merging feat/rbac (see §1)
npm ci
npm run build              # must pass before deploying
npm run start              # or restart the hosting service that runs it
```

Environment variables required (same as today; nothing new was added):

- `NEXT_PUBLIC_SUPABASE_URL` / Supabase service-role key (see `.env`) — **must point to `hpeioufrdqrvaymkoggs`**
- JWT session secret used by `src/features/auth/lib/session.ts`

To run locally on a specific port: `npm run dev -- -p 3002`.

---

## 4. Post-deploy checklist

1. **Everyone must log in again.** Permissions are embedded in the JWT session
   cookie at login; old sessions have no `perms` and admins/operators keep
   working, but new per-user permissions only apply after a fresh login.
2. **Log in as admin** (`admin@gmail.com`) → the **Users** item appears in the
   sidebar → `/users` is the admin screen to add users and set per-module
   access (None / View / Edit for: dashboard, purchases, bilty, sales, gunny,
   expenses, users).
3. Spot-check RBAC:
   - A *view-only* user must not see Add/Edit/Delete buttons and must get
     "Forbidden" if they call a write anyway (server-enforced).
   - A user with no module access lands on `/no-access`.
4. **Sales smoke test:** add a sale for each issuer company — bill numbers are
   scoped per issuer per financial year (Apr–Mar).
5. **Landing page:** open `/` logged-out — the public marketing page should
   render (no redirect to `/login`). `Staff login →` is in the footer.
6. **Soya (admin only):** as admin, the sidebar shows a Maize/Soya switcher →
   Soya has Dashboard, **Factory** (buy side) and **Parties** (sell side), with
   the workbook's own column headers. Add one entry on each side and check the
   computed columns against the sheet: Factory AMOUNT = WEIGHT x RATE,
   GST 5 % = 5% of it; Parties AMOUNT = NET WT x RATE, with 2.5%CGST and
   2.5%SGST each 2.5% of it. Confirm a non-admin sees **no** switcher and is
   redirected off `/soya/*`. Then confirm maize is untouched: **Purchases →
   Generate Bill still produces `max+1`** (this is the check that catches any
   shared-sequence regression) and the maize Bilty/Sales bill numbers are
   unchanged.

---

## 5. Landing page content (placeholders to replace)

All in [`src/app/page.tsx`](../src/app/page.tsx), top of the file:

```ts
const CONTACT_EMAIL   = "info@mbgroups.example";     // real email
const CONTACT_PHONE   = "+91 98765 43210";           // real phone
const CONTACT_ADDRESS = "Plot 12, Market Yard Road, …"; // real address
```

Also update the `stats` array (years in trade, suppliers & buyers, tonnes
traded) with real figures. Photos live in `public/marketing/` and are CC0
(free for commercial use, no attribution required).

---

## 6. Troubleshooting

| Symptom | Fix |
|---|---|
| 500 "duplicate key … bill_number" on adding sales | Ensure §2.2 was run on that database (drops `ux_sales_bill_number`, creates the per-issuer/per-FY unique index). |
| Login works but sidebar is empty / redirected to `/no-access` | The user has no rows in `user_permissions` and isn't an admin — grant modules in `/users`, then the user must re-login. |
| Admin password unknown | See README §"Reset Login Password" — update `users.password_hash` with a bcrypt hash. |
| Permission changes not taking effect | The affected user must log out and back in (permissions live in the JWT). |
