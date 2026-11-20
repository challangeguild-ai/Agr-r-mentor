\set ON_ERROR_STOP on
\echo === AgrarMentor: hat fuggoben levo migracio – csak HELYI, ROLLBACK ===
BEGIN;
\i /tmp/agrar_release_migration_check_20261119/20261119080000_general_task_attestation_review.sql
\i /tmp/agrar_release_migration_check_20261119/20261119093000_authorized_advisor_notifications.sql
\i /tmp/agrar_release_migration_check_20261119/20261119110000_verified_task_proof_rpc_guard.sql
\i /tmp/agrar_release_migration_check_20261119/20261119123000_field_boundary_proposals.sql
\i /tmp/agrar_release_migration_check_20261119/20261119211340_notification_email_send_quota.sql
\i /tmp/agrar_release_migration_check_20261119/20261120110000_manual_hu_spraying_log_guard.sql

DO $verify$
DECLARE
  v_name text;
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'public.submit_general_task_execution(uuid,text,date)',
    'public.notify_advisors(text,text,text,text,text)',
    'public.submit_verified_task_execution(uuid,text,date,numeric,text,numeric,numeric,text,text,text,numeric,numeric)',
    'public.submit_field_boundary_proposal(uuid,double precision,double precision,jsonb,text,text)',
    'public.review_field_boundary_proposal(uuid,boolean,text)'
  ] LOOP
    IF to_regprocedure(v_name) IS NULL THEN
      RAISE EXCEPTION 'Hiányzó migrált RPC: %', v_name;
    END IF;
    IF has_function_privilege('anon',v_name,'EXECUTE') THEN
      RAISE EXCEPTION 'Az RPC anon szerepkörrel is meghívható: %', v_name;
    END IF;
    IF NOT has_function_privilege('authenticated',v_name,'EXECUTE') THEN
      RAISE EXCEPTION 'A bejelentkezett szerepkör nem hívhatja az RPC-t: %', v_name;
    END IF;
  END LOOP;

  IF to_regclass('public.field_boundary_proposals') IS NULL THEN
    RAISE EXCEPTION 'Hiányzik a táblahatár-javaslatok táblája';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid='public.field_boundary_proposals'::regclass AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'A táblahatár-javaslatok táblán nincs RLS';
  END IF;
  IF has_table_privilege('authenticated','public.field_boundary_proposals','INSERT')
     OR has_table_privilege('authenticated','public.field_boundary_proposals','UPDATE')
     OR has_table_privilege('authenticated','public.field_boundary_proposals','DELETE') THEN
    RAISE EXCEPTION 'A táblahatár-javaslat közvetlen írása engedélyezett';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid='public.notification_email_send_quota'::regclass AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'A levelkuldési keret tablajan nincs RLS';
  END IF;
  IF has_table_privilege('authenticated','public.notification_email_send_quota','SELECT')
     OR has_table_privilege('authenticated','public.notification_email_send_quota','INSERT')
     OR has_table_privilege('anon','public.notification_email_send_quota','SELECT') THEN
    RAISE EXCEPTION 'A levelkuldési keret normal felhasznalo szamara elerheto';
  END IF;

  IF to_regprocedure('public.claim_notification_email_send_quota(uuid)') IS NULL
     OR has_function_privilege('authenticated','public.claim_notification_email_send_quota(uuid)','EXECUTE')
     OR has_function_privilege('anon','public.claim_notification_email_send_quota(uuid)','EXECUTE')
     OR NOT has_function_privilege('service_role','public.claim_notification_email_send_quota(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'A levelkuldési kvota RPC jogosultsagai hibasak';
  END IF;
  IF to_regprocedure('public.claim_invitation_email_send_quota(uuid)') IS NULL
     OR has_function_privilege('authenticated','public.claim_invitation_email_send_quota(uuid)','EXECUTE')
     OR has_function_privilege('anon','public.claim_invitation_email_send_quota(uuid)','EXECUTE')
     OR NOT has_function_privilege('service_role','public.claim_invitation_email_send_quota(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'A meghivasi kvota RPC jogosultsagai hibasak';
  END IF;

  IF to_regprocedure('public.hu_manual_spraying_policy_version()') IS NULL
     OR public.hu_manual_spraying_policy_version() <> 1
     OR has_function_privilege('anon','public.hu_manual_spraying_policy_version()','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.hu_manual_spraying_policy_version()','EXECUTE') THEN
    RAISE EXCEPTION 'A magyar kézi permetezési napló védelmi verziója vagy jogosultsága hiányzik';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid='public.guard_hu_plant_protection_regulatory_status()'::regprocedure
      AND position('new.product_id := p.id' in pg_get_functiondef(p.oid))>0
  ) THEN
    RAISE EXCEPTION 'A kézi napló továbbra is automatikusan hivatalos termékazonosítót rendel';
  END IF;
END;
$verify$;

-- Exercise the atomic quota under the actual service_role, still inside the
-- enclosing transaction: 60 successes, then one denial without extra writes.
SET LOCAL ROLE service_role;
DO $quota$
DECLARE
  v_sender uuid;
  v_i integer;
BEGIN
  SELECT id INTO v_sender FROM public.profiles LIMIT 1;
  IF v_sender IS NULL THEN RAISE EXCEPTION 'Hianyzik a helyi visszaallitott profil'; END IF;
  FOR v_i IN 1..60 LOOP
    IF public.claim_notification_email_send_quota(v_sender) IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'A levelkuldes indokolatlanul letiltva: %', v_i;
    END IF;
  END LOOP;
  IF public.claim_notification_email_send_quota(v_sender) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'A 61. levelkuldesnek mar tiltva kell lennie';
  END IF;
  IF (SELECT send_count FROM public.notification_email_send_quota
      WHERE sender_id=v_sender AND bucket_type='hour')<>60 THEN
    RAISE EXCEPTION 'A korlatot tulfuto keres megvaltoztatta a szamlalot';
  END IF;
  FOR v_i IN 1..10 LOOP
    IF public.claim_invitation_email_send_quota(v_sender) IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'A meghivas indokolatlanul letiltva: %', v_i;
    END IF;
  END LOOP;
  IF public.claim_invitation_email_send_quota(v_sender) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'A 11. meghivast mar le kell tiltani';
  END IF;
  IF (SELECT send_count FROM public.notification_email_send_quota
      WHERE sender_id=v_sender AND bucket_type='invite_hour')<>10 THEN
    RAISE EXCEPTION 'A meghivasi keret elutasitasa modosította a szamlalot';
  END IF;
END;
$quota$;
RESET ROLE;

\echo === Minden ellenorzes sikeres; a tranzakcio visszavonasa kovetkezik ===
ROLLBACK;
\echo === ROLLBACK megtortent: az eredeti helyi adatbazis valtozatlan ===
