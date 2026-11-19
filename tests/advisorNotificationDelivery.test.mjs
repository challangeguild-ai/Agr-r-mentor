import test from "node:test";
import assert from "node:assert/strict";
import {notifyAdvisors} from "../lib/workflowNotifications.ts";

const input={kind:"farmer_report",title:"Új bejelentés",eventKey:"report:123:created"};

test("an RPC failure is distinguishable from a successful call with no recipients",async()=>{
 const failure={message:"RPC jogosultság megtagadva",code:"42501"};
 const client={rpc:async()=>({data:null,error:failure})};
 await assert.rejects(notifyAdvisors(client,input),error=>{
  assert.match(error.message,/RPC jogosultság megtagadva/);
  assert.equal(error.cause,failure);
  return true;
 });
});

test("a successful call without an advisor still returns an empty recipient list",async()=>{
 const client={rpc:async()=>({data:[],error:null})};
 assert.deepEqual(await notifyAdvisors(client,input),[]);
});

test("a successful notification returns only valid recipient IDs",async()=>{
 const client={rpc:async()=>({data:[{recipient_id:"advisor-1"},{recipient_id:null},{recipient_id:"advisor-2"}],error:null})};
 assert.deepEqual(await notifyAdvisors(client,input),["advisor-1","advisor-2"]);
});
