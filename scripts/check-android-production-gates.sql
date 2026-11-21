-- READ ONLY. Run through the authorized Supabase SQL editor/MCP, not in the APK.
-- Target project: qkezhvtwirdsvhzjyvfi. Do not apply migrations here.
-- A release is blocked if ANY `ready` value is false.
BEGIN READ ONLY;

WITH checks AS (
 SELECT 'GPS-igazolt feladat szervervédelme'::text AS gate,
  EXISTS(
   SELECT 1 FROM pg_proc p
   WHERE p.oid=to_regprocedure('public.verified_task_proof_policy_version()')
    AND p.prosecdef=false
    AND has_function_privilege('authenticated',p.oid,'EXECUTE')
    AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
    AND p.prosrc LIKE '%select 1%'
  ) AS ready
 UNION ALL
 SELECT 'HU kézi növényvédelmi napló v2 szervervédelme',
  EXISTS(
   SELECT 1 FROM pg_proc p
   WHERE p.oid=to_regprocedure('public.hu_manual_spraying_policy_version()')
    AND p.prosecdef=false
    AND has_function_privilege('authenticated',p.oid,'EXECUTE')
    AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
    AND p.prosrc LIKE '%select 2%'
  )
 UNION ALL
 SELECT 'HU engedélyokirat-ellenőrzési nyilatkozat',
  EXISTS(
   SELECT 1 FROM information_schema.columns
   WHERE table_schema='public' AND table_name='field_operations'
    AND column_name='permit_check_attested' AND is_nullable='NO'
  )
 UNION ALL
 SELECT 'HU naplózás triggerének védelme',
  EXISTS(
   SELECT 1 FROM pg_trigger t
   WHERE t.tgrelid='public.field_operations'::regclass
    AND t.tgname='guard_hu_plant_protection_regulatory_status'
    AND NOT t.tgisinternal
    AND pg_get_triggerdef(t.oid) LIKE '%permit_check_attested%'
  )
 UNION ALL
 SELECT 'Szemle és látogatás RLS',
  (SELECT count(*)=2 FROM pg_class c
    WHERE c.oid IN ('public.inspections'::regclass,'public.timeline_events'::regclass)
     AND c.relrowsecurity)
 UNION ALL
 SELECT 'Szerepkörös táblahozzáférés RLS',
  (SELECT count(*)=2 FROM pg_class c
    WHERE c.oid IN ('public.farms'::regclass,'public.fields'::regclass)
     AND c.relrowsecurity)
)
SELECT gate,ready FROM checks ORDER BY ready,gate;

ROLLBACK;
