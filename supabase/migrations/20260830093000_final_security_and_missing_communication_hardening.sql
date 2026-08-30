-- Final audit hardening migration, applied to production Supabase.
-- Restores the missing communication/contact schema and closes the privilege-escalation paths found by the final audit.

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
drop policy if exists "farm contacts advisor all" on public.farm_contacts;
drop policy if exists "farm contacts owner select" on public.farm_contacts;
create policy "farm contacts advisor all" on public.farm_contacts for all to authenticated using (app_private.is_advisor()) with check (app_private.is_advisor());
create policy "farm contacts owner select" on public.farm_contacts for select to authenticated using (exists(select 1 from public.farms f where f.id=farm_id and f.owner_id=auth.uid()));

create table if not exists public.profile_contacts (
  id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id) on delete cascade,
  contact_type text not null check (contact_type in ('phone','email')), label text not null, value text not null,
  is_primary boolean not null default false, visible_to_counterparty boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint profile_contacts_phone_requires_name check (contact_type <> 'phone' or length(trim(label)) > 0),
  constraint profile_contacts_value_not_blank check (length(trim(value)) > 0)
);
create index if not exists profile_contacts_profile_idx on public.profile_contacts(profile_id,contact_type,is_primary desc,created_at);
alter table public.profile_contacts enable row level security;
drop policy if exists "users manage own profile contacts" on public.profile_contacts;
drop policy if exists "advisors view farmer profile contacts" on public.profile_contacts;
drop policy if exists "farmers view advisor public contacts" on public.profile_contacts;
create policy "users manage own profile contacts" on public.profile_contacts for all to authenticated using (profile_id=auth.uid()) with check (profile_id=auth.uid());
create policy "advisors view farmer profile contacts" on public.profile_contacts for select to authenticated using (app_private.is_advisor());
create policy "farmers view advisor public contacts" on public.profile_contacts for select to authenticated using (visible_to_counterparty and exists(select 1 from public.profiles p where p.id=profile_id and p.role='advisor' and coalesce(p.system_role,'user')<>'admin'));

create table if not exists public.communication_receipts (
  id uuid primary key default gen_random_uuid(), entity_type text not null check (entity_type in ('farmer_report','inspection','task','advisor_message')),
  entity_id uuid not null, viewer_id uuid not null references public.profiles(id) on delete cascade,
  first_seen_at timestamptz not null default now(), last_seen_at timestamptz not null default now(), unique(entity_type,entity_id,viewer_id)
);
create index if not exists communication_receipts_entity_idx on public.communication_receipts(entity_type,entity_id);
alter table public.communication_receipts enable row level security;
drop policy if exists "users manage own communication receipts" on public.communication_receipts;
drop policy if exists "advisors view communication receipts" on public.communication_receipts;
create policy "users manage own communication receipts" on public.communication_receipts for all to authenticated using (viewer_id=auth.uid()) with check (viewer_id=auth.uid());
create policy "advisors view communication receipts" on public.communication_receipts for select to authenticated using (app_private.is_advisor());

create table if not exists public.personal_followups (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  entity_type text not null check (entity_type in ('farmer_report','inspection','task','advisor_message')), entity_id uuid not null,
  title text not null, href text not null, remind_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','done','cancelled','notified')),
  created_at timestamptz not null default now(), completed_at timestamptz, notified_at timestamptz,
  unique(user_id,entity_type,entity_id,remind_at)
);
create index if not exists personal_followups_due_idx on public.personal_followups(user_id,status,remind_at);
alter table public.personal_followups enable row level security;
drop policy if exists "users manage own followups" on public.personal_followups;
create policy "users manage own followups" on public.personal_followups for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
grant select,insert,update,delete on public.farm_contacts,public.profile_contacts,public.personal_followups to authenticated;
grant select,insert,update on public.communication_receipts to authenticated;

create or replace function public.mark_communication_seen(p_entity_type text,p_entity_id uuid)
returns void language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_uid uuid:=auth.uid(); v_allowed boolean:=false;
begin
  if v_uid is null then raise exception 'Bejelentkezés szükséges'; end if;
  if p_entity_type='farmer_report' then
    select exists(select 1 from public.farmer_reports r join public.fields fi on fi.id=r.field_id join public.farms f on f.id=fi.farm_id where r.id=p_entity_id and (r.farmer_id=v_uid or f.owner_id=v_uid or app_private.is_advisor())) into v_allowed;
  elsif p_entity_type='inspection' then
    select exists(select 1 from public.inspections i join public.fields fi on fi.id=i.field_id join public.farms f on f.id=fi.farm_id where i.id=p_entity_id and (i.advisor_id=v_uid or f.owner_id=v_uid or app_private.is_advisor())) into v_allowed;
  elsif p_entity_type='task' then
    select exists(select 1 from public.tasks t join public.farms f on f.id=t.farm_id where t.id=p_entity_id and (t.assigned_to=v_uid or f.owner_id=v_uid or app_private.is_advisor())) into v_allowed;
  end if;
  if not v_allowed then raise exception 'Ehhez a kommunikációhoz nincs hozzáférésed'; end if;
  insert into public.communication_receipts(entity_type,entity_id,viewer_id) values(p_entity_type,p_entity_id,v_uid)
  on conflict(entity_type,entity_id,viewer_id) do update set last_seen_at=now();
