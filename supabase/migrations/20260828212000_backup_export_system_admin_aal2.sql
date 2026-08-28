-- Defense in depth for the full application backup RPC.
-- The HTTP route also requires a fresh step-up grant, but the RPC itself must
-- not allow an ordinary advisor or an AAL1 session to bypass that route.

create or replace function public.export_app_backup()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  if not app_private.is_system_admin() then
    raise exception 'Csak rendszeradminisztrátor készíthet biztonsági mentést.';
  end if;

  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'A biztonsági mentéshez kétfaktoros hitelesítés szükséges.';
  end if;

  select jsonb_build_object(
    'format', 'agrar-mentor-backup-v1',
    'created_at', now(),
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

revoke all on function public.export_app_backup() from public, anon;
grant execute on function public.export_app_backup() to authenticated, service_role;
