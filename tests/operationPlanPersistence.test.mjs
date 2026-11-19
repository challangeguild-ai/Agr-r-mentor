import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ensureOperationPlanOnce,ensureOperationMachineOnce} from "../lib/operationPlanPersistence.ts";

const taskId="123e4567-e89b-42d3-a456-426614174000";
const plan={task_id:taskId,country_code:"HU",operation_type:"fertilizing",
 subtype:null,product_id:null,plant_protection_use_id:null,product_name:"Műtrágya",
 crop:"Kukorica",target:null,planned_dose:25,dose_unit:"kg/ha",
 planned_area:3.5,planned_quantity:87.5,quantity_unit:"kg",
 approval_required:false,requested_approver_id:null,
 regulatory_snapshot:{},catalog_snapshot:{}};

function fakeDb(){
 const plans=new Map(),machines=new Map(),calls=[];
 let planMode="success",machineMode="success";
 const supabase={
  from(table){
   assert.ok(["task_operation_plans","task_machine_assignments"].includes(table));
   return{
    select(){return{eq(key,id){assert.equal(key,"task_id");return{
     async maybeSingle(){
      calls.push(["read",table,id]);
      const row=(table==="task_operation_plans"?plans:machines).get(id);
      return{data:row||null,error:null};
     }
    }}}},
    insert(row){
     calls.push(["insert",table,row.task_id]);
     const mode=table==="task_operation_plans"?planMode:machineMode;
     if(mode!=="error-no-write"){
      if(table==="task_operation_plans")plans.set(row.task_id,row);
      else machines.set(row.task_id,row);
     }
     if(mode==="throw-committed")throw new Error("connection reset");
     return Promise.resolve({error:mode==="success"?null:{message:"connection lost"}});
    }
   };
  }
 };
 return{supabase,plans,machines,calls,
  setPlanMode(mode){planMode=mode},setMachineMode(mode){machineMode=mode}};
}

test("saved operation plan is reused across retries without a second INSERT",async()=>{
 const db=fakeDb();
 assert.deepEqual(await ensureOperationPlanOnce(db.supabase,plan),{alreadyExists:false});
 assert.deepEqual(await ensureOperationPlanOnce(db.supabase,plan),{alreadyExists:true});
 assert.equal(db.plans.size,1);
 assert.equal(db.calls.filter(x=>x[0]==="insert").length,1);
});

test("committed plan survives an error response or thrown timeout",async()=>{
 for(const mode of ["error-committed","throw-committed"]){
  const db=fakeDb();db.setPlanMode(mode);
  assert.deepEqual(await ensureOperationPlanOnce(db.supabase,plan),{alreadyExists:true});
  assert.equal(db.plans.size,1);
  await ensureOperationPlanOnce(db.supabase,plan);
  assert.equal(db.calls.filter(x=>x[0]==="insert").length,1);
 }
});

test("failed plan does not roll back the parent task and can be resumed",async()=>{
 const db=fakeDb(),tasks=new Set([taskId]);
 db.setPlanMode("error-no-write");
 await assert.rejects(()=>ensureOperationPlanOnce(db.supabase,plan),/feladat .* megmaradt/);
 assert.equal(db.plans.size,0);
 assert.ok(tasks.has(taskId));
 db.setPlanMode("success");
 assert.deepEqual(await ensureOperationPlanOnce(db.supabase,plan),{alreadyExists:false});
 assert.equal(db.plans.size,1);
 assert.ok(tasks.has(taskId));
});

test("same ID cannot quietly accept changed plan data",async()=>{
 const db=fakeDb();
 await ensureOperationPlanOnce(db.supabase,plan);
 await assert.rejects(
  ()=>ensureOperationPlanOnce(db.supabase,{...plan,planned_dose:30}),
  /eltérő műveleti tervhez/
 );
 assert.equal(db.plans.get(taskId).planned_dose,25);
 assert.equal(db.calls.filter(x=>x[0]==="insert").length,1);
});

test("a missing machine can be added later without creating duplicates",async()=>{
 const db=fakeDb();db.setMachineMode("error-no-write");
 assert.equal(await ensureOperationMachineOnce(db.supabase,taskId,"machine-1","advisor-1"),"missing");
 db.setMachineMode("success");
 assert.equal(await ensureOperationMachineOnce(db.supabase,taskId,"machine-1","advisor-1"),"confirmed");
 assert.equal(await ensureOperationMachineOnce(db.supabase,taskId,"machine-1","advisor-1"),"confirmed");
 assert.equal(db.calls.filter(x=>x[0]==="insert"&&x[1]==="task_machine_assignments").length,2);
});

test("committed machine is recovered after timeout; conflicting machine is not overwritten",async()=>{
 const db=fakeDb();db.setMachineMode("throw-committed");
 assert.equal(await ensureOperationMachineOnce(db.supabase,taskId,"machine-1","advisor-1"),"confirmed");
 assert.equal(await ensureOperationMachineOnce(db.supabase,taskId,"machine-2","advisor-1"),"conflict");
 assert.equal(db.machines.get(taskId).machine_id,"machine-1");
 assert.equal(db.calls.filter(x=>x[0]==="insert"&&x[1]==="task_machine_assignments").length,1);
});

test("the real form retains one request ID and the server never deletes a partially saved task",()=>{
 const form=readFileSync(new URL("../components/OperationTaskPlanForm.tsx",import.meta.url),"utf8");
 const action=readFileSync(new URL("../app/admin/tasks/operation-actions.ts",import.meta.url),"utf8");
 assert.match(form,/requestIdRef=useRef<string\|null>\(null\)/);
 assert.match(form,/crypto\.randomUUID\(\)/);
 assert.match(form,/fd\.set\("request_id",requestIdRef\.current\)/);
 assert.match(form,/requestIdRef\.current=null/);
 assert.match(action,/createTaskOnce\(/);
 assert.match(action,/ensureOperationPlanOnce\(/);
 assert.match(action,/ensureOperationMachineOnce\(/);
 assert.doesNotMatch(action,/\.delete\(\)/);
 assert.ok(action.indexOf("if(planAlreadyExists)")<action.indexOf('from("notifications").insert('));
});
