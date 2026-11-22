-- Direct finance-table RLS remains farmer-only. Assigned advisors use the audited server endpoint.
create table if not exists public.farm_advisor_finance_grants (
 farm_id uuid not null references public.farms(id) on delete cascade,
 owner_id uuid not null references auth.users(id),
 advisor_id uuid not null references public.profiles(id) on delete cascade,
 granted_by uuid not null references auth.users(id),
 authorization_reference text not null check (char_length(btrim(authorization_reference)) between 8 and 400),
 granted_at timestamptz not null default now(),
 revoked_at timestamptz,
 revoked_by uuid references auth.users(id),
 revocation_reason text,
 updated_at timestamptz not null default now(),
 primary key(farm_id,advisor_id),
 constraint advisor_finance_revocation_valid check (
  (revoked_at is null and revoked_by is null and revocation_reason is null) or
  (revoked_at is not null and revoked_by is not null and char_length(btrim(coalesce(revocation_reason,''))) between 8 and 400)
 )
);
create index if not exists advisor_finance_active_grants_idx on public.farm_advisor_finance_grants(advisor_id,farm_id) where revoked_at is null;
alter table public.farm_advisor_finance_grants enable row level security;
revoke all on public.farm_advisor_finance_grants from public,anon,authenticated;
grant select on public.farm_advisor_finance_grants to authenticated;
create policy "owner or assigned advisor reads grant" on public.farm_advisor_finance_grants
 for select to authenticated using (
  (advisor_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='advisor' and coalesce(p.system_role,'user')='user'))
  or exists(select 1 from public.farms f where f.id=farm_id and f.owner_id=(select auth.uid()))
 );

-- The service-role admin operation and its audit either both succeed or both roll back.
create or replace function app_private.audit_advisor_finance_grant()
 returns trigger language plpgsql security invoker set search_path='' as $$
begin
 insert into public.admin_audit_events(actor_user_id,action,target_type,target_id,reason,before_state,after_state,metadata)
 values(
  case when new.revoked_at is null then new.granted_by else new.revoked_by end,
  case when new.revoked_at is null then 'advisor_finance_granted' else 'advisor_finance_revoked' end,
  'advisor_finance_grant',new.farm_id::text,
  case when new.revoked_at is null then new.authorization_reference else new.revocation_reason end,
  case when tg_op='UPDATE' then jsonb_build_object('owner_id',old.owner_id,'advisor_id',old.advisor_id,'revoked_at',old.revoked_at) else null end,
  jsonb_build_object('owner_id',new.owner_id,'advisor_id',new.advisor_id,'revoked_at',new.revoked_at),
  jsonb_build_object('source','system-admin/finance','farm_id',new.farm_id,'advisor_id',new.advisor_id)
 );
 return new;
end;
$$;
revoke all on function app_private.audit_advisor_finance_grant() from public,anon,authenticated;
drop trigger if exists advisor_finance_grant_audit on public.farm_advisor_finance_grants;
create trigger advisor_finance_grant_audit after insert or update on public.farm_advisor_finance_grants
 for each row execute function app_private.audit_advisor_finance_grant();
