import test from "node:test";
import assert from "node:assert/strict";
import {selectDispatchOptions} from "../lib/dispatchOptions.ts";

const farms=[{id:"a",owner_id:"owner-a"},{id:"b",owner_id:"owner-b"}];
const fields=[{id:"fa",farm_id:"a"},{id:"fb",farm_id:"b"}];
const members=[{user_id:"worker-a",farm_id:"a"},{user_id:"owner-a",farm_id:"a"},{user_id:"worker-a",farm_id:"a"},{user_id:"worker-b",farm_id:"b"}];
const machines=[{id:"ma",farm_id:"a"},{id:"mb",farm_id:"b"}];

test("a selected farm limits field, worker and machine choices",()=>{
 const selected=selectDispatchOptions("a",farms,fields,members,machines);
 assert.deepEqual(selected.fields.map(x=>x.id),["fa"]);
 assert.deepEqual(selected.machines.map(x=>x.id),["ma"]);
 assert.deepEqual(selected.assigneeIds,["owner-a","worker-a"]);
});
test("unknown or empty farm never exposes assignments from another farm",()=>{
 for(const id of ["","unknown"]){
  const selected=selectDispatchOptions(id,farms,fields,members,machines);
  assert.equal(selected.farm,null);
  assert.equal(selected.fields.length,0);
  assert.equal(selected.machines.length,0);
  assert.equal(selected.assigneeIds.length,0);
 }
});
test("changing farms does not carry old worker or machine selections",()=>{
 const selected=selectDispatchOptions("b",farms,fields,members,machines);
 assert.deepEqual(selected.assigneeIds,["owner-b","worker-b"]);
 assert.deepEqual(selected.fields.map(x=>x.id),["fb"]);
 assert.deepEqual(selected.machines.map(x=>x.id),["mb"]);
});
