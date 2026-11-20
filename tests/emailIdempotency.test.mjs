import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 normalizeNotificationEventKey,
 notificationEmailIdempotencyKey,
} from "../supabase/functions/_shared/notificationIdempotency.ts";

const source=relative=>readFileSync(new URL(relative,import.meta.url),"utf8");
const example={
 senderId:"sender-1",recipientId:"recipient-1",recipientEmail:"farmer@example.invalid",
 eventKey:"task:a1b2:assigned",from:"Agrár Mentor <noreply@example.invalid>",
 subject:"Új munka",message:"Földtábla ellenőrzés",link:"https://mentor.example.invalid/work",
};

test("idempotency keys are deterministic, opaque and different for independent events",async()=>{
 const first=await notificationEmailIdempotencyKey(example);
 assert.match(first,/^agrar-email-v1-[a-f0-9]{64}$/);
 assert.equal(await notificationEmailIdempotencyKey({...example}),first);
 assert.ok(!first.includes(example.recipientEmail));
 assert.notEqual(await notificationEmailIdempotencyKey({...example,eventKey:"task:c3d4:assigned"}),first);
 assert.equal(await notificationEmailIdempotencyKey({...example,message:"Másik feladat"}),first);
 assert.equal(await notificationEmailIdempotencyKey({...example,subject:"Változtatott tárgy"}),first);
 assert.notEqual(await notificationEmailIdempotencyKey({...example,recipientId:"recipient-2"}),first);
});

test("invalid business event keys are refused and plain calls do not fake event identities",()=>{
 assert.equal(normalizeNotificationEventKey(" task:42:done "),"task:42:done");
 for(const value of [null,undefined,""," ","evil\nheader","x".repeat(181),42,{},[]])
  assert.equal(normalizeNotificationEventKey(value),null);
 const edge=source("../supabase/functions/send-notification-email/index.ts");
 assert.match(edge,/if\(!eventKey\)return json\(\{error:/);
 assert.match(edge,/const idempotencyKey=await notificationEmailIdempotencyKey/);
 assert.match(edge,/"Idempotency-Key":idempotencyKey/);
 assert.match(edge,/AbortSignal\.timeout\(15000\)/);
 assert.match(edge,/authorizeNotificationEmail\(/);
 assert.ok(edge.indexOf('admin.rpc("claim_notification_email_send_quota"')<edge.indexOf('fetch("https://api.resend.com/emails"'));
});

test("workflow callers pass their real persisted event or task IDs",()=>{
 const workflow=source("../lib/workflowNotifications.ts");
 assert.match(workflow,/event_key:eventKey/);
 assert.match(workflow,/input\.eventKey\|\|null/);
 const targets=[
  ["../app/dispatch/actions.ts",/event_key:`task:\$\{taskId\}:dispatch`/],
  ["../app/admin/tasks/actions.ts",/event_key:`task:\$\{taskId\}:advisor`/],
  ["../app/admin/tasks/operation-actions.ts",/event_key:`task:\$\{taskId\}:operation-plan`/],
  ["../app/admin/inspectionActions.ts",/`inspection:\$\{inspection\.id\}:farmer`/],
  ["../app/admin/actions.ts",/`report:\$\{reportId\}:reply`/],
 ];
 for(const [path,pattern] of targets)assert.match(source(path),pattern,path);
});
