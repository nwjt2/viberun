-- One row per user project (app they're building).
create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  idea_payload  jsonb not null,
  -- Free-tier or paid-tier can plug in without schema change.
  status        text not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists projects_user_idx on public.projects (user_id, updated_at desc);
