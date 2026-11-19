-- Farmer-supplied geometry is always a proposal. Only an authorized advisor may
-- copy it onto a field, atomically and only if the field has not changed.
create table public.field_boundary_proposals (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.fields(id) on delete cascade,
  farm_id uuid not null references public.farms(id) on delete cascade,
  proposed_by uuid not null references auth.users(id),
  center_lat double precision,
  center_lng double precision,
  boundary_geojson jsonb,
  has_boundary boolean generated always as (boundary_geojson is not null) stored,
  geometry_source text not null default 'manual' check (geometry_source in ('manual','external')),
  note text not null default '' check (char_length(note)<=1000),
  base_boundary_updated_at timestamptz,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  constraint field_boundary_proposal_point_pair check (
    (center_lat is null and center_lng is null) or
    (center_lat between -90 and 90 and center_lng between -180 and 180)
  ),
  constraint field_boundary_proposal_has_location check (center_lat is not null or boundary_geojson is not null)
);

create unique index field_boundary_proposals_one_pending_field
  on public.field_boundary_proposals(field_id) where status='pending';
create index field_boundary_proposals_pending_idx
  on public.field_boundary_proposals(created_at desc) where status='pending';
create index field_boundary_proposals_proposer_idx
  on public.field_boundary_proposals(proposed_by,created_at desc);

alter table public.field_boundary_proposals enable row level security;
revoke all on public.field_boundary_proposals from public,anon,authenticated;
grant select on public.field_boundary_proposals to authenticated;

create policy "boundary proposals visible to authorized participants"
on public.field_boundary_proposals for select to authenticated using (
  proposed_by=(select auth.uid())
  or (select app_private.is_advisor())
  or (select public.can_coordinate_farm(farm_id))
);

-- No browser role can insert/update/delete proposals directly. A security-definer
-- function supplies the actor, linked farm and baseline from trusted tables.
create function public.submit_field_boundary_proposal(
  p_field_id uuid,
  p_center_lat double precision,
  p_center_lng double precision,
  p_boundary_geojson jsonb,
  p_geometry_source text default 'manual',
  p_note text default ''
)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_user uuid := (select auth.uid());
  v_field public.fields%rowtype;
  v_geom gis.geometry;
  v_id uuid;
begin
  if v_user is null then raise exception 'Bejelentkezés szükséges'; end if;
  if p_field_id is null then raise exception 'Hiányzó földtábla'; end if;
  select * into v_field from public.fields where id=p_field_id for share;
  if not found then raise exception 'A földtábla nem található'; end if;
  if not (select public.can_coordinate_farm(v_field.farm_id)) then
    raise exception 'Csak a gazdaság tulajdonosa vagy vezetője küldhet határjavaslatot';
  end if;
  if p_geometry_source not in ('manual','external') or p_geometry_source is null then
    raise exception 'Ismeretlen geometriaforrás';
  end if;
  if length(coalesce(p_note,''))>1000 then raise exception 'A megjegyzés legfeljebb 1000 karakter lehet'; end if;
  if (p_center_lat is null)<>(p_center_lng is null)
     or (p_center_lat is not null and (p_center_lat not between -90 and 90
          or p_center_lng not between -180 and 180)) then
    raise exception 'Érvénytelen térképi koordináta';
  end if;
  if p_boundary_geojson is null and p_center_lat is null then
    raise exception 'Legalább egy pontot vagy poligont adj meg';
  end if;
  if p_boundary_geojson is not null then
    if pg_column_size(p_boundary_geojson)>2000000 then raise exception 'Túl nagy poligon'; end if;
    if p_boundary_geojson->>'type' not in ('Polygon','MultiPolygon') then
      raise exception 'Csak poligon alakzat fogadható el';
    end if;
    v_geom := gis.ST_GeomFromGeoJSON(p_boundary_geojson::text);
    if gis.ST_IsEmpty(v_geom) or not gis.ST_IsValid(v_geom)
       or gis.ST_NPoints(v_geom)>12150
       or gis.ST_XMin(gis.Box3D(v_geom)) < -180 or gis.ST_XMax(gis.Box3D(v_geom)) > 180
       or gis.ST_YMin(gis.Box3D(v_geom)) < -90 or gis.ST_YMax(gis.Box3D(v_geom)) > 90 then
      raise exception 'Érvénytelen vagy túl részletes táblahatár';
    end if;
  end if;
  if exists(select 1 from public.field_boundary_proposals where field_id=p_field_id and status='pending') then
    raise exception 'Ehhez a táblához már van ellenőrzésre váró javaslat';
  end if;
  insert into public.field_boundary_proposals (
    field_id,farm_id,proposed_by,center_lat,center_lng,boundary_geojson,
    geometry_source,note,base_boundary_updated_at
  ) values (
    p_field_id,v_field.farm_id,v_user,p_center_lat,p_center_lng,p_boundary_geojson,
    p_geometry_source,coalesce(p_note,''),v_field.boundary_updated_at
  ) returning id into v_id;
  insert into public.notifications(user_id,kind,title,message,href,event_key)
  select p.id,'field_boundary_proposal','Új táblahatár-javaslat',
    'Egy gazdálkodó új földtábla-határt küldött ellenőrzésre.',
    '/admin/map/proposals','boundary:'||v_id::text||':advisor:'||p.id::text
  from public.profiles p
  where p.role='advisor' and coalesce(p.system_role,'user')<>'admin'
  on conflict (user_id,event_key) where event_key is not null do nothing;
  return v_id;
