create table if not exists public.farm_contacts (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  contact_type text not null check (contact_type in ('phone','email')),
  label text not null,
  value text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint farm_contacts_phone_requires_name check (contact_type <> 'phone' or length(trim(label)) > 0),
  constraint farm_contacts_value_not_blank check (length(trim(value)) > 0)
);
create index if not exists farm_contacts_farm_idx on public.farm_contacts(farm_id,contact_type,is_primary desc,created_at);
alter table public.farm_contacts enable row level security;
create policy "farm contacts advisor all" on public.farm_contacts for all using (app_private.is_advisor()) with check (app_private.is_advisor());
create policy "farm contacts owner select" on public.farm_contacts for select using (exists(select 1 from public.farms f where f.id=farm_id and f.owner_id=auth.uid()));

create table if not exists public.profile_contacts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  contact_type text not null check (contact_type in ('phone','email')),
  label text not null,
  value text not null,
  is_primary boolean not null default false,
  visible_to_counterparty boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_contacts_phone_requires_name check (contact_type <> 'phone' or length(trim(label)) > 0),
  constraint profile_contacts_value_not_blank check (length(trim(value)) > 0)
);
create index if not exists profile_contacts_profile_idx on public.profile_contacts(profile_id,contact_type,is_primary desc,created_at);
alter table public.profile_contacts enable row level security;
create policy "users manage own profile contacts" on public.profile_contacts for all using (profile_id=auth.uid()) with check (profile_id=auth.uid());
create policy "advisors view farmer profile contacts" on public.profile_contacts for select using (app_private.is_advisor());
create policy "farmers view advisor public contacts" on public.profile_contacts for select using (visible_to_counterparty and exists(select 1 from public.profiles p where p.id=profile_id and p.role='advisor'));

create table if not exists public.communication_receipts (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('farmer_report','inspection','task','advisor_message')),
  entity_id uuid not null,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(entity_type,entity_id,viewer_id)
);
create index if not exists communication_receipts_entity_idx on public.communication_receipts(entity_type,entity_id);
alter table public.communication_receipts enable row level security;
create policy "users manage own communication receipts" on public.communication_receipts for all using (viewer_id=auth.uid()) with check (viewer_id=auth.uid());
create policy "advisors view communication receipts" on public.communication_receipts for select using (app_private.is_advisor());

create table if not exists public.personal_followups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  entity_type text not null check (entity_type in ('farmer_report','inspection','task','advisor_message')),
  entity_id uuid not null,
  title text not null,
  href text not null,
  remind_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','done','cancelled')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(user_id,entity_type,entity_id,remind_at)
);
create index if not exists personal_followups_due_idx on public.personal_followups(user_id,status,remind_at);
alter table public.personal_followups enable row level security;
create policy "users manage own followups" on public.personal_followups for all using (user_id=auth.uid()) with check (user_id=auth.uid());

grant select,insert,update,delete on public.farm_contacts to authenticated;
grant select,insert,update,delete on public.profile_contacts to authenticated;
grant select,insert,update on public.communication_receipts to authenticated;
grant select,insert,update,delete on public.personal_followups to authenticated;

create or replace function public.mark_communication_seen(p_entity_type text,p_entity_id uuid)
returns void language plpgsql security definer set search_path='public','pg_temp' as $$
begin
  if auth.uid() is null then raise exception 'Bejelentkezés szükséges'; end if;
  insert into public.communication_receipts(entity_type,entity_id,viewer_id)
  values(p_entity_type,p_entity_id,auth.uid())
  on conflict(entity_type,entity_id,viewer_id) do update set last_seen_at=now();
end;$$;
revoke all on function public.mark_communication_seen(text,uuid) from public,anon;
grant execute on function public.mark_communication_seen(text,uuid) to authenticated;
