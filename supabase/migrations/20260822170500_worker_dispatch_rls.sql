-- RLS for manager/agronomist dispatch and worker task workflow.
-- SECURITY DEFINER helpers avoid recursive RLS evaluation on farm_members.
create or replace function public.can_coordinate_farm(target_farm uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(select 1 from public.farms f where f.id=target_farm and f.owner_id=auth.uid())
      or exists(select 1 from public.farm_members fm where fm.farm_id=target_farm and fm.user_id=auth.uid() and fm.active and fm.member_role in ('manager','agronomist'));
$$;

create or replace function public.is_active_farm_member(target_farm uuid,target_user uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(select 1 from public.farm_members fm where fm.farm_id=target_farm and fm.user_id=target_user and fm.active);
$$;

revoke all on function public.can_coordinate_farm(uuid) from public;
revoke all on function public.is_active_farm_member(uuid,uuid) from public;
grant execute on function public.can_coordinate_farm(uuid) to authenticated;
grant execute on function public.is_active_farm_member(uuid,uuid) to authenticated;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='farm_members' and policyname='farm coordinators can read team') then
    create policy "farm coordinators can read team" on public.farm_members for select to authenticated
      using (public.can_coordinate_farm(farm_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='tasks' and policyname='farm coordinators can create tasks') then
    create policy "farm coordinators can create tasks" on public.tasks for insert to authenticated
      with check (
        created_by=auth.uid()
        and public.can_coordinate_farm(farm_id)
        and (
          assigned_to=(select owner_id from public.farms where id=farm_id)
          or public.is_active_farm_member(farm_id,assigned_to)
        )
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='tasks' and policyname='farm coordinators can read dispatched tasks') then
    create policy "farm coordinators can read dispatched tasks" on public.tasks for select to authenticated
      using (public.can_coordinate_farm(farm_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='timeline_events' and policyname='workers can read own task workflow') then
    create policy "workers can read own task workflow" on public.timeline_events for select to authenticated
      using (source_id is not null and exists(select 1 from public.tasks t where t.id=source_id and t.assigned_to=auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='timeline_events' and policyname='workers can add own task workflow') then
    create policy "workers can add own task workflow" on public.timeline_events for insert to authenticated
      with check (
        created_by=auth.uid()
        and event_type in ('task_accepted','task_started','task_completed_verified')
        and source_id is not null
        and exists(select 1 from public.tasks t where t.id=source_id and t.assigned_to=auth.uid() and t.farm_id=farm_id)
      );
  end if;
end $$;
