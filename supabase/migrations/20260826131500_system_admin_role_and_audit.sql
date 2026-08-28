-- Separate business role (farmer/advisor) from system administration.
-- A system administrator keeps the advisor business role so existing RLS and
-- professional workflows remain compatible, while system_role grants the
-- additional support/security surface.

alter table public.profiles add column if not exists system_role text not null default 'user';

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.profiles'::regclass and conname='profiles_system_role_check'
  ) then
    alter table public.profiles add constraint profiles_system_role_check
      check (system_role in ('user','admin'));
  end if;
end $$;

create or replace function app_private.is_system_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists(
    select 1 from public.profiles p
    where p.id=auth.uid() and p.role='advisor' and p.system_role='admin'
  );
$$;
revoke all on function app_private.is_system_admin() from public, anon;
grant execute on function app_private.is_system_admin() to authenticated, service_role;

create table if not exists public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  target_type text not null,
  target_id text,
  reason text not null,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists admin_audit_events_created_idx on public.admin_audit_events(created_at desc);
create index if not exists admin_audit_events_actor_idx on public.admin_audit_events(actor_user_id,created_at desc);
create index if not exists admin_audit_events_target_idx on public.admin_audit_events(target_type,target_id,created_at desc);
alter table public.admin_audit_events enable row level security;

drop policy if exists "system admins read admin audit" on public.admin_audit_events;
create policy "system admins read admin audit" on public.admin_audit_events for select to authenticated
  using (app_private.is_system_admin());
drop policy if exists "system admins write own admin audit" on public.admin_audit_events;
create policy "system admins write own admin audit" on public.admin_audit_events for insert to authenticated
  with check (app_private.is_system_admin() and actor_user_id=auth.uid());

grant select,insert on public.admin_audit_events to authenticated;

-- The raw security ledger stays hidden from normal users/advisors, but the
-- designated system administrator may inspect it for incident response.
drop policy if exists "system admins read security events" on public.security_events;
create policy "system admins read security events" on public.security_events for select to authenticated
  using (app_private.is_system_admin());
grant select on public.security_events to authenticated;

comment on column public.profiles.system_role is 'System privilege: user or admin. Admin is independent from the farmer/advisor business role.';
comment on table public.admin_audit_events is 'Immutable-style audit trail for explicit system administrator interventions.';
