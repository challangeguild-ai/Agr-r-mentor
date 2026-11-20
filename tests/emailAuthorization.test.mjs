import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {authorizeNotificationEmail,parseEmailEvent} from "../supabase/functions/_shared/notificationAuthorization.ts";

const uuid="11111111-2222-4333-8444-555555555555";
const sender="aaaaaaaa-1111-4111-8111-111111111111";
const target="bbbbbbbb-2222-4222-8222-222222222222";

function fixture(tables){
 return{from(name){
  const filters=[];
  return{
   select(){return this},
   eq(field,value){filters.push([field,value]);return this},
   async maybeSingle(){
    const rows=tables[name]??[];
    return{data:rows.find(row=>filters.every(([field,value])=>row[field]===value))??null,error:null};
   }
  };
 }};
}

function taskDatabase(action="dispatch"){
 return fixture({
  notifications:[{id:"n1",user_id:target,event_key:`task:${uuid}:${action}`}],
  tasks:[{id:uuid,created_by:sender,assigned_to:target,status:"open"}],
 });
}

test("mail is allowed for a persisted task assigned to a worker, regardless of profile role",async()=>{
 assert.deepEqual(parseEmailEvent(`task:${uuid}:dispatch`),{kind:"task",id:uuid,action:"dispatch"});
 assert.equal(await authorizeNotificationEmail(taskDatabase(),sender,target,`task:${uuid}:dispatch`,"farmer","user","farmer","user"),true);
 assert.equal(await authorizeNotificationEmail(taskDatabase(),sender,target,`task:${uuid}:dispatch`,"advisor","user","farmer","user"),true);
});

test("email cannot be sent to an unrelated user or with a fabricated event",async()=>{
 const db=taskDatabase();
 assert.equal(await authorizeNotificationEmail(db,sender,"outsider",`task:${uuid}:dispatch`,"farmer","user","farmer","user"),false);
 assert.equal(await authorizeNotificationEmail(db,sender,target,`task:${uuid}:other`,"farmer","user","farmer","user"),false);
 assert.equal(await authorizeNotificationEmail(db,sender,sender,`task:${uuid}:dispatch`,"farmer","user","farmer","user"),false);
 assert.equal(await authorizeNotificationEmail(taskDatabase("advisor"),sender,target,`task:${uuid}:advisor`,"farmer","user","farmer","user"),false);
 assert.equal(await authorizeNotificationEmail(fixture({notifications:[{id:"n1",user_id:target,event_key:`task:${uuid}:dispatch`}],tasks:[{id:uuid,created_by:"someone-else",assigned_to:target,status:"open"}]}),sender,target,`task:${uuid}:dispatch`,"farmer","user","farmer","user"),false);
});

test("a real task assigned to its own farmer creator can send a legitimate self-notice",async()=>{
 const db=fixture({
  notifications:[{id:"n1",user_id:sender,event_key:`task:${uuid}:dispatch`}],
  tasks:[{id:uuid,created_by:sender,assigned_to:sender,status:"open"}],
 });
 assert.equal(await authorizeNotificationEmail(db,sender,sender,`task:${uuid}:dispatch`,"farmer","user","farmer","user"),true);
});

test("worker task submission and farmer reports require the real advisor notification",async()=>{
 const submitted=fixture({
  notifications:[{id:"n2",user_id:target,event_key:`task:${uuid}:submitted:advisor:${target}`}],
  tasks:[{id:uuid,created_by:"some-advisor",assigned_to:sender,status:"submitted"}],
 });
 assert.equal(await authorizeNotificationEmail(submitted,sender,target,`task:${uuid}:submitted`,"farmer","user","advisor","user"),true);
 assert.equal(await authorizeNotificationEmail(submitted,sender,target,`task:${uuid}:submitted`,"farmer","user","advisor","admin"),false);
 const reported=fixture({
  notifications:[{id:"n3",user_id:target,event_key:`report:${uuid}:created:advisor:${target}`}],
  farmer_reports:[{id:uuid,farmer_id:sender,status:"new",replied_by:null}],
 });
 assert.equal(await authorizeNotificationEmail(reported,sender,target,`report:${uuid}:created`,"farmer","user","advisor","user"),true);
});

test("inspection and advisor reply emails must match existing business records",async()=>{
 const inspection=fixture({
  notifications:[{id:"n4",user_id:target,event_key:`inspection:${uuid}:farmer`}],
  inspections:[{id:uuid,advisor_id:sender,field_id:"field-1"}],
  fields:[{id:"field-1",farm_id:"farm-1"}],
  farms:[{id:"farm-1",owner_id:target}],
 });
 assert.equal(await authorizeNotificationEmail(inspection,sender,target,`inspection:${uuid}:farmer`,"advisor","user","farmer","user"),true);
 assert.equal(await authorizeNotificationEmail(inspection,sender,target,`inspection:${uuid}:farmer`,"farmer","user","farmer","user"),false);
 const reply=fixture({
  notifications:[{id:"n5",user_id:target,event_key:`report:${uuid}:reply`}],
  farmer_reports:[{id:uuid,farmer_id:target,replied_by:sender,status:"reviewed"}],
 });
 assert.equal(await authorizeNotificationEmail(reply,sender,target,`report:${uuid}:reply`,"advisor","user","farmer","user"),true);
 assert.equal(await authorizeNotificationEmail(reply,sender,target,`report:${uuid}:reply`,"advisor","admin","farmer","user"),false);
});

test("every notification email callsite includes an event key and a matching notification insert",()=>{
 const source=path=>readFileSync(new URL(path,import.meta.url),"utf8");
 const paths=[
  "../app/dispatch/actions.ts",
  "../app/admin/tasks/actions.ts",
  "../app/admin/tasks/operation-actions.ts",
  "../app/admin/inspectionActions.ts",
  "../app/admin/actions.ts",
 ];
 for(const path of paths){
  const value=source(path);
  assert.match(value,/event_key:/,path);
  assert.match(value,/event_key:[\s\S]*?task:|event_key:[\s\S]*?inspection:|event_key:eventKey/,path);
 }
 const gateway=source("../supabase/functions/send-notification-email/index.ts");
 assert.match(gateway,/authorizeNotificationEmail\(/);
 assert.ok(gateway.indexOf("authorizeNotificationEmail(")<gateway.indexOf('admin.rpc("claim_notification_email_send_quota"'));
 assert.match(gateway,/if\(!eventKey\)/);
});
