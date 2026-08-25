create table if not exists public.plant_protection_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  country_code text not null check (country_code in ('HU','SK')),
  source_name text not null,
  source_url text,
  status text not null default 'prepared' check (status in ('prepared','running','completed','error')),
  total_rows integer not null default 0 check (total_rows >= 0),
  processed_rows integer not null default 0 check (processed_rows >= 0),
  inserted_products integer not null default 0,
  inserted_uses integer not null default 0,
  updated_uses integer not null default 0,
  inserted_ingredients integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  last_error text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '6 hours')
);

create table if not exists public.plant_protection_sync_job_chunks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.plant_protection_sync_jobs(id) on delete cascade,
  chunk_no integer not null check (chunk_no >= 0),
  row_count integer not null check (row_count > 0),
  rows jsonb not null check (jsonb_typeof(rows) = 'array'),
  processed boolean not null default false,
  processed_at timestamptz,
  result jsonb,
  unique(job_id, chunk_no)
);

create index if not exists pp_sync_jobs_owner_status_idx on public.plant_protection_sync_jobs(created_by,status,created_at desc);
create index if not exists pp_sync_chunks_pending_idx on public.plant_protection_sync_job_chunks(job_id,processed,chunk_no);

alter table public.plant_protection_sync_jobs enable row level security;
alter table public.plant_protection_sync_job_chunks enable row level security;

drop policy if exists pp_sync_jobs_advisor_all on public.plant_protection_sync_jobs;
create policy pp_sync_jobs_advisor_all on public.plant_protection_sync_jobs
for all to authenticated
using (app_private.is_advisor() and created_by = auth.uid())
with check (app_private.is_advisor() and created_by = auth.uid());

drop policy if exists pp_sync_chunks_advisor_all on public.plant_protection_sync_job_chunks;
create policy pp_sync_chunks_advisor_all on public.plant_protection_sync_job_chunks
for all to authenticated
using (
  app_private.is_advisor() and exists (
    select 1 from public.plant_protection_sync_jobs j
    where j.id = job_id and j.created_by = auth.uid()
  )
)
with check (
  app_private.is_advisor() and exists (
    select 1 from public.plant_protection_sync_jobs j
    where j.id = job_id and j.created_by = auth.uid()
  )
);

create or replace function public.process_plant_protection_sync_job_chunk(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.plant_protection_sync_jobs%rowtype;
  v_chunk public.plant_protection_sync_job_chunks%rowtype;
  v_result jsonb;
  v_remaining integer;
  v_status text;
begin
  if not app_private.is_advisor() then
    raise exception 'Csak szaktanácsadó/admin folytathat hivatalos katalógusszinkront.';
  end if;

  select * into v_job
  from public.plant_protection_sync_jobs
  where id = p_job_id and created_by = auth.uid()
  for update;

  if not found then raise exception 'A szinkronfeladat nem található.'; end if;
  if v_job.expires_at < now() then raise exception 'A szinkronfeladat lejárt. Indíts új szinkront.'; end if;
  if v_job.status = 'completed' then
    return jsonb_build_object(
      'ok',true,'job_id',v_job.id,'done',true,'status','completed',
      'total_rows',v_job.total_rows,'processed_rows',v_job.processed_rows,
      'inserted_products',v_job.inserted_products,'inserted_uses',v_job.inserted_uses,
      'updated_uses',v_job.updated_uses,'inserted_ingredients',v_job.inserted_ingredients,
      'metadata',v_job.metadata,'source_url',v_job.source_url
    );
  end if;

  select * into v_chunk
  from public.plant_protection_sync_job_chunks
  where job_id = p_job_id and processed = false
  order by chunk_no
  limit 1
  for update skip locked;

  if not found then
    update public.plant_protection_sync_jobs
      set status='completed', processed_rows=total_rows, updated_at=now(), last_error=null
      where id=p_job_id
      returning * into v_job;
    return jsonb_build_object(
      'ok',true,'job_id',v_job.id,'done',true,'status','completed',
      'total_rows',v_job.total_rows,'processed_rows',v_job.processed_rows,
      'inserted_products',v_job.inserted_products,'inserted_uses',v_job.inserted_uses,
      'updated_uses',v_job.updated_uses,'inserted_ingredients',v_job.inserted_ingredients,
      'metadata',v_job.metadata,'source_url',v_job.source_url
    );
  end if;

  update public.plant_protection_sync_jobs
    set status='running', updated_at=now(), last_error=null
    where id=p_job_id;

  v_result := public.import_plant_protection_catalog(
    v_job.country_code,
    v_job.source_name,
    v_job.source_url,
    v_chunk.rows,
    format('Szakaszos hivatalos szinkron · chunk %s · job %s', v_chunk.chunk_no + 1, p_job_id)
  );

  update public.plant_protection_sync_job_chunks
    set processed=true, processed_at=now(), result=v_result
    where id=v_chunk.id;

  select count(*) into v_remaining
  from public.plant_protection_sync_job_chunks
  where job_id=p_job_id and processed=false;

  v_status := case when v_remaining=0 then 'completed' else 'running' end;

  update public.plant_protection_sync_jobs
  set processed_rows = least(total_rows, processed_rows + v_chunk.row_count),
      inserted_products = inserted_products + coalesce((v_result->>'inserted_products')::integer,0),
      inserted_uses = inserted_uses + coalesce((v_result->>'inserted_uses')::integer,0),
      updated_uses = updated_uses + coalesce((v_result->>'updated_uses')::integer,0),
      inserted_ingredients = inserted_ingredients + coalesce((v_result->>'inserted_ingredients')::integer,0),
      status = v_status,
      updated_at = now(),
      last_error = null
  where id=p_job_id
  returning * into v_job;

  return jsonb_build_object(
    'ok',true,'job_id',v_job.id,'done',(v_status='completed'),'status',v_status,
    'chunk_no',v_chunk.chunk_no,'remaining_chunks',v_remaining,
    'total_rows',v_job.total_rows,'processed_rows',v_job.processed_rows,
    'inserted_products',v_job.inserted_products,'inserted_uses',v_job.inserted_uses,
    'updated_uses',v_job.updated_uses,'inserted_ingredients',v_job.inserted_ingredients,
    'metadata',v_job.metadata,'source_url',v_job.source_url
  );
exception when others then
  update public.plant_protection_sync_jobs
    set status='error',last_error=sqlerrm,updated_at=now()
    where id=p_job_id and created_by=auth.uid();
  raise;
end;
$$;

grant execute on function public.process_plant_protection_sync_job_chunk(uuid) to authenticated;
