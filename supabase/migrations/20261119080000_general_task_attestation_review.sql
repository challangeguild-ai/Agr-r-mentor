-- A farm-wide, non-field general task needs no GPS or photo, but still requires
-- the same advisor review as a field-linked execution. The report is auditable
-- and the row lock makes duplicate submissions idempotent.
create or replace function public.submit_general_task_execution(
  p_task_id uuid,
  p_notes text,
  p_operation_date date
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_task public.tasks%rowtype;
  v_notes text := btrim(coalesce(p_notes, ''));
begin
  if v_actor is null then
    raise exception 'A munkamenet lejárt. Jelentkezz be újra.';
  end if;

  select * into v_task
  from public.tasks
  where id = p_task_id and assigned_to = v_actor
  for update;
  if not found then
    raise exception 'A teendő nem található vagy nincs hozzá jogosultságod.';
  end if;

  if v_task.task_kind <> 'general' or v_task.field_id is not null then
    raise exception 'Ez az igazolás csak földtábla nélküli, általános teendőhöz használható.';
  end if;

  if not exists (
    select 1 from public.farms f
    where f.id = v_task.farm_id and f.owner_id = v_actor
  ) and not exists (
    select 1 from public.farm_members fm
    where fm.farm_id = v_task.farm_id and fm.user_id = v_actor and fm.active
  ) then
    raise exception 'Nincs aktív gazdasági jogosultságod.';
  end if;

  if v_task.status in ('submitted', 'done') then
    return false;
  end if;
  if v_task.status not in ('open', 'in_progress') then
    raise exception 'Ez a teendő már nem küldhető be ellenőrzésre.';
  end if;
  if char_length(v_notes) < 3 or char_length(v_notes) > 1500 then
    raise exception 'A teljesítési megjegyzés 3–1500 karakter lehet.';
  end if;
  if p_operation_date is null or p_operation_date > (now() at time zone 'Europe/Budapest')::date then
    raise exception 'Érvénytelen teljesítési dátum.';
  end if;

  insert into public.task_execution_reports (
    task_id, reported_by, operation_date, notes, proof, review_status
  ) values (
    v_task.id, v_actor, p_operation_date, v_notes,
    'GENERAL_TASK_ATTESTATION:' || now()::text, 'pending'
  ) on conflict (task_id) do update set
    reported_by = excluded.reported_by,
    reported_at = now(),
    operation_date = excluded.operation_date,
    notes = excluded.notes,
    proof = excluded.proof,
    actual_dose = null,
    actual_area = null,
    actual_quantity = null,
    dose_unit = null,
    quantity_unit = null,
    weather = null,
    finished_hours = null,
    worked_hectares = null,
    review_status = 'pending',
    reviewed_by = null,
    reviewed_at = null,
    review_note = null,
    operation_id = null,
    updated_at = now();

  insert into public.timeline_events (
    farm_id, field_id, event_type, title, description, event_at, created_by, source_id
  ) values (
    v_task.farm_id, null, 'task_submitted_review',
    'Általános teendő ellenőrzésre beküldve: ' || v_task.title,
    v_notes, now(), v_actor, v_task.id
  );

  update public.tasks set
    status = 'submitted',
    review_status = 'pending',
    completed_at = null,
    reviewed_by = null,
    reviewed_at = null,
    review_note = null,
    linked_operation_id = null,
    updated_at = now()
  where id = v_task.id;

  return true;
end;
$$;

revoke all on function public.submit_general_task_execution(uuid,text,date) from public, anon, authenticated;
grant execute on function public.submit_general_task_execution(uuid,text,date) to authenticated;
