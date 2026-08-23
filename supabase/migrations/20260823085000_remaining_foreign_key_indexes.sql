create index if not exists farm_member_invites_invited_by_idx on public.farm_member_invites(invited_by);
create index if not exists farm_members_invited_by_idx on public.farm_members(invited_by);
create index if not exists farmer_reports_replied_by_idx on public.farmer_reports(replied_by);
create index if not exists inspection_media_uploaded_by_idx on public.inspection_media(uploaded_by);
create index if not exists machine_usage_logs_operator_id_idx on public.machine_usage_logs(operator_id);
create index if not exists task_machine_assignments_assigned_by_idx on public.task_machine_assignments(assigned_by);
