-- Append-only slice plan versions tied to a spec version.
create table if not exists public.slice_plans (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  spec_id     uuid not null references public.specs(id) on delete cascade,
  version     integer not null,
  payload     jsonb not null,
  accepted    boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (project_id, version)
);

create index if not exists slice_plans_project_idx on public.slice_plans (project_id, version desc);
