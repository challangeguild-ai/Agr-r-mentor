create table if not exists public.weather_sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running','success','partial','failed')),
  fields_total integer not null default 0 check (fields_total >= 0),
  fields_synced integer not null default 0 check (fields_synced >= 0),
  fields_skipped integer not null default 0 check (fields_skipped >= 0),
  stations_requested integer not null default 0 check (stations_requested >= 0),
  stations_failed integer not null default 0 check (stations_failed >= 0),
  observations_upserted integer not null default 0 check (observations_upserted >= 0),
  timeline_inserted integer not null default 0 check (timeline_inserted >= 0),
  error_summary jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists weather_sync_runs_started_idx
  on public.weather_sync_runs(started_at desc);

alter table public.weather_sync_runs enable row level security;
revoke all on public.weather_sync_runs from anon, authenticated;
grant all on public.weather_sync_runs to service_role;

comment on table public.weather_sync_runs is
'Operational evidence for official HungaroMet ODP weather synchronization runs. Service-role only.';
