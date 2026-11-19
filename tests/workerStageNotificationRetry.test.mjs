import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const action=readFileSync(new URL("../app/work/actions.ts",import.meta.url),"utf8");
const form=readFileSync(new URL("../components/WorkerTaskStageForm.tsx",import.meta.url),"utf8");
const page=readFileSync(new URL("../app/work/page.tsx",import.meta.url),"utf8");
const notificationSql=readFileSync(new URL("../supabase/migrations/20261119093000_authorized_advisor_notifications.sql",import.meta.url),"utf8");

test("stage retries inspect persisted events and never create another event after an existing one",()=>{
 assert.match(action,/select\("id"\)\.eq\("source_id",task\.id\)\.eq\("event_type",eventType\)\.eq\("created_by",user\.id\)\.limit\(1\)\.maybeSingle\(\)/);
 assert.match(action,/if\(lookupError\)throw/);
 assert.match(action,/if\(!existing\)\{/);
 const insertion=action.indexOf('from("timeline_events").insert');
 const notification=action.indexOf('await notifyAdvisors(');
 const afterInsertBlock=action.indexOf('let warning:string|null=null;');
 assert.ok(insertion>0&&afterInsertBlock>insertion&&notification>afterInsertBlock,"notifications must retry outside the first-insert-only branch");
});

test("work cannot be started without the current worker's accepted event",()=>{
 assert.match(action,/if\(stage==="started"\)\{/);
 assert.match(action,/\.eq\("event_type",TASK_ACCEPTED_EVENT\)\.eq\("created_by",user\.id\)/);
 assert.match(action,/if\(!accepted\)throw new Error/);
 assert.ok(action.indexOf('if(!accepted)throw')<action.indexOf('from("timeline_events").insert'));
});

test("advisor notifications remain idempotent, and the worker can retry partial success without duplicate steps",()=>{
 assert.match(notificationSql,/on conflict \(user_id,event_key\) where event_key is not null do nothing/);
 assert.match(action,/eventKey:`task:\$\{task\.id\}:\$\{stage\}`/);
 assert.match(action,/warning="A munkalépés elmentődött, de a szaktanácsadói értesítés nem igazolt/);
 assert.match(action,/return\{ok:true as const,warning\}/);
 assert.match(action,/try\{revalidatePath\(path\)\}catch\(e\)/);
 assert.match(form,/if\(submitting\.current\)return/);
 assert.match(form,/if\(result\.warning\)setWarning\(result\.warning\)/);
 assert.match(form,/Értesítés újrapróbálása/);
 assert.match(form,/role="status"/);
 assert.match(page,/<WorkerTaskStageForm taskId=\{t\.id\} stage="accepted"\/>/);
 assert.match(page,/<WorkerTaskStageForm taskId=\{t\.id\} stage="started"\/>/);
 assert.match(page,/\.select\("source_id,event_type,event_at,created_by"\)/);
 assert.match(page,/e\.source_id===t\.id&&e\.created_by===user\.id/);
 assert.doesNotMatch(page,/action=\{setWorkerTaskStage\}/);
});
