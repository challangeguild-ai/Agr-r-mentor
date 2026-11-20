import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseContacts,validateContacts} from "../lib/contactInput.ts";
import {createFarmRecord} from "../lib/farmCreation.ts";

const farm={owner_id:"farmer-1",name:"Próba gazdaság",settlement:"Példa",address:null};
const phone={contact_type:"phone",label:"Nagy Ágnes",value:"+36301234567",is_primary:true};
const email={contact_type:"email",label:"Iroda",value:"office@example.hu",is_primary:false};

function mockDatabase({matches=[],farmWriteError=null,contactsError=null,lookupError=null}={}){
 const calls=[];
 const fake={
  from(table){
   calls.push(["from",table]);
   if(table==="farms")return{
    select(){return{
     eq(){return this},ilike(){return this},is(){return this},limit(){return this},
     async maybeSingle(){calls.push(["lookup"]);return{data:matches.shift()||null,error:lookupError}}
    }},
    insert(value){
     calls.push(["insertFarm",value]);
     return{select(){return{async single(){return farmWriteError
      ?{data:null,error:{message:farmWriteError}}
      :{data:{id:"farm-new"},error:null}}}}};
    },
    delete(){throw new Error("A gazdaság visszagörgetése tilos.")}
   };
   if(table==="farm_contacts")return{
    insert(rows){
     calls.push(["insertContacts",rows]);
     return{async select(){return contactsError
      ?{data:null,error:{message:contactsError}}
      :{data:rows.map((_,index)=>({id:`contact-${index}`})),error:null}}};
    }
   };
   throw new Error(`Váratlan tábla: ${table}`);
  }
 };
 return{fake,calls};
}

test("new farm and contacts are created once with correct primary flag",async()=>{
 const{fake,calls}=mockDatabase();
 const result=await createFarmRecord(fake,farm,[phone,email]);
 assert.deepEqual(result,{id:"farm-new",status:"created"});
 assert.equal(calls.filter(([action])=>action==="insertFarm").length,1);
 assert.deepEqual(calls.find(([action])=>action==="insertContacts")[1],[
  {...phone,farm_id:"farm-new"},{...email,farm_id:"farm-new"}
 ]);
});

test("existing farm never inserts a duplicate or overwrites contacts",async()=>{
 const{fake,calls}=mockDatabase({matches:[{id:"already-created"}]});
 const result=await createFarmRecord(fake,farm,[phone,email]);
 assert.equal(result.id,"already-created");
 assert.equal(result.status,"existing");
 assert.match(result.warning,/már szerepel/);
 assert.deepEqual(calls.map(([action])=>action),["from","lookup"]);
});

test("failed contact write leaves created farm intact and reports partial success",async()=>{
 const{fake,calls}=mockDatabase({contactsError:"permission denied"});
 const originalError=console.error;
 console.error=()=>{};
 try{
  const result=await createFarmRecord(fake,farm,[phone,email]);
  assert.equal(result.id,"farm-new");
  assert.equal(result.status,"created");
  assert.match(result.warning,/gazdaság létrejött/);
  assert.match(result.warning,/Kapcsolattartók/);
  assert.equal(calls.filter(([action])=>action==="insertFarm").length,1);
 }finally{console.error=originalError}
});

test("uncertain farm insert is rechecked before allowing retry",async()=>{
 const{fake,calls}=mockDatabase({matches:[null,{id:"farm-committed"}],farmWriteError:"network timeout"});
 const result=await createFarmRecord(fake,farm,[phone,email]);
 assert.equal(result.id,"farm-committed");
 assert.equal(result.status,"existing");
 assert.match(result.warning,/visszaigazolás/);
 assert.equal(calls.filter(([action])=>action==="lookup").length,2);
 assert.equal(calls.filter(([action])=>action==="insertContacts").length,0);
});

test("lookup failure prevents unverified farm insert",async()=>{
 const{fake,calls}=mockDatabase({lookupError:{message:"RLS denied"}});
 await assert.rejects(()=>createFarmRecord(fake,farm,[phone,email]),/ellenőrzése sikertelen/);
 assert.equal(calls.some(([action])=>action==="insertFarm"),false);
});

test("contact input validates before farm creation and normalizes duplicates",()=>{
 const raw=JSON.stringify([
  {...phone,value:"+36 30 123 4567",is_primary:false},
  {...phone,value:"+36301234567",is_primary:false},
  {...email,value:" OFFICE@EXAMPLE.HU ",is_primary:true}
 ]);
 const items=parseContacts(raw);
 assert.equal(items.length,2);
 assert.deepEqual(items[0],{...phone,is_primary:false});
 assert.deepEqual(items[1],{...email,is_primary:true});
 assert.doesNotThrow(()=>validateContacts(items));
 assert.throws(()=>validateContacts(parseContacts(JSON.stringify([
  {...phone,value:"123"},{...email}
 ]))),/Érvénytelen telefonszám/);
 assert.throws(()=>parseContacts(JSON.stringify(Array(31).fill(phone))),/Legfeljebb 30/);
});

test("farm creation action uses safe workflow and shows partial-save UI",()=>{
 const action=readFileSync(new URL("../app/admin/client-contact-actions.ts",import.meta.url),"utf8");
 const component=readFileSync(new URL("../components/FarmCreateWithContacts.tsx",import.meta.url),"utf8");
 assert.match(action,/validateContacts\(items,true\)/);
 assert.match(action,/createFarmRecord\(/);
 assert.doesNotMatch(action,/\.delete\(\)/);
 assert.match(component,/result.warning/);
 assert.match(component,/Kapcsolattartók ellenőrzése/);
});
