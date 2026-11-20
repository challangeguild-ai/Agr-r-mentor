import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const dispatch=readFileSync(new URL("../app/dispatch/actions.ts",import.meta.url),"utf8");
const dispatchForm=readFileSync(new URL("../components/DispatchTaskForm.tsx",import.meta.url),"utf8");
const operationPlan=readFileSync(new URL("../app/admin/tasks/operation-actions.ts",import.meta.url),"utf8");

test("a cache refresh cannot turn a successful work dispatch into a retryable save error",()=>{
 assert.match(dispatch,/try\{\s*revalidatePath\("\/dispatch"\)/);
 assert.match(dispatch,/catch\(error\)\{console\.error\("Kiosztott munka nézetfrissítési hiba"/);
 assert.match(dispatch,/warnings\.push\("A munka létrejött, de a listák frissítése késhet\."\)/);
 assert.match(dispatch,/return\{ok:true as const,id:taskId,warnings\}/);
 assert.match(dispatchForm,/try\{router\.refresh\(\)\}catch\(refreshError\)/);
 assert.match(dispatchForm,/setWarning\(previous=>/);
});

test("a planned operation remains a confirmed saved task after refresh errors",()=>{
 assert.match(operationPlan,/catch\(error\)\{console\.error\("Műveleti terv nézetfrissítési hiba"/);
 assert.match(operationPlan,/warnings\.push\("A műveleti terv létrejött, de a listák frissülése késhet\."\)/);
 assert.match(operationPlan,/return\{ok:true,id:taskId,warnings\}/);
});
