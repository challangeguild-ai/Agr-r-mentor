revoke execute on function public.can_coordinate_farm(uuid) from anon;
revoke execute on function public.is_active_farm_member(uuid,uuid) from anon;
revoke execute on function public.can_manage_farm(uuid) from anon;
revoke execute on function public.record_task_machine_usage(uuid,numeric,numeric) from anon;
revoke execute on function public.can_manage_farm(uuid) from public;
grant execute on function public.can_manage_farm(uuid) to authenticated;
