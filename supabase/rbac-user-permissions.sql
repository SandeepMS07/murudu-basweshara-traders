-- RBAC: per-user, per-module access levels.
-- Run once in the Supabase SQL editor (production, then local).
--
-- Model:
--   users.role = 'admin'  -> full access to everything + Users management
--   users.role = 'operator' -> access driven entirely by user_permissions below
--   level: 'none' (hidden) | 'view' (read only) | 'edit' (full create/edit/delete)

create table if not exists public.user_permissions (
  user_id    uuid not null references public.users(id) on delete cascade,
  module     text not null,
  level      text not null check (level in ('none', 'view', 'edit')) default 'none',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, module)
);

create index if not exists idx_user_permissions_user_id
  on public.user_permissions (user_id);
