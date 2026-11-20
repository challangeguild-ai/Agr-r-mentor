-- Notification RPCs must only accept events that the calling user actually
-- owns. The former allowlist accidentally rejected farmer reports and hotspot
-- reports, while permitting arbitrary worker-supplied advisor notifications.

create or replace function public.notify_advisors(
  p_kind text,
  p_title text,
  p_message text default null,
  p_href text default null,
  p_event_key text default null
) returns table(recipient_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_parts text[];
  v_entity_id uuid;
  v_allowed boolean := false;
begin
  if v_actor is null then
    raise exception 'Bejelentkezés szükséges';
  end if;
  select role into v_role from public.profiles where id = v_actor;
  if v_role is null then
    raise exception 'Profil nem található';
  end if;
  if length(coalesce(p_kind,'')) < 1 or length(p_kind) > 80
    or length(coalesce(p_title,'')) < 1 or length(p_title) > 200
    or length(coalesce(p_message,'')) > 3000
    or length(coalesce(p_href,'')) > 500
    or length(coalesce(p_event_key,'')) > 250 then
    raise exception 'Érvénytelen értesítési adat';
  end if;
  if p_href is not null and p_href <> '' and p_href not like '/admin%' then
    raise exception 'Érvénytelen szaktanácsadói hivatkozás';
  end if;

  if v_role <> 'advisor' then
    -- Every non-advisor notification must point at a specific, existing event.
    -- This also caps duplicates via the notifications(user_id,event_key) index.
    v_parts := regexp_match(coalesce(p_event_key,''),
      '^(task|report|hotspot):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):(accepted|started|submitted|created|resolved)$');
    if v_parts is null then
      raise exception 'Az értesítéshez érvényes eseményazonosító szükséges';
    end if;
    v_entity_id := v_parts[2]::uuid;

    if p_kind in ('task_accepted','task_worker_accepted','task_started','task_worker_started')
      and v_parts[1] = 'task'
      and (
        (p_kind in ('task_accepted','task_worker_accepted') and v_parts[3] = 'accepted')
        or (p_kind in ('task_started','task_worker_started') and v_parts[3] = 'started')
      ) then
      select exists(
        select 1 from public.tasks t
        join public.timeline_events e on e.source_id = t.id
        where t.id = v_entity_id and t.assigned_to = v_actor
          and e.created_by = v_actor
          and e.event_type = case when v_parts[3] = 'accepted' then 'task_accepted' else 'task_started' end
      ) into v_allowed;

    elsif p_kind = 'task_submitted_review' and v_parts[1] = 'task' and v_parts[3] = 'submitted' then
      select exists(
        select 1 from public.tasks t
        join public.task_execution_reports r on r.task_id = t.id
        where t.id = v_entity_id and t.assigned_to = v_actor
          and t.status = 'submitted' and r.reported_by = v_actor
          and r.review_status = 'pending'
      ) into v_allowed;

    elsif p_kind = 'farmer_report' and v_parts[1] = 'report' and v_parts[3] = 'created' then
      select exists(
        select 1 from public.farmer_reports r
        join public.fields fi on fi.id = r.field_id
        join public.farms f on f.id = fi.farm_id
        where r.id = v_entity_id and r.farmer_id = v_actor and f.owner_id = v_actor
      ) into v_allowed;

    elsif p_kind in ('hotspot','hotspot_resolved') and v_parts[1] = 'hotspot'
      and (
        (p_kind = 'hotspot' and v_parts[3] = 'created')
        or (p_kind = 'hotspot_resolved' and v_parts[3] = 'resolved')
      ) then
      select exists(
        select 1 from public.timeline_events e
        join public.fields fi on fi.id = e.field_id
        join public.farms f on f.id = fi.farm_id
        where e.id = v_entity_id and e.event_type = 'field_hotspot'
          and f.owner_id = v_actor
          and e.description like 'HOTSPOTJSON:%'
          and (p_kind = 'hotspot_resolved' or e.created_by = v_actor)
          and coalesce((substring(e.description from 13)::jsonb ->> 'resolved')::boolean,false)
              = (p_kind = 'hotspot_resolved')
      ) into v_allowed;
    end if;

    if not coalesce(v_allowed,false) then
      raise exception 'Ehhez az értesítési eseményhez nincs jogosultságod';
    end if;
  end if;

  return query
    with targets as (
      select p.id from public.profiles p
      where p.role = 'advisor' and coalesce(p.system_role,'user') <> 'admin'
    ), ins as (
      insert into public.notifications(user_id,kind,title,message,href,event_key)
      select t.id,p_kind,p_title,p_message,p_href,
        case when p_event_key is null then null else p_event_key||':advisor:'||t.id::text end
      from targets t
      on conflict (user_id,event_key) where event_key is not null do nothing
      returning user_id
    ) select user_id from ins;
end;
$$;

revoke all on function public.notify_advisors(text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.notify_advisors(text,text,text,text,text) to authenticated;

-- This legacy profile RPC already rejects missing auth.uid() and only updates
-- the caller's own row. Anonymous execution is unnecessary and flagged by
-- Supabase's public SECURITY DEFINER advisor.
do $$
begin
  if to_regprocedure('public.update_own_profile(text,text,text)') is not null then
    revoke execute on function public.update_own_profile(text,text,text) from public, anon;
  end if;
end;
$$;
