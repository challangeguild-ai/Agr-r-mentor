-- Final database hardening/performance cleanup.
-- 1) Keep system administrators out of advisor-only farm permissions and notifications.
-- 2) Make auth helper calls in existing RLS policies initialization-plan friendly
--    without changing policy semantics.

create or replace function public.can_manage_farm(target_farm uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists(
    select 1 from public.farms f
    where f.id=target_farm and f.owner_id=(select auth.uid())
  )
  or exists(
    select 1 from public.farm_members fm
    where fm.farm_id=target_farm
      and fm.user_id=(select auth.uid())
      and fm.active
      and fm.member_role in ('manager','agronomist')
  )
  or (select app_private.is_advisor());
$$;

create or replace function public.can_coordinate_farm(target_farm uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists(
    select 1 from public.farms f
    where f.id=target_farm and f.owner_id=(select auth.uid())
  )
  or exists(
    select 1 from public.farm_members fm
    where fm.farm_id=target_farm
      and fm.user_id=(select auth.uid())
      and fm.active
      and fm.member_role in ('manager','agronomist')
  );
$$;

create or replace function public.is_active_farm_member(target_farm uuid, target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists(
    select 1 from public.farm_members fm
    where fm.farm_id=target_farm and fm.user_id=target_user and fm.active
  );
$$;

create or replace function public.notify_advisors(
  p_kind text,
  p_title text,
  p_message text default null,
  p_href text default null,
  p_event_key text default null
)
returns table(recipient_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := (select auth.uid());
  v_kind text := left(trim(coalesce(p_kind,'')),80);
  v_title text := left(trim(coalesce(p_title,'')),200);
  v_message text := nullif(left(trim(coalesce(p_message,'')),2000),'');
  v_href text := nullif(left(trim(coalesce(p_href,'')),500),'');
  v_key text := nullif(left(trim(coalesce(p_event_key,'')),200),'');
begin
  if v_actor is null then raise exception 'Bejelentkezés szükséges'; end if;
  if v_kind='' or v_title='' then raise exception 'Hiányzó értesítési adatok'; end if;
  if not exists(select 1 from public.profiles where id=v_actor) then raise exception 'Ismeretlen felhasználó'; end if;

  return query
  with recipients as (
    select p.id
    from public.profiles p
    where p.role='advisor'
      and coalesce(p.system_role,'user') <> 'admin'
      and p.id<>v_actor
  ), inserted as (
    insert into public.notifications(user_id,kind,title,message,href,event_key)
    select r.id,v_kind,v_title,v_message,v_href,v_key from recipients r
    on conflict (user_id,event_key) where event_key is not null do nothing
    returning user_id
  )
  select user_id from inserted;
end;
$$;

-- Existing application policies are preserved verbatim except that auth.uid()
-- and auth.jwt() are evaluated once per statement rather than once per row.
do $$
declare
  r record;
  v_using text;
  v_check text;
  v_sql text;
begin
  for r in
    select schemaname,tablename,policyname,qual,with_check
    from pg_policies
    where schemaname='public'
      and (
        coalesce(qual,'') like '%auth.uid()%'
        or coalesce(with_check,'') like '%auth.uid()%'
        or coalesce(qual,'') like '%auth.jwt()%'
        or coalesce(with_check,'') like '%auth.jwt()%'
      )
  loop
    v_using := r.qual;
    v_check := r.with_check;
    if v_using is not null then
      v_using := replace(v_using,'auth.uid()','(select auth.uid())');
      v_using := replace(v_using,'auth.jwt()','(select auth.jwt())');
    end if;
    if v_check is not null then
      v_check := replace(v_check,'auth.uid()','(select auth.uid())');
      v_check := replace(v_check,'auth.jwt()','(select auth.jwt())');
    end if;

    v_sql := format('alter policy %I on %I.%I',r.policyname,r.schemaname,r.tablename);
    if v_using is not null then v_sql := v_sql || format(' using (%s)',v_using); end if;
    if v_check is not null then v_sql := v_sql || format(' with check (%s)',v_check); end if;
    execute v_sql;
  end loop;
end $$;

revoke all on function public.can_manage_farm(uuid) from public, anon;
revoke all on function public.can_coordinate_farm(uuid) from public, anon;
revoke all on function public.is_active_farm_member(uuid,uuid) from public, anon;
revoke all on function public.notify_advisors(text,text,text,text,text) from public, anon;
grant execute on function public.can_manage_farm(uuid) to authenticated, service_role;
grant execute on function public.can_coordinate_farm(uuid) to authenticated, service_role;
grant execute on function public.is_active_farm_member(uuid,uuid) to authenticated, service_role;
grant execute on function public.notify_advisors(text,text,text,text,text) to authenticated, service_role;
