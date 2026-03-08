This is a [Next.js](https://nextjs.org) app with Supabase-backed auth, purchases, and bills.

## Setup

1. Create `.env.local` in project root:

```bash
SESSION_SECRET=replace_with_at_least_32_chars
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

2. Run Supabase SQL from `supabase/schema.sql` in your Supabase SQL Editor.

3. Install deps:

```bash
npm install
```

4. Start dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
