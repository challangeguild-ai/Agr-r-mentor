-- READ ONLY; run on the authorized Agrár Mentor project qkezhvtwirdsvhzjyvfi.
-- Contains only migration names and SQL checksums, never application rows.
-- Export the JSON result (name, stored_md5) to a local, non-secret file and run
-- `node scripts/audit-android-migration-history.mjs <history.json>`.
BEGIN READ ONLY;
SELECT name,md5(statements[1]) AS stored_md5
FROM supabase_migrations.schema_migrations
WHERE name IN (
 '20261119080000_general_task_attestation_review',
 '20261119093000_authorized_advisor_notifications',
 '20261119110000_verified_task_proof_rpc_guard',
 '20261119123000_field_boundary_proposals',
 '20261119211340_notification_email_send_quota',
 '20261120110000_manual_hu_spraying_log_guard'
)
ORDER BY name;
ROLLBACK;
