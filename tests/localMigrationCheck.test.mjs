import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=relative=>readFileSync(new URL(relative,import.meta.url),"utf8");
const names=[
 "20261119080000_general_task_attestation_review.sql",
 "20261119093000_authorized_advisor_notifications.sql",
 "20261119110000_verified_task_proof_rpc_guard.sql",
 "20261119123000_field_boundary_proposals.sql",
];

test("the local migration rehearsal targets only the restored Docker database",()=>{
 const script=read("../scripts/Test-AgrarMentor-Migrations.ps1");
 assert.match(script,/supabase_db_AgrarMentor-mentes-2026-11-19/);
 assert.match(script,/docker inspect/);
 assert.match(script,/docker exec -i \$containerName psql/);
 assert.match(script,/ON_ERROR_STOP=1/);
 assert.doesNotMatch(script,/supabase db push|--linked|--remote|supabase\.com/);
 for(const name of names)assert.ok(script.includes(name),name);
});

test("all four staged migrations are checked in one transaction and rolled back",()=>{
 const check=read("../scripts/verify_staged_migrations.sql");
 assert.match(check,/\nBEGIN;\n/);
 assert.match(check,/\nROLLBACK;\n/);
 assert.doesNotMatch(check,/^\s*COMMIT\s*;/im);
 let last=check.indexOf("BEGIN;");
 for(const name of names){
  const pos=check.indexOf(name,last);
  assert.ok(pos>last,`${name}: migration order`);
  last=pos;
  const migration=read(`../supabase/migrations/${name}`);
  assert.doesNotMatch(migration,/^\s*(COMMIT|ROLLBACK|BEGIN)\s*;/im,`${name}: nested transaction`);
 }
 assert.ok(check.indexOf("ROLLBACK;")>last);
 assert.match(check,/has_function_privilege\('anon'/);
 assert.match(check,/relrowsecurity/);
 assert.match(check,/has_table_privilege\('authenticated'/);
});
