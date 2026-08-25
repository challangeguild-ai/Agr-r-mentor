create or replace function app_private.cleanup_field_operation_timeline()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  delete from public.timeline_events
  where source_id = old.id and event_type = 'field_operation';
  return old;
end;
$$;
revoke all on function app_private.cleanup_field_operation_timeline() from public, anon, authenticated;

drop trigger if exists field_operations_timeline_cleanup on public.field_operations;
create trigger field_operations_timeline_cleanup
after delete on public.field_operations
for each row execute function app_private.cleanup_field_operation_timeline();
