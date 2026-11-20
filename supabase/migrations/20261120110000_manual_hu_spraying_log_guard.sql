-- A manual HU spray entry is a factual log, never an approved product/use record.
-- The legacy name-based regulatory lookup must not silently populate product_id:
-- that would bypass the product/use pair check in prepare_field_operation_snapshot.
create or replace function public.guard_hu_plant_protection_regulatory_status()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare
  p record;
begin
  if new.operation_type not in ('spraying','plant_protection') then return new; end if;

  if new.product_id is null then
    if new.country_code <> 'HU' then
      raise exception 'Növényvédelmi műveletnél ebben az országban kötelező a hivatalos készítmény és felhasználás.';
    end if;
    if exists (
      select 1 from public.plant_protection_uses u
      join public.plant_protection_products pp on pp.id=u.product_id
      where pp.country_code='HU'
    ) then
      raise exception 'A magyar engedélyezett felhasználási katalógus már tartalmaz adatokat; kézi naplózás előtt válassz ellenőrzött készítményt és felhasználást.';
    end if;
    if nullif(trim(coalesce(new.product_name,'')),'') is null
       or nullif(trim(coalesce(new.crop,'')),'') is null
       or new.dose is null or new.dose <= 0
       or nullif(trim(coalesce(new.dose_unit,'')),'') is null
       or new.dose_mode='official_max'
       or new.plant_protection_use_id is not null then
      raise exception 'Kézi növényvédelmi naplózáshoz szer, kultúra, pozitív tényleges dózis és mértékegység kell; hivatalos maximum nem választható.';
    end if;
    new.catalog_mode := 'manual';
    new.official_dose_max := null;
    new.authorization_number := null;
    new.regulatory_category := null;
    new.approval_required := false;
    new.approval_status := 'not_required';
    new.requested_approver_id := null;
    new.approver_name := null;
    new.approved_by := null;
    new.approved_at := null;
    new.approval_basis := null;
    new.approval_note := null;
    new.regulatory_snapshot := jsonb_build_object(
      'verification_status','not_verified',
      'source','user_reported_actual_application',
      'permit_check_required',true,
      'permit_search_url','https://novenyvedoszer.nebih.gov.hu/Engedelykereso/kereso'
    );
  end if;

  if new.country_code <> 'HU' then return new; end if;
  if new.product_id is not null then
    select id,regulatory_status,withdrawal_effective_at,grace_period_until,valid_from,valid_until,active,name
      into p from public.plant_protection_products
      where id=new.product_id and country_code='HU';
  elsif nullif(trim(coalesce(new.product_name,'')),'') is not null then
    select id,regulatory_status,withdrawal_effective_at,grace_period_until,valid_from,valid_until,active,name
      into p from public.plant_protection_products
      where country_code='HU' and lower(trim(name))=lower(trim(new.product_name))
      order by source_snapshot_at desc nulls last,source_checked_at desc nulls last,created_at desc nulls last
      limit 1;
    -- Deliberately leave product_id null for unverified manual entries.
  else
    return new;
  end if;
  if not found then return new; end if;
  if p.valid_from is not null and new.operation_date < p.valid_from then
    raise exception 'A készítmény engedélye a művelet napján még nem volt hatályos.';
  end if;
  if p.regulatory_status='not_applicable' and (p.grace_period_until is null or new.operation_date > p.grace_period_until) then
    raise exception 'A(z) % készítmény a művelet napján Magyarországon már nem alkalmazható.',p.name;
  end if;
  if p.regulatory_status='withdrawn_grace' then
    if p.grace_period_until is null then
      raise exception 'A(z) % készítmény engedélye visszavont; a végső felhasználási határidő nem igazolt. Ellenőrizd a hatályos engedélyokiratot.',p.name;
    elsif new.operation_date > p.grace_period_until then
      raise exception 'A(z) % készítmény végső felhasználási türelmi ideje % napján lejárt, ezért ezen a műveleti dátumon nem alkalmazható.',p.name,p.grace_period_until;
    end if;
  end if;
  if p.regulatory_status='unknown' then
    raise exception 'A(z) % készítmény aktuális hatósági státusza nincs igazolva. Ellenőrizd a hatályos engedélyokiratot.',p.name;
  end if;
  if p.valid_until is not null and new.operation_date > p.valid_until
     and (p.grace_period_until is null or new.operation_date > p.grace_period_until) then
    raise exception 'A(z) % készítmény engedélye/türelmi ideje a művelet napján már lejárt.',p.name;
  end if;
  return new;
end $$;

-- Keep the existing trigger and its name-based checks; replace only the function.
revoke all on function public.guard_hu_plant_protection_regulatory_status() from public,anon,authenticated;

-- Clients must fail closed until the guarded trigger is actually installed.
-- This capability marker is not an authorization decision; INSERT RLS and the
-- trigger above still enforce every operation after the marker is present.
create or replace function public.hu_manual_spraying_policy_version()
returns integer language sql stable security invoker set search_path=public,pg_temp
as $$ select 1 $$;
revoke all on function public.hu_manual_spraying_policy_version() from public,anon;
grant execute on function public.hu_manual_spraying_policy_version() to authenticated;
