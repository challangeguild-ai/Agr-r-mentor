import test from "node:test";
import assert from "node:assert/strict";
import {parseOperationDraft} from "../lib/operationDraft.ts";
const now=1795037000000,context={fieldIds:["f1","f2"],operationTypes:["spraying","fertilizing"],now};
function snapshot(overrides={}){
 return JSON.stringify({
  savedAt:now-1000,fieldId:"f1",type:"spraying",step:2,
  product:"",customProduct:"",productId:"",useId:"",catalogCrop:"",dose:"",
  doseMode:"custom",machineId:"",customMachine:"",
  entries:{notes:"Mintaszöveg",treated_area:"1,5"},...overrides
 });
}
test("restores a recent, well-formed field draft",()=>{
 const parsed=parseOperationDraft(snapshot(),context);
 assert.equal(parsed?.step,2);
 assert.equal(parsed?.entries.notes,"Mintaszöveg");
});
test("rejects old or future snapshots",()=>{
 for(const savedAt of [now-13*60*60*1000,now+2*60*1000])
  assert.equal(parseOperationDraft(snapshot({savedAt}),context),null);
});
test("a draft cannot be restored on a different or inaccessible field",()=>{
 assert.equal(parseOperationDraft(snapshot(),{...context,defaultFieldId:"f2"}),null);
 assert.equal(parseOperationDraft(snapshot(),{...context,fieldIds:["f2"]}),null);
});
test("untrusted broken entries and operation modes are discarded",()=>{
 for(const raw of [
  "{not-json",snapshot({type:"not-a-type"}),snapshot({step:9}),
  snapshot({entries:{notes:{nested:1}}}),
  snapshot({doseMode:"rogue"}),
  snapshot({productId:77})
 ])assert.equal(parseOperationDraft(raw,context),null);
});
