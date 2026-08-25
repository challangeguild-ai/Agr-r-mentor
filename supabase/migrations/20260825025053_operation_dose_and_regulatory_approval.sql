alter table public.plant_protection_products
  add column if not exists regulatory_category text,
  add column if not exists professional_use_only boolean not null default false,
  add column if not exists prescription_required boolean not null default false,
  add column if not exists approval_required boolean not null default false;

alter table public.field_operations
  add column if not exists dose_mode text check (dose_mode is null or dose_mode in ('official_max','custom')),
  add column if not exists official_dose_max numeric,
  add column if not exists regulatory_category text,
  add column if not exists approval_required boolean not null default false,
  add column if not exists approval_status text not null default 'not_required' check (approval_status in ('not_required','pending','approved','rejected')),
  add column if not exists requested_approver_id uuid references public.profiles(id),
  add column if not exists approver_name text,
  add column if not exists approved_by uuid references public.profiles(id),
  add column if not exists approved_at timestamptz,
  add column if not exists approval_note text;

create index if not exists field_operations_requested_approver_idx on public.field_operations(requested_approver_id) where requested_approver_id is not null;
create index if not exists field_operations_approval_status_idx on public.field_operations(approval_status) where approval_required = true;
