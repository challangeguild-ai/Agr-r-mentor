-- Production-safe rollout for detailed Slovak (ÚKSÚP/ISPOR) plant-protection uses.
-- This migration is intentionally new instead of relying on edits to an older migration that may already have been applied.

alter table public.plant_protection_uses
  add column if not exists bbch_min integer,
  add column if not exists bbch_max integer,
  add column if not exists max_applications integer,
  add column if not exists application_interval_days integer,
  add column if not exists water_volume_min numeric,
  add column if not exists water_volume_max numeric,
  add column if not exists water_volume_unit text,
  add column if not exists application_timing text,
  add column if not exists restrictions text,
  add column if not exists source_reference text;

alter table public.field_operations
  add column if not exists regulatory_snapshot jsonb not null default '{}'::jsonb;

create index if not exists plant_protection_uses_crop_target_idx
  on public.plant_protection_uses (lower(crop), lower(coalesce(target,'')));

create index if not exists plant_protection_uses_product_crop_target_idx
  on public.plant_protection_uses (product_id, lower(crop), lower(coalesce(target,'')));

do $$
begin
  if not exists (select 1 from pg_constraint where conname='plant_protection_uses_bbch_min_check') then
    alter table public.plant_protection_uses add constraint plant_protection_uses_bbch_min_check check (bbch_min is null or bbch_min between 0 and 99);
  end if;
  if not exists (select 1 from pg_constraint where conname='plant_protection_uses_bbch_max_check') then
    alter table public.plant_protection_uses add constraint plant_protection_uses_bbch_max_check check (bbch_max is null or bbch_max between 0 and 99);
  end if;
  if not exists (select 1 from pg_constraint where conname='plant_protection_uses_bbch_order_check') then
    alter table public.plant_protection_uses add constraint plant_protection_uses_bbch_order_check check (bbch_min is null or bbch_max is null or bbch_min <= bbch_max);
  end if;
  if not exists (select 1 from pg_constraint where conname='plant_protection_uses_max_applications_check') then
    alter table public.plant_protection_uses add constraint plant_protection_uses_max_applications_check check (max_applications is null or max_applications > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname='plant_protection_uses_interval_check') then
    alter table public.plant_protection_uses add constraint plant_protection_uses_interval_check check (application_interval_days is null or application_interval_days >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname='plant_protection_uses_water_min_check') then
    alter table public.plant_protection_uses add constraint plant_protection_uses_water_min_check check (water_volume_min is null or water_volume_min >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname='plant_protection_uses_water_max_check') then
    alter table public.plant_protection_uses add constraint plant_protection_uses_water_max_check check (water_volume_max is null or water_volume_max >= 0);
  end if;
end $$;

