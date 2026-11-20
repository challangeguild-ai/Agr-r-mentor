import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const edge=readFileSync(new URL("../supabase/functions/send-notification-email/index.ts",import.meta.url),"utf8");
const migration=readFileSync(new URL("../supabase/migrations/20261119211340_notification_email_send_quota.sql",import.meta.url),"utf8");
const rehearsal=readFileSync(new URL("../scripts/verify_staged_migrations.sql",import.meta.url),"utf8");

test("only the server service role may atomically reserve notification email quota",()=>{
 assert.match(migration,/create table public\.notification_email_send_quota/);
 assert.match(migration,/primary key\(sender_id,bucket_type,bucket_start\)/);
 assert.match(migration,/enable row level security/);
 assert.match(migration,/revoke all on public\.notification_email_send_quota from public,anon,authenticated/);
 assert.match(migration,/security invoker/);
 assert.match(migration,/current_user <> 'service_role'/);
 assert.match(migration,/send_count<60/);
 assert.match(migration,/send_count<200/);
 assert.match(migration,/get diagnostics v_claimed = row_count/);
 assert.match(migration,/if v_claimed<>2 then[\s\S]+?raise exception/);
 assert.match(migration,/exception when sqlstate 'P0001' then\s+return false/);
 assert.match(migration,/revoke all on function public\.claim_notification_email_send_quota\(uuid\) from public,anon,authenticated/);
 assert.match(migration,/grant execute on function public\.claim_notification_email_send_quota\(uuid\) to service_role/);
 assert.match(migration,/bucket_type in \('hour','day','invite_hour','invite_day'\)/);
 assert.match(migration,/create function public\.claim_invitation_email_send_quota\(p_sender_id uuid\)/);
 assert.match(migration,/send_count<10/);
 assert.match(migration,/send_count<30/);
 assert.match(migration,/grant execute on function public\.claim_invitation_email_send_quota\(uuid\) to service_role/);
});

test("the Edge function claims quota before contacting Resend, failing closed",()=>{
 const claim=edge.indexOf('admin.rpc("claim_notification_email_send_quota"');
 const send=edge.indexOf('fetch("https://api.resend.com/emails"');
 assert.ok(claim>0&&send>claim);
 assert.match(edge,/p_sender_id:user\.id/);
 assert.match(edge,/if\(quotaError\)[\s\S]*?503/);
 assert.match(edge,/if\(quotaAllowed!==true\)[\s\S]*?429/);
});

test("the rollback-only local exercise verifies denied writes and the 61st email",()=>{
 assert.match(rehearsal,/SET LOCAL ROLE service_role/);
 assert.match(rehearsal,/FOR v_i IN 1\.\.60 LOOP/);
 assert.match(rehearsal,/claim_notification_email_send_quota\(v_sender\) IS DISTINCT FROM false/);
 assert.match(rehearsal,/bucket_type='hour'\)<>60/);
 assert.match(rehearsal,/has_function_privilege\('authenticated','public\.claim_notification_email_send_quota\(uuid\)','EXECUTE'\)/);
 assert.ok(rehearsal.trimEnd().endsWith('=== ROLLBACK megtortent: az eredeti helyi adatbazis valtozatlan ==='));
 assert.match(rehearsal,/FOR v_i IN 1\.\.10 LOOP/);
 assert.match(rehearsal,/claim_invitation_email_send_quota\(v_sender\) IS DISTINCT FROM false/);
});

test("both invitation Edge Functions claim a dedicated quota after authorization",()=>{
 for(const path of ["../supabase/functions/invite-farmer/index.ts","../supabase/functions/invite-advisor/index.ts"]){
  const source=readFileSync(new URL(path,import.meta.url),"utf8");
  const claim=source.indexOf('rpc("claim_invitation_email_send_quota"');
  const invite=source.indexOf("inviteUserByEmail(");
  assert.ok(claim>0&&invite>claim,path);
  assert.match(source,/quotaAllowed!==true/);
  assert.match(source,/429/);
 }
});
