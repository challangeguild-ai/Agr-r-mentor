drop policy if exists "field operations select" on public.field_operations;
drop policy if exists "field operations insert" on public.field_operations;
drop policy if exists "field operations update" on public.field_operations;
drop policy if exists "field operations delete" on public.field_operations;

create policy "field operations select"
on public.field_operations for select to authenticated
using (
  (select app_private.is_advisor())
  or exists(select 1 from public.farms f where f.id=farm_id and f.owner_id=(select auth.uid()))
  or requested_approver_id=(select auth.uid())
);

create policy "field operations insert"
on public.field_operations for insert to authenticated
with check (
  created_by=(select auth.uid())
  and exists(select 1 from public.farms f where f.id=farm_id and f.owner_id=(select auth.uid()))
);

create policy "field operations update"
on public.field_operations for update to authenticated
using (
  (created_by=(select auth.uid()) and exists(select 1 from public.farms f where f.id=farm_id and f.owner_id=(select auth.uid())))
  or requested_approver_id=(select auth.uid())
)
with check (
  (created_by=(select auth.uid()) and exists(select 1 from public.farms f where f.id=farm_id and f.owner_id=(select auth.uid())))
  or requested_approver_id=(select auth.uid())
);

create policy "field operations delete"
on public.field_operations for delete to authenticated
using (
  created_by=(select auth.uid())
  and exists(select 1 from public.farms f where f.id=farm_id and f.owner_id=(select auth.uid()))
);

create or replace function public.enforce_field_operation_approval_actor()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_role text;
  auth_level text;
  auth_valid_until date;
  auth_active boolean;
  category text;
  approval_fields_changed boolean;
begin
  approval_fields_changed :=
    new.approval_status is distinct from old.approval_status
    or new.approved_by is distinct from old.approved_by
    or new.approved_at is distinct from old.approved_at
    or new.approver_name is distinct from old.approver_name
    or new.approval_note is distinct from old.approval_note;

  if not approval_fields_changed then
    return new;
  end if;

  select role into actor_role from public.profiles where id=actor;
  if actor_role='advisor' then
    raise exception 'A szaktanácsadó nem hagyhat jóvá gazdasági növényvédelmi műveletet.';
  end if;

  if old.approval_required is not true or old.requested_approver_id is distinct from actor then
    raise exception 'A művelet jóváhagyására ez a felhasználó nincs kijelölve.';
  end if;

  select authorization_level, valid_until, active
    into auth_level, auth_valid_until, auth_active
  from public.farm_plant_protection_approvers
  where farm_id=old.farm_id and user_id=actor
  limit 1;

  if auth_level is null or auth_active is not true or (auth_valid_until is not null and auth_valid_until < current_date) then
    raise exception 'A kijelölt személy növényvédelmi jogosultsága nem aktív vagy lejárt.';
  end if;

  category := upper(trim(coalesce(old.regulatory_category,'')));
  if category='I' and auth_level <> 'I' then
    raise exception 'I. kategóriájú művelethez I. kategóriájú jogosultság szükséges.';
  end if;
  if category='II' and auth_level not in ('I','II') then
    raise exception 'II. kategóriájú művelethez I. vagy II. kategóriájú jogosultság szükséges.';
  end if;

  if new.approval_status='approved' then
    new.approved_by := actor;
    new.approved_at := coalesce(new.approved_at, now());
    new.approval_basis := 'farm_plant_protection_approver';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_field_operation_approval_actor on public.field_operations;
create trigger enforce_field_operation_approval_actor
before update on public.field_operations
for each row execute function public.enforce_field_operation_approval_actor();
