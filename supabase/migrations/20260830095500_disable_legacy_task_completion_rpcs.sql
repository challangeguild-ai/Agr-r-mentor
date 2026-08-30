-- Final audit: legacy RPCs predate the advisor review workflow and must not be directly callable.
revoke all on function public.complete_verified_task(uuid,text,numeric,numeric) from public,anon,authenticated;
revoke all on function public.record_task_machine_usage(uuid,numeric,numeric) from public,anon,authenticated;
