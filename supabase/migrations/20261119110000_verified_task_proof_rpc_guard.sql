-- The authenticated Data API can call this SECURITY DEFINER RPC directly.
-- Validate its GPS/photo evidence inside the transaction, even if a caller bypasses Next.js.
-- Staged only: do not apply to the hosted database before the release decision.
-- No demo-farm GPS bypass: a farm name must never disable location verification.

create or replace function public.submit_verified_task_execution(
  p_task_id uuid,
  p_proof text,
  p_operation_date date default current_date,
  p_actual_dose numeric default null,
  p_dose_unit text default null,
  p_actual_area numeric default null,
  p_actual_quantity numeric default null,
  p_quantity_unit text default null,
  p_weather text default null,
  p_notes text default null,
  p_finished_hours numeric default null,
  p_worked_hectares numeric default null
) returns void
language plpgsql security definer set search_path='' as $$
declare
  v_task public.tasks%rowtype;
  v_plan public.task_operation_plans%rowtype;
  v_product public.plant_protection_products%rowtype;
  v_use public.plant_protection_uses%rowtype;
  v_field public.fields%rowtype;
  v_payload jsonb;
  v_lat numeric;
  v_lng numeric;
  v_accuracy numeric;
  v_captured_at timestamptz;
  v_photo_path text;
  v_photo_name text;
  v_point gis.geometry;
  v_boundary gis.geometry;
  v_validation text;
  v_distance double precision;
  v_in_hole boolean := false;
  v_regulatory_status text;
  v_hungarian_grace boolean;
  v_dose_min numeric;
  v_dose_max numeric;
  v_dose_unit text;
