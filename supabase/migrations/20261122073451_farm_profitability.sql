-- Farmer-owned financial planning (applied 20261122073451). These are estimated operating figures, not tax accounting.
-- The field/farm pair prevents a record being attached to another farm's field.
create unique index if not exists fields_id_farm_id_profit_fk_idx on public.fields (id,farm_id);

create table if not exists public.field_profit_seasons (
 id uuid primary key default gen_random_uuid(),
 farm_id uuid not null references public.farms(id) on delete cascade,
 field_id uuid not null,
 season_year integer not null check (season_year between 2000 and 2100),
 crop_name text not null check (char_length(btrim(crop_name)) between 1 and 160),
 area_ha_snapshot numeric(12,3) not null check (area_ha_snapshot > 0),
 harvested_tonnes numeric(15,3) not null default 0 check (harvested_tonnes >= 0),
 expected_price_huf_per_tonne numeric(15,2) not null default 0 check (expected_price_huf_per_tonne >= 0),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint field_profit_seasons_field_farm_fk foreign key (field_id,farm_id)
  references public.fields(id,farm_id) on delete cascade,
 constraint field_profit_seasons_field_year_key unique(field_id,season_year)
);

create table if not exists public.field_profit_entries (
 id uuid primary key default gen_random_uuid(),
 season_id uuid not null references public.field_profit_seasons(id) on delete cascade,
 entry_type text not null check (entry_type in ('cost','sale')),
 category text not null check (char_length(btrim(category)) between 1 and 80),
 description text not null default '' check (char_length(description) <= 240),
 occurred_on date not null,
 amount_huf numeric(15,2),
 quantity_tonnes numeric(15,3),
 price_huf_per_tonne numeric(15,2),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 constraint field_profit_entry_values check (
  (entry_type='cost' and amount_huf is not null and amount_huf > 0 and quantity_tonnes is null and price_huf_per_tonne is null)
  or
  (entry_type='sale' and amount_huf is null and quantity_tonnes is not null and quantity_tonnes > 0
   and price_huf_per_tonne is not null and price_huf_per_tonne >= 0)
 )
);

create index if not exists field_profit_seasons_farm_year_idx
 on public.field_profit_seasons(farm_id,season_year desc);
create index if not exists field_profit_entries_season_type_date_idx
 on public.field_profit_entries(season_id,entry_type,occurred_on desc);

alter table public.field_profit_seasons enable row level security;
alter table public.field_profit_entries enable row level security;

revoke all on public.field_profit_seasons from public,anon;
revoke all on public.field_profit_entries from public,anon;
grant select,insert,update,delete on public.field_profit_seasons to authenticated;
grant select,insert,update,delete on public.field_profit_entries to authenticated;

-- An advisor, worker or unrelated farmer must not see or edit financial records.
create policy "farmer owns season" on public.field_profit_seasons
 for all to authenticated
 using (
  exists(select 1 from public.farms f
   where f.id=field_profit_seasons.farm_id and f.owner_id=(select auth.uid()))
 )
 with check (
  created_by=(select auth.uid())
  and exists(select 1 from public.farms f
   join public.fields fi on fi.farm_id=f.id
   where f.id=field_profit_seasons.farm_id and fi.id=field_profit_seasons.field_id
    and f.owner_id=(select auth.uid()))
 );

create policy "farmer owns financial entries" on public.field_profit_entries
 for all to authenticated
 using (
  exists(select 1 from public.field_profit_seasons s
   join public.farms f on f.id=s.farm_id
   where s.id=field_profit_entries.season_id and f.owner_id=(select auth.uid()))
 )
 with check (
  created_by=(select auth.uid())
  and exists(select 1 from public.field_profit_seasons s
   join public.farms f on f.id=s.farm_id
   where s.id=field_profit_entries.season_id and f.owner_id=(select auth.uid()))
 );

-- Keep harvest inventory consistent even when an authenticated client calls the Data API directly.
-- Lock the season row to serialize concurrent sale inserts for the same field and year.
create function public.enforce_profit_sale_limit()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
 v_harvest numeric;
 v_sold numeric;
begin
 if new.entry_type <> 'sale' then return new; end if;
 select s.harvested_tonnes into v_harvest
 from public.field_profit_seasons s where s.id=new.season_id for update;
 if not found then raise exception 'A termesztési év nem érhető el'; end if;
 select coalesce(sum(e.quantity_tonnes),0) into v_sold
 from public.field_profit_entries e
 where e.season_id=new.season_id and e.entry_type='sale' and e.id<>new.id;
 if v_sold+new.quantity_tonnes>v_harvest then
  raise exception 'Az eladott mennyiség nem haladhatja meg a betakarított terményt';
 end if;
 return new;
end;
$$;

create trigger field_profit_sale_quantity_guard
 before insert or update on public.field_profit_entries
 for each row execute function public.enforce_profit_sale_limit();

create function public.enforce_profit_harvest_limit()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_sold numeric;
begin
 if new.harvested_tonnes=old.harvested_tonnes then return new; end if;
 select coalesce(sum(e.quantity_tonnes),0) into v_sold
 from public.field_profit_entries e
 where e.season_id=new.id and e.entry_type='sale';
 if v_sold>new.harvested_tonnes then
  raise exception 'A betakarított mennyiség nem lehet kisebb az eladottnál';
 end if;
 return new;
end;
$$;

create trigger field_profit_harvest_quantity_guard
 before update of harvested_tonnes on public.field_profit_seasons
 for each row execute function public.enforce_profit_harvest_limit();

revoke all on function public.enforce_profit_sale_limit() from public,anon,authenticated;
revoke all on function public.enforce_profit_harvest_limit() from public,anon,authenticated;
