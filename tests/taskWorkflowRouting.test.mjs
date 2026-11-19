import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {canSubmitTaskProof,canSubmitGeneralTask,generalTaskCompletionNote} from "../lib/taskWorkflow.ts";

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

test("farm-wide general tasks have a separate review path without field GPS",()=>{
 for(const status of ["open","in_progress"]){
  assert.equal(canSubmitGeneralTask(status,null,"general"),true);
  assert.equal(canSubmitGeneralTask(status,"field-123","general"),false);
  assert.equal(canSubmitGeneralTask(status,null,"operation"),false);
  assert.equal(canSubmitTaskProof(status,null),false);
 }
 for(const status of ["submitted","done","cancelled",null]){
  assert.equal(canSubmitGeneralTask(status,null,"general"),false);
 }
});

test("general task attestation requires a short, bounded human note",()=>{
 assert.equal(generalTaskCompletionNote("  Egyeztetve.  "),"Egyeztetve.");
 for(const note of ["","  ","OK","x".repeat(1501)]){
  assert.equal(generalTaskCompletionNote(note),null);
 }
 assert.equal(generalTaskCompletionNote("x".repeat(1500))?.length,1500);
});

test("general task RPC is authorized, atomic, idempotent and review-gated",()=>{
 const sql=readFileSync(new URL("../supabase/migrations/20261119080000_general_task_attestation_review.sql",import.meta.url),"utf8");
 assert.match(sql,/assigned_to\s*=\s*v_actor\s+for update/i);
 assert.match(sql,/v_task\.task_kind\s*<>\s*'general'/i);
 assert.match(sql,/v_task\.field_id\s+is not null/i);
 assert.match(sql,/fm\.active/i);
 assert.match(sql,/v_task\.status in \('submitted', 'done'\)\s+then\s+return false/i);
 assert.match(sql,/on conflict \(task_id\) do update/i);
 assert.match(sql,/review_status\s*=\s*'pending'/i);
 assert.match(sql,/status\s*=\s*'submitted'/i);
 assert.doesNotMatch(sql,/status\s*=\s*'done'/i);
 assert.match(sql,/revoke all on function .* from public, anon, authenticated/i);
 assert.match(sql,/grant execute on function .* to authenticated/i);
});

test("field details no longer expose the legacy direct-completion action",()=>{
 const fieldPage=readFileSync(new URL("../app/fields/[id]/page.tsx",import.meta.url),"utf8");
 const fieldActions=readFileSync(new URL("../app/fields/[id]/actions.ts",import.meta.url),"utf8");
 const tasksPage=readFileSync(new URL("../app/tasks/page.tsx",import.meta.url),"utf8");
 assert.match(fieldPage,/Igazolás beküldése/);
 assert.match(fieldPage,/\/tasks\?view=open#task-/);
 assert.doesNotMatch(fieldPage,/completeTask/);
 assert.doesNotMatch(fieldActions,/\bcompleteTask\b|status:\s*["']done["']/);
 assert.match(tasksPage,/\|\|canSubmit\|\|canSubmitGeneral\)\&\&/);
 assert.match(tasksPage,/TaskProofCompleteForm/);
});
