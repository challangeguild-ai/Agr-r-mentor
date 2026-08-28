-- System administrators are a distinct security role and must not inherit
-- agronomic advisor access merely because their profile role is `advisor`.
-- System-admin pages/actions use the server-only service-role client after
-- their own AAL2 + system_role=admin checks.

create or replace function app_private.is_advisor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
     and exists (
       select 1
       from public.profiles p
       where p.id = (select auth.uid())
         and p.role = 'advisor'
         and coalesce(p.system_role, 'user') <> 'admin'
     );
$$;

revoke all on function app_private.is_advisor() from public, anon, authenticated;
grant execute on function app_private.is_advisor() to service_role;