end;$$;
revoke all on function public.mark_communication_seen(text,uuid) from public,anon;
grant execute on function public.mark_communication_seen(text,uuid) to authenticated;

create or replace function public.dispatch_due_personal_followups()
returns integer language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_uid uuid:=auth.uid(); v_count integer:=0;
begin
  if v_uid is null then raise exception 'Bejelentkezés szükséges'; end if;
  with due as (select id,title,href from public.personal_followups where user_id=v_uid and status='pending' and remind_at<=now() for update skip locked),
  ins as (insert into public.notifications(user_id,kind,title,message,href,event_key) select v_uid,'personal_followup','Emlékeztető',d.title,d.href,'followup:'||d.id::text from due d on conflict (user_id,event_key) where event_key is not null do nothing returning event_key),
  upd as (update public.personal_followups p set status='notified',notified_at=now() from due d where p.id=d.id returning p.id)
  select count(*) into v_count from upd; return v_count;
end;$$;
revoke all on function public.dispatch_due_personal_followups() from public,anon;
grant execute on function public.dispatch_due_personal_followups() to authenticated;

create or replace function public.guard_profile_privileged_columns()
returns trigger language plpgsql security invoker set search_path='public','pg_temp' as $$
begin
  if auth.role() <> 'service_role' and (new.id is distinct from old.id or new.role is distinct from old.role or new.system_role is distinct from old.system_role or new.created_at is distinct from old.created_at) then
    raise exception 'A szerepkör és rendszerjogosultság közvetlenül nem módosítható.';
  end if;
  return new;
end;$$;
drop trigger if exists guard_profile_privileged_columns on public.profiles;
create trigger guard_profile_privileged_columns before update on public.profiles for each row execute function public.guard_profile_privileged_columns();

create or replace function public.accept_farm_member_invite(p_invite_id uuid)
returns uuid language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_uid uuid:=auth.uid(); v_email text; v_inv public.farm_member_invites%rowtype; v_member_id uuid;
begin
  if v_uid is null then raise exception 'Bejelentkezés szükséges'; end if;
  select lower(email) into v_email from auth.users where id=v_uid;
  select * into v_inv from public.farm_member_invites where id=p_invite_id and accepted_at is null for update;
  if not found or lower(v_inv.email) is distinct from v_email then raise exception 'Nincs elfogadható meghívó.'; end if;
  insert into public.farm_members(farm_id,user_id,member_role,active,invited_by,updated_at)
  values(v_inv.farm_id,v_uid,v_inv.member_role,true,v_inv.invited_by,now())
  on conflict(farm_id,user_id) do update set member_role=excluded.member_role,active=true,invited_by=excluded.invited_by,updated_at=now()
  returning id into v_member_id;
  update public.farm_member_invites set accepted_at=now() where id=v_inv.id;
  return v_member_id;
end;$$;
revoke all on function public.accept_farm_member_invite(uuid) from public,anon;
grant execute on function public.accept_farm_member_invite(uuid) to authenticated;
drop policy if exists "invitee can accept own invite" on public.farm_member_invites;
drop policy if exists "invitee can create own membership" on public.farm_members;

drop policy if exists "assigned workers can update tasks" on public.tasks;