create or replace function public.import_plant_protection_catalog(
  p_country_code text,
  p_source_name text,
  p_source_url text,
  p_rows jsonb,
  p_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  r jsonb;
  v_product_id uuid; v_use_id uuid;
  v_name text; v_auth text; v_category text; v_function text;
  v_crop text; v_target text; v_dose_min numeric; v_dose_max numeric; v_dose_unit text; v_method text; v_phi integer;
  v_ingredient text; v_concentration numeric; v_concentration_unit text;
  v_bbch_min integer; v_bbch_max integer; v_max_applications integer; v_interval integer;
  v_water_min numeric; v_water_max numeric; v_water_unit text; v_timing text; v_restrictions text; v_source_reference text;
  v_products int:=0; v_uses int:=0; v_updated_uses int:=0; v_ingredients int:=0; v_rows int:=0; v_batch uuid;
begin
  if not (select app_private.is_advisor()) then
    raise exception 'Csak szaktanácsadó/admin indíthat hivatalos katalógusimportot.';
  end if;
  if p_country_code not in ('HU','SK') then raise exception 'Érvénytelen országkód.'; end if;
  if jsonb_typeof(p_rows)<>'array' then raise exception 'Az importadatnak JSON tömbnek kell lennie.'; end if;

  insert into public.plant_protection_import_batches(country_code,source_name,source_url,imported_by,row_count,notes)
  values(p_country_code,coalesce(nullif(p_source_name,''),'Hivatalos növényvédőszer-adatforrás'),p_source_url,auth.uid(),jsonb_array_length(p_rows),p_notes)
  returning id into v_batch;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_rows:=v_rows+1;
    v_name:=nullif(trim(coalesce(r->>'name',r->>'product_name',r->>'keszitmeny',r->>'novenyvedo_szer_neve',r->>'obchodny_nazov_pripravku')),'');
    v_auth:=nullif(trim(coalesce(r->>'authorization_number',r->>'engedelyszam',r->>'engedely_szama',r->>'cislo_autorizacie')),'');
    if v_name is null then continue; end if;

    v_category:=nullif(trim(coalesce(r->>'regulatory_category',r->>'forgalmazasi_kategoria',r->>'forg_kategoria',r->>'kategoria')),'');
    v_function:=nullif(trim(coalesce(r->>'function_type',r->>'rendeltetes',r->>'typ_funkcie_pripravku')),'');

    select id into v_product_id
    from public.plant_protection_products
    where country_code=p_country_code
      and ((v_auth is not null and authorization_number=v_auth) or (v_auth is null and lower(name)=lower(v_name)))
    order by source_checked_at nulls last,id
    limit 1;

    if v_product_id is null then
      insert into public.plant_protection_products(country_code,name,authorization_number,function_type,regulatory_category,professional_use_only,prescription_required,approval_required,active,source_name,source_checked_at)
      values(
        p_country_code,v_name,v_auth,v_function,v_category,
        case when p_country_code='HU' and upper(replace(coalesce(v_category,''),'.','')) in ('I','II') then true else false end,
        false,
        case when p_country_code='HU' and upper(replace(coalesce(v_category,''),'.','')) in ('I','II') then true else false end,
        true,p_source_name,now()
      ) returning id into v_product_id;
      v_products:=v_products+1;
    else
      update public.plant_protection_products set
        name=v_name,
        authorization_number=coalesce(v_auth,authorization_number),
        function_type=coalesce(v_function,function_type),
        regulatory_category=coalesce(v_category,regulatory_category),
        professional_use_only=case when p_country_code='HU' and upper(replace(coalesce(v_category,regulatory_category,''),'.','')) in ('I','II') then true else professional_use_only end,
        approval_required=case when p_country_code='HU' and upper(replace(coalesce(v_category,regulatory_category,''),'.','')) in ('I','II') then true else approval_required end,
        active=true,source_name=p_source_name,source_checked_at=now()
      where id=v_product_id;
    end if;

    v_crop:=nullif(trim(coalesce(r->>'crop',r->>'kultura',r->>'plodina',r->>'plodina_alebo_oblast_pouzitia')),'');
    v_target:=nullif(trim(coalesce(r->>'target',r->>'karosito',r->>'cel',r->>'skodlivy_organizmus_alebo_iny_ucel_pouzitia')),'');
    v_dose_min:=nullif(regexp_replace(replace(coalesce(r->>'dose_min',r->>'dozis_min',''),',','.'),'[^0-9.]','','g'),'')::numeric;
    v_dose_max:=nullif(regexp_replace(replace(coalesce(r->>'dose_max',r->>'dozis_max',r->>'max_dozis',''),',','.'),'[^0-9.]','','g'),'')::numeric;
    v_dose_unit:=nullif(trim(coalesce(r->>'dose_unit',r->>'dozis_egyseg',r->>'jednotka_davky')),'');
    v_method:=nullif(trim(coalesce(r->>'application_method',r->>'kijuttatas_modja',r->>'sposob_aplikacie')),'');
    v_phi:=nullif(regexp_replace(coalesce(r->>'phi_days',r->>'evi',r->>'varakozasi_ido',''),'[^0-9]','','g'),'')::integer;
    v_bbch_min:=nullif(regexp_replace(coalesce(r->>'bbch_min',r->>'rastova_faza_od',''),'[^0-9]','','g'),'')::integer;
    v_bbch_max:=nullif(regexp_replace(coalesce(r->>'bbch_max',r->>'rastova_faza_do',''),'[^0-9]','','g'),'')::integer;
    v_max_applications:=nullif(regexp_replace(coalesce(r->>'max_applications',r->>'maximalny_pocet_aplikacii',''),'[^0-9]','','g'),'')::integer;
    v_interval:=nullif(regexp_replace(coalesce(r->>'application_interval_days',r->>'interval_medzi_aplikaciami',''),'[^0-9]','','g'),'')::integer;
    v_water_min:=nullif(regexp_replace(replace(coalesce(r->>'water_volume_min',r->>'mnozstvo_vody_min',''),',','.'),'[^0-9.]','','g'),'')::numeric;
    v_water_max:=nullif(regexp_replace(replace(coalesce(r->>'water_volume_max',r->>'mnozstvo_vody_max',''),',','.'),'[^0-9.]','','g'),'')::numeric;
    v_water_unit:=nullif(trim(coalesce(r->>'water_volume_unit',r->>'jednotka_mnozstva_vody')),'');
    v_timing:=nullif(trim(coalesce(r->>'application_timing',r->>'termin_aplikacie',r->>'termin_pouzitia')),'');
    v_restrictions:=nullif(trim(coalesce(r->>'restrictions',r->>'obmedzenia',r->>'poznamka_k_pouzitiu')),'');
    v_source_reference:=nullif(trim(coalesce(r->>'source_reference',r->>'zdrojovy_odkaz',r->>'rozhodnutie')),'');

    if v_bbch_min is not null and (v_bbch_min < 0 or v_bbch_min > 99) then v_bbch_min:=null; end if;
    if v_bbch_max is not null and (v_bbch_max < 0 or v_bbch_max > 99) then v_bbch_max:=null; end if;
    if v_bbch_min is not null and v_bbch_max is not null and v_bbch_min > v_bbch_max then
      v_bbch_min:=null; v_bbch_max:=null;
    end if;
    if v_max_applications is not null and v_max_applications <= 0 then v_max_applications:=null; end if;
    if v_interval is not null and v_interval < 0 then v_interval:=null; end if;
    if v_water_min is not null and v_water_min < 0 then v_water_min:=null; end if;
    if v_water_max is not null and v_water_max < 0 then v_water_max:=null; end if;

    if v_crop is not null then
      select id into v_use_id
      from public.plant_protection_uses
      where product_id=v_product_id
        and lower(crop)=lower(v_crop)
        and coalesce(lower(target),'')=coalesce(lower(v_target),'')
        and coalesce(dose_max,-1)=coalesce(v_dose_max,-1)
        and coalesce(lower(dose_unit),'')=coalesce(lower(v_dose_unit),'')
        and coalesce(lower(application_method),'')=coalesce(lower(v_method),'')
        and coalesce(bbch_min,-1)=coalesce(v_bbch_min,-1)
        and coalesce(bbch_max,-1)=coalesce(v_bbch_max,-1)
      limit 1;

      if v_use_id is null then
        insert into public.plant_protection_uses(
          product_id,crop,target,dose_min,dose_max,dose_unit,application_method,phi_days,notes,
          bbch_min,bbch_max,max_applications,application_interval_days,water_volume_min,water_volume_max,
          water_volume_unit,application_timing,restrictions,source_reference
        ) values(
          v_product_id,v_crop,v_target,v_dose_min,v_dose_max,v_dose_unit,v_method,v_phi,p_source_name,
          v_bbch_min,v_bbch_max,v_max_applications,v_interval,v_water_min,v_water_max,
          v_water_unit,v_timing,v_restrictions,v_source_reference
        ) returning id into v_use_id;
        v_uses:=v_uses+1;
      else
        update public.plant_protection_uses set
          dose_min=coalesce(v_dose_min,dose_min),dose_max=coalesce(v_dose_max,dose_max),dose_unit=coalesce(v_dose_unit,dose_unit),
          application_method=coalesce(v_method,application_method),phi_days=coalesce(v_phi,phi_days),notes=p_source_name,
          bbch_min=coalesce(v_bbch_min,bbch_min),bbch_max=coalesce(v_bbch_max,bbch_max),
          max_applications=coalesce(v_max_applications,max_applications),application_interval_days=coalesce(v_interval,application_interval_days),
          water_volume_min=coalesce(v_water_min,water_volume_min),water_volume_max=coalesce(v_water_max,water_volume_max),
          water_volume_unit=coalesce(v_water_unit,water_volume_unit),application_timing=coalesce(v_timing,application_timing),
          restrictions=coalesce(v_restrictions,restrictions),source_reference=coalesce(v_source_reference,source_reference)
        where id=v_use_id;
        v_updated_uses:=v_updated_uses+1;
      end if;
    end if;

    v_ingredient:=nullif(trim(coalesce(r->>'ingredient',r->>'hatoanyag',r->>'hatoanyag_osszetetel',r->>'nazov_ucinnej_latky')),'');
    if v_ingredient is not null and not exists(
      select 1 from public.plant_protection_ingredients where product_id=v_product_id and lower(ingredient)=lower(v_ingredient)
    ) then
      v_concentration:=nullif(regexp_replace(replace(coalesce(r->>'concentration',r->>'hatoanyag_mennyiseg',''),',','.'),'[^0-9.]','','g'),'')::numeric;
      v_concentration_unit:=nullif(trim(coalesce(r->>'concentration_unit',r->>'hatoanyag_egyseg','')),'');
      insert into public.plant_protection_ingredients(product_id,ingredient,concentration,concentration_unit)
      values(v_product_id,v_ingredient,v_concentration,v_concentration_unit);
      v_ingredients:=v_ingredients+1;
    end if;
  end loop;

  update public.plant_protection_import_batches
  set product_count=v_products,use_count=v_uses,ingredient_count=v_ingredients
  where id=v_batch;

  insert into public.operation_catalog_sources(country_code,source_name,source_url,last_checked_at,last_imported_at,product_count,use_count,status,notes)
  values(
    p_country_code,p_source_name,p_source_url,now(),now(),
    (select count(*) from public.plant_protection_products where country_code=p_country_code and active=true),
    (select count(*) from public.plant_protection_uses u join public.plant_protection_products p on p.id=u.product_id where p.country_code=p_country_code and p.active=true),
    'ready',p_notes
  )
  on conflict(country_code) do update set
    source_name=excluded.source_name,source_url=excluded.source_url,last_checked_at=excluded.last_checked_at,
    last_imported_at=excluded.last_imported_at,product_count=excluded.product_count,use_count=excluded.use_count,status='ready',notes=excluded.notes;

  return jsonb_build_object(
    'batch_id',v_batch,'rows',v_rows,'inserted_products',v_products,'inserted_uses',v_uses,
    'updated_uses',v_updated_uses,'inserted_ingredients',v_ingredients
  );
end $$;

revoke all on function public.import_plant_protection_catalog(text,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.import_plant_protection_catalog(text,text,text,jsonb,text) to authenticated;
