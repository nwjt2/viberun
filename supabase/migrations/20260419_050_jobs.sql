-- The job queue. Mobile enqueues, Companion claims/completes.
create table if not exists public.jobs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  project_id    uuid references public.projects(id) on delete cascade,
  type          text not null,
  payload       jsonb not null,
  status        text not null default 'queued',    -- queued | claimed | running | done | failed
  claimed_by    uuid,
  claimed_at    timestamptz,
  heartbeat_at  timestamptz,
  result        jsonb,
  error         text,
  retries       integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists jobs_claim_idx on public.jobs (user_id, status, created_at);

-- Companion calls this RPC to claim the oldest queued job for the current
-- authenticated user. `for update skip locked` keeps correct behavior if the
-- user somehow runs two Companions at once.
create or replace function public.claim_next_job(device_id uuid)
returns setof public.jobs
language sql
security definer
set search_path = public
as $$
  update public.jobs
     set status = 'claimed',
         claimed_by = device_id,
         claimed_at = now(),
         heartbeat_at = now(),
         updated_at = now()
   where id = (
     select id from public.jobs
      where user_id = auth.uid() and status = 'queued'
      order by created_at
      for update skip locked
      limit 1
   )
  returning *;
$$;

revoke all on function public.claim_next_job(uuid) from public;
grant execute on function public.claim_next_job(uuid) to authenticated;
