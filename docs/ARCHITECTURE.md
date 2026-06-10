# PB Manager — System Architecture

> Internal management system for a grain/maize trading business (branded **MB Groups**).
> Tracks **purchases**, **bilty** (transport consignments), **sales**, **billing/invoicing**,
> **expenses**, and **gunny bags** (jute sacks), with payment tracking and Excel import/export.

| | |
|---|---|
| **Framework** | Next.js 16 (App Router) · React 19 · TypeScript |
| **Database** | Supabase (Postgres), accessed server-side via service-role key |
| **Validation** | Zod (schemas are the source of truth for types) |
| **UI** | Tailwind v4 · shadcn-ui · TanStack Table |
| **Auth** | JWT in an httpOnly cookie (jose) + bcrypt password hashing |
| **Rendering** | Server Components by default; Client Components only for interactive tables/forms |

> 📊 **Diagrams** are committed as rendered SVGs under [`docs/diagrams/`](diagrams/) so they display
> in any viewer. Each diagram's editable Mermaid source sits next to it as a `.mmd` file and is also
> embedded in a collapsible block below it. To regenerate after editing, see [§11](#11-regenerating-the-diagrams).

---

## 1. High-level architecture

There is no separate backend service. **Next.js *is* the backend.** The browser never talks to
Supabase directly — every read/write goes through the server (a Server Action or a Route Handler)
using the **service-role key**, which never ships to the client bundle.

![High-level architecture](diagrams/01-high-level.svg)

<details><summary>Mermaid source</summary>

```mermaid
flowchart TB
    subgraph Client["Browser"]
        UI["React 19 UI (Server + Client Components)<br/>shadcn-ui / Tailwind / TanStack Table"]
    end
    subgraph Edge["Next.js 16 App Router - single deployable"]
        MW["proxy.ts middleware<br/>JWT gate + redirects"]
        RSC["Server Components<br/>render data server-side"]
        SA["Server Actions<br/>app/*/actions.ts"]
        API["Route Handlers<br/>app/api/*"]
    end
    subgraph Domain["Feature / Domain layer (src/features/*)"]
        SVC["Services"]
        SCHEMA["Zod Schemas"]
        CALC["Pure calc utils"]
    end
    subgraph Data["Supabase (Postgres)"]
        PG[("Tables + Sequences + RPC")]
    end
    UI -->|navigation| MW
    MW --> RSC
    UI -->|form submit / mutation| SA
    UI -->|login, bilty CRUD, company profile| API
    RSC --> SVC
    SA -->|Zod.parse| SCHEMA
    SA --> SVC
    API --> SVC
    SVC --> SCHEMA
    SVC --> CALC
    SVC -->|service-role key| PG
```
</details>

---

## 2. Layered design (per feature slice)

Every domain under `src/features/<domain>/` follows the **same four-part shape**. This consistency
is the backbone of the codebase — learn one slice and you know them all.

![Feature slice layering](diagrams/02-feature-slice.svg)

| Layer | Responsibility | Rule |
|-------|----------------|------|
| `schemas/` | Zod validation + inferred types | **Single source of truth** for shape |
| `utils/` | Pure derivations (net weight, totals) | No I/O, unit-tested |
| `service/` | All Supabase reads/writes + auth guards | Server-only; recomputes derived fields |
| `components/` | Forms & tables | Client; call Server Actions |
| `app/.../actions.ts` | Thin RPC boundary | `parse()` then delegate to service |

<details><summary>Mermaid source</summary>

```mermaid
flowchart LR
    subgraph slice["src/features/&lt;domain&gt;/"]
        direction TB
        C["components/ Client UI"]
        S["schemas/ Zod -> types"]
        U["utils/ pure calc + tests"]
        SV["service/ Supabase, server-only"]
    end
    subgraph app["src/app/&lt;domain&gt;/"]
        P["page.tsx (Server Component)"]
        A["actions.ts (use server)"]
    end
    P -->|reads| SV
    P -->|renders| C
    C -->|calls| A
    A -->|parse| S
    A --> SV
    SV --> U
    SV --> S
```
</details>

---

## 3. Request lifecycle (a mutation, end-to-end)

![Request lifecycle sequence](diagrams/03-request-lifecycle.svg)

**Notes**
- Validation happens **twice on the server**: Zod at the action boundary, then DB constraints.
- `requireAuth()` is enforced inside the service, not only in middleware → defense in depth.
- Derived fields (`net_weight`, `final_total`, …) are **recomputed server-side** on every write,
  so they can never drift from the inputs.
- Errors are thrown and surfaced to the client as toast messages (sonner).

<details><summary>Mermaid source</summary>

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser (Client Component)
    participant M as proxy.ts (middleware)
    participant A as Server Action
    participant Z as Zod schema
    participant S as Service
    participant DB as Supabase (Postgres)
    B->>M: navigate / submit (cookie session)
    M->>M: verifySession(JWT)
    alt no valid session and private route
        M-->>B: 302 redirect to /login
    end
    B->>A: createPurchaseAction(input)
    A->>Z: purchaseSchema.parse(input)
    Z-->>A: validated input (or throws)
    A->>S: createPurchase(parsed)
    S->>S: requireAuth + role check
    S->>S: calculatePurchase (derive totals)
    S->>DB: insert(payload)
    DB-->>S: row (or 23505 unique violation)
    S-->>A: domain object
    A-->>B: result (or thrown Error to toast)
```
</details>

---

## 4. Authentication & session

- Sessions are **stateless JWTs** (no server-side session store), signed with `SESSION_SECRET`, 24h expiry.
- Roles: `admin`, `operator`. Guards: `requireAuth()`, `requireRole([...])`.
- Public routes: `/login`, `/api/auth/login`. Everything else is gated by [`proxy.ts`](../src/proxy.ts).

![Authentication sequence](diagrams/04-auth.svg)

<details><summary>Mermaid source</summary>

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant API as login route
    participant AS as auth.service
    participant DB as users table
    participant J as jose JWT
    B->>API: POST email and password
    API->>AS: authenticateUser
    AS->>DB: select user by email
    DB-->>AS: password_hash and role
    AS->>AS: bcrypt compare password hash
    AS->>J: signSession id email role HS256 24h
    J-->>AS: token
    AS-->>B: Set-Cookie session JWT httpOnly sameSite lax
    Note over B,API: Later requests carry the cookie and proxy.ts verifies it on every protected route
```
</details>

---

## 5. Route map

Navigation is defined in [`src/components/layout/Sidebar.tsx`](../src/components/layout/Sidebar.tsx).

![Route map](diagrams/05-route-map.svg)

<details><summary>Mermaid source</summary>

```mermaid
flowchart TD
    root["/"] -->|authed| dash["/dashboard"]
    root -->|guest| login["/login"]
    dash --> pur["/purchases + /new, /[id]/edit, /all"]
    dash --> bil["/bilty + /add, /[id]/edit, /parties"]
    dash --> sal["/sales + /new, /[id]/edit"]
    sal --> inv["/sales/invoices + /[id]/print"]
    sal --> comp["/companies"]
    dash --> gun["/gunny + /add, /[id]/edit, /sellers"]
    dash --> exp["/expenses/[tab]"]
    dash --> bills["/bills/[id]/print and /edit"]
    subgraph apis["API Route Handlers"]
        a1["/api/auth/login logout me"]
        a2["/api/bilty and /api/bilty/[id]"]
        a3["/api/companies/profile"]
    end
```
</details>

---

## 6. Data model (ERD)

The schema lives in [`supabase/schema.sql`](../supabase/schema.sql) (18 tables + sequences + one RPC).

![Entity-relationship diagram](diagrams/06-erd.svg)

> **Modeling notes:** `purchases`/`bilty` carry denormalized `name/place/mob` rather than a hard FK
> to a party table. `gunny_bags.seller` is a free-text name (matched to `gunny_sellers` by name, not FK).
> The `*_payment_allocations` tables are the join between a single payment and the many records it pays.

<details><summary>Mermaid source</summary>

```mermaid
erDiagram
    users { uuid id PK }
    purchases { text id PK }
    bilty { text id PK }
    bilty_parties { text id PK }
    bilty_party_payments { text id PK }
    bills { text id PK }
    sales { text id PK }
    companies { text id PK }
    company_invoice_counters { text issuer_company_id PK }
    company_payments { text id PK }
    company_payment_allocations { text id PK }
    sales_invoices { text id PK }
    sales_invoice_items { text id PK }
    gunny_bags { text id PK }
    gunny_sellers { text id PK }
    gunny_seller_payments { text id PK }
    gunny_payment_allocations { text id PK }
    expense_employees { text id PK }
    expenses { text id PK }
    bilty_parties ||--o{ bilty_party_payments : receives
    companies ||--o| company_invoice_counters : has_counter
    companies ||--o{ company_payments : receives
    company_payments ||--o{ company_payment_allocations : split_into
    sales ||--o{ company_payment_allocations : applied_to
    companies ||--o{ sales_invoices : issues_or_buys
    sales_invoices ||--o{ sales_invoice_items : contains
    sales ||--o{ sales_invoice_items : billed_in
    gunny_sellers ||--o{ gunny_seller_payments : receives
    gunny_seller_payments ||--o{ gunny_payment_allocations : split_into
    gunny_bags ||--o{ gunny_payment_allocations : applied_to
    expense_employees ||--o{ expenses : incurs
```
</details>

---

## 7. Key domain flows

### 7.1 Bill generation (idempotent)
A purchase or bilty maps to a **deterministic bill id**, so re-generating never duplicates:

```
purchase  →  bill id = "PUR_BILL_<purchaseId>"  →  upsertBillById(...)
```

Because the id is derived from the source row, the `upsert` makes the operation idempotent —
one purchase always resolves to exactly one bill.

### 7.2 Sales invoice numbering (concurrency-safe)
Invoice sequence per issuer company uses an **atomic Postgres RPC** (`next_company_invoice_seq`),
not a read-modify-write — so concurrent invoice generation can't collide. The invoice also stores a
**`snapshot_json`** of issuer/buyer/items at issue time, so printed invoices stay stable even if the
underlying company or sale rows change later.

![Invoice generation flow](diagrams/07-invoice-flow.svg)

<details><summary>Mermaid source</summary>

```mermaid
flowchart LR
    A["generateSalesInvoice()"] --> B["rpc next_company_invoice_seq(issuer)"]
    B --> C["INSERT ON CONFLICT DO UPDATE last_seq = last_seq + 1 RETURNING last_seq"]
    C --> D["invoice_no = PREFIX-0001"]
    D --> E["insert sales_invoices (header)"]
    E --> F["insert sales_invoice_items[]"]
    F -->|items fail| G["delete header (compensating)"]
```
</details>

### 7.3 Payment allocation (gunny & companies)
Payments are recorded once and **split across multiple records** via an allocations table:

```
seller_payment (₹50,000)
   ├─ allocation → gunny_bags A : ₹30,000
   └─ allocation → gunny_bags B : ₹20,000
```

This is the pattern behind the most recent feature work (allocation-based payment tracking).

---

## 8. Cross-cutting concerns

| Concern | Where | How |
|---------|-------|-----|
| Validation | `features/*/schemas` | Zod, parsed at every action boundary |
| Money math | `features/*/utils/calculations.ts` | Pure, recomputed server-side, unit-tested |
| Auth | `features/auth/lib/session.ts`, `proxy.ts` | JWT cookie + middleware + service guards |
| Env safety | `lib/env.ts` | Zod-validated at boot; throws on missing vars |
| Financial year | `lib/financial-year.ts` | Bill numbers & stats scoped per FY |
| Excel I/O | `lib/excel/`, `xlsx` | Import legacy data (`source='manual'`), export reports |
| Number/phone fmt | `lib/number-format.ts`, `lib/phone-format.ts` | Display + `+91` normalization |

---

## 9. Known limitations / production hardening backlog

These are documented so the trade-offs are explicit. None block a small, trusted-user deployment,
but they matter at scale.

1. **No Row-Level Security.** All access uses the service-role key; the DB is protected only by the
   app layer. Add RLS + anon key for defense in depth.
2. **Read-modify-write sequences** for `purchases`/`bilty` bill numbers (race-prone; relies on a
   unique-constraint error). Move to atomic sequences like `next_company_invoice_seq`.
3. **No multi-table transactions.** Invoice header+items uses a best-effort compensating delete;
   gunny payment+allocations can orphan a payment row on partial failure. Wrap in Postgres functions.
4. **No cache revalidation** (`revalidatePath`/`revalidateTag` unused) — freshness relies on refetch.
5. **Thin tests** — only pure calc functions are covered; services/actions/auth are untested.
6. **Inconsistent error surfacing** — most actions throw raw DB error strings to the client.
7. **`SESSION_SECRET` has a dev fallback default** — must hard-fail in production.

---

## 10. Directory reference

```
src/
├── app/                    # Routes (App Router): pages, actions.ts, api/
│   ├── api/                #   Route Handlers (auth, bilty, companies/profile)
│   └── <domain>/           #   page.tsx (RSC) + actions.ts ('use server')
├── features/<domain>/      # Domain logic
│   ├── schemas/            #   Zod schemas + types  (source of truth)
│   ├── utils/              #   pure calculations (+ .test.ts)
│   ├── service/            #   Supabase data access (server-only)
│   └── components/         #   client forms & tables
├── components/             # Shared UI (ui/, layout/, shared/, auth/)
├── lib/                    # env, supabase client, financial-year, excel, formatting
└── proxy.ts                # middleware: JWT gate + redirects
supabase/schema.sql         # full DDL + seed + RPC
docs/diagrams/              # diagram sources (.mmd) + rendered (.svg)
```

---

## 11. Regenerating the diagrams

Diagram sources are the `.mmd` files in [`docs/diagrams/`](diagrams/); the committed `.svg` files are
rendered output. To regenerate after editing a `.mmd`:

```bash
# one-time: mermaid-cli is installed as a devDependency
for f in docs/diagrams/*.mmd; do
  npx mmdc -i "$f" -o "${f%.mmd}.svg" \
    -c docs/diagrams/mermaid-theme.json -b transparent
done
```

> On macOS the renderer uses the system Chrome via a Puppeteer config
> (`executablePath` → `/Applications/Google Chrome.app/...`). Adjust for your OS if needed.
</content>
