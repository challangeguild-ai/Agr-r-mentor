create or replace function public.plant_protection_use_coverage(p_country_code text)
returns table(
  uses bigint,
  dose bigint,
  bbch bigint,
  water bigint,
  restrictions bigint,
  timing bigint
)
language sql
stable
security invoker
set search_path=public
as $$
  select
    count(*)::bigint as uses,
    count(*) filter (where u.dose_max is not null or u.dose_min is not null)::bigint as dose,
    count(*) filter (where u.bbch_min is not null or u.bbch_max is not null)::bigint as bbch,
    count(*) filter (where u.water_volume_min is not null or u.water_volume_max is not null)::bigint as water,
    count(*) filter (where nullif(trim(u.restrictions),'') is not null)::bigint as restrictions,
    count(*) filter (where nullif(trim(u.application_timing),'') is not null)::bigint as timing
  from public.plant_protection_uses u
  join public.plant_protection_products p on p.id=u.product_id
  where p.country_code=p_country_code and p.active=true;
$$;

revoke all on function public.plant_protection_use_coverage(text) from public,anon;
grant execute on function public.plant_protection_use_coverage(text) to authenticated;
