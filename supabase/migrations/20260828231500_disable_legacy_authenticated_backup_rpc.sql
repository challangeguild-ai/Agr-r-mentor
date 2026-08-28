-- The application now exports backups through export_app_backup_service(uuid),
-- which is service_role-only and is reached only after the server route has
-- verified system-admin status, AAL2 and a fresh step-up grant.
-- Keep the legacy function available only to service_role for compatibility,
-- but remove all direct browser/authenticated access.

revoke all on function public.export_app_backup() from public, anon, authenticated;
grant execute on function public.export_app_backup() to service_role;
