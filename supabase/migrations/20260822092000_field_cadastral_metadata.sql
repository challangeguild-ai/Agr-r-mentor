-- Prepare field records for future cadastral (HRSZ), MePAR and external geometry integrations.
alter table public.fields
  add column if not exists parcel_number text,
  add column if not exists settlement text,
  add column if not exists mepar_block_id text,
  add column if not exists geometry_source text not null default 'manual',
  add column if not exists external_parcel_id text,
  add column if not exists geometry_source_updated_at timestamptz;

alter table public.fields drop constraint if exists fields_geometry_source_check;
alter table public.fields
  add constraint fields_geometry_source_check
  check (geometry_source in ('manual','cadastral','mepar','external'));

create index if not exists fields_parcel_number_idx on public.fields(parcel_number);
create index if not exists fields_settlement_idx on public.fields(settlement);
create index if not exists fields_mepar_block_id_idx on public.fields(mepar_block_id);

comment on column public.fields.parcel_number is 'Helyrajzi szám / cadastral parcel number.';
comment on column public.fields.settlement is 'Település, amelyhez a helyrajzi szám tartozik.';
comment on column public.fields.mepar_block_id is 'MePAR fizikai blokkazonosító, ha rendelkezésre áll.';
comment on column public.fields.geometry_source is 'A táblahatár forrása: manual, cadastral, mepar vagy external.';
comment on column public.fields.external_parcel_id is 'Külső földrészlet-adatforrás technikai azonosítója.';
