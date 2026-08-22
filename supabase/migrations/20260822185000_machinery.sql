create table if not exists public.machines (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  name text not null,
  machine_type text not null check (machine_type in ('tractor','combine','sprayer','implement','loader','other')),
  manufacturer text,
  model text,
  registration_no text,
  serial_no text,
  current_hours numeric(12,1),
  current_hectares numeric(12,2),
  service_interval_hours numeric(12,1),
  next_service_hours numeric(12,1),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_machine_assignments (
  task_id uuid primary key references public.tasks(id) on delete cascade,
  machine_id uuid not null references public.machines(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  assigned_by uuid not null references auth.users(id)
);

create table if not exists public.machine_usage_logs (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references public.machines(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  field_id uuid references public.fields(id) on delete set null,
  operator_id uuid references auth.users(id),
  started_hours numeric(12,1),
  finished_hours numeric(12,1),
  worked_hectares numeric(12,2),
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.machines enable row level security;
alter table public.task_machine_assignments enable row level security;
alter table public.machine_usage_logs enable row level security;

create or replace function public.can_manage_farm(target_farm uuid)
returns boolean language sql security definer set search_path=public stable as $$
  select exists(select 1 from public.farms f where f.id=target_farm and f.owner_id=auth.uid())
  or exists(select 1 from public.farm_members fm where fm.farm_id=target_farm and fm.user_id=auth.uid() and fm.active and fm.member_role in ('manager','agronomist'))
  or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='advisor');
$$;

create policy "farm team can read machines" on public.machines for select to authenticated using (
  public.can_manage_farm(farm_id) or exists(select 1 from public.farm_members fm where fm.farm_id=machines.farm_id and fm.user_id=auth.uid() and fm.active)
);
create policy "farm managers can insert machines" on public.machines for insert to authenticated with check (public.can_manage_farm(farm_id));
create policy "farm managers can update machines" on public.machines for update to authenticated using (public.can_manage_farm(farm_id)) with check (public.can_manage_farm(farm_id));

create policy "task participants can read machine assignment" on public.task_machine_assignments for select to authenticated using (
  exists(select 1 from public.tasks t where t.id=task_id and (t.assigned_to=auth.uid() or public.can_manage_farm(t.farm_id)))
);
create policy "farm managers can assign machines" on public.task_machine_assignments for insert to authenticated with check (
  exists(select 1 from public.tasks t where t.id=task_id and public.can_manage_farm(t.farm_id)) and assigned_by=auth.uid()
);
create policy "farm managers can change machine assignment" on public.task_machine_assignments for update to authenticated using (
  exists(select 1 from public.tasks t where t.id=task_id and public.can_manage_farm(t.farm_id))
);

create policy "task participants can read usage logs" on public.machine_usage_logs for select to authenticated using (
  operator_id=auth.uid() or exists(select 1 from public.machines m where m.id=machine_id and public.can_manage_farm(m.farm_id))
);
create policy "workers can add own usage logs" on public.machine_usage_logs for insert to authenticated with check (
  operator_id=auth.uid() and exists(select 1 from public.tasks t where t.id=task_id and t.assigned_to=auth.uid())
);