begin
  if auth.uid() is null then raise exception 'Bejelentkezés szükséges'; end if;
  select * into v_task from public.tasks where id=p_task_id and assigned_to=auth.uid() for update;
  if not found then raise exception 'A teendő nem található vagy nincs hozzá jogosultságod'; end if;
  if v_task.status='done' then return; end if;
  if v_task.status='submitted' then raise exception 'A munka már ellenőrzésre be lett küldve'; end if;
  if v_task.status not in ('open','in_progress') then raise exception 'Ez a teendő nem küldhető be végrehajtottnak'; end if;
  if v_task.field_id is null then raise exception 'GPS-validált lezárás csak földtáblához kapcsolt munkánál használható'; end if;
  if not exists (
    select 1 from public.farms f where f.id=v_task.farm_id and f.owner_id=auth.uid()
  ) and not exists (
    select 1 from public.farm_members fm
    where fm.farm_id=v_task.farm_id and fm.user_id=auth.uid() and fm.active
  ) then
    raise exception 'Ehhez a gazdasághoz már nincs aktív jogosultságod';
  end if;

  if left(coalesce(p_proof,''),10)<>'TASKPROOF:' or length(p_proof)>5000 then
    raise exception 'Érvénytelen GPS/fotó igazolás';
  end if;
  v_payload := substring(p_proof from 11)::jsonb;
  if jsonb_typeof(v_payload) is distinct from 'object'
     or jsonb_typeof(v_payload->'lat') is distinct from 'number'
     or jsonb_typeof(v_payload->'lng') is distinct from 'number'
     or jsonb_typeof(v_payload->'accuracy') is distinct from 'number'
     or jsonb_typeof(v_payload->'capturedAt') is distinct from 'string'
     or jsonb_typeof(v_payload->'photoPath') is distinct from 'string'
     or jsonb_typeof(v_payload->'photoName') is distinct from 'string' then
    raise exception 'Hiányzó vagy érvénytelen GPS/fotó adatok';
  end if;
  v_lat := (v_payload->>'lat')::numeric;
  v_lng := (v_payload->>'lng')::numeric;
  v_accuracy := (v_payload->>'accuracy')::numeric;
  if v_lat not between -90 and 90 or v_lng not between -180 and 180
     or v_accuracy<=0 or v_accuracy>200 then
    raise exception 'A GPS-koordináta vagy pontosság nem megfelelő';
  end if;

  if (v_payload->>'capturedAt') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$' then
    raise exception 'Érvénytelen GPS-mérési idő';
  end if;
  v_captured_at := (v_payload->>'capturedAt')::timestamptz;
  if not isfinite(v_captured_at) or v_captured_at<now()-interval '15 minutes'
     or v_captured_at>now()+interval '2 minutes' then
    raise exception 'A GPS-mérés túl régi vagy érvénytelen. Kérj új pozíciót';
  end if;

  v_photo_path := v_payload->>'photoPath';
  v_photo_name := trim(v_payload->>'photoName');
  if length(v_photo_path)>512 or v_photo_path not like auth.uid()::text||'/task-proofs/'||p_task_id::text||'/%'
     or length(v_photo_name) not between 1 and 255 then
    raise exception 'Érvénytelen helyszíni fotóhivatkozás';
  end if;
  if not exists(
    select 1 from storage.objects o
    where o.bucket_id='farmer-report-media' and o.name=v_photo_path
      and o.owner_id=auth.uid()::text
      and coalesce(o.metadata->>'mimetype','') like 'image/%'
      and case when (o.metadata->>'size') ~ '^[0-9]+$'
        then (o.metadata->>'size')::bigint between 1 and 15*1024*1024 else false end
  ) then
    raise exception 'A feltöltött helyszíni fotó nem található vagy nem megfelelő';
  end if;

  select * into v_field from public.fields where id=v_task.field_id and farm_id=v_task.farm_id;
  if not found then raise exception 'A földtábla nem található'; end if;
  v_point := gis.ST_SetSRID(gis.ST_MakePoint(v_lng::double precision,v_lat::double precision),4326);
  if v_field.boundary_geojson is not null then
    v_boundary := gis.ST_SetSRID(gis.ST_GeomFromGeoJSON(v_field.boundary_geojson::text),4326);
    if gis.ST_GeometryType(v_boundary) not in ('ST_Polygon','ST_MultiPolygon')
       or not gis.ST_IsValid(v_boundary) then
      raise exception 'Érvénytelen táblahatár: a térképi adatot javítani kell';
    end if;
    if gis.ST_Covers(v_boundary,v_point) then
      v_validation := 'inside_boundary';
    else
      -- An inner hole is not farmland, even when it lies near an exterior edge.
      select exists(
        select 1 from gis.ST_Dump(v_boundary) part
        cross join lateral generate_series(1,gis.ST_NumInteriorRings(part.geom)) ring_index(n)
        where gis.ST_Covers(gis.ST_MakePolygon(gis.ST_InteriorRingN(part.geom,ring_index.n)),v_point)
      ) into v_in_hole;
      if v_in_hole then raise exception 'A GPS a földtábla kizárt belső területére esik'; end if;
      select min(gis.ST_Distance(gis.ST_ExteriorRing(part.geom)::gis.geography,v_point::gis.geography))
        into v_distance from gis.ST_Dump(v_boundary) part;
      if v_distance is not null and v_distance<=150 then v_validation := 'near_boundary'; end if;
    end if;
  elsif v_field.center_lat between -90 and 90 and v_field.center_lng between -180 and 180 then
    v_distance := gis.ST_Distance(v_point::gis.geography,
      gis.ST_SetSRID(gis.ST_MakePoint(v_field.center_lng,v_field.center_lat),4326)::gis.geography);
    if v_distance<=500 then v_validation := 'near_center'; end if;
  else
    raise exception 'Ehhez a táblához még nincs GPS-ellenőrizhető térképi adat';
  end if;
  if v_validation is null then raise exception 'A GPS alapján nem vagy a munkaterületen'; end if;
  if coalesce(v_payload->>'validation','')<>v_validation then
    raise exception 'A GPS-ellenőrzés eredménye nem egyezik a táblahatárral';
  end if;

  if p_operation_date>(now() at time zone 'Europe/Budapest')::date
     or p_operation_date is null then raise exception 'Érvénytelen munkavégzési dátum'; end if;
  if p_actual_dose<0 or p_actual_area<0 or p_actual_quantity<0
     or p_finished_hours<0 or p_worked_hectares<0 then
    raise exception 'A tényleges munkavégzési adatok nem lehetnek negatívak';
  end if;
  if length(coalesce(p_weather,''))>1000 or length(coalesce(p_notes,''))>3000 then
    raise exception 'A végrehajtási megjegyzés túl hosszú';
  end if;

  select * into v_plan from public.task_operation_plans where task_id=p_task_id;
  if found and v_plan.operation_type in ('spraying','plant_protection') then
    if p_actual_dose is null then raise exception 'Növényvédelmi munkánál a tényleges dózis kötelező'; end if;
    if v_plan.product_id is null or v_plan.plant_protection_use_id is null then
      raise exception 'A növényvédelmi terv hivatalos termék- vagy felhasználási kapcsolata hiányzik';
    end if;
    select * into v_product from public.plant_protection_products where id=v_plan.product_id;
    if not found or v_product.country_code is distinct from v_plan.country_code or v_product.active is false then
      raise exception 'A készítmény nem igazolható a jelenlegi hivatalos terméktörzsből';
    end if;
    select * into v_use from public.plant_protection_uses where id=v_plan.plant_protection_use_id;
    if not found or v_use.product_id is distinct from v_product.id then
      raise exception 'A hivatalos felhasználás nem tartozik a kiválasztott készítményhez';
    end if;
    if v_product.valid_from is not null and p_operation_date<v_product.valid_from then
      raise exception 'A készítmény engedélye még nem volt érvényes a munkavégzés napján';
    end if;
    v_regulatory_status := lower(trim(coalesce(v_product.regulatory_status,'')));
    v_hungarian_grace := v_plan.country_code='HU'
      and v_regulatory_status in ('withdrawn_grace','not_applicable')
      and v_product.grace_period_until is not null
      and p_operation_date<=v_product.grace_period_until;
    if v_plan.country_code='HU'
       and (v_regulatory_status in ('','unknown')
         or (v_regulatory_status in ('withdrawn_grace','not_applicable') and not v_hungarian_grace)) then
      raise exception 'A készítmény magyar hatósági státusza nem engedi a kijuttatást';
    end if;
    if v_product.valid_until is not null and p_operation_date>v_product.valid_until and not v_hungarian_grace then
      raise exception 'A készítmény engedélye lejárt a munkavégzés napjára';
    end if;
    v_dose_min := coalesce(v_use.dose_min,v_plan.dose_min);
    v_dose_max := coalesce(v_use.dose_max,v_plan.dose_max);
    v_dose_unit := coalesce(nullif(v_use.dose_unit,''),nullif(v_plan.dose_unit,''));
    if v_dose_max is not null and p_actual_dose>v_dose_max then raise exception 'A tényleges dózis meghaladja a jelenlegi hivatalos maximumot'; end if;
    if v_dose_min is not null and p_actual_dose<v_dose_min then raise exception 'A tényleges dózis kisebb a jelenlegi hivatalos minimumnál'; end if;
    if v_dose_unit is not null and coalesce(nullif(trim(p_dose_unit),''),'')<>v_dose_unit then
      raise exception 'A dózisegység nem egyezik a hivatalos felhasználással';
    end if;
  end if;

  -- Recompute the trusted validation and distance; never store caller-supplied verdicts.
  p_proof := 'TASKPROOF:'||jsonb_build_object(
    'lat',v_lat,'lng',v_lng,'accuracy',v_accuracy,
    'photoPath',v_photo_path,'photoName',v_photo_name,
    'capturedAt',v_payload->>'capturedAt','validation',v_validation,'distanceMeters',v_distance
  )::text;

  insert into public.task_execution_reports(task_id,reported_by,operation_date,actual_dose,dose_unit,actual_area,actual_quantity,quantity_unit,weather,notes,proof,finished_hours,worked_hectares,review_status)
  values(v_task.id,auth.uid(),p_operation_date,p_actual_dose,nullif(trim(p_dose_unit),''),p_actual_area,p_actual_quantity,nullif(trim(p_quantity_unit),''),nullif(trim(p_weather),''),nullif(trim(p_notes),''),p_proof,p_finished_hours,p_worked_hectares,'pending')
  on conflict(task_id) do update set reported_by=excluded.reported_by,reported_at=now(),operation_date=excluded.operation_date,actual_dose=excluded.actual_dose,dose_unit=excluded.dose_unit,actual_area=excluded.actual_area,actual_quantity=excluded.actual_quantity,quantity_unit=excluded.quantity_unit,weather=excluded.weather,notes=excluded.notes,proof=excluded.proof,finished_hours=excluded.finished_hours,worked_hectares=excluded.worked_hectares,review_status='pending',reviewed_by=null,reviewed_at=null,review_note=null,updated_at=now();
  insert into public.timeline_events(farm_id,field_id,event_type,title,description,event_at,created_by,source_id)
  values(v_task.farm_id,v_task.field_id,'task_submitted_review',concat('Munka ellenőrzésre beküldve: ',v_task.title),p_proof,now(),auth.uid(),v_task.id);
  update public.tasks set status='submitted',review_status='pending',completed_at=null,reviewed_by=null,reviewed_at=null,review_note=null,updated_at=now() where id=v_task.id;
end $$;

revoke all on function public.submit_verified_task_execution(uuid,text,date,numeric,text,numeric,numeric,text,text,text,numeric,numeric) from public,anon,authenticated;
grant execute on function public.submit_verified_task_execution(uuid,text,date,numeric,text,numeric,numeric,text,text,text,numeric,numeric) to authenticated;
