import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {canSubmitTaskProof} from "../lib/taskWorkflow.ts";

test("field-linked open and started tasks can be submitted for advisor review",()=>{
 for(const status of ["open","in_progress"]){
  assert.equal(canSubmitTaskProof(status,"field-123"),true);
 }
});

test("submitted, completed and cancelled tasks cannot open another proof form",()=>{
 for(const status of ["submitted","done","cancelled",null,undefined,""]){
  assert.equal(canSubmitTaskProof(status,"field-123"),false);
 }
 assert.equal(canSubmitTaskProof("open",null),false);
 assert.equal(canSubmitTaskProof("in_progress",""),false);
});

test("field details no longer expose the legacy direct-completion action",()=>{
 const fieldPage=readFileSync(new URL("../app/fields/[id]/page.tsx",import.meta.url),"utf8");
 const fieldActions=readFileSync(new URL("../app/fields/[id]/actions.ts",import.meta.url),"utf8");
 const tasksPage=readFileSync(new URL("../app/tasks/page.tsx",import.meta.url),"utf8");
 assert.match(fieldPage,/Igazolás beküldése/);
 assert.match(fieldPage,/\/tasks\?view=open#task-/);
 assert.doesNotMatch(fieldPage,/completeTask/);
 assert.doesNotMatch(fieldActions,/\bcompleteTask\b|status:\s*["']done["']/);
 assert.match(tasksPage,/\|\|canSubmit\)\&\&/);
 assert.match(tasksPage,/TaskProofCompleteForm/);
});
