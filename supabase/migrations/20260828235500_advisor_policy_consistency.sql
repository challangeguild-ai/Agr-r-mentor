-- Enforce the same advisor/system-admin separation in every legacy policy.
-- System admins must never inherit agronomic access merely because their
-- historical profile role is `advisor`.

alter policy documents_delete_uploader_or_advisor on public.documents
using (
  uploaded_by = (select auth.uid())
  or (select app_private.is_advisor())
);

alter policy documents_insert_own_or_advisor on public.documents
with check (
  uploaded_by = (select auth.uid())
  and (
    (select app_private.is_advisor())
    or exists(select 1 from public.farms f where f.id=documents.farm_id and f.owner_id=(select auth.uid()))
    or exists(select 1 from public.fields fi join public.farms f on f.id=fi.farm_id where fi.id=documents.field_id and f.owner_id=(select auth.uid()))
  )
);

alter policy documents_select_own_or_advisor on public.documents
using (
  (select app_private.is_advisor())
  or exists(select 1 from public.farms f where f.id=documents.farm_id and f.owner_id=(select auth.uid()))
  or exists(select 1 from public.fields fi join public.farms f on f.id=fi.farm_id where fi.id=documents.field_id and f.owner_id=(select auth.uid()))
);

alter policy "advisors can read memberships" on public.farm_members
using ((select app_private.is_advisor()));

alter policy "Advisors view report media" on public.farmer_report_media
using ((select app_private.is_advisor()));

alter policy "Advisors manage reports" on public.farmer_reports
using ((select app_private.is_advisor()))
with check ((select app_private.is_advisor()));

alter policy "Advisors manage inspection media" on public.inspection_media
using ((select app_private.is_advisor()))
with check ((select app_private.is_advisor()));

alter policy "Advisors create notifications" on public.notifications
with check ((select app_private.is_advisor()));

alter policy "Users create advisor notifications" on public.notifications
with check (
  exists(
    select 1 from public.profiles p
    where p.id=notifications.user_id
      and p.role='advisor'
      and coalesce(p.system_role,'user') <> 'admin'
  )
);

-- These policies were originally created TO public, even though every branch
-- requires an authenticated identity. Narrowing the policy role removes
-- irrelevant anonymous/authenticator evaluation without changing signed-in use.
alter policy "execution reports advisor all" on public.task_execution_reports to authenticated;
alter policy "execution reports assigned read" on public.task_execution_reports to authenticated;
alter policy "task plans advisor all" on public.task_operation_plans to authenticated;
alter policy "task plans involved read" on public.task_operation_plans to authenticated;

-- Remove one exact duplicate worker update policy; the remaining policy has
-- the same USING and WITH CHECK expression.
drop policy if exists tasks_farmer_update_own on public.tasks;
