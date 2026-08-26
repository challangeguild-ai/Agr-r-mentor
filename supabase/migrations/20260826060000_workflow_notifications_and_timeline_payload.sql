-- Workflow notification routing and mobile-safe timeline payload storage.

alter table public.notifications add column if not exists event_key text;
create unique index if not exists notifications_user_event_key_uq
  on public.notifications(user_id,event_key)
  where event_key is not null;

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
  v_actor uuid := auth.uid();
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
    select p.id from public.profiles p where p.role='advisor' and p.id<>v_actor
  ), inserted as (
    insert into public.notifications(user_id,kind,title,message,href,event_key)
    select r.id,v_kind,v_title,v_message,v_href,v_key from recipients r
    on conflict (user_id,event_key) where event_key is not null do nothing
    returning user_id
  )
  select user_id from inserted;
end;
$$;
revoke all on function public.notify_advisors(text,text,text,text,text) from public;
grant execute on function public.notify_advisors(text,text,text,text,text) to authenticated;

alter table public.timeline_events add column if not exists technical_payload jsonb;

create or replace function public.normalize_timeline_technical_payload()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
begin
  if new.description like 'TASKPROOF:%' then
    begin
      new.technical_payload := substring(new.description from 11)::jsonb;
      new.description := 'GPS helyszínadat rögzítve · Helyszíni fotó csatolva.';
    exception when others then
      new.description := 'GPS helyszínadat és helyszíni fotó rögzítve.';
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists normalize_timeline_technical_payload_trg on public.timeline_events;
create trigger normalize_timeline_technical_payload_trg
before insert or update of description on public.timeline_events
for each row execute function public.normalize_timeline_technical_payload();

update public.timeline_events
set description=description
where description like 'TASKPROOF:%';