create or replace function public.guard_operation_approver_material_update()
returns trigger language plpgsql security invoker set search_path='public','pg_temp' as $$
declare v_uid uuid:=auth.uid(); v_owner uuid;
begin
  if v_uid is null or auth.role()='service_role' then return new; end if;
  select owner_id into v_owner from public.farms where id=old.farm_id;
  if old.requested_approver_id=v_uid and v_uid is distinct from v_owner and not app_private.is_advisor() then
    if new.id is distinct from old.id or new.farm_id is distinct from old.farm_id or new.field_id is distinct from old.field_id or new.operation_date is distinct from old.operation_date or new.operation_type is distinct from old.operation_type or new.country_code is distinct from old.country_code or new.subtype is distinct from old.subtype or new.product_id is distinct from old.product_id or new.plant_protection_use_id is distinct from old.plant_protection_use_id or new.product_name is distinct from old.product_name or new.authorization_number is distinct from old.authorization_number or new.crop is distinct from old.crop or new.target is distinct from old.target or new.active_ingredient is distinct from old.active_ingredient or new.composition is distinct from old.composition or new.dose is distinct from old.dose or new.dose_unit is distinct from old.dose_unit or new.quantity is distinct from old.quantity or new.quantity_unit is distinct from old.quantity_unit or new.treated_area is distinct from old.treated_area or new.machine_id is distinct from old.machine_id or new.machine_name is distinct from old.machine_name or new.operator_name is distinct from old.operator_name or new.weather is distinct from old.weather or new.notes is distinct from old.notes or new.catalog_mode is distinct from old.catalog_mode or new.created_by is distinct from old.created_by or new.dose_mode is distinct from old.dose_mode or new.official_dose_max is distinct from old.official_dose_max or new.regulatory_category is distinct from old.regulatory_category or new.approval_required is distinct from old.approval_required or new.requested_approver_id is distinct from old.requested_approver_id or new.regulatory_snapshot is distinct from old.regulatory_snapshot or new.catalog_snapshot is distinct from old.catalog_snapshot or new.source_task_id is distinct from old.source_task_id then
      raise exception 'A kijelölt jóváhagyó csak a jóváhagyási döntést és megjegyzést módosíthatja.';
    end if;
  end if;
  return new;
end;$$;
drop trigger if exists aaa_guard_operation_approver_material_update on public.field_operations;
create trigger aaa_guard_operation_approver_material_update before update on public.field_operations for each row execute function public.guard_operation_approver_material_update();

drop policy if exists "Users create advisor notifications" on public.notifications;
create or replace function public.notify_advisors(p_kind text,p_title text,p_message text default null,p_href text default null,p_event_key text default null)
returns table(recipient_id uuid) language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_actor uuid:=auth.uid(); v_role text;
begin
  if v_actor is null then raise exception 'Bejelentkezés szükséges'; end if;
  select role into v_role from public.profiles where id=v_actor;
  if v_role is null then raise exception 'Profil nem található'; end if;
  if length(coalesce(p_kind,''))<1 or length(p_kind)>80 or length(coalesce(p_title,''))<1 or length(p_title)>200 or length(coalesce(p_message,''))>3000 or length(coalesce(p_href,''))>500 or length(coalesce(p_event_key,''))>250 then raise exception 'Érvénytelen értesítési adat'; end if;
  if p_href is not null and p_href<>'' and p_href not like '/admin%' then raise exception 'Érvénytelen szaktanácsadói hivatkozás'; end if;
  if v_role<>'advisor' and p_kind not in ('task_worker_accepted','task_worker_started','task_submitted_review','task_accepted','task_started') then raise exception 'Ez az értesítéstípus nem küldhető közvetlenül'; end if;
  return query with targets as (select p.id from public.profiles p where p.role='advisor' and coalesce(p.system_role,'user')<>'admin'),
  ins as (insert into public.notifications(user_id,kind,title,message,href,event_key) select t.id,p_kind,p_title,p_message,p_href,case when p_event_key is null then null else p_event_key||':advisor:'||t.id::text end from targets t on conflict (user_id,event_key) where event_key is not null do nothing returning user_id)
  select user_id from ins;
end;$$;
revoke all on function public.notify_advisors(text,text,text,text,text) from public,anon;
grant execute on function public.notify_advisors(text,text,text,text,text) to authenticated;

drop policy if exists "report media scoped read" on storage.objects;
create policy "report media scoped read" on storage.objects for select to authenticated using (
  bucket_id='farmer-report-media' and (
    app_private.is_advisor() or (storage.foldername(name))[1]=auth.uid()::text
    or exists(select 1 from public.farmer_report_media frm join public.farmer_reports r on r.id=frm.report_id join public.fields fi on fi.id=r.field_id join public.farms f on f.id=fi.farm_id where frm.storage_path=objects.name and (r.farmer_id=auth.uid() or f.owner_id=auth.uid() or exists(select 1 from public.farm_members fm where fm.farm_id=f.id and fm.user_id=auth.uid() and fm.active)))
    or ((storage.foldername(name))[2]='task-proofs' and exists(select 1 from public.tasks t join public.farms f on f.id=t.farm_id where t.id::text=(storage.foldername(objects.name))[3] and (t.assigned_to=auth.uid() or f.owner_id=auth.uid() or exists(select 1 from public.farm_members fm where fm.farm_id=f.id and fm.user_id=auth.uid() and fm.active and fm.member_role in ('manager','agronomist')))))
  )
);

do $$ declare r record; begin
  for r in select tablename from pg_tables where schemaname='public' loop
    execute format('revoke all on table public.%I from anon',r.tablename);
    execute format('revoke truncate, trigger, references on table public.%I from authenticated',r.tablename);
  end loop;
end $$;
grant select,insert,update,delete on public.farm_contacts,public.profile_contacts,public.personal_followups to authenticated;
grant select,insert,update on public.communication_receipts to authenticated;
