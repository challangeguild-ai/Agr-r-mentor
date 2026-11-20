import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");

test("the database never accepts an unacknowledged manual HU pesticide record",()=>{
 const sql=read("supabase/migrations/20261120110000_manual_hu_spraying_log_guard.sql");
 assert.match(sql,/permit_check_attested boolean not null default false/);
 assert.match(sql,/not coalesce\(new\.permit_check_attested,false\)/);
 assert.match(sql,/'permit_check_attested',true/);
 assert.match(sql,/'permit_attested_at',now\(\)/);
 assert.match(sql,/before insert or update of\s+operation_date,operation_type,country_code,product_id,product_name,\s+plant_protection_use_id,crop,dose,dose_unit,dose_mode,permit_check_attested/);
 assert.match(sql,/as \$\$ select 2 \$\$/);
 assert.doesNotMatch(sql,/new\.product_id\s*:=\s*p\.id/);
});

test("web submission persists the attestation, and only after checking policy v2",()=>{
 const action=read("app/operations/actions.ts");
 const catalog=read("app/api/operation-catalog/route.ts");
 assert.match(action,/policyVersion!==2/);
 assert.match(catalog,/policyVersion===2/);
 assert.match(action,/permit_check_attested:formData\.get\("manual_permit_checked"\)==="on"/);
 assert.match(action,/validateManualPlantProtection\(/);
});

test("native submission persists the attestation, and verifies the recorded value",()=>{
 const native=read("android/app/src/main/java/hu/agrarmentor/android/data/OperationCreateRepository.kt");
 assert.match(native,/hu_manual_spraying_policy_version",session,JSONObject\(\)\)\.trim\(\)!="2"/);
 assert.match(native,/if\(manualHu\)body\.put\("permit_check_attested",input\.permitAcknowledged\)/);
 assert.match(native,/saved\.optBoolean\("permit_check_attested",false\)==\(manualHu&&input\.permitAcknowledged\)/);
});
