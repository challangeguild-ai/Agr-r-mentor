-- Farmer profit is private personal financial data, not part of advisor farm-management visibility.
-- Keep the original creator and the current farm owner as independent requirements:
-- a later farm owner, advisor or farm member cannot inherit historical financial records.
-- This also closes the case where an advisor can update a farm's owner_id.

drop policy if exists "farmer owns season" on public.field_profit_seasons;
create policy "farmer owns season" on public.field_profit_seasons
 for all to authenticated
 using (
  created_by=(select auth.uid())
  and exists(
   select 1 from public.profiles p
   where p.id=(select auth.uid()) and p.role='farmer'
    and coalesce(p.system_role,'user')='user'
  )
  and exists(
   select 1 from public.farms f
   where f.id=field_profit_seasons.farm_id and f.owner_id=(select auth.uid())
  )
 )
 with check (
  created_by=(select auth.uid())
  and exists(
   select 1 from public.profiles p
   where p.id=(select auth.uid()) and p.role='farmer'
    and coalesce(p.system_role,'user')='user'
  )
  and exists(
   select 1 from public.farms f
   join public.fields fi on fi.farm_id=f.id
   where f.id=field_profit_seasons.farm_id
    and fi.id=field_profit_seasons.field_id
    and f.owner_id=(select auth.uid())
  )
 );

drop policy if exists "farmer owns financial entries" on public.field_profit_entries;
create policy "farmer owns financial entries" on public.field_profit_entries
 for all to authenticated
 using (
  created_by=(select auth.uid())
  and exists(
   select 1 from public.profiles p
   where p.id=(select auth.uid()) and p.role='farmer'
    and coalesce(p.system_role,'user')='user'
  )
  and exists(
   select 1 from public.field_profit_seasons s
   join public.farms f on f.id=s.farm_id
   where s.id=field_profit_entries.season_id
    and s.created_by=(select auth.uid()) and f.owner_id=(select auth.uid())
  )
 )
 with check (
  created_by=(select auth.uid())
  and exists(
   select 1 from public.profiles p
   where p.id=(select auth.uid()) and p.role='farmer'
    and coalesce(p.system_role,'user')='user'
  )
  and exists(
   select 1 from public.field_profit_seasons s
   join public.farms f on f.id=s.farm_id
   where s.id=field_profit_entries.season_id
    and s.created_by=(select auth.uid()) and f.owner_id=(select auth.uid())
  )
 );