end;
$$;

create function public.review_field_boundary_proposal(
  p_proposal_id uuid,
  p_approve boolean,
  p_note text default null
)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_user uuid := (select auth.uid());
  v_proposal public.field_boundary_proposals%rowtype;
  v_field public.fields%rowtype;
begin
  if v_user is null or not (select app_private.is_advisor()) then
    raise exception 'Szaktanácsadói jogosultság szükséges';
  end if;
  if p_approve is null then raise exception 'Hiányzó döntés'; end if;
  if length(coalesce(p_note,''))>1000 then raise exception 'A megjegyzés túl hosszú'; end if;
  select * into v_proposal from public.field_boundary_proposals
    where id=p_proposal_id for update;
  if not found or v_proposal.status<>'pending' then
    raise exception 'A javaslat már nem vár elbírálásra';
  end if;
  select * into v_field from public.fields where id=v_proposal.field_id for update;
  if not found or v_field.farm_id<>v_proposal.farm_id then
    raise exception 'A javaslat földtáblája megváltozott';
  end if;
  if p_approve then
    if v_field.boundary_updated_at is distinct from v_proposal.base_boundary_updated_at then
      raise exception 'A táblahatár időközben megváltozott. A javaslatot újra kell készíteni.';
    end if;
    update public.fields set
      center_lat=v_proposal.center_lat,
      center_lng=v_proposal.center_lng,
      boundary_geojson=v_proposal.boundary_geojson,
      boundary_updated_at=now(),
      geometry_source=case when v_proposal.boundary_geojson is null then 'manual' else v_proposal.geometry_source end,
      geometry_source_updated_at=now()
    where id=v_proposal.field_id;
  end if;
  update public.field_boundary_proposals set
    status=case when p_approve then 'approved' else 'rejected' end,
    reviewed_by=v_user,
    reviewed_at=now(),
    review_note=nullif(trim(coalesce(p_note,'')),'')
  where id=p_proposal_id;
  return v_proposal.field_id;
end;
$$;

revoke all on function public.submit_field_boundary_proposal(uuid,double precision,double precision,jsonb,text,text) from public,anon;
revoke all on function public.review_field_boundary_proposal(uuid,boolean,text) from public,anon;
grant execute on function public.submit_field_boundary_proposal(uuid,double precision,double precision,jsonb,text,text) to authenticated;
grant execute on function public.review_field_boundary_proposal(uuid,boolean,text) to authenticated;
