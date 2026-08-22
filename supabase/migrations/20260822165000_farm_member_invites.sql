create table if not exists public.farm_member_invites (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  email text not null,
  full_name text,
  member_role text not null default 'operator',
  invited_by uuid not null references auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint farm_member_invites_role_check check (member_role in ('manager','agronomist','operator','harvester'))
);
create unique index if not exists farm_member_invites_pending_unique on public.farm_member_invites(farm_id,lower(email)) where accepted_at is null;
create index if not exists farm_member_invites_email_idx on public.farm_member_invites(lower(email));
alter table public.farm_member_invites enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='farm_member_invites' and policyname='farm owners manage member invites') then
    create policy "farm owners manage member invites" on public.farm_member_invites for all to authenticated
      using (exists(select 1 from public.farms f where f.id=farm_id and f.owner_id=auth.uid()))
      with check (exists(select 1 from public.farms f where f.id=farm_id and f.owner_id=auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='farm_member_invites' and policyname='invitee can read own invite') then
    create policy "invitee can read own invite" on public.farm_member_invites for select to authenticated
      using (lower(email)=lower(coalesce(auth.jwt()->>'email','')) and accepted_at is null);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='farm_member_invites' and policyname='invitee can accept own invite') then
    create policy "invitee can accept own invite" on public.farm_member_invites for update to authenticated
      using (lower(email)=lower(coalesce(auth.jwt()->>'email','')) and accepted_at is null)
      with check (lower(email)=lower(coalesce(auth.jwt()->>'email','')));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='farm_members' and policyname='invitee can create own membership') then
    create policy "invitee can create own membership" on public.farm_members for insert to authenticated
      with check (user_id=auth.uid() and exists(select 1 from public.farm_member_invites i where i.farm_id=farm_id and lower(i.email)=lower(coalesce(auth.jwt()->>'email','')) and i.accepted_at is null));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='farm_members' and policyname='advisors can read memberships') then
    create policy "advisors can read memberships" on public.farm_members for select to authenticated
      using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='advisor'));
  end if;
end $$;
