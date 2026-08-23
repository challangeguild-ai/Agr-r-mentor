alter table public.documents
  add column if not exists category text not null default 'egyeb',
  add column if not exists notes text,
  add column if not exists media_type text,
  add column if not exists file_size bigint;

alter table public.documents drop constraint if exists documents_category_check;
alter table public.documents add constraint documents_category_check
  check (category in ('talajvizsgalat','permetezes','szerzodes','szamla','foto','egyeb'));

update public.documents
set file_size=coalesce(file_size,file_size_bytes),
    media_type=coalesce(media_type,mime_type)
where file_size is null or media_type is null;
