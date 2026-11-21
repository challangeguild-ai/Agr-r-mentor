import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const repo=readFileSync(new URL("../android/app/src/main/java/hu/agrarmentor/android/data/CommunicationRepository.kt",import.meta.url),"utf8");
const ui=readFileSync(new URL("../android/app/src/main/java/hu/agrarmentor/android/ui/AdvisorReportScreen.kt",import.meta.url),"utf8");
const task=repo.slice(repo.indexOf("private fun saveReportTask("),repo.indexOf("suspend fun documents("));

test("native response task uses a stable ID and verifies the persisted fields before notification",()=>{
 const uuid=task.indexOf("AdvisorReportTaskRules.stableId(report.id,reply)");
 const query=task.indexOf("fun checkSaved()");
 const insert=task.indexOf('request("POST","rest/v1/tasks"');
 const readBack=task.indexOf('check(checkSaved())');
 const notice=task.indexOf('request("POST","rest/v1/notifications"');
 assert.ok(uuid>=0&&query>uuid&&insert>query&&readBack>insert&&notice>readBack);
 assert.match(task,/saved\.optString\("assigned_to"\)==report\.farmerId/);
 assert.match(task,/saved\.optString\("created_by"\)==session\.userId/);
 assert.match(task,/saved\.optString\("title"\)==title/);
 assert.match(task,/"task:\$taskId:report"/);
});

test("task email failure cannot roll back an already-saved task",()=>{
 assert.match(task,/\.onFailure\{warnings\.add\("A teendő e-mailes értesítése nem igazolható\."\)\}/);
 assert.match(task,/return ReportTaskSaveOutcome\(taskId,warnings\)/);
 assert.match(ui,/Checkbox\(checked=attachTask/);
 assert.match(ui,/AdvisorReportTaskRules\.validate\(AdvisorReportTaskInput/);
 assert.match(ui,/result\.taskId!=null/);
});
