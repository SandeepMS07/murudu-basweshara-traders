# PB Manager

PB Manager is a [Next.js](https://nextjs.org) app for managing purchases, generating bills, and printing invoice copies.  
Data is stored in Supabase (Postgres).

## Features

- Login/logout with role-based access (`admin`, `operator`)
- Purchases CRUD
- Bill generation from purchases (idempotent: one purchase -> one bill id)
- Invoice preview in dialog
- Print invoice flow (A4 layout, dual copy print)
- Bills list with `Bill For`, `Due Date`, `Status`, `View Bill`
- Dashboard KPIs + analytics widgets

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Supabase (Postgres)
- React Hook Form + Zod
- shadcn/ui + Tailwind CSS

## Environment Variables

Create `.env` (or `.env.local`) in project root:

```bash
SESSION_SECRET=replace_with_at_least_32_chars
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

## Database Setup (Supabase)

1. Open Supabase project.
2. Go to SQL Editor.
3. Run:

```sql
-- file: supabase/schema.sql
```

This creates:
- `users`
- `purchases`
- `bills`

and seeds default users:
- `admin@gmail.com`
- `operator@gmail.com`

## Install & Run

```bash
npm install
npm run dev
```

Open: [http://localhost:3000](http://localhost:3000)

## Production Build

```bash
npm run build
npm run start
```

## Reset Login Password (Optional)

If you need to set a known password for seeded users:

```sql
update public.users
set password_hash = crypt('Admin@123', gen_salt('bf'))
where email in ('admin@gmail.com', 'operator@gmail.com');
```

Then login with:
- `admin@gmail.com / Admin@123`
- `operator@gmail.com / Admin@123`
