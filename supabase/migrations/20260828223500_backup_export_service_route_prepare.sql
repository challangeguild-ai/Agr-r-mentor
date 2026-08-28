create or replace function public.export_app_backup_service(p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = p_actor and p.role = 'advisor' and p.system_role = 'admin'
  ) then
    raise exception 'Csak rendszeradminisztrátor készíthet biztonsági mentést.';
  end if;

  select jsonb_build_object(
    'format', 'agrar-mentor-backup-v1',
    'created_at', now(),
    'actor_user_id', p_actor,
    'data', jsonb_build_object(
      'profiles', (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) from public.profiles t),
      'farms', (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) from public.farms t),
      'fields', (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) from public.fields t),
      'inspections', (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) from public.inspections t),
      'inspection_media', (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) from public.inspection_media t),
      'tasks', (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) from public.tasks t),
      'timeline_events', (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) from public.timeline_events t),
      'farmer_reports', (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) from public.farmer_reports t),
      'farmer_report_media', (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) from public.farmer_report_media t),
      'documents', (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) from public.documents t),
      'farm_members', (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) from public.farm_members t),
      'farm_member_invites', (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) from public.farm_member_invites t),
      'machines', (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) from public.machines t),
      'machine_usage_logs', (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) from public.machine_usage_logs t),
      'notifications', (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) from public.notifications t)
    ),
    'storage_manifest', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'bucket_id', bucket_id,
        'name', name,
        'metadata', metadata,
        'created_at', created_at,
        'updated_at', updated_at
      ) order by bucket_id, name), '[]'::jsonb)
      from storage.objects
      where bucket_id in ('documents','inspection-media','farmer-report-media')
    ),
    'notes', jsonb_build_array(
      'A mentés nem tartalmaz auth jelszavakat vagy titkos API kulcsokat.',
      'A storage_manifest a feltöltött fájlok listáját tartalmazza, magukat a fájlbytes-okat nem.'
    )
  ) into result;
  return result;
end;
$$;

revoke all on function public.export_app_backup_service(uuid) from public, anon, authenticated;
grant execute on function public.export_app_backup_service(uuid) to service_role;
