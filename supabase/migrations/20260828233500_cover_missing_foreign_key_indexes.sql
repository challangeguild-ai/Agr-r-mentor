-- Cover foreign keys reported by Supabase Performance Advisor.
-- These indexes are additive and do not alter application semantics.

create index if not exists farm_pp_approvers_created_by_idx on public.farm_plant_protection_approvers(created_by);
create index if not exists field_operation_audit_changed_by_idx on public.field_operation_audit_log(changed_by);
create index if not exists field_operation_audit_field_id_idx on public.field_operation_audit_log(field_id);
create index if not exists field_operations_approved_by_idx on public.field_operations(approved_by);
create index if not exists plant_protection_import_batches_imported_by_idx on public.plant_protection_import_batches(imported_by);
create index if not exists task_execution_reports_operation_id_idx on public.task_execution_reports(operation_id);
create index if not exists task_execution_reports_reported_by_idx on public.task_execution_reports(reported_by);
create index if not exists task_execution_reports_reviewed_by_idx on public.task_execution_reports(reviewed_by);
create index if not exists task_operation_plans_requested_approver_idx on public.task_operation_plans(requested_approver_id);
create index if not exists tasks_linked_operation_id_idx on public.tasks(linked_operation_id);
create index if not exists tasks_reviewed_by_idx on public.tasks(reviewed_by);
