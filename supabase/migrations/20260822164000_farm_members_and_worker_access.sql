-- Multi-user farm membership for Agrár Mentor.
create table if not exists public.farm_members (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_role text not null default 'operator',
  active boolean not null default true,
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(farm_id,user_id),
  constraint farm_members_role_check check (member_role in ('manager','agronomist','operator','harvester'))
);

create index if not exists farm_members_user_idx on public.farm_members(user_id);
create index if not exists farm_members_farm_idx on public.farm_members(farm_id);

alter table public.farm_members enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='farm_members' and policyname='members can read own memberships') then
    create policy "members can read own memberships" on public.farm_members for select to authenticated
      using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='farm_members' and policyname='farm owners can manage memberships') then
    create policy "farm owners can manage memberships" on public.farm_members for all to authenticated
      using (exists(select 1 from public.farms f where f.id=farm_id and f.owner_id=auth.uid()))
      with check (exists(select 1 from public.farms f where f.id=farm_id and f.owner_id=auth.uid()));
  end if;
end $$;

-- Members need read access to the farm and its field geometry for their assigned work.
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='farms' and policyname='farm members can read farm') then
    create policy "farm members can read farm" on public.farms for select to authenticated
      using (exists(select 1 from public.farm_members fm where fm.farm_id=id and fm.user_id=auth.uid() and fm.active));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='fields' and policyname='farm members can read fields') then
    create policy "farm members can read fields" on public.fields for select to authenticated
      using (exists(select 1 from public.farm_members fm where fm.farm_id=farm_id and fm.user_id=auth.uid() and fm.active));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='tasks' and policyname='assigned workers can read tasks') then
    create policy "assigned workers can read tasks" on public.tasks for select to authenticated
      using (assigned_to=auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='tasks' and policyname='assigned workers can update tasks') then
    create policy "assigned workers can update tasks" on public.tasks for update to authenticated
      using (assigned_to=auth.uid()) with check (assigned_to=auth.uid());
  end if;
end $$;

comment on table public.farm_members is 'A gazdasághoz kapcsolt kisebb jogosultságú felhasználók: vezető, agronómus, gépkezelő, kombájnos.';
comment on column public.farm_members.member_role is 'manager, agronomist, operator vagy harvester.';
