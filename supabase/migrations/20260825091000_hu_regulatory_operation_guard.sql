create or replace function public.guard_hu_plant_protection_regulatory_status()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  p record;
begin
  if new.country_code <> 'HU' or new.product_id is null or new.operation_type not in ('spraying','plant_protection') then
    return new;
  end if;

  select regulatory_status, withdrawal_effective_at, grace_period_until, valid_from, valid_until, active, name
  into p
  from public.plant_protection_products
  where id=new.product_id and country_code='HU';

  if not found then
    raise exception 'A kiválasztott magyar növényvédő szer nem található a katalógusban.';
  end if;

  if p.valid_from is not null and new.operation_date < p.valid_from then
    raise exception 'A készítmény engedélye a művelet napján még nem volt hatályos.';
  end if;

  if p.regulatory_status='not_applicable' then
    if p.grace_period_until is null or new.operation_date > p.grace_period_until then
      raise exception 'A készítmény a művelet napján Magyarországon már nem alkalmazható.';
    end if;
  end if;

  if p.regulatory_status='withdrawn_grace' then
    if p.grace_period_until is null then
      raise exception 'A készítmény engedélye visszavont; a végső felhasználási határidő nem igazolt. Ellenőrizd a hatályos engedélyokiratot.';
    elsif new.operation_date > p.grace_period_until then
      raise exception 'A készítmény végső türelmi ideje a művelet napja előtt lejárt, ezért nem alkalmazható.';
    end if;
  end if;

  if p.regulatory_status='unknown' then
    raise exception 'A készítmény aktuális hatósági státusza nincs igazolva. Új kijuttatás csak ellenőrzött engedélyokirati adat után menthető.';
  end if;

  if p.valid_until is not null and new.operation_date > p.valid_until
     and (p.grace_period_until is null or new.operation_date > p.grace_period_until) then
    raise exception 'A készítmény engedélye/türelmi ideje a művelet napján már lejárt.';
  end if;

  return new;
end $$;

drop trigger if exists guard_hu_plant_protection_regulatory_status on public.field_operations;
create trigger guard_hu_plant_protection_regulatory_status
before insert or update of operation_date,product_id,country_code,operation_type
on public.field_operations
for each row execute function public.guard_hu_plant_protection_regulatory_status();

revoke all on function public.guard_hu_plant_protection_regulatory_status() from public,anon,authenticated;
