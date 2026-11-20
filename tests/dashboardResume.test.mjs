import test from "node:test";
import assert from "node:assert/strict";
import {selectResumeCards} from "../lib/dashboardResume.ts";
const task=(id,status,review_status)=>({id,title:"Feladat "+id,status,review_status});
test("review corrections supersede in-progress state without duplicate cards",()=>{
 const out=selectResumeCards([task("a","in_progress","rejected")],[]);
 assert.deepEqual(out.map(x=>x.id),["r-a"]);
});
test("waiting review takes priority over regular work",()=>{
 const out=selectResumeCards([task("a","in_progress",null),task("b","submitted","pending")],[]);
 assert.deepEqual(out.map(x=>x.id),["w-b","p-a"]);
});
test("reply links and maximum cards are retained",()=>{
 const out=selectResumeCards([task("a","in_progress",null)], [{id:"x",title:"Válasz"}],2);
 assert.deepEqual(out.map(x=>x.href),["/tasks","/messages"]);
 assert.equal(selectResumeCards([task("a","in_progress",null)],[],0).length,0);
});
