alter table public.profiles
  add column if not exists avatar_url text;

alter table public.farmer_reports
  add column if not exists category text,
  add column if not exists severity text,
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='farmer_reports_category_check') then
    alter table public.farmer_reports add constraint farmer_reports_category_check
      check (category is null or category in ('crop_health','pest','disease','weed','water','weather','soil','machine','work','other'));
  end if;
  if not exists (select 1 from pg_constraint where conname='farmer_reports_severity_check') then
    alter table public.farmer_reports add constraint farmer_reports_severity_check
      check (severity is null or severity in ('normal','high','urgent'));
  end if;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-avatars','profile-avatars',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='profile_avatars_read') then
    create policy profile_avatars_read on storage.objects for select using (bucket_id='profile-avatars');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='profile_avatars_insert_own') then
    create policy profile_avatars_insert_own on storage.objects for insert to authenticated
      with check (bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='profile_avatars_update_own') then
    create policy profile_avatars_update_own on storage.objects for update to authenticated
      using (bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text)
      with check (bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='profile_avatars_delete_own') then
    create policy profile_avatars_delete_own on storage.objects for delete to authenticated
      using (bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
  end if;
end $$;
