import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const native=readFileSync(new URL("../android/app/src/main/java/hu/agrarmentor/android/data/CommunicationRepository.kt",import.meta.url),"utf8");
const server=readFileSync(new URL("../supabase/functions/_shared/notificationAuthorization.ts",import.meta.url),"utf8");
const decide=native.slice(native.indexOf("suspend fun decideReport("),native.indexOf("suspend fun documents("));

test("native advisor email is only attempted after confirmed report and notification persistence",()=>{
 const saved=decide.indexOf("if(JSONArray(response).length()!=1)");
 const notice=decide.indexOf('request("POST","rest/v1/notifications"');
 const confirmation=decide.indexOf("}.onFailure{warnings.add(\"A gazdálkodói értesítés nem igazolható.\")}.isSuccess");
 const email=decide.indexOf('request("POST","functions/v1/send-notification-email"');
 assert.ok(saved>=0&&notice>saved&&confirmation>notice&&email>confirmation);
 assert.match(decide,/if\(noticeConfirmed\)/);
 assert.match(decide,/if\(close\)"closed"else"reply"/);
 assert.match(decide,/"target_user_id",report\.farmerId/);
 assert.match(server,/const reportActions=new Set\(\["created","reply","closed"\]\)/);
});

test("email failure cannot turn a saved report into a retryable change",()=>{
 assert.match(decide,/runCatching\{[\s\S]*"functions\/v1\/send-notification-email"[\s\S]*\}\.onFailure\{warnings\.add\("A gazdálkodónak küldött e-mail nem igazolható\."\)\}/);
 assert.match(decide,/ReportDecisionResult\(false,warnings,taskId\)/);
});
