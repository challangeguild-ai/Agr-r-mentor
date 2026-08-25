-- Planned operation -> execution -> advisor verification workflow
alter table public.tasks
  add column if not exists task_kind text not null default 'general',
  add column if not exists review_status text not null default 'not_required',
  add column if not exists reviewed_by uuid references auth.users(id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text,
  add column if not exists linked_operation_id uuid;

alter table public.tasks drop constraint if exists tasks_task_kind_check;
alter table public.tasks add constraint tasks_task_kind_check check (task_kind in ('general','operation'));
alter table public.tasks drop constraint if exists tasks_review_status_check;
alter table public.tasks add constraint tasks_review_status_check check (review_status in ('not_required','pending','approved','rejected'));

alter table public.field_operations
  add column if not exists source_task_id uuid references public.tasks(id) on delete set null;
create unique index if not exists field_operations_source_task_uidx on public.field_operations(source_task_id) where source_task_id is not null;

create table if not exists public.task_operation_plans (
  task_id uuid primary key references public.tasks(id) on delete cascade,
  country_code text not null check (country_code in ('HU','SK')),
  operation_type text not null,
  subtype text,
  product_id uuid references public.plant_protection_products(id) on delete set null,
  plant_protection_use_id uuid references public.plant_protection_uses(id) on delete set null,
  product_name text,
  authorization_number text,
  crop text,
  target text,
  active_ingredient text,
  planned_dose numeric,
  dose_min numeric,
  dose_max numeric,
  dose_unit text,
  planned_area numeric,
  planned_quantity numeric,
  quantity_unit text,
  application_method text,
  phi_days integer,
  bbch_min integer,
  bbch_max integer,
  max_applications integer,
  application_interval_days integer,
  water_volume_min numeric,
  water_volume_max numeric,
  water_volume_unit text,
  application_timing text,
  restrictions text,
  source_reference text,
  approval_required boolean not null default false,
  requested_approver_id uuid references auth.users(id),
  regulatory_snapshot jsonb not null default '{}'::jsonb,
  catalog_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_execution_reports (
  task_id uuid primary key references public.tasks(id) on delete cascade,
  reported_by uuid not null references auth.users(id),
  reported_at timestamptz not null default now(),
  operation_date date not null default current_date,
  actual_dose numeric,
  dose_unit text,
  actual_area numeric,
  actual_quantity numeric,
  quantity_unit text,
  weather text,
  notes text,
  proof text not null,
  finished_hours numeric,
  worked_hectares numeric,
  review_status text not null default 'pending' check (review_status in ('pending','approved','rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  operation_id uuid references public.field_operations(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists task_operation_plans_product_idx on public.task_operation_plans(product_id);
create index if not exists task_operation_plans_use_idx on public.task_operation_plans(plant_protection_use_id);
create index if not exists task_execution_reports_review_idx on public.task_execution_reports(review_status, reported_at desc);
create index if not exists tasks_review_status_idx on public.tasks(review_status,status,updated_at desc);

alter table public.task_operation_plans enable row level security;
alter table public.task_execution_reports enable row level security;

drop policy if exists "task plans advisor all" on public.task_operation_plans;
create policy "task plans advisor all" on public.task_operation_plans for all using ((select app_private.is_advisor())) with check ((select app_private.is_advisor()));
drop policy if exists "task plans involved read" on public.task_operation_plans;
create policy "task plans involved read" on public.task_operation_plans for select using (
  exists(select 1 from public.tasks t join public.farms f on f.id=t.farm_id where t.id=task_id and (t.assigned_to=auth.uid() or f.owner_id=auth.uid()))
);

drop policy if exists "execution reports advisor all" on public.task_execution_reports;
create policy "execution reports advisor all" on public.task_execution_reports for all using ((select app_private.is_advisor())) with check ((select app_private.is_advisor()));
drop policy if exists "execution reports assigned read" on public.task_execution_reports;
create policy "execution reports assigned read" on public.task_execution_reports for select using (
  reported_by=auth.uid() or exists(select 1 from public.tasks t join public.farms f on f.id=t.farm_id where t.id=task_id and (t.assigned_to=auth.uid() or f.owner_id=auth.uid()))
);

create or replace function public.submit_verified_task_execution(
  p_task_id uuid,
  p_proof text,
  p_operation_date date default current_date,
  p_actual_dose numeric default null,
  p_dose_unit text default null,
  p_actual_area numeric default null,
  p_actual_quantity numeric default null,
  p_quantity_unit text default null,
  p_weather text default null,
  p_notes text default null,
  p_finished_hours numeric default null,
  p_worked_hectares numeric default null
) returns void
language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_task public.tasks%rowtype; v_plan public.task_operation_plans%rowtype;
begin
  select * into v_task from public.tasks where id=p_task_id and assigned_to=auth.uid() for update;
  if not found then raise exception 'A teendő nem található vagy nincs hozzá jogosultságod'; end if;
  if v_task.status='done' then return; end if;
  if v_task.status='submitted' then raise exception 'A munka már ellenőrzésre be lett küldve'; end if;
  if v_task.field_id is null then raise exception 'GPS-validált lezárás csak földtáblához kapcsolt munkánál használható'; end if;
  if coalesce(trim(p_proof),'')='' then raise exception 'Hiányzó munkavégzési igazolás'; end if;
  select * into v_plan from public.task_operation_plans where task_id=p_task_id;
  if found and v_plan.operation_type in ('spraying','plant_protection') then
    if p_actual_dose is null then raise exception 'Növényvédelmi munkánál a tényleges dózis kötelező'; end if;
    if v_plan.dose_max is not null and p_actual_dose>v_plan.dose_max then raise exception 'A tényleges dózis meghaladja a hivatalos maximumot'; end if;
    if v_plan.dose_min is not null and p_actual_dose<v_plan.dose_min then raise exception 'A tényleges dózis kisebb a hivatalos minimum értéknél'; end if;
    if v_plan.dose_unit is not null and coalesce(nullif(trim(p_dose_unit),''),v_plan.dose_unit)<>v_plan.dose_unit then raise exception 'A dózisegység nem egyezik a hivatalos felhasználással'; end if;
  end if;
  insert into public.task_execution_reports(task_id,reported_by,operation_date,actual_dose,dose_unit,actual_area,actual_quantity,quantity_unit,weather,notes,proof,finished_hours,worked_hectares,review_status)
  values(v_task.id,auth.uid(),coalesce(p_operation_date,current_date),p_actual_dose,nullif(trim(p_dose_unit),''),p_actual_area,p_actual_quantity,nullif(trim(p_quantity_unit),''),nullif(trim(p_weather),''),nullif(trim(p_notes),''),p_proof,p_finished_hours,p_worked_hectares,'pending')
  on conflict(task_id) do update set reported_by=excluded.reported_by,reported_at=now(),operation_date=excluded.operation_date,actual_dose=excluded.actual_dose,dose_unit=excluded.dose_unit,actual_area=excluded.actual_area,actual_quantity=excluded.actual_quantity,quantity_unit=excluded.quantity_unit,weather=excluded.weather,notes=excluded.notes,proof=excluded.proof,finished_hours=excluded.finished_hours,worked_hectares=excluded.worked_hectares,review_status='pending',reviewed_by=null,reviewed_at=null,review_note=null,updated_at=now();
  insert into public.timeline_events(farm_id,field_id,event_type,title,description,event_at,created_by,source_id)
  values(v_task.farm_id,v_task.field_id,'task_submitted_review',concat('Munka ellenőrzésre beküldve: ',v_task.title),p_proof,now(),auth.uid(),v_task.id);
  update public.tasks set status='submitted',review_status='pending',completed_at=null,reviewed_by=null,reviewed_at=null,review_note=null,updated_at=now() where id=v_task.id;
end $$;

create or replace function public.review_task_execution(p_task_id uuid,p_approve boolean,p_note text default null)
returns uuid
language plpgsql security definer set search_path='public','pg_temp' as $$
declare
  v_task public.tasks%rowtype; v_plan public.task_operation_plans%rowtype; v_report public.task_execution_reports%rowtype;
  v_operation_id uuid; v_machine_id uuid; v_machine public.machines%rowtype; v_start numeric;
begin
  if not (select app_private.is_advisor()) then raise exception 'Szaktanácsadói jogosultság szükséges'; end if;
  select * into v_task from public.tasks where id=p_task_id for update;
  if not found then raise exception 'A teendő nem található'; end if;
  select * into v_report from public.task_execution_reports where task_id=p_task_id for update;
  if not found or v_task.status<>'submitted' then raise exception 'Nincs ellenőrzésre váró végrehajtás'; end if;
  select * into v_plan from public.task_operation_plans where task_id=p_task_id;
  if not p_approve then
    update public.task_execution_reports set review_status='rejected',reviewed_by=auth.uid(),reviewed_at=now(),review_note=nullif(trim(p_note),''),updated_at=now() where task_id=p_task_id;
    update public.tasks set status='open',review_status='rejected',reviewed_by=auth.uid(),reviewed_at=now(),review_note=nullif(trim(p_note),''),updated_at=now() where id=p_task_id;
    insert into public.timeline_events(farm_id,field_id,event_type,title,description,event_at,created_by,source_id) values(v_task.farm_id,v_task.field_id,'task_review_rejected',concat('Végrehajtás javításra visszaküldve: ',v_task.title),nullif(trim(p_note),''),now(),auth.uid(),v_task.id);
    return null;
  end if;

  if v_task.task_kind='operation' and v_task.field_id is not null and found then
    insert into public.field_operations(
      farm_id,field_id,operation_date,operation_type,country_code,subtype,product_id,plant_protection_use_id,product_name,authorization_number,crop,target,active_ingredient,
      dose,dose_unit,quantity,quantity_unit,treated_area,machine_id,machine_name,operator_name,weather,notes,catalog_mode,created_by,dose_mode,official_dose_max,
      approval_required,approval_status,requested_approver_id,regulatory_snapshot,catalog_snapshot,source_task_id
    ) values(
      v_task.farm_id,v_task.field_id,v_report.operation_date,v_plan.operation_type,v_plan.country_code,v_plan.subtype,v_plan.product_id,v_plan.plant_protection_use_id,v_plan.product_name,v_plan.authorization_number,v_plan.crop,v_plan.target,v_plan.active_ingredient,
      coalesce(v_report.actual_dose,v_plan.planned_dose),coalesce(v_report.dose_unit,v_plan.dose_unit),coalesce(v_report.actual_quantity,v_plan.planned_quantity),coalesce(v_report.quantity_unit,v_plan.quantity_unit),coalesce(v_report.actual_area,v_plan.planned_area),
      (select machine_id from public.task_machine_assignments where task_id=p_task_id limit 1),null,v_report.reported_by::text,v_report.weather,concat_ws(' · ',nullif(v_report.notes,''),nullif(p_note,'')),'planned_task',auth.uid(),case when v_report.actual_dose is null then null else 'executed' end,v_plan.dose_max,
      v_plan.approval_required,case when v_plan.approval_required then 'pending' else 'not_required' end,v_plan.requested_approver_id,v_plan.regulatory_snapshot,v_plan.catalog_snapshot,v_task.id
    ) returning id into v_operation_id;
  end if;

  select machine_id into v_machine_id from public.task_machine_assignments where task_id=p_task_id limit 1;
  if v_machine_id is not null then
    select * into v_machine from public.machines where id=v_machine_id for update;
    if found then
      v_start:=v_machine.current_hours;
      if v_report.finished_hours is not null and v_report.finished_hours<coalesce(v_start,0) then raise exception 'A záró üzemóra nem lehet kisebb a nyilvántartott értéknél'; end if;
      insert into public.machine_usage_logs(machine_id,task_id,field_id,operator_id,started_hours,finished_hours,worked_hectares,completed_at)
      values(v_machine.id,v_task.id,v_task.field_id,v_report.reported_by,v_start,v_report.finished_hours,v_report.worked_hectares,now())
      on conflict do nothing;
      update public.machines set current_hours=coalesce(v_report.finished_hours,current_hours),current_hectares=coalesce(current_hectares,0)+coalesce(v_report.worked_hectares,0),updated_at=now() where id=v_machine.id;
    end if;
  end if;

  update public.task_execution_reports set review_status='approved',reviewed_by=auth.uid(),reviewed_at=now(),review_note=nullif(trim(p_note),''),operation_id=v_operation_id,updated_at=now() where task_id=p_task_id;
  update public.tasks set status='done',review_status='approved',reviewed_by=auth.uid(),reviewed_at=now(),review_note=nullif(trim(p_note),''),linked_operation_id=v_operation_id,completed_at=now(),updated_at=now() where id=p_task_id;
  insert into public.timeline_events(farm_id,field_id,event_type,title,description,event_at,created_by,source_id) values(v_task.farm_id,v_task.field_id,'task_review_approved',concat('Végrehajtás visszaigazolva: ',v_task.title),nullif(trim(p_note),''),now(),auth.uid(),v_task.id);
  return v_operation_id;
end $$;

revoke all on function public.submit_verified_task_execution(uuid,text,date,numeric,text,numeric,numeric,text,text,text,numeric,numeric) from anon;
grant execute on function public.submit_verified_task_execution(uuid,text,date,numeric,text,numeric,numeric,text,text,text,numeric,numeric) to authenticated;
revoke all on function public.review_task_execution(uuid,boolean,text) from anon;
grant execute on function public.review_task_execution(uuid,boolean,text) to authenticated;
