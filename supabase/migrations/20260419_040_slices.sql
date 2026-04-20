-- One row per slice build attempt.
create table if not exists public.slices (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  slice_plan_id  uuid not null references public.slice_plans(id) on delete cascade,
  base_slice     text not null,
  status         text not null default 'pending', -- pending | in_progress | accepted | failed
  artifacts      jsonb,
  summary        text,
  preview_url    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists slices_project_idx on public.slices (project_id, created_at desc);
