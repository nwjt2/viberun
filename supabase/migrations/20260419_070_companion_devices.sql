-- Heartbeat table. Companion upserts every N seconds; PWA's CompanionStatus
-- screen reads last_seen_at to tell the user whether their laptop is reachable.
create table if not exists public.companion_devices (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  label         text,
  version       text,
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists companion_devices_user_idx on public.companion_devices (user_id, last_seen_at desc);
