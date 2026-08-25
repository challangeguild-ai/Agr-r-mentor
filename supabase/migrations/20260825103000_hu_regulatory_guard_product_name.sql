create or replace function public.guard_hu_plant_protection_regulatory_status()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  p record;
begin
  if new.country_code <> 'HU' or new.operation_type not in ('spraying','plant_protection') then
    return new;
  end if;

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
    if found then
      new.product_id := p.id;
    end if;
  else
    return new;
  end if;

  -- Ismeretlen kézi terméknév esetén a meglévő kézi rögzítési út marad; ismert Nébih-terméknél kötelező a státuszvizsgálat.
  if not found then return new; end if;

  if p.valid_from is not null and new.operation_date < p.valid_from then
    raise exception 'A készítmény engedélye a művelet napján még nem volt hatályos.';
  end if;

  if p.regulatory_status='not_applicable' then
    if p.grace_period_until is null or new.operation_date > p.grace_period_until then
      raise exception 'A(z) % készítmény a művelet napján Magyarországon már nem alkalmazható.',p.name;
    end if;
  end if;

  if p.regulatory_status='withdrawn_grace' then
    if p.grace_period_until is null then
      raise exception 'A(z) % készítmény engedélye visszavont; a végső felhasználási határidő nem igazolt. Ellenőrizd a hatályos engedélyokiratot.',p.name;
    elsif new.operation_date > p.grace_period_until then
      raise exception 'A(z) % készítmény végső felhasználási türelmi ideje % napján lejárt, ezért ezen a műveleti dátumon nem alkalmazható.',p.name,p.grace_period_until;
    end if;
  end if;

  if p.regulatory_status='unknown' then
    raise exception 'A(z) % készítmény aktuális hatósági státusza nincs igazolva. Új kijuttatás csak ellenőrzött engedélyokirati adat után menthető.',p.name;
  end if;

  if p.valid_until is not null and new.operation_date > p.valid_until
     and (p.grace_period_until is null or new.operation_date > p.grace_period_until) then
    raise exception 'A(z) % készítmény engedélye/türelmi ideje a művelet napján már lejárt.',p.name;
  end if;

  return new;
end $$;

-- A product_name változására is fusson, ne csak product_id esetén.
drop trigger if exists guard_hu_plant_protection_regulatory_status on public.field_operations;
create trigger guard_hu_plant_protection_regulatory_status
before insert or update of operation_date,product_id,product_name,country_code,operation_type
on public.field_operations
for each row execute function public.guard_hu_plant_protection_regulatory_status();

revoke all on function public.guard_hu_plant_protection_regulatory_status() from public,anon,authenticated;
