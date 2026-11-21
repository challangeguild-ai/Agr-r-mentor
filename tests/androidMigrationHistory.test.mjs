import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {auditAndroidMigrationHistory} from "../scripts/audit-android-migration-history.mjs";

const read=filename=>readFileSync(new URL(`../supabase/migrations/${filename}`,import.meta.url),"utf8");
const observed=[
 {name:"20261119080000_general_task_attestation_review",stored_md5:"7f60b7f4018323530e8945c799ada086"},
 {name:"20261119093000_authorized_advisor_notifications",stored_md5:"be28338395ca2df5c7c1d86e78f09d8f"},
 {name:"20261119110000_verified_task_proof_rpc_guard",stored_md5:"da4aebf859b3e1c16a963d656d5cfbe2"},
 {name:"20261119123000_field_boundary_proposals",stored_md5:"c2b4755d681fd94b113dbf0be1508d1f"},
 {name:"20261119211340_notification_email_send_quota",stored_md5:"f8678a27cd0c1fd0448689c464cb91e1"}
];

test("actual production migration evidence detects four exact, one historic, one absent",()=>{
 const result=auditAndroidMigrationHistory(observed,read);
 assert.equal(result.ready,false);
 assert.deepEqual(result.migrations.map(item=>item.status),[
  "identical","identical","known_older_proof_without_marker","identical","identical","missing"
 ]);
});

test("an unexpected change, duplicate or malformed checksum fails closed",()=>{
 const altered=observed.map(item=>item.name.includes("authorized_advisor")?{...item,stored_md5:"e".repeat(32)}:item);
 assert.equal(auditAndroidMigrationHistory(altered,read).migrations[1].status,"unexpected_drift");
 assert.equal(auditAndroidMigrationHistory([...observed,observed[0]],read).migrations[0].status,"duplicate");
 assert.equal(auditAndroidMigrationHistory([{...observed[0],stored_md5:"not-md5"}],read).migrations[0].status,"invalid_checksum");
 assert.throws(()=>auditAndroidMigrationHistory({},read));
});

test("the history audit and SQL are incapable of changing production data",()=>{
 const script=readFileSync(new URL("../scripts/audit-android-migration-history.mjs",import.meta.url),"utf8");
 const sql=readFileSync(new URL("../scripts/read-android-migration-history.sql",import.meta.url),"utf8");
 assert.doesNotMatch(script,/\bfetch\s*\(|child_process|execSync|spawnSync|supabase_apply_migration/);
 assert.match(sql,/^BEGIN READ ONLY;$/m);
 assert.match(sql,/^ROLLBACK;$/m);
 assert.doesNotMatch(sql,/\b(insert|update|delete|alter|drop|create)\s+(table|function|trigger|into|on)\b/i);
});
