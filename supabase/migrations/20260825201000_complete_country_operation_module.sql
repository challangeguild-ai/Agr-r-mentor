-- Agrár Műveleti Modul – HU/SK országfüggő katalógus és szabályozási pillanatkép
-- Ez a migráció szándékosan nem töröl korábbi adatot; csak kiegészít és szigorít.

alter table public.field_operations
  add column if not exists catalog_snapshot jsonb not null default '{}'::jsonb;

create index if not exists field_operations_country_type_date_idx
  on public.field_operations(country_code, operation_type, operation_date desc);

create index if not exists operation_catalog_country_type_active_idx
  on public.operation_catalog(country_code, operation_type, active, sort_order, name);

-- Országspecifikus törzs: a HU/SK rekordok az alkalmazásban felülírják az azonos nevű ALL rekordot.
with seed(country_code, operation_type, category, name, sort_order, metadata) as (
  values
    ('HU','fertilizing','fertilizer','Karbamid 46% N',10,'{"N":46,"scope":"HU","kind":"mineral"}'::jsonb),
    ('HU','fertilizing','fertilizer','Mészammon-salétrom (MAS) 27% N',20,'{"N":27,"scope":"HU","kind":"mineral"}'::jsonb),
    ('HU','fertilizing','fertilizer','DAP 18-46',30,'{"N":18,"P2O5":46,"scope":"HU","kind":"mineral"}'::jsonb),
    ('HU','fertilizing','fertilizer','MAP 11-52',40,'{"N":11,"P2O5":52,"scope":"HU","kind":"mineral"}'::jsonb),
    ('HU','fertilizing','fertilizer','NPK 15-15-15',50,'{"N":15,"P2O5":15,"K2O":15,"scope":"HU","kind":"mineral"}'::jsonb),
    ('HU','fertilizing','fertilizer','NPK 8-20-30',60,'{"N":8,"P2O5":20,"K2O":30,"scope":"HU","kind":"mineral"}'::jsonb),
    ('HU','fertilizing','fertilizer','Kálium-klorid / kálisó 60% K₂O',70,'{"K2O":60,"scope":"HU","kind":"mineral"}'::jsonb),
    ('HU','fertilizing','fertilizer','Szerves trágya',80,'{"scope":"HU","kind":"organic","composition_required":true}'::jsonb),
    ('HU','fertilizing','fertilizer','Hígtrágya',90,'{"scope":"HU","kind":"organic","composition_required":true}'::jsonb),
    ('HU','fertilizing','fertilizer','Mésztrágya',100,'{"scope":"HU","kind":"soil_amendment","composition_required":true}'::jsonb),
    ('HU','fertilizing','fertilizer','Lombtrágya',110,'{"scope":"HU","kind":"foliar","composition_required":true}'::jsonb),

    ('SK','fertilizing','fertilizer','Karbamid 46% N',10,'{"N":46,"scope":"SK","kind":"mineral"}'::jsonb),
    ('SK','fertilizing','fertilizer','Mészammon-salétrom (MAS) 27% N',20,'{"N":27,"scope":"SK","kind":"mineral"}'::jsonb),
    ('SK','fertilizing','fertilizer','DAP 18-46',30,'{"N":18,"P2O5":46,"scope":"SK","kind":"mineral"}'::jsonb),
    ('SK','fertilizing','fertilizer','MAP 11-52',40,'{"N":11,"P2O5":52,"scope":"SK","kind":"mineral"}'::jsonb),
    ('SK','fertilizing','fertilizer','NPK 15-15-15',50,'{"N":15,"P2O5":15,"K2O":15,"scope":"SK","kind":"mineral"}'::jsonb),
    ('SK','fertilizing','fertilizer','NPK 8-20-30',60,'{"N":8,"P2O5":20,"K2O":30,"scope":"SK","kind":"mineral"}'::jsonb),
    ('SK','fertilizing','fertilizer','Kálium-klorid / kálisó 60% K₂O',70,'{"K2O":60,"scope":"SK","kind":"mineral"}'::jsonb),
    ('SK','fertilizing','fertilizer','Szerves trágya',80,'{"scope":"SK","kind":"organic","composition_required":true}'::jsonb),
    ('SK','fertilizing','fertilizer','Hígtrágya',90,'{"scope":"SK","kind":"organic","composition_required":true}'::jsonb),
    ('SK','fertilizing','fertilizer','Mésztrágya',100,'{"scope":"SK","kind":"soil_amendment","composition_required":true}'::jsonb),
    ('SK','fertilizing','fertilizer','Lombtrágya',110,'{"scope":"SK","kind":"foliar","composition_required":true}'::jsonb),

    ('HU','soil_work','method','Tarlóhántás',10,'{"scope":"HU"}'::jsonb),
    ('HU','soil_work','method','Tárcsázás',20,'{"scope":"HU"}'::jsonb),
    ('HU','soil_work','method','Boronálás',30,'{"scope":"HU"}'::jsonb),
    ('HU','soil_work','method','Kultivátorozás',40,'{"scope":"HU"}'::jsonb),
    ('HU','soil_work','method','Sekélyszántás',50,'{"scope":"HU"}'::jsonb),
    ('HU','soil_work','method','Szántás',60,'{"scope":"HU"}'::jsonb),
    ('HU','soil_work','method','Mélyszántás',70,'{"scope":"HU"}'::jsonb),
    ('HU','soil_work','method','Mélylazítás',80,'{"scope":"HU"}'::jsonb),
    ('HU','soil_work','method','Rotálás / rotációs művelés',90,'{"scope":"HU"}'::jsonb),
    ('HU','soil_work','method','Hengerezés',100,'{"scope":"HU"}'::jsonb),
    ('HU','soil_work','method','Magágykészítés',110,'{"scope":"HU"}'::jsonb),
    ('HU','soil_work','method','Sorközművelés',120,'{"scope":"HU"}'::jsonb),

    ('SK','soil_work','method','Tarlóhántás',10,'{"scope":"SK"}'::jsonb),
    ('SK','soil_work','method','Tárcsázás',20,'{"scope":"SK"}'::jsonb),
    ('SK','soil_work','method','Boronálás',30,'{"scope":"SK"}'::jsonb),
    ('SK','soil_work','method','Kultivátorozás',40,'{"scope":"SK"}'::jsonb),
    ('SK','soil_work','method','Sekélyszántás',50,'{"scope":"SK"}'::jsonb),
    ('SK','soil_work','method','Szántás',60,'{"scope":"SK"}'::jsonb),
    ('SK','soil_work','method','Mélyszántás',70,'{"scope":"SK"}'::jsonb),
    ('SK','soil_work','method','Mélylazítás',80,'{"scope":"SK"}'::jsonb),
    ('SK','soil_work','method','Rotálás / rotációs művelés',90,'{"scope":"SK"}'::jsonb),
    ('SK','soil_work','method','Hengerezés',100,'{"scope":"SK"}'::jsonb),
    ('SK','soil_work','method','Magágykészítés',110,'{"scope":"SK"}'::jsonb),
    ('SK','soil_work','method','Sorközművelés',120,'{"scope":"SK"}'::jsonb),

    ('HU','sowing','method','Vetés',10,'{"scope":"HU"}'::jsonb),
    ('HU','sowing','method','Direktvetés',20,'{"scope":"HU"}'::jsonb),
    ('HU','sowing','method','Ültetés',30,'{"scope":"HU"}'::jsonb),
    ('HU','sowing','method','Palántázás',40,'{"scope":"HU"}'::jsonb),
    ('SK','sowing','method','Vetés',10,'{"scope":"SK"}'::jsonb),
    ('SK','sowing','method','Direktvetés',20,'{"scope":"SK"}'::jsonb),
    ('SK','sowing','method','Ültetés',30,'{"scope":"SK"}'::jsonb),
    ('SK','sowing','method','Palántázás',40,'{"scope":"SK"}'::jsonb),

    ('HU','harvest','method','Aratás / kombájnos betakarítás',10,'{"scope":"HU"}'::jsonb),
    ('HU','harvest','method','Kézi betakarítás',20,'{"scope":"HU"}'::jsonb),
    ('HU','harvest','method','Gépi zöldségbetakarítás',30,'{"scope":"HU"}'::jsonb),
    ('SK','harvest','method','Aratás / kombájnos betakarítás',10,'{"scope":"SK"}'::jsonb),
    ('SK','harvest','method','Kézi betakarítás',20,'{"scope":"SK"}'::jsonb),
    ('SK','harvest','method','Gépi zöldségbetakarítás',30,'{"scope":"SK"}'::jsonb),

    ('HU','irrigation','method','Esőztető öntözés',10,'{"scope":"HU"}'::jsonb),
    ('HU','irrigation','method','Csepegtető öntözés',20,'{"scope":"HU"}'::jsonb),
    ('HU','irrigation','method','Lineár / center pivot',30,'{"scope":"HU"}'::jsonb),
    ('SK','irrigation','method','Esőztető öntözés',10,'{"scope":"SK"}'::jsonb),
    ('SK','irrigation','method','Csepegtető öntözés',20,'{"scope":"SK"}'::jsonb),
    ('SK','irrigation','method','Lineár / center pivot',30,'{"scope":"SK"}'::jsonb),

    ('HU','mowing','method','Kaszálás',10,'{"scope":"HU"}'::jsonb),
    ('HU','mowing','method','Szárzúzás',20,'{"scope":"HU"}'::jsonb),
    ('HU','mowing','method','Mulcsozás',30,'{"scope":"HU"}'::jsonb),
    ('SK','mowing','method','Kaszálás',10,'{"scope":"SK"}'::jsonb),
    ('SK','mowing','method','Szárzúzás',20,'{"scope":"SK"}'::jsonb),
    ('SK','mowing','method','Mulcsozás',30,'{"scope":"SK"}'::jsonb),

    ('HU','other','method','Növényápolás',10,'{"scope":"HU"}'::jsonb),
    ('HU','other','method','Bálázás',20,'{"scope":"HU"}'::jsonb),
    ('HU','other','method','Szállítás',30,'{"scope":"HU"}'::jsonb),
    ('SK','other','method','Növényápolás',10,'{"scope":"SK"}'::jsonb),
    ('SK','other','method','Bálázás',20,'{"scope":"SK"}'::jsonb),
    ('SK','other','method','Szállítás',30,'{"scope":"SK"}'::jsonb)
)
insert into public.operation_catalog(country_code,operation_type,category,name,sort_order,metadata,active)
select s.country_code,s.operation_type,s.category,s.name,s.sort_order,s.metadata,true
from seed s
where not exists (
  select 1 from public.operation_catalog c
  where c.country_code=s.country_code
    and c.operation_type=s.operation_type
    and lower(c.name)=lower(s.name)
);

