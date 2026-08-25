create or replace function public.import_hu_nebih_regulatory_snapshot(
  p_rows jsonb,
  p_source_name text default 'Nébih – visszavont és lejárt szerek'
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  r jsonb;
  v_id uuid;
  v_name text;
  v_status text;
  v_withdrawal date;
  v_grace date;
  v_note text;
  v_url text;
  v_snapshot timestamptz;
  v_rows int := 0;
  v_inserted int := 0;
  v_updated int := 0;
begin
  if not (select app_private.is_advisor()) then
    raise exception 'Csak szaktanácsadó/admin frissítheti a Nébih státusz-snapshotot.';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'A snapshot adatnak JSON tömbnek kell lennie.';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_name := nullif(trim(coalesce(r->>'name','')),'');
    if v_name is null then continue; end if;
    v_rows := v_rows + 1;
    v_status := coalesce(nullif(r->>'regulatory_status',''),'unknown');
    if v_status not in ('authorized','withdrawn_grace','not_applicable','unknown') then v_status := 'unknown'; end if;
    v_withdrawal := nullif(r->>'withdrawal_effective_at','')::date;
    v_grace := nullif(r->>'grace_period_until','')::date;
    v_note := nullif(r->>'status_note','');
    v_url := nullif(r->>'source_url','');
    v_snapshot := coalesce(nullif(r->>'source_snapshot_at','')::timestamptz,now());

    select id into v_id from public.plant_protection_products
      where country_code='HU' and lower(name)=lower(v_name)
      order by created_at nulls last,id limit 1;

    if v_id is null then
      insert into public.plant_protection_products(
        country_code,name,active,regulatory_status,withdrawal_effective_at,grace_period_until,
        status_note,source_name,source_url,source_checked_at,source_snapshot_at
      ) values(
        'HU',v_name,true,v_status,v_withdrawal,v_grace,v_note,p_source_name,v_url,now(),v_snapshot
      ) returning id into v_id;
      v_inserted := v_inserted + 1;
    else
      update public.plant_protection_products set
        active=true,
        regulatory_status=v_status,
        withdrawal_effective_at=v_withdrawal,
        grace_period_until=v_grace,
        status_note=v_note,
        source_name=p_source_name,
        source_url=coalesce(v_url,source_url),
        source_checked_at=now(),
        source_snapshot_at=v_snapshot
      where id=v_id;
      v_updated := v_updated + 1;
    end if;
  end loop;

  insert into public.operation_catalog_sources(country_code,source_name,source_url,last_checked_at,last_imported_at,product_count,use_count,status,notes)
  values('HU',p_source_name,'https://portal.nebih.gov.hu/visszavont-es-lejart-ervenyessegu-novenyvedo-szerek',now(),now(),
    (select count(*) from public.plant_protection_products where country_code='HU'),
    (select count(*) from public.plant_protection_uses u join public.plant_protection_products p on p.id=u.product_id where p.country_code='HU'),
    'ready','Nébih nyilvános visszavont/lejárt snapshot frissítve; a hatályos engedélyokirat továbbra is irányadó.')
  on conflict (country_code) do update set
    source_name=excluded.source_name,source_url=excluded.source_url,last_checked_at=excluded.last_checked_at,
    last_imported_at=excluded.last_imported_at,product_count=excluded.product_count,use_count=excluded.use_count,
    status=excluded.status,notes=excluded.notes;

  return jsonb_build_object('rows',v_rows,'inserted_products',v_inserted,'updated_products',v_updated);
end $$;

revoke all on function public.import_hu_nebih_regulatory_snapshot(jsonb,text) from public,anon,authenticated;
grant execute on function public.import_hu_nebih_regulatory_snapshot(jsonb,text) to authenticated;
