import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createOperationOnce,operationRequestId} from "../lib/operationCreateIdempotency.ts";
import {operationSubmissionFingerprint,reuseOperationAttempt} from "../lib/operationSubmissionAttempt.ts";

const id="123e4567-e89b-42d3-a456-426614174000";
const otherId="123e4567-e89b-42d3-a456-426614174001";
const payload={
 farm_id:"farm-1",field_id:"field-1",operation_date:"2026-11-19",
 operation_type:"fertilizing",country_code:"HU",subtype:null,product_id:null,
 plant_protection_use_id:null,product_name:"Műtrágya",authorization_number:null,
 crop:"Kukorica",target:null,active_ingredient:null,dose:25,dose_unit:"kg/ha",
 quantity:50,quantity_unit:"kg",treated_area:2,machine_id:null,machine_name:null,
 operator_name:"Gazda",weather:null,notes:null,catalog_mode:"manual",
 regulatory_category:null,approval_required:false,requested_approver_id:null,
 created_by:"user-1"
};

function fakeOperations(mode="success"){
 const rows=new Map(),calls=[];
 const supabase={from(table){
  assert.equal(table,"field_operations");
  return{
   select(){return{eq(field,value){assert.equal(field,"id");return{
    async maybeSingle(){calls.push(["find",value]);return{data:rows.get(value)||null,error:null}}
   }}}},
   insert(record){
    calls.push(["insert",record.id]);
    return{select(){return{async single(){
     if(mode==="error-no-write")return{data:null,error:{message:"database rejected"}};
     rows.set(record.id,record);
     if(mode==="error-committed")return{data:null,error:{message:"response lost"}};
     if(mode==="throw-committed")throw new Error("timeout");
     return{data:{id:record.id},error:null};
    }}}};
   }
  };
 }};
 return{supabase,rows,calls};
}

test("one user submission creates one operation and one independent submission creates another",async()=>{
 const db=fakeOperations();
 assert.deepEqual(await createOperationOnce(db.supabase,payload,id),{id,alreadyExists:false});
 assert.deepEqual(await createOperationOnce(db.supabase,payload,id),{id,alreadyExists:true});
 assert.deepEqual(await createOperationOnce(db.supabase,payload,otherId),{id:otherId,alreadyExists:false});
 assert.equal(db.rows.size,2);
 assert.equal(db.calls.filter(([action])=>action==="insert").length,2);
});

test("a committed operation is recovered after an error response or network timeout",async()=>{
 for(const mode of ["error-committed","throw-committed"]){
  const db=fakeOperations(mode);
  const saved=await createOperationOnce(db.supabase,payload,id);
  assert.deepEqual(saved,{id,alreadyExists:true});
  assert.equal(db.rows.size,1);
  await createOperationOnce(db.supabase,payload,id);
  assert.equal(db.calls.filter(([action])=>action==="insert").length,1);
 }
});

test("a genuinely failed insert is not reported as saved",async()=>{
 const db=fakeOperations("error-no-write");
 await assert.rejects(()=>createOperationOnce(db.supabase,payload,id),/database rejected/);
 assert.equal(db.rows.size,0);
});

test("changed form values cannot overwrite or impersonate an existing operation",async()=>{
 const db=fakeOperations();
 await createOperationOnce(db.supabase,payload,id);
 await assert.rejects(()=>createOperationOnce(db.supabase,{...payload,dose:30},id),/eltérő művelethez/);
 await assert.rejects(()=>createOperationOnce(db.supabase,{...payload,created_by:"other-user"},id),/eltérő művelethez/);
 assert.equal(db.rows.get(id).dose,25);
});

test("saved numeric values normalize across client and database formats",async()=>{
 const db=fakeOperations();
 await createOperationOnce(db.supabase,payload,id);
 db.rows.get(id).dose="25.000";
 assert.deepEqual(await createOperationOnce(db.supabase,payload,id),{id,alreadyExists:true});
});

test("invalid request IDs fail before querying the database",async()=>{
 const db=fakeOperations();
 await assert.rejects(()=>createOperationOnce(db.supabase,payload,"not-uuid"),/Érvénytelen/);
 assert.equal(db.calls.length,0);
 assert.match(operationRequestId(""),/^[0-9a-f-]{36}$/);
});

test("retry survives refresh for identical form values but changes create a new attempt",()=>{
 const firstForm=new FormData();firstForm.set("field_id","field-1");firstForm.set("dose","25");
 const sameForm=new FormData();sameForm.set("dose","25");sameForm.set("field_id","field-1");
 const changedForm=new FormData();changedForm.set("field_id","field-1");changedForm.set("dose","30");
 const fingerprint=operationSubmissionFingerprint(firstForm);
 assert.equal(fingerprint,operationSubmissionFingerprint(sameForm));
 const previous=reuseOperationAttempt(null,fingerprint,1000,()=>id);
 assert.equal(reuseOperationAttempt(previous,fingerprint,1500,()=>otherId).id,id);
 assert.equal(reuseOperationAttempt(previous,operationSubmissionFingerprint(changedForm),1500,()=>otherId).id,otherId);
 assert.equal(reuseOperationAttempt(previous,fingerprint,1000+13*3600*1000,()=>otherId).id,otherId);
 assert.equal(reuseOperationAttempt({...previous,id:"invalid"},fingerprint,1500,()=>otherId).id,otherId);
});

test("real operation form and server action skip duplicate timeline writes",()=>{
 const form=readFileSync(new URL("../components/OperationForm.tsx",import.meta.url),"utf8");
 const action=readFileSync(new URL("../app/operations/actions.ts",import.meta.url),"utf8");
 assert.match(form,/formData\.set\("request_id",attempt\.id\)/);
 assert.match(form,/sessionStorage\.setItem\(attemptKey,JSON\.stringify\(attempt\)\)/);
 assert.match(form,/sessionStorage\.removeItem\(attemptKey\)/);
 assert.match(action,/createOperationOnce\(/);
 assert.ok(action.indexOf("if(alreadyExists)")<action.indexOf('from("timeline_events").insert('));
 assert.doesNotMatch(action,/source_id:operation\.id/);
});
