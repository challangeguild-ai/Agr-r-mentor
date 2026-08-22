create or replace function public.record_task_machine_usage(p_task_id uuid, p_finished_hours numeric, p_worked_hectares numeric)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_task public.tasks%rowtype;
  v_assignment public.task_machine_assignments%rowtype;
  v_machine public.machines%rowtype;
  v_start numeric;
begin
  select * into v_task from public.tasks where id=p_task_id and assigned_to=auth.uid();
  if not found then raise exception 'Nincs jogosultság a feladathoz'; end if;
  select * into v_assignment from public.task_machine_assignments where task_id=p_task_id;
  if not found then return; end if;
  select * into v_machine from public.machines where id=v_assignment.machine_id for update;
  if not found then raise exception 'A hozzárendelt gép nem található'; end if;
  if v_machine.farm_id<>v_task.farm_id then raise exception 'A gép nem ehhez a gazdasághoz tartozik'; end if;
  v_start:=v_machine.current_hours;
  if p_finished_hours is not null and p_finished_hours<coalesce(v_start,0) then raise exception 'A záró üzemóra nem lehet kisebb a nyilvántartott értéknél'; end if;
  if p_worked_hectares is not null and p_worked_hectares<0 then raise exception 'A hektár nem lehet negatív'; end if;
  insert into public.machine_usage_logs(machine_id,task_id,field_id,operator_id,started_hours,finished_hours,worked_hectares,completed_at)
  values(v_machine.id,v_task.id,v_task.field_id,auth.uid(),v_start,p_finished_hours,p_worked_hectares,now());
  update public.machines set
    current_hours=coalesce(p_finished_hours,current_hours),
    current_hectares=coalesce(current_hectares,0)+coalesce(p_worked_hectares,0),
    updated_at=now()
  where id=v_machine.id;
end;
$$;
revoke all on function public.record_task_machine_usage(uuid,numeric,numeric) from public;
grant execute on function public.record_task_machine_usage(uuid,numeric,numeric) to authenticated;
