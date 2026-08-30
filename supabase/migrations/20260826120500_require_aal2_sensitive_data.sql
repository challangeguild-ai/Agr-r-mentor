-- Historical migration revised by the final system audit.
-- A global restrictive AAL2 policy on every business table would lock normal farmers and advisors
-- out of the application. MFA is instead required at sensitive privileged operations (for example
-- system-admin actions and account invitations).

create or replace function public.require_aal2()
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Bejelentkezés szükséges'; end if;
  if coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'Kétfaktoros hitelesítés szükséges';
  end if;
end $$;
revoke all on function public.require_aal2() from public, anon;
grant execute on function public.require_aal2() to authenticated;
