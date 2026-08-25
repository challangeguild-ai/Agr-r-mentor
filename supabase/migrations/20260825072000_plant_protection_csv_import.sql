create table if not exists public.plant_protection_import_batches (
  id uuid primary key default gen_random_uuid(),
  country_code text not null check (country_code in ('HU','SK')),
  source_name text not null,
  source_url text,
  imported_by uuid references auth.users(id) on delete set null,
  imported_at timestamptz not null default now(),
  row_count integer not null default 0,
  product_count integer not null default 0,
  use_count integer not null default 0,
  ingredient_count integer not null default 0,
  notes text
);

alter table public.plant_protection_import_batches enable row level security;
drop policy if exists "plant protection import batches advisor select" on public.plant_protection_import_batches;
create policy "plant protection import batches advisor select" on public.plant_protection_import_batches for select to authenticated using ((select app_private.is_advisor()));

grant select on public.plant_protection_import_batches to authenticated;

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
  v_product_id uuid;
  v_use_id uuid;
  v_name text;
  v_auth text;
  v_category text;
  v_function text;
  v_crop text;
  v_target text;
  v_dose_min numeric;
  v_dose_max numeric;
  v_dose_unit text;
  v_method text;
  v_phi integer;
  v_ingredient text;
  v_concentration numeric;
  v_concentration_unit text;
  v_products int := 0;
  v_uses int := 0;
  v_ingredients int := 0;
  v_rows int := 0;
  v_batch uuid;
