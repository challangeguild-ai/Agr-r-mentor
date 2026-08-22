-- RLS for manager/agronomist dispatch and worker task workflow.
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='farm_members' and policyname='farm coordinators can read team') then
    create policy "farm coordinators can read team" on public.farm_members for select to authenticated
      using (
        exists(select 1 from public.farms f where f.id=farm_id and f.owner_id=auth.uid())
        or exists(select 1 from public.farm_members me where me.farm_id=farm_id and me.user_id=auth.uid() and me.active and me.member_role in ('manager','agronomist'))
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='tasks' and policyname='farm coordinators can create tasks') then
    create policy "farm coordinators can create tasks" on public.tasks for insert to authenticated
      with check (
        created_by=auth.uid() and (
          exists(select 1 from public.farms f where f.id=farm_id and f.owner_id=auth.uid())
          or exists(select 1 from public.farm_members me where me.farm_id=farm_id and me.user_id=auth.uid() and me.active and me.member_role in ('manager','agronomist'))
        ) and (
          assigned_to=(select owner_id from public.farms where id=farm_id)
          or exists(select 1 from public.farm_members fm where fm.farm_id=farm_id and fm.user_id=assigned_to and fm.active)
        )
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='tasks' and policyname='farm coordinators can read dispatched tasks') then
    create policy "farm coordinators can read dispatched tasks" on public.tasks for select to authenticated
      using (
        exists(select 1 from public.farms f where f.id=farm_id and f.owner_id=auth.uid())
        or exists(select 1 from public.farm_members me where me.farm_id=farm_id and me.user_id=auth.uid() and me.active and me.member_role in ('manager','agronomist'))
      );
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
