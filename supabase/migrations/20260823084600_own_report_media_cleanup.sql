drop policy if exists "report media own delete" on storage.objects;
create policy "report media own delete" on storage.objects
for delete to authenticated
using (
  bucket_id='farmer-report-media'
  and (storage.foldername(name))[1]=(auth.uid())::text
);
