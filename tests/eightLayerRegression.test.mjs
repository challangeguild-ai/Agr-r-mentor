import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {countDueFieldChecks} from "../lib/clientOverview.ts";
import {parseMachineMeasurements} from "../lib/machinery.ts";

test("client overview counts a field once using only its latest inspection",()=>{
 const latest=new Map([
  ["a",{issue_status:"resolved",next_check_at:"2026-11-01"}],
  ["b",{issue_status:"open",next_check_at:"2026-11-19"}],
  ["c",{issue_status:"open",next_check_at:"2026-12-01"}],
 ]);
 assert.equal(countDueFieldChecks(["a","b","c"],latest,"2026-11-19"),1);
 assert.equal(countDueFieldChecks(["b","b"],latest,"2026-11-19"),1);
});

test("machine measurements reject malformed and negative input instead of storing null",()=>{
 const input=new FormData();input.set("current_hours","12,5");input.set("current_hectares","0,25");
 assert.deepEqual(parseMachineMeasurements(input),{currentHours:12.5,currentHectares:0.25,serviceIntervalHours:null,nextServiceHours:null});
 for(const bad of ["NaN","1e4","1,2,3","-1","1.235"]){
  input.set("current_hours",bad);
  assert.throws(()=>parseMachineMeasurements(input),/üzemóra/i,bad);
 }
 input.set("current_hours","");input.set("service_interval_hours","-20");
 assert.throws(()=>parseMachineMeasurements(input),/szervizciklus/i);
});

test("visit partial notification failure is surfaced without retrying a saved visit",()=>{
 const actions=readFileSync(new URL("../app/admin/visits/actions.ts",import.meta.url),"utf8");
 const page=readFileSync(new URL("../app/admin/visits/page.tsx",import.meta.url),"utf8");
 assert.match(actions,/notificationError/);
 assert.match(actions,/redirect\("\/admin\/visits\?notice=notification_failed"\)/);
 assert.match(page,/sp\.notice==="notification_failed"/);
});

test("notification bell reloads authoritative count on realtime events and successful mutations",()=>{
 const src=readFileSync(new URL("../components/NotificationBell.tsx",import.meta.url),"utf8");
 assert.match(src,/refreshUnreadCount/);
 assert.match(src,/postgres_changes[\s\S]*?refreshUnreadCount\(\)/);
 assert.doesNotMatch(src,/setUnread\(v=>v[+-]1\)/);
});

test("an uncertain document metadata response never deletes a previously uploaded invoice file",()=>{
 const src=readFileSync(new URL("../components/DocumentUploadForm.tsx",import.meta.url),"utf8");
 assert.doesNotMatch(src,/storage\.from\("documents"\)\.remove\(\[path\]\)/);
 assert.match(src,/a fájlt biztonságból megőriztük/i);
});

test("step-up challenges are limited to verified system admins before checking TOTP",()=>{
 const src=readFileSync(new URL("../app/api/security/step-up/route.ts",import.meta.url),"utf8");
 assert.ok(src.indexOf('profile.system_role!=="admin"')<src.indexOf("mfa.challengeAndVerify"));
});

test("notification email links use configured origin and escape untrusted href attributes",()=>{
 const src=readFileSync(new URL("../supabase/functions/send-notification-email/index.ts",import.meta.url),"utf8");
 assert.match(src,/Deno\.env\.get\("APP_PUBLIC_ORIGIN"\)/);
 assert.match(src,/if\(!configuredOrigin\)return json\(\{error:.*APP_PUBLIC_ORIGIN.*\},503\)/);
 assert.doesNotMatch(src,/agr-r-mentor\.vercel\.app/);
 assert.match(src,/const destination=new URL\(href\|\|"\/",appUrl\)/);
 assert.match(src,/destination\.origin!==appUrl/);
 assert.match(src,/href="\$\{esc\(link\)\}"/);
});

test("advisor invitations use the same strictly checked current app origin as farmer invitations",()=>{
 const src=readFileSync(new URL("../supabase/functions/invite-advisor/index.ts",import.meta.url),"utf8");
 assert.match(src,/Deno\.env\.get\("APP_PUBLIC_ORIGIN"\)/);
 assert.match(src,/destination\.origin!==configured\.origin/);
 assert.match(src,/destination\.pathname!=="\/invite"/);
 assert.match(src,/redirectTo:destination\.toString\(\)/);
});
