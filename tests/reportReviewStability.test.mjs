import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const actions=readFileSync(new URL("../app/admin/actions.ts",import.meta.url),"utf8");
const section=actions.slice(actions.indexOf("export async function handleReport("));
const form=readFileSync(new URL("../components/ReportResponseForm.tsx",import.meta.url),"utf8");
const page=readFileSync(new URL("../app/admin/reports/page.tsx",import.meta.url),"utf8");

test("report task date and title are validated before any report update",()=>{
 const date=section.indexOf('if(!validDate(taskDue))');
 const title=section.indexOf("if(taskTitleInput.length>180)");
 const update=section.indexOf('from("farmer_reports").update(changes)');
 assert.ok(date>=0&&title>=0&&update>date&&update>title);
 assert.match(section,/if\(action!=="close"&&!reply\)/);
 assert.match(section,/if\(action==="reply_task"&&taskTitle\.length>180\)/);
});

test("already saved replies and closed reports avoid a second write",()=>{
 const guard=section.indexOf('report.status==="reviewed"&&report.advisor_reply===reply');
 const guardClose=section.indexOf('action==="close"&&report.status==="closed"');
 const write=section.indexOf('from("farmer_reports").update(changes)');
 assert.ok(guard>=0&&guard<write&&guardClose>=0&&guardClose<write);
 assert.match(section,/status:"already_saved"/);
});

test("concurrent changes and invisible updates cannot be mistaken for success",()=>{
 assert.match(section,/update\.eq\("updated_at",report\.updated_at\)/);
 assert.match(section,/update\.is\("updated_at",null\)/);
 assert.match(section,/update\.select\("id"\)\.maybeSingle\(\)/);
 assert.match(section,/if\(updateError\|\|!saved\)/);
});

test("task and notifications only happen after confirmed report save",()=>{
 const verified=section.indexOf("if(updateError||!saved)");
 const notices=section.indexOf("async function sendNotices");
 const task=section.indexOf('from("tasks").insert({');
 assert.ok(verified>=0&&notices>verified&&task>verified);
 assert.match(section,/if\(error\|\|!task\)throw/);
 assert.match(section,/warnings\.push\("A válasz elmentve, de a teendő mentése nem igazolt/);
 assert.match(section,/return\{status:"saved",action,warnings,taskId\}/);
});

test("side effect errors return warnings instead of making the user retry the saved response",()=>{
 assert.match(section,/console\.error\("Már mentett bejelentés idővonalhiba"/);
 assert.match(section,/console\.error\("Már mentett bejelentés értesítési hiba"/);
 assert.match(section,/console\.error\("Már mentett bejelentés e-mail hiba"/);
 assert.match(section,/console\.error\("Bejelentés mentve, gyorsítótár-frissítés sikertelen"/);
 assert.match(section,/if\(error\|\|data\?\.error\)/);
});

test("client feedback displays partial success and blocks duplicate clicks",()=>{
 assert.match(form,/if\(pendingRef\.current\|\|result\)return/);
 assert.match(form,/setResult\(saved\)/);
 assert.match(form,/result\.warnings\.map/);
 assert.match(form,/result\.taskId/);
 assert.match(form,/disabled=\{busy\|\|!!result\}/);
 assert.match(form,/Teendőlista ellenőrzése/);
 assert.match(page,/<ReportResponseForm reportId=\{r\.id\}\/>/);
 assert.doesNotMatch(page,/action=\{handleReport\}/);
});
