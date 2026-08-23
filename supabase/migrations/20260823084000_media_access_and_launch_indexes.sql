drop policy if exists "Authenticated read inspection files" on storage.objects;
drop policy if exists "Farmers upload report files" on storage.objects;
drop policy if exists "Authenticated read report files" on storage.objects;

create policy "inspection media scoped read" on storage.objects
for select to authenticated
using (
  bucket_id='inspection-media'
  and (
    exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='advisor')
    or exists(
      select 1
      from public.inspection_media im
      join public.inspections i on i.id=im.inspection_id
      join public.fields fi on fi.id=i.field_id
      join public.farms f on f.id=fi.farm_id
      where im.storage_path=storage.objects.name
        and (
          f.owner_id=auth.uid()
          or exists(select 1 from public.farm_members fm where fm.farm_id=f.id and fm.user_id=auth.uid() and fm.active)
        )
    )
  )
);

create policy "report media scoped insert" on storage.objects
for insert to authenticated
with check (
  bucket_id='farmer-report-media'
  and (storage.foldername(name))[1]=(auth.uid())::text
);

create policy "report media scoped read" on storage.objects
for select to authenticated
using (
  bucket_id='farmer-report-media'
  and (
    exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='advisor')
    or (storage.foldername(name))[1]=(auth.uid())::text
    or exists(
      select 1
      from public.farmer_report_media frm
      join public.farmer_reports r on r.id=frm.report_id
      join public.fields fi on fi.id=r.field_id
      join public.farms f on f.id=fi.farm_id
      where frm.storage_path=storage.objects.name
        and (
          r.farmer_id=auth.uid()
          or f.owner_id=auth.uid()
          or exists(select 1 from public.farm_members fm where fm.farm_id=f.id and fm.user_id=auth.uid() and fm.active)
        )
    )
    or (
      (storage.foldername(name))[2]='task-proofs'
      and exists(
        select 1 from public.tasks t
        join public.farms f on f.id=t.farm_id
        where t.id::text=(storage.foldername(name))[3]
          and (
            t.assigned_to=auth.uid()
            or f.owner_id=auth.uid()
            or exists(select 1 from public.farm_members fm where fm.farm_id=f.id and fm.user_id=auth.uid() and fm.active and fm.member_role in ('manager','agronomist'))
          )
      )
    )
  )
);

create index if not exists documents_inspection_id_idx on public.documents(inspection_id);
create index if not exists documents_uploaded_by_idx on public.documents(uploaded_by);
create index if not exists farmer_reports_field_id_idx on public.farmer_reports(field_id);
create index if not exists farmer_reports_farmer_id_idx on public.farmer_reports(farmer_id);
create index if not exists farmer_report_media_report_id_idx on public.farmer_report_media(report_id);
create index if not exists inspection_media_inspection_id_idx on public.inspection_media(inspection_id);
create index if not exists inspections_previous_inspection_id_idx on public.inspections(previous_inspection_id);
create index if not exists machines_farm_id_idx on public.machines(farm_id);
create index if not exists machine_usage_logs_machine_id_idx on public.machine_usage_logs(machine_id);
create index if not exists machine_usage_logs_task_id_idx on public.machine_usage_logs(task_id);
create index if not exists machine_usage_logs_field_id_idx on public.machine_usage_logs(field_id);
create index if not exists task_machine_assignments_machine_id_idx on public.task_machine_assignments(machine_id);
create index if not exists tasks_created_by_idx on public.tasks(created_by);
create index if not exists timeline_events_created_by_idx on public.timeline_events(created_by);
