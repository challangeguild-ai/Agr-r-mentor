-- Agrár Mentor: szakmai szemle -> visszaellenőrzés folyamat
alter table public.inspections
  add column if not exists follow_up_status text,
  add column if not exists previous_inspection_id uuid references public.inspections(id) on delete set null,
  add column if not exists next_check_at date,
  add column if not exists issue_status text not null default 'open',
  add column if not exists closed_at timestamptz;

alter table public.inspections drop constraint if exists inspections_follow_up_status_check;
alter table public.inspections add constraint inspections_follow_up_status_check
  check (follow_up_status is null or follow_up_status in ('improved','unchanged','worsened'));

alter table public.inspections drop constraint if exists inspections_issue_status_check;
alter table public.inspections add constraint inspections_issue_status_check
  check (issue_status in ('open','monitoring','resolved'));

create index if not exists inspections_field_followup_idx
  on public.inspections(field_id, inspected_at desc);
create index if not exists inspections_next_check_idx
  on public.inspections(next_check_at)
  where issue_status <> 'resolved';
