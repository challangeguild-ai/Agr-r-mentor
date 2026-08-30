-- Final audit: remove broad anonymous/write-style grants from the plant-protection quality view.
revoke all on public.plant_protection_catalog_quality from anon;
revoke all on public.plant_protection_catalog_quality from authenticated;
grant select on public.plant_protection_catalog_quality to authenticated;
