create or replace function public.complete_verified_task(
  p_task_id uuid,
  p_proof text,
  p_finished_hours numeric default null,
  p_worked_hectares numeric default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_task public.tasks%rowtype;
  v_has_machine boolean;
begin
  select * into v_task
  from public.tasks
  where id=p_task_id and assigned_to=auth.uid()
  for update;

  if not found then raise exception 'A teendő nem található vagy nincs hozzá jogosultságod'; end if;
  if v_task.status='done' then return; end if;
  if v_task.field_id is null then raise exception 'GPS-validált lezárás csak földtáblához kapcsolt munkánál használható'; end if;
  if coalesce(trim(p_proof),'')='' then raise exception 'Hiányzó munkavégzési igazolás'; end if;

  select exists(select 1 from public.task_machine_assignments a where a.task_id=p_task_id) into v_has_machine;
  if v_has_machine then
    perform public.record_task_machine_usage(p_task_id,p_finished_hours,p_worked_hectares);
  end if;

  insert into public.timeline_events(farm_id,field_id,event_type,title,description,event_at,created_by,source_id)
  values(v_task.farm_id,v_task.field_id,'task_completed_verified',concat('GPS-validált munka: ',v_task.title),p_proof,now(),auth.uid(),v_task.id);

  update public.tasks
  set status='done',completed_at=now(),updated_at=now()
  where id=v_task.id;
end;
$$;

revoke all on function public.complete_verified_task(uuid,text,numeric,numeric) from public;
revoke all on function public.complete_verified_task(uuid,text,numeric,numeric) from anon;
grant execute on function public.complete_verified_task(uuid,text,numeric,numeric) to authenticated;
