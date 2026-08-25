create table if not exists public.operation_catalog_sources (
 country_code text primary key check (country_code in ('HU','SK')),
 source_name text not null,
 source_url text not null,
 last_checked_at timestamptz,
 last_imported_at timestamptz,
 product_count integer not null default 0,
 use_count integer not null default 0,
 status text not null default 'pending' check (status in ('pending','ready','stale','error')),
 notes text,
 updated_at timestamptz not null default now()
);
alter table public.operation_catalog_sources enable row level security;
drop policy if exists "authenticated read operation catalog sources" on public.operation_catalog_sources;
create policy "authenticated read operation catalog sources" on public.operation_catalog_sources for select to authenticated using (true);
grant select on public.operation_catalog_sources to authenticated;
insert into public.operation_catalog_sources(country_code,source_name,source_url,status,notes)
values
 ('HU','Nébih Növényvédő szerek adatbázisa','https://novenyvedoszer.nebih.gov.hu/Engedelykereso/Kereso','pending','A hivatalos HU katalógus importkapcsolata előkészítve; importig kézi rögzítés megengedett.'),
 ('SK','ÚKSÚP ISPOR / ORP datasety','https://www.uksup.sk/orp-datasety','pending','A hivatalos SK katalógus export/importkapcsolata előkészítve; importig kézi rögzítés megengedett.')
on conflict (country_code) do update set source_name=excluded.source_name,source_url=excluded.source_url,updated_at=now();
