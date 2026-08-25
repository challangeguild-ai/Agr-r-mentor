create index if not exists field_operations_machine_idx on public.field_operations(machine_id) where machine_id is not null;
create index if not exists field_operations_use_idx on public.field_operations(plant_protection_use_id) where plant_protection_use_id is not null;

drop policy if exists "field operations advisor all" on public.field_operations;
drop policy if exists "field operations farmer select" on public.field_operations;
drop policy if exists "field operations farmer insert own" on public.field_operations;
drop policy if exists "field operations farmer update own" on public.field_operations;
drop policy if exists "field operations farmer delete own" on public.field_operations;

create policy "field operations select" on public.field_operations for select to authenticated
using ((select app_private.is_advisor()) or exists (select 1 from public.farms f where f.id=field_operations.farm_id and f.owner_id=(select auth.uid())));
create policy "field operations insert" on public.field_operations for insert to authenticated
with check ((select app_private.is_advisor()) or (created_by=(select auth.uid()) and exists (select 1 from public.farms f where f.id=field_operations.farm_id and f.owner_id=(select auth.uid()))));
create policy "field operations update" on public.field_operations for update to authenticated
using ((select app_private.is_advisor()) or (created_by=(select auth.uid()) and exists (select 1 from public.farms f where f.id=field_operations.farm_id and f.owner_id=(select auth.uid()))))
with check ((select app_private.is_advisor()) or (created_by=(select auth.uid()) and exists (select 1 from public.farms f where f.id=field_operations.farm_id and f.owner_id=(select auth.uid()))));
create policy "field operations delete" on public.field_operations for delete to authenticated
using ((select app_private.is_advisor()) or (created_by=(select auth.uid()) and exists (select 1 from public.farms f where f.id=field_operations.farm_id and f.owner_id=(select auth.uid()))));
