alter table public.plant_protection_products
  add column if not exists regulatory_status text not null default 'authorized',
  add column if not exists withdrawal_effective_at date,
  add column if not exists grace_period_until date,
  add column if not exists status_note text,
  add column if not exists source_url text,
  add column if not exists source_snapshot_at timestamptz;

alter table public.plant_protection_products drop constraint if exists plant_protection_products_regulatory_status_check;
alter table public.plant_protection_products add constraint plant_protection_products_regulatory_status_check
  check (regulatory_status in ('authorized','withdrawn_grace','not_applicable','unknown'));

create index if not exists plant_protection_products_country_status_idx
  on public.plant_protection_products(country_code, regulatory_status, name);

comment on column public.plant_protection_products.regulatory_status is 'Hatósági státusz: authorized, withdrawn_grace, not_applicable, unknown.';
comment on column public.plant_protection_products.withdrawal_effective_at is 'A visszavonás hatályának dátuma, ha ismert.';
comment on column public.plant_protection_products.grace_period_until is 'A végső felhasználási/türelmi idő vége, ha ismert.';
comment on column public.plant_protection_products.source_snapshot_at is 'Az a forrás-snapshot időpont, amelyből a státusz származik.';