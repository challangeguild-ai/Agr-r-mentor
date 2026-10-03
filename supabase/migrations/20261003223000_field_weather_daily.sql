create table if not exists public.field_weather_daily (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.fields(id) on delete cascade,
  weather_date date not null,
  source_type text not null check (source_type in ('measured','calculated','forecast')),
  provider text not null,
  station_number text,
  station_name text,
  station_lat double precision,
  station_lng double precision,
  distance_km numeric(8,2),
  precipitation_mm numeric(10,2) not null default 0 check (precipitation_mm >= 0),
  temperature_min_c numeric(6,2),
  temperature_max_c numeric(6,2),
  source_url text,
  source_file text,
  fetched_at timestamptz not null default now(),
  source_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(field_id,weather_date,provider,station_number)
);

create index if not exists field_weather_daily_field_date_idx
  on public.field_weather_daily(field_id,weather_date desc);

alter table public.field_weather_daily enable row level security;

create policy "field weather scoped read"
on public.field_weather_daily for select to authenticated
using (
  (select app_private.is_advisor())
  or exists (
    select 1 from public.fields fi
    join public.farms f on f.id=fi.farm_id
    where fi.id=field_weather_daily.field_id
      and f.owner_id=(select auth.uid())
  )
  or exists (
    select 1 from public.fields fi
    join public.farm_members fm on fm.farm_id=fi.farm_id
    where fi.id=field_weather_daily.field_id
      and fm.user_id=(select auth.uid())
      and fm.active
  )
);

revoke all on public.field_weather_daily from anon,authenticated;
grant select on public.field_weather_daily to authenticated;

alter table public.timeline_events drop constraint if exists timeline_events_event_type_check;
alter table public.timeline_events add constraint timeline_events_event_type_check check (event_type in (
  'inspection','inspection_followup','task','task_completed','task_accepted','task_started','task_completed_verified',
  'task_submitted_review','task_review_approved','task_review_rejected','operation_plan_created',
  'crop','note','document','farmer_report','advisor_reply','report_closed','field_operation',
  'supervision_config','field_hotspot','advisor_visit_plan','weather_observation'
));
