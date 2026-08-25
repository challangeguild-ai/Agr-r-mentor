insert into public.field_operations(id,farm_id,field_id,operation_date,operation_type,country_code,subtype,notes,catalog_mode,created_by,created_at,updated_at)
select t.id,t.farm_id,t.field_id,(t.event_at at time zone 'UTC')::date,
  case
    when lower(t.title) like '%tarló%' then 'soil_work'
    when lower(t.title) like '%tápanyag%' then 'fertilizing'
    when lower(t.title) like '%gyom%' or lower(t.title) like '%állomány%' then 'plant_protection'
    else 'other'
  end,
  case when f.country_code='SK' then 'SK' else 'HU' end,
  t.title,t.description,'manual',t.created_by,t.event_at,now()
from public.timeline_events t
join public.farms f on f.id=t.farm_id
where t.event_type='field_operation' and t.source_id is null and t.field_id is not null and t.created_by is not null
on conflict (id) do nothing;

update public.timeline_events t
set source_id=t.id
where t.event_type='field_operation' and t.source_id is null
  and exists(select 1 from public.field_operations o where o.id=t.id);
