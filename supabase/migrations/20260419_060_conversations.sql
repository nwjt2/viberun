-- Resume support: each meaningful UX step writes an event. On app open we
-- replay the most recent events to restore state.
create table if not exists public.conversation_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  project_id  uuid references public.projects(id) on delete cascade,
  kind        text not null,
  payload     jsonb not null,
  created_at  timestamptz not null default now()
);

create index if not exists conversation_events_project_idx
  on public.conversation_events (project_id, created_at);
