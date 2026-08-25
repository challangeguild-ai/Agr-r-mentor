create table if not exists public.field_operations (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  field_id uuid not null references public.fields(id) on delete cascade,
  operation_date date not null,
  operation_type text not null check (operation_type in ('spraying','plant_protection','fertilizing','sowing','soil_work','harvest','irrigation','mowing','other')),
  country_code text not null check (country_code in ('HU','SK')),
  subtype text,
  product_id uuid references public.plant_protection_products(id) on delete set null,
  plant_protection_use_id uuid references public.plant_protection_uses(id) on delete set null,
  product_name text,
  authorization_number text,
  crop text,
  target text,
  active_ingredient text,
  composition jsonb not null default '{}'::jsonb,
  dose numeric check (dose is null or dose >= 0),
  dose_unit text,
  quantity numeric check (quantity is null or quantity >= 0),
  quantity_unit text,
  treated_area numeric check (treated_area is null or treated_area > 0),
  machine_id uuid references public.machines(id) on delete set null,
  machine_name text,
  operator_name text,
  weather text,
  notes text,
  catalog_mode text not null default 'manual' check (catalog_mode in ('official','catalog','manual')),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists field_operations_farm_date_idx on public.field_operations(farm_id, operation_date desc);
create index if not exists field_operations_field_date_idx on public.field_operations(field_id, operation_date desc);
create index if not exists field_operations_type_date_idx on public.field_operations(operation_type, operation_date desc);
create index if not exists field_operations_product_idx on public.field_operations(product_id) where product_id is not null;
create index if not exists field_operations_creator_idx on public.field_operations(created_by);

alter table public.field_operations enable row level security;

drop policy if exists "field operations advisor all" on public.field_operations;
create policy "field operations advisor all" on public.field_operations for all to authenticated using ((select app_private.is_advisor())) with check ((select app_private.is_advisor()));

drop policy if exists "field operations farmer select" on public.field_operations;
create policy "field operations farmer select" on public.field_operations for select to authenticated using (exists (select 1 from public.farms f where f.id = field_operations.farm_id and f.owner_id = (select auth.uid())));

drop policy if exists "field operations farmer insert own" on public.field_operations;
create policy "field operations farmer insert own" on public.field_operations for insert to authenticated with check (created_by = (select auth.uid()) and exists (select 1 from public.farms f where f.id = field_operations.farm_id and f.owner_id = (select auth.uid())));

drop policy if exists "field operations farmer update own" on public.field_operations;
create policy "field operations farmer update own" on public.field_operations for update to authenticated using (created_by = (select auth.uid()) and exists (select 1 from public.farms f where f.id = field_operations.farm_id and f.owner_id = (select auth.uid()))) with check (created_by = (select auth.uid()) and exists (select 1 from public.farms f where f.id = field_operations.farm_id and f.owner_id = (select auth.uid())));

drop policy if exists "field operations farmer delete own" on public.field_operations;
create policy "field operations farmer delete own" on public.field_operations for delete to authenticated using (created_by = (select auth.uid()) and exists (select 1 from public.farms f where f.id = field_operations.farm_id and f.owner_id = (select auth.uid())));

grant select, insert, update, delete on public.field_operations to authenticated;

insert into public.operation_catalog(country_code,operation_type,category,name,sort_order,metadata)
select v.country_code,v.operation_type,v.category,v.name,v.sort_order,v.metadata
from (values
 ('ALL','mowing','method','Kaszálás',10,'{}'::jsonb),
 ('ALL','mowing','method','Szárzúzás',20,'{}'::jsonb),
 ('ALL','mowing','method','Mulcsozás',30,'{}'::jsonb),
 ('ALL','other','method','Növényápolás',10,'{}'::jsonb),
 ('ALL','other','method','Bálázás',20,'{}'::jsonb),
 ('ALL','other','method','Szállítás',30,'{}'::jsonb),
 ('ALL','fertilizing','fertilizer','Szerves trágya',80,'{}'::jsonb),
 ('ALL','fertilizing','fertilizer','Hígtrágya',90,'{}'::jsonb),
 ('ALL','fertilizing','fertilizer','Mésztrágya',100,'{}'::jsonb),
 ('ALL','fertilizing','fertilizer','Lombtrágya',110,'{}'::jsonb)
) as v(country_code,operation_type,category,name,sort_order,metadata)
where not exists (select 1 from public.operation_catalog c where c.country_code=v.country_code and c.operation_type=v.operation_type and c.name=v.name);