create or replace function public.prepare_field_operation_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  p public.plant_protection_products%rowtype;
  u public.plant_protection_uses%rowtype;
  c public.operation_catalog%rowtype;
  v_ingredients text;
  v_candidate text;
begin
  -- A végrehajtott művelet dátuma nem lehet jövőbeli.
  if new.operation_date > current_date then
    raise exception 'A végrehajtott művelet dátuma nem lehet jövőbeli.';
  end if;

  if new.treated_area is not null and new.treated_area <= 0 then
    raise exception 'A kezelt területnek pozitívnak kell lennie.';
  end if;

  if new.operation_type in ('spraying','plant_protection') and new.product_id is not null then
    if new.plant_protection_use_id is null then
      raise exception 'Hivatalos növényvédő szerhez kötelező engedélyezett felhasználást választani.';
    end if;

    select * into p from public.plant_protection_products where id=new.product_id;
    if not found or not coalesce(p.active,false) then
      raise exception 'A kiválasztott növényvédő szer nem aktív vagy nem található.';
    end if;
    if p.country_code <> new.country_code then
      raise exception 'A növényvédő szer országa nem egyezik a gazdaság országával.';
    end if;
    if p.valid_from is not null and p.valid_from > new.operation_date then
      raise exception 'A készítmény engedélye a művelet napján még nem volt hatályos.';
    end if;
    if p.valid_until is not null and p.valid_until < new.operation_date then
      raise exception 'A készítmény engedélye a művelet napján már nem volt hatályos.';
    end if;

    select * into u from public.plant_protection_uses where id=new.plant_protection_use_id;
    if not found or u.product_id <> p.id then
      raise exception 'A kiválasztott felhasználás nem tartozik ehhez a készítményhez.';
    end if;

    if u.dose_unit is not null and new.dose_unit is not null
       and lower(trim(u.dose_unit)) <> lower(trim(new.dose_unit)) then
      raise exception 'A dózisegység nem egyezik a hivatalos felhasználás egységével.';
    end if;
    if new.dose is not null and u.dose_min is not null and new.dose < u.dose_min then
      raise exception 'A dózis kisebb a hivatalos minimumnál.';
    end if;
    if new.dose is not null and u.dose_max is not null and new.dose > u.dose_max then
      raise exception 'A dózis nagyobb a hivatalos maximumnál.';
    end if;

    select string_agg(
      ingredient || case when concentration is null then '' else ' ' || concentration::text || coalesce(' ' || concentration_unit,'') end,
      ', ' order by ingredient
    ) into v_ingredients
    from public.plant_protection_ingredients
    where product_id=p.id;

    new.product_name := p.name;
    new.authorization_number := p.authorization_number;
    new.crop := u.crop;
    new.target := u.target;
    new.active_ingredient := coalesce(nullif(v_ingredients,''),new.active_ingredient);
    new.official_dose_max := u.dose_max;
    new.regulatory_category := p.regulatory_category;
    new.catalog_mode := 'official';
    new.regulatory_snapshot := jsonb_strip_nulls(jsonb_build_object(
      'snapshot_at', now(),
      'country_code', p.country_code,
      'product_id', p.id,
      'product_name', p.name,
      'authorization_number', p.authorization_number,
      'function_type', p.function_type,
      'valid_from', p.valid_from,
      'valid_until', p.valid_until,
      'regulatory_category', p.regulatory_category,
      'regulatory_status', p.regulatory_status,
      'withdrawal_effective_at', p.withdrawal_effective_at,
      'grace_period_until', p.grace_period_until,
      'status_note', p.status_note,
      'professional_use_only', p.professional_use_only,
      'prescription_required', p.prescription_required,
      'approval_required', p.approval_required,
      'source_name', p.source_name,
      'source_url', p.source_url,
      'source_checked_at', p.source_checked_at,
      'use_id', u.id,
      'crop', u.crop,
      'target', u.target,
      'dose_min', u.dose_min,
      'dose_max', u.dose_max,
      'dose_unit', u.dose_unit,
      'application_method', u.application_method,
      'phi_days', u.phi_days,
      'bbch_min', u.bbch_min,
      'bbch_max', u.bbch_max,
      'max_applications', u.max_applications,
      'application_interval_days', u.application_interval_days,
      'water_volume_min', u.water_volume_min,
      'water_volume_max', u.water_volume_max,
      'water_volume_unit', u.water_volume_unit,
      'application_timing', u.application_timing,
      'restrictions', u.restrictions,
      'source_reference', u.source_reference,
      'active_ingredient', v_ingredients
    ));
  else
    -- Nem növényvédelmi művelet: készítsünk országfüggő katalóguspillanatképet.
    v_candidate := case when new.operation_type='fertilizing' then new.product_name else new.subtype end;
    if nullif(trim(coalesce(v_candidate,'')),'') is not null then
      select * into c
      from public.operation_catalog
      where country_code in (new.country_code,'ALL')
        and operation_type=new.operation_type
        and lower(name)=lower(v_candidate)
        and active=true
      order by case when country_code=new.country_code then 0 else 1 end, sort_order, id
      limit 1;

      if found then
        new.catalog_mode := 'catalog';
        new.composition := coalesce(c.metadata,'{}'::jsonb);
        new.catalog_snapshot := jsonb_strip_nulls(jsonb_build_object(
          'snapshot_at', now(),
          'catalog_id', c.id,
          'country_code', c.country_code,
          'operation_type', c.operation_type,
          'category', c.category,
          'name', c.name,
          'metadata', c.metadata
        ));
      end if;
    end if;
  end if;

  new.updated_at := now();
  return new;
end
$function$;

drop trigger if exists field_operations_prepare_snapshot on public.field_operations;
create trigger field_operations_prepare_snapshot
before insert or update of operation_date,operation_type,country_code,product_id,plant_protection_use_id,product_name,subtype,dose,dose_unit
on public.field_operations
for each row execute function public.prepare_field_operation_snapshot();

-- Adatminőségi nézet az admin ellenőrzéshez.
create or replace view public.plant_protection_catalog_quality as
select
  p.country_code,
  count(distinct p.id)::bigint as product_count,
  count(u.id)::bigint as use_count,
  count(u.id) filter (where nullif(trim(u.target),'') is not null)::bigint as with_target,
  count(u.id) filter (where u.dose_min is not null or u.dose_max is not null)::bigint as with_dose,
  count(u.id) filter (where u.bbch_min is not null or u.bbch_max is not null)::bigint as with_bbch,
  count(u.id) filter (where nullif(trim(u.source_reference),'') is not null)::bigint as with_source_reference,
  max(p.source_checked_at) as last_source_check
from public.plant_protection_products p
left join public.plant_protection_uses u on u.product_id=p.id
where p.active=true
group by p.country_code;

grant select on public.plant_protection_catalog_quality to authenticated;
