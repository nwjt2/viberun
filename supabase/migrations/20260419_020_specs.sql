-- Append-only spec versions. Never mutate an accepted row; write a new version.
create table if not exists public.specs (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  version     integer not null,
  payload     jsonb not null,
  accepted    boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (project_id, version)
);

create index if not exists specs_project_idx on public.specs (project_id, version desc);
