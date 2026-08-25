create table if not exists public.farm_plant_protection_approvers (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  authorization_level text not null check (authorization_level in ('I','II','III')),
  permit_number text,
  valid_until date,
  active boolean not null default true,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (farm_id, user_id)
);

comment on table public.farm_plant_protection_approvers is 'Gazdaság által kijelölt, növényvédelmi műveletek jóváhagyására jogosult személyek. A szaktanácsadói szerepkörtől független.';

alter table public.farm_plant_protection_approvers enable row level security;
grant select, insert, update, delete on public.farm_plant_protection_approvers to authenticated;

create index if not exists farm_pp_approvers_farm_active_idx on public.farm_plant_protection_approvers(farm_id, active);
create index if not exists farm_pp_approvers_user_idx on public.farm_plant_protection_approvers(user_id);

drop policy if exists "farm owners manage plant protection approvers" on public.farm_plant_protection_approvers;
create policy "farm owners manage plant protection approvers"
on public.farm_plant_protection_approvers
for all to authenticated
using (exists(select 1 from public.farms f where f.id=farm_id and f.owner_id=(select auth.uid())))
with check (exists(select 1 from public.farms f where f.id=farm_id and f.owner_id=(select auth.uid())));

drop policy if exists "designated approvers read own authorization" on public.farm_plant_protection_approvers;
create policy "designated approvers read own authorization"
on public.farm_plant_protection_approvers
for select to authenticated
using (user_id=(select auth.uid()));

alter table public.field_operations add column if not exists approval_basis text;
comment on column public.field_operations.approval_basis is 'A jóváhagyás jogalapja/szerepe. farm_plant_protection_approver esetén kizárólag gazdasági jogosult személy.';
