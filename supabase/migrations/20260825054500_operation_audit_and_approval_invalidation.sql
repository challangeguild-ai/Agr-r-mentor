create table if not exists public.field_operation_audit_log (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.field_operations(id) on delete cascade,
  farm_id uuid not null references public.farms(id) on delete cascade,
  field_id uuid not null references public.fields(id) on delete cascade,
  action text not null check (action in ('created','updated','approval_requested','approved','approval_invalidated','deleted')),
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  snapshot jsonb not null default '{}'::jsonb,
  changed_fields text[] not null default '{}'::text[]
);
create index if not exists idx_field_operation_audit_operation on public.field_operation_audit_log(operation_id,changed_at desc);
create index if not exists idx_field_operation_audit_farm on public.field_operation_audit_log(farm_id,changed_at desc);
alter table public.field_operation_audit_log enable row level security;
drop policy if exists "operation audit select" on public.field_operation_audit_log;
create policy "operation audit select" on public.field_operation_audit_log for select to authenticated using (
  (select app_private.is_advisor())
  or exists(select 1 from public.farms f where f.id=field_operation_audit_log.farm_id and f.owner_id=(select auth.uid()))
  or exists(select 1 from public.farm_plant_protection_approvers a where a.farm_id=field_operation_audit_log.farm_id and a.user_id=(select auth.uid()) and a.active=true)
);
revoke insert,update,delete on public.field_operation_audit_log from authenticated;

create or replace function public.audit_field_operation_change() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_action text; v_fields text[] := '{}'::text[]; v_actor uuid := auth.uid();
begin
 if tg_op='INSERT' then
  v_action:=case when new.approval_required then 'approval_requested' else 'created' end;
  insert into public.field_operation_audit_log(operation_id,farm_id,field_id,action,changed_by,snapshot)
  values(new.id,new.farm_id,new.field_id,v_action,v_actor,to_jsonb(new));
  return new;
 elsif tg_op='UPDATE' then
  if old.approval_status is distinct from new.approval_status and new.approval_status='approved' then v_action:='approved';
  elsif old.approval_status='approved' and new.approval_status='pending' then v_action:='approval_invalidated';
  else v_action:='updated'; end if;
  select coalesce(array_agg(k),'{}'::text[]) into v_fields from jsonb_each(to_jsonb(new)) n(k,v) where (to_jsonb(old)->k) is distinct from v;
  insert into public.field_operation_audit_log(operation_id,farm_id,field_id,action,changed_by,snapshot,changed_fields)
  values(new.id,new.farm_id,new.field_id,v_action,v_actor,to_jsonb(new),v_fields);
  return new;
 else
  insert into public.field_operation_audit_log(operation_id,farm_id,field_id,action,changed_by,snapshot)
  values(old.id,old.farm_id,old.field_id,'deleted',v_actor,to_jsonb(old));
  return old;
 end if;
end $$;
revoke all on function public.audit_field_operation_change() from public,anon,authenticated;
drop trigger if exists audit_field_operation_change on public.field_operations;
create trigger audit_field_operation_change after insert or update or delete on public.field_operations for each row execute function public.audit_field_operation_change();

create or replace function public.invalidate_operation_approval_on_material_change() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
 if old.approval_status='approved' and (
  old.operation_date is distinct from new.operation_date or old.product_id is distinct from new.product_id or
  old.plant_protection_use_id is distinct from new.plant_protection_use_id or old.dose is distinct from new.dose or
  old.dose_unit is distinct from new.dose_unit or old.treated_area is distinct from new.treated_area or
  old.operator_name is distinct from new.operator_name or old.machine_id is distinct from new.machine_id
 ) then
  new.approval_status:='pending'; new.approved_by:=null; new.approved_at:=null;
 end if;
 return new;
end $$;
drop trigger if exists invalidate_operation_approval_on_material_change on public.field_operations;
create trigger invalidate_operation_approval_on_material_change before update on public.field_operations for each row execute function public.invalidate_operation_approval_on_material_change();