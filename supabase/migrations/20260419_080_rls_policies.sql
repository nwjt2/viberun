-- Enable RLS on all user-owned tables and apply a single, uniform policy:
-- a row is visible/mutable only to the user whose user_id matches auth.uid().

alter table public.projects            enable row level security;
alter table public.specs               enable row level security;
alter table public.slice_plans         enable row level security;
alter table public.slices              enable row level security;
alter table public.jobs                enable row level security;
alter table public.conversation_events enable row level security;
alter table public.companion_devices   enable row level security;

create policy projects_owner on public.projects
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy specs_owner on public.specs
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy slice_plans_owner on public.slice_plans
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy slices_owner on public.slices
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy jobs_owner on public.jobs
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy conversation_events_owner on public.conversation_events
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy companion_devices_owner on public.companion_devices
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());
