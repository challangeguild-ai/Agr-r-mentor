create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_user_id uuid null references auth.users(id) on delete set null,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info','low','medium','high','critical')),
  risk_score integer not null default 0 check (risk_score between 0 and 100),
  ip_address inet null,
  country_code text null,
  region text null,
  city text null,
  user_agent text null,
  request_path text null,
  method text null,
  subject_type text null,
  subject_id text null,
  detail jsonb not null default '{}'::jsonb,
  fingerprint text null,
  alerted_at timestamptz null,
  retained_until timestamptz not null default (now() + interval '90 days')
);

create index if not exists security_events_created_idx on public.security_events(created_at desc);
create index if not exists security_events_actor_idx on public.security_events(actor_user_id, created_at desc);
create index if not exists security_events_ip_idx on public.security_events(ip_address, created_at desc);
create index if not exists security_events_risk_idx on public.security_events(risk_score desc, created_at desc);
create unique index if not exists security_events_fingerprint_idx on public.security_events(fingerprint) where fingerprint is not null;

alter table public.security_events enable row level security;

revoke all on table public.security_events from anon, authenticated;

-- SECURITY DEFINER keeps the raw ledger inaccessible to normal application roles.
create or replace function public.record_security_event(
  p_event_type text,
  p_severity text default 'info',
  p_risk_score integer default 0,
  p_ip_address inet default null,
  p_country_code text default null,
  p_region text default null,
  p_city text default null,
  p_user_agent text default null,
  p_request_path text default null,
  p_method text default null,
  p_subject_type text default null,
  p_subject_id text default null,
  p_detail jsonb default '{}'::jsonb,
  p_fingerprint text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_uid uuid := auth.uid();
begin
  if auth.role() not in ('authenticated','service_role') then
    raise exception 'not authorized';
  end if;
  insert into public.security_events(actor_user_id,event_type,severity,risk_score,ip_address,country_code,region,city,user_agent,request_path,method,subject_type,subject_id,detail,fingerprint)
  values(v_uid,left(p_event_type,80),case when p_severity in ('info','low','medium','high','critical') then p_severity else 'info' end,greatest(0,least(coalesce(p_risk_score,0),100)),p_ip_address,left(p_country_code,8),left(p_region,120),left(p_city,120),left(p_user_agent,500),left(p_request_path,500),left(p_method,12),left(p_subject_type,80),left(p_subject_id,200),coalesce(p_detail,'{}'::jsonb),p_fingerprint)
  on conflict (fingerprint) where fingerprint is not null do update set created_at=excluded.created_at
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.record_security_event(text,text,integer,inet,text,text,text,text,text,text,text,text,jsonb,text) from public, anon;
grant execute on function public.record_security_event(text,text,integer,inet,text,text,text,text,text,text,text,text,jsonb,text) to authenticated, service_role;

create or replace function public.security_event_summary(p_minutes integer default 10)
returns table(event_type text, ip_address inet, event_count bigint, max_risk integer, last_seen timestamptz)
language sql
security definer
set search_path = public, pg_temp
as $$
  select e.event_type,e.ip_address,count(*),max(e.risk_score),max(e.created_at)
  from public.security_events e
  where e.created_at >= now() - make_interval(mins => greatest(1,least(coalesce(p_minutes,10),1440)))
  group by e.event_type,e.ip_address
  having count(*) >= 5 or max(e.risk_score) >= 70
  order by max(e.risk_score) desc,count(*) desc;
$$;
revoke all on function public.security_event_summary(integer) from public, anon, authenticated;
grant execute on function public.security_event_summary(integer) to service_role;
