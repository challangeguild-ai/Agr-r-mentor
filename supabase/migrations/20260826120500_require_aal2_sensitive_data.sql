do $$
declare t text;
begin
  foreach t in array array[
    'profiles','farms','farm_members','farm_member_invites','fields','inspections','inspection_media',
    'farmer_reports','farmer_report_media','tasks','task_execution_reports','task_operation_plans',
    'task_machine_assignments','documents','notifications','field_operations','field_operation_audit_log',
    'machines','machine_usage_logs','farm_plant_protection_approvers','timeline_events','farm_contacts',
    'profile_contacts','communication_receipts','personal_followups'
  ] loop
    if to_regclass('public.'||t) is not null then
      execute format('drop policy if exists %I on public.%I', 'require aal2', t);
      execute format(
        'create policy %I on public.%I as restrictive for all to authenticated using ((auth.jwt()->>''aal'') = ''aal2'') with check ((auth.jwt()->>''aal'') = ''aal2'')',
        'require aal2', t
      );
    end if;
  end loop;
end $$;

-- Sensitive RPCs must not be useful from an AAL1 session even when directly invoked.
create or replace function public.require_aal2()
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Bejelentkezés szükséges'; end if;
  if coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'Kétfaktoros hitelesítés szükséges';
  end if;
end $$;
revoke all on function public.require_aal2() from public, anon;
grant execute on function public.require_aal2() to authenticated;
