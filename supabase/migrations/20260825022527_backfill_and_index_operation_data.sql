create index if not exists pp_ingredients_product_idx on public.plant_protection_ingredients(product_id);

with parsed as (
  select t.id,t.farm_id,t.field_id,t.event_at,t.created_by,t.description,
         substring(t.description from 8)::jsonb as op,
         f.country_code
  from public.timeline_events t
  join public.farms f on f.id=t.farm_id
  where t.event_type='field_operation'
    and t.field_id is not null
    and t.created_by is not null
    and t.description like 'OPJSON:%'
    and t.source_id is null
), ins as (
  insert into public.field_operations(
    id,farm_id,field_id,operation_date,operation_type,country_code,subtype,
    product_name,authorization_number,crop,target,active_ingredient,dose,dose_unit,
    quantity,quantity_unit,treated_area,machine_name,operator_name,weather,notes,
    catalog_mode,created_by,created_at,updated_at
  )
  select
    p.id,p.farm_id,p.field_id,(p.event_at at time zone 'UTC')::date,p.op->>'type',
    case when p.country_code='SK' then 'SK' else 'HU' end,
    nullif(p.op->>'subtype',''),nullif(p.op->>'product',''),nullif(p.op->>'authorizationNumber',''),
    nullif(p.op->>'crop',''),nullif(p.op->>'target',''),nullif(p.op->>'activeIngredient',''),
    case when jsonb_typeof(p.op->'dose')='number' then (p.op->>'dose')::numeric else null end,
    nullif(p.op->>'doseUnit',''),
    case when jsonb_typeof(p.op->'quantity')='number' then (p.op->>'quantity')::numeric else null end,
    nullif(p.op->>'quantityUnit',''),
    case when jsonb_typeof(p.op->'treatedArea')='number' then (p.op->>'treatedArea')::numeric else null end,
    nullif(p.op->>'machine',''),nullif(p.op->>'operator',''),nullif(p.op->>'weather',''),nullif(p.op->>'notes',''),
    case when nullif(p.op->>'productId','') is not null then 'official' else 'manual' end,
    p.created_by,p.event_at,now()
  from parsed p
  where p.op->>'type' in ('spraying','plant_protection','fertilizing','sowing','soil_work','harvest','irrigation','mowing','other')
  on conflict (id) do nothing
  returning id
)
update public.timeline_events t set source_id=t.id
where t.id in (select id from parsed)
  and exists (select 1 from public.field_operations o where o.id=t.id);
