import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createTaskOnce,taskRequestId} from "../lib/taskCreateIdempotency.ts";

const payload={
 farm_id:"farm-1",field_id:"field-1",title:"Vetés",
 description:"Keleti parcella",due_date:"2026-11-24",
 priority:"normal",status:"open",
 assigned_to:"farmer-1",created_by:"advisor-1"
};
const requestId="123e4567-e89b-42d3-a456-426614174000";
const otherRequestId="123e4567-e89b-42d3-a456-426614174001";

function mockTasks(mode="success"){
 const rows=new Map(),calls=[];
 const supabase={
  from(table){
   assert.equal(table,"tasks");
   return{
    select(){
     return{eq(key,id){
      assert.equal(key,"id");
      return{async maybeSingle(){
       calls.push(["lookup",id]);
       return{data:rows.get(id)||null,error:null};
      }};
     }};
    },
    insert(task){
     calls.push(["insert",task.id]);
     return{select(){return{async single(){
      if(mode==="error-no-write")return{data:null,error:{message:"write rejected"}};
      rows.set(task.id,task);
      if(mode==="error-committed")return{data:null,error:{message:"connection lost"}};
      if(mode==="throw-committed")throw new Error("network timeout");
      return{data:{id:task.id},error:null};
     }}}};
    }
   };
  }
 };
 return{supabase,rows,calls};
}

test("one request UUID creates only one task even when submitted twice",async()=>{
 const{supabase,rows,calls}=mockTasks();
 const first=await createTaskOnce(supabase,payload,requestId);
 const repeat=await createTaskOnce(supabase,payload,requestId);
 assert.deepEqual(first,{id:requestId,alreadyExists:false});
 assert.deepEqual(repeat,{id:requestId,alreadyExists:true});
 assert.equal(rows.size,1);
 assert.equal(calls.filter(([action])=>action==="insert").length,1);
});

test("timed-out response with committed task is recognized as success",async()=>{
 for(const mode of ["error-committed","throw-committed"]){
  const{supabase,rows,calls}=mockTasks(mode);
  const result=await createTaskOnce(supabase,payload,requestId);
  assert.deepEqual(result,{id:requestId,alreadyExists:true});
  assert.equal(rows.size,1);
  assert.equal(calls.filter(([action])=>action==="insert").length,1);
 }
});

test("failure without stored task is not reported as successful",async()=>{
 const{supabase}=mockTasks("error-no-write");
 await assert.rejects(()=>createTaskOnce(supabase,payload,requestId),/write rejected/);
});

test("same request UUID cannot be reused for another task or assignee",async()=>{
 const{supabase,calls}=mockTasks();
 await createTaskOnce(supabase,payload,requestId);
 await assert.rejects(()=>createTaskOnce(supabase,{...payload,assigned_to:"worker-2"},requestId),/másik feladathoz/);
 assert.equal(calls.filter(([action])=>action==="insert").length,1);
});

test("two independent UUIDs allow two intentional tasks",async()=>{
 const{supabase,rows}=mockTasks();
 await createTaskOnce(supabase,payload,requestId);
 await createTaskOnce(supabase,payload,otherRequestId);
 assert.equal(rows.size,2);
});

test("malformed request ID is rejected before any database call",async()=>{
 const{supabase,calls}=mockTasks();
 await assert.rejects(()=>createTaskOnce(supabase,payload,"not-a-uuid"),/érvénytelen/);
 assert.equal(calls.length,0);
 assert.match(taskRequestId(""),/^[0-9a-f-]{36}$/);
});

test("both actual task forms retain request IDs across retries",()=>{
 const advisor=readFileSync(new URL("../components/AdvisorSimpleTaskForm.tsx",import.meta.url),"utf8");
 const dispatch=readFileSync(new URL("../components/DispatchTaskForm.tsx",import.meta.url),"utf8");
 const advisorAction=readFileSync(new URL("../app/admin/tasks/actions.ts",import.meta.url),"utf8");
 const dispatchAction=readFileSync(new URL("../app/dispatch/actions.ts",import.meta.url),"utf8");
 for(const form of [advisor,dispatch]){
  assert.match(form,/requestIdRef=useRef<string\|null>\(null\)/);
  assert.match(form,/crypto\.randomUUID\(\)/);
  assert.match(form,/\.set\("request_id",requestIdRef\.current\)/);
  assert.match(form,/requestIdRef\.current=null/);
 }
 for(const action of [advisorAction,dispatchAction]){
  const check=action.indexOf("if(alreadyExists)return");
  const notice=action.indexOf('from("notifications").insert(');
  assert.ok(check>=0&&check<notice);
  assert.match(action,/createTaskOnce\(/);
 }
});
