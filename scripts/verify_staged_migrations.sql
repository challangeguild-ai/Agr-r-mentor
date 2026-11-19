\set ON_ERROR_STOP on
\echo === AgrarMentor: negy fuggoben levo migracio – csak HELYI, ROLLBACK ===
BEGIN;
\i /tmp/agrar_release_migration_check_20261119/20261119080000_general_task_attestation_review.sql
\i /tmp/agrar_release_migration_check_20261119/20261119093000_authorized_advisor_notifications.sql
\i /tmp/agrar_release_migration_check_20261119/20261119110000_verified_task_proof_rpc_guard.sql
\i /tmp/agrar_release_migration_check_20261119/20261119123000_field_boundary_proposals.sql

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
END;
$verify$;

\echo === Minden ellenorzes sikeres; a tranzakcio visszavonasa kovetkezik ===
ROLLBACK;
\echo === ROLLBACK megtortent: az eredeti helyi adatbazis valtozatlan ===
