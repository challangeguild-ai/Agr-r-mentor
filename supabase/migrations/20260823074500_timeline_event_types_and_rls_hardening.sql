-- Keep timeline event types aligned with implemented Agrár Mentor workflows.
alter table public.timeline_events drop constraint if exists timeline_events_event_type_check;
alter table public.timeline_events add constraint timeline_events_event_type_check check (event_type in (
  'inspection','inspection_followup','task','task_completed','task_accepted','task_started','task_completed_verified',
  'crop','note','document','farmer_report','advisor_reply','report_closed','field_operation','supervision_config','field_hotspot','advisor_visit_plan'
));

-- Fix ambiguous/self-referencing predicates from the first farm member migration.
drop policy if exists "farm members can read farm" on public.farms;
create policy "farm members can read farm" on public.farms for select to authenticated
using (exists(select 1 from public.farm_members fm where fm.farm_id=farms.id and fm.user_id=auth.uid() and fm.active));

drop policy if exists "farm members can read fields" on public.fields;
create policy "farm members can read fields" on public.fields for select to authenticated
using (exists(select 1 from public.farm_members fm where fm.farm_id=fields.farm_id and fm.user_id=auth.uid() and fm.active));

drop policy if exists "invitee can create own membership" on public.farm_members;
create policy "invitee can create own membership" on public.farm_members for insert to authenticated
with check (
  user_id=auth.uid()
  and exists(
    select 1 from public.farm_member_invites i
    where i.farm_id=farm_members.farm_id
      and lower(i.email)=lower(coalesce(auth.jwt()->>'email',''))
      and i.accepted_at is null
  )
);

drop policy if exists "workers can add own task workflow" on public.timeline_events;
create policy "workers can add own task workflow" on public.timeline_events for insert to authenticated
with check (
  created_by=auth.uid()
  and event_type in ('task_accepted','task_started','task_completed_verified')
  and source_id is not null
  and exists(
    select 1 from public.tasks t
    where t.id=timeline_events.source_id
      and t.assigned_to=auth.uid()
      and t.farm_id=timeline_events.farm_id
      and (timeline_events.field_id is null or timeline_events.field_id=t.field_id)
  )
);