begin
  if not (select app_private.is_advisor()) then
    raise exception 'Csak szaktanácsadó/admin indíthat hivatalos katalógusimportot.';
  end if;
  if p_country_code not in ('HU','SK') then
    raise exception 'Érvénytelen országkód.';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Az importadatnak JSON tömbnek kell lennie.';
  end if;

  insert into public.plant_protection_import_batches(country_code,source_name,source_url,imported_by,row_count,notes)
  values(p_country_code,coalesce(nullif(p_source_name,''),'Hivatalos növényvédőszer-adatforrás'),p_source_url,auth.uid(),jsonb_array_length(p_rows),p_notes)
  returning id into v_batch;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_rows := v_rows + 1;
    v_name := nullif(trim(coalesce(r->>'name',r->>'product_name',r->>'keszitmeny',r->>'novenyvedo_szer_neve',r->>'obchodny_nazov_pripravku')),'');
    v_auth := nullif(trim(coalesce(r->>'authorization_number',r->>'engedelyszam',r->>'engedely_szama',r->>'cislo_autorizacie')),'');
    if v_name is null then
      continue;
    end if;
    v_category := nullif(trim(coalesce(r->>'regulatory_category',r->>'forgalmazasi_kategoria',r->>'forg_kategoria',r->>'kategoria')),'');
    v_function := nullif(trim(coalesce(r->>'function_type',r->>'rendeltetes',r->>'typ_funkcie_pripravku')),'');

    select id into v_product_id from public.plant_protection_products
    where country_code=p_country_code and ((v_auth is not null and authorization_number=v_auth) or (v_auth is null and lower(name)=lower(v_name)))
    order by created_at nulls last, id limit 1;

    if v_product_id is null then
      insert into public.plant_protection_products(country_code,name,authorization_number,function_type,regulatory_category,professional_use_only,prescription_required,approval_required,active,source_name,source_checked_at)
      values(p_country_code,v_name,v_auth,v_function,v_category,
        case when p_country_code='HU' and upper(replace(coalesce(v_category,''),'.','')) in ('I','II') then true else false end,
        false,
        case when p_country_code='HU' and upper(replace(coalesce(v_category,''),'.','')) in ('I','II') then true else false end,
        true,p_source_name,now()) returning id into v_product_id;
      v_products := v_products + 1;
    else
      update public.plant_protection_products set
        name=v_name,
        authorization_number=coalesce(v_auth,authorization_number),
        function_type=coalesce(v_function,function_type),
        regulatory_category=coalesce(v_category,regulatory_category),
        professional_use_only=case when p_country_code='HU' and upper(replace(coalesce(v_category,regulatory_category,''),'.','')) in ('I','II') then true else professional_use_only end,
        approval_required=case when p_country_code='HU' and upper(replace(coalesce(v_category,regulatory_category,''),'.','')) in ('I','II') then true else approval_required end,
        active=true,
        source_name=p_source_name,
        source_checked_at=now()
      where id=v_product_id;
    end if;

    v_crop := nullif(trim(coalesce(r->>'crop',r->>'kultura',r->>'plodina',r->>'plodina_alebo_oblast_pouzitia')),'');
    v_target := nullif(trim(coalesce(r->>'target',r->>'karosito',r->>'cel',r->>'skodlivy_organizmus_alebo_iny_ucel_pouzitia')),'');
    v_dose_min := nullif(replace(coalesce(r->>'dose_min',r->>'dozis_min',''),',','.'),'')::numeric;
    v_dose_max := nullif(replace(coalesce(r->>'dose_max',r->>'dozis_max',r->>'max_dozis',''),',','.'),'')::numeric;
    v_dose_unit := nullif(trim(coalesce(r->>'dose_unit',r->>'dozis_egyseg',r->>'jednotka_davky')),'');
    v_method := nullif(trim(coalesce(r->>'application_method',r->>'kijuttatas_modja',r->>'sposob_aplikacie')),'');
    v_phi := nullif(regexp_replace(coalesce(r->>'phi_days',r->>'evi',r->>'varakozasi_ido',''), '[^0-9]', '', 'g'),'')::integer;

    if v_crop is not null then
      select id into v_use_id from public.plant_protection_uses
      where product_id=v_product_id and lower(crop)=lower(v_crop) and coalesce(lower(target),'')=coalesce(lower(v_target),'') and coalesce(dose_max,-1)=coalesce(v_dose_max,-1)
      limit 1;
      if v_use_id is null then
        insert into public.plant_protection_uses(product_id,crop,target,dose_min,dose_max,dose_unit,application_method,phi_days,notes)
        values(v_product_id,v_crop,v_target,v_dose_min,v_dose_max,v_dose_unit,v_method,v_phi,p_source_name)
        returning id into v_use_id;
        v_uses := v_uses + 1;
      else
        update public.plant_protection_uses set dose_min=v_dose_min,dose_max=v_dose_max,dose_unit=v_dose_unit,application_method=v_method,phi_days=v_phi,notes=p_source_name where id=v_use_id;
      end if;
    end if;

    v_ingredient := nullif(trim(coalesce(r->>'ingredient',r->>'hatoanyag',r->>'hatoanyag_osszetetel',r->>'nazov_ucinnej_latky')),'');
    if v_ingredient is not null and not exists(select 1 from public.plant_protection_ingredients where product_id=v_product_id and lower(ingredient)=lower(v_ingredient)) then
      v_concentration := nullif(replace(coalesce(r->>'concentration',r->>'hatoanyag_mennyiseg',''),',','.'),'')::numeric;
      v_concentration_unit := nullif(trim(coalesce(r->>'concentration_unit',r->>'hatoanyag_egyseg','')),'');
      insert into public.plant_protection_ingredients(product_id,ingredient,concentration,concentration_unit)
      values(v_product_id,v_ingredient,v_concentration,v_concentration_unit);
      v_ingredients := v_ingredients + 1;
    end if;
  end loop;

  update public.plant_protection_import_batches set product_count=v_products,use_count=v_uses,ingredient_count=v_ingredients where id=v_batch;
  insert into public.operation_catalog_sources(country_code,source_name,source_url,last_checked_at,last_imported_at,product_count,use_count,status,notes)
  values(p_country_code,p_source_name,p_source_url,now(),now(),(select count(*) from public.plant_protection_products where country_code=p_country_code and active=true),(select count(*) from public.plant_protection_uses u join public.plant_protection_products p on p.id=u.product_id where p.country_code=p_country_code and p.active=true),'ready',p_notes)
  on conflict (country_code) do update set source_name=excluded.source_name,source_url=excluded.source_url,last_checked_at=excluded.last_checked_at,last_imported_at=excluded.last_imported_at,product_count=excluded.product_count,use_count=excluded.use_count,status='ready',notes=excluded.notes;

  return jsonb_build_object('batch_id',v_batch,'rows',v_rows,'inserted_products',v_products,'inserted_uses',v_uses,'inserted_ingredients',v_ingredients);
end $$;

revoke all on function public.import_plant_protection_catalog(text,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.import_plant_protection_catalog(text,text,text,jsonb,text) to authenticated;