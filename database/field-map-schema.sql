-- Agrár Mentor: térképes földtábla-kezelés előkészítése
-- Additív, visszafelé kompatibilis séma. Nem töröl és nem nevez át meglévő adatot.
-- A migráció külön futtatandó Supabase/PostgreSQL környezetben.

alter table public.fields
  add column if not exists center_lat double precision,
  add column if not exists center_lng double precision,
  add column if not exists boundary_geojson jsonb,
  add column if not exists boundary_updated_at timestamptz;

comment on column public.fields.center_lat is 'A földtábla térképi középpontjának szélességi foka (WGS84).';
comment on column public.fields.center_lng is 'A földtábla térképi középpontjának hosszúsági foka (WGS84).';
comment on column public.fields.boundary_geojson is 'GeoJSON Polygon vagy MultiPolygon geometria WGS84 koordinátákkal.';
comment on column public.fields.boundary_updated_at is 'A táblahatár utolsó módosításának időpontja.';

alter table public.fields drop constraint if exists fields_center_lat_range;
alter table public.fields add constraint fields_center_lat_range
  check (center_lat is null or center_lat between -90 and 90);

alter table public.fields drop constraint if exists fields_center_lng_range;
alter table public.fields add constraint fields_center_lng_range
  check (center_lng is null or center_lng between -180 and 180);

alter table public.fields drop constraint if exists fields_boundary_geojson_type;
alter table public.fields add constraint fields_boundary_geojson_type
  check (
    boundary_geojson is null
    or (
      boundary_geojson ? 'type'
      and boundary_geojson ? 'coordinates'
      and boundary_geojson->>'type' in ('Polygon','MultiPolygon')
    )
  );

create index if not exists fields_boundary_geojson_gin_idx
  on public.fields using gin (boundary_geojson);

-- A meglévő fields RLS szabályokat szándékosan nem módosítjuk:
-- az új oszlopokra ugyanaz a sor-szintű hozzáférés vonatkozik, mint a tábla többi adatára.
