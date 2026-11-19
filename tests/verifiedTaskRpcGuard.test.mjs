import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const sql=readFileSync(new URL("../supabase/migrations/20261119110000_verified_task_proof_rpc_guard.sql",import.meta.url),"utf8");

test("direct verified-task RPC is restricted to its assigned worker and live task states",()=>{
 assert.match(sql,/assigned_to=auth\.uid\(\) for update/);
 assert.match(sql,/v_task\.status not in \('open','in_progress'\)/);
 assert.match(sql,/revoke all on function public\.submit_verified_task_execution\([\s\S]+?\) from public,anon/);
 assert.match(sql,/grant execute on function public\.submit_verified_task_execution\([\s\S]+?\) to authenticated/);
});

test("direct RPC requires structured GPS evidence with a recent measurement",()=>{
 assert.match(sql,/left\(coalesce\(p_proof,''\),10\)<>'TASKPROOF:'/);
 for(const field of ["lat","lng","accuracy","capturedAt","photoPath","photoName"]){
  assert.match(sql,new RegExp(`jsonb_typeof\\(v_payload->'${field}'\\) is distinct from`));
 }
 assert.match(sql,/jsonb_typeof\(v_payload\) is distinct from 'object'/);
 assert.match(sql,/v_accuracy<=0 or v_accuracy>200/);
 assert.match(sql,/v_captured_at<now\(\)-interval '15 minutes'/);
 assert.match(sql,/v_captured_at>now\(\)\+interval '2 minutes'/);
});

test("a real stored photo must belong to the submitting worker and task",()=>{
 assert.match(sql,/v_photo_path not like auth\.uid\(\)::text\|\|'\/task-proofs\/'\|\|p_task_id::text\|\|'\/%'/);
 assert.match(sql,/from storage\.objects o/);
 assert.match(sql,/o\.owner_id=auth\.uid\(\)::text/);
 assert.match(sql,/o\.bucket_id='farmer-report-media' and o\.name=v_photo_path/);
 assert.match(sql,/o\.metadata->>'mimetype'/);
 assert.match(sql,/15\*1024\*1024/);
});

test("the RPC derives the field verdict from actual geometry and excludes interior holes",()=>{
 assert.match(sql,/create table if not exists app_private\.verified_task_demo_farms/);
 assert.match(sql,/if exists\(select 1 from app_private\.verified_task_demo_farms where farm_id=v_task\.farm_id\)/);
 assert.match(sql,/gis\.ST_GeomFromGeoJSON\(v_field\.boundary_geojson::text\)/);
 assert.match(sql,/gis\.ST_Covers\(v_boundary,v_point\)/);
 assert.match(sql,/gis\.ST_InteriorRingN\(part\.geom,ring_index\.n\)/);
 assert.match(sql,/gis\.ST_ExteriorRing\(part\.geom\)::gis\.geography/);
 assert.match(sql,/v_distance<=150/);
 assert.match(sql,/v_distance<=500/);
 assert.match(sql,/coalesce\(v_payload->>'validation',''\)<>v_validation/);
 assert.match(sql,/p_proof := 'TASKPROOF:'\|\|jsonb_build_object/);
});

test("an RPC caller cannot bypass official pesticide identity, authorization date and dose",()=>{
 assert.match(sql,/v_plan\.plant_protection_use_id is null/);
 assert.match(sql,/from public\.plant_protection_products where id=v_plan\.product_id/);
 assert.match(sql,/from public\.plant_protection_uses where id=v_plan\.plant_protection_use_id/);
 assert.match(sql,/v_product\.valid_from/);
 assert.match(sql,/v_product\.valid_until/);
 assert.match(sql,/v_product\.grace_period_until/);
 assert.match(sql,/v_use\.dose_max/);
 assert.match(sql,/v_dose_unit/);
});
