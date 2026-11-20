import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {planContactSync,syncContactRows} from "../lib/contactPersistence.ts";

const phone={contact_type:"phone",value:"+36301234567",label:"Kovács Anna",is_primary:true};
const email={contact_type:"email",value:"anna@example.hu",label:"Iroda",is_primary:false};

test("saving the same contact list again does not delete or insert anything",()=>{
 const existing=[{...phone,id:"p1"},{...email,id:"e1"}];
 assert.deepEqual(planContactSync(existing,[phone,email]),{inserts:[],updates:[],removeIds:[]});
});

test("new contact information is inserted before removing obsolete contact IDs",()=>{
 const existing=[{...phone,id:"p1"},{...email,id:"e1"}];
 const nextPhone={...phone,value:"+36309998877"};
 const nextEmail={...email,label:"Telephely",is_primary:true};
 assert.deepEqual(planContactSync(existing,[nextPhone,nextEmail]),{
  inserts:[nextPhone],
  updates:[{id:"e1",label:"Telephely",is_primary:true}],
  removeIds:["p1"]
 });
});

test("legacy duplicate contact rows can be cleaned without deleting the retained one",()=>{
 const existing=[{...phone,id:"p1"},{...phone,id:"p2"},{...email,id:"e1"}];
 assert.deepEqual(planContactSync(existing,[phone,email]),{inserts:[],updates:[],removeIds:["p2"]});
});

test("failed insertion never runs the destructive contact cleanup",async()=>{
 const calls=[];
 const supabase={
  from(table){
   assert.equal(table,"farm_contacts");
   return{
    select(){return{eq(){calls.push("read");return Promise.resolve({data:[{...phone,id:"p1"}],error:null})}}},
    insert(){calls.push("insert");return{select(){return Promise.resolve({data:null,error:{message:"write failed"}})}}},
    delete(){calls.push("delete");throw new Error("Must not delete existing contacts")}
   };
  }
 };
 await assert.rejects(()=>syncContactRows(supabase,"farm_contacts","farm_id","farm-1",[phone,email]),/write failed/);
 assert.deepEqual(calls,["read","insert"]);
});

test("both contact actions avoid delete-before-insert",()=>{
 const actions=readFileSync(new URL("../app/contact-actions.ts",import.meta.url),"utf8");
 assert.match(actions,/syncContactRows\(supabase,"farm_contacts"/);
 assert.match(actions,/syncContactRows\(supabase,"profile_contacts"/);
 assert.doesNotMatch(actions,/from\("farm_contacts"\)\.delete\(\)\.eq\("farm_id"/);
 assert.doesNotMatch(actions,/from\("profile_contacts"\)\.delete\(\)\.eq\("profile_id"/);
});
