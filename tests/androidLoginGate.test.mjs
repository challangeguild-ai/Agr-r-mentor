import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");

test("Android always opens real sign-in without a demo or automatic session restoration",()=>{
 const activity=source("android/app/src/main/java/hu/agrarmentor/android/MainActivity.kt");
 const app=source("android/app/src/main/java/hu/agrarmentor/android/ui/AgrarMentorApp.kt");
 assert.match(activity,/AgrarMentorApp\(\)/);
 assert.match(app,/if\(session==null\)\{\s*SignInScreen\(/);
 assert.match(app,/key\(authenticated\.userId,authenticated\.role\)/);
 assert.match(app,/PortalShell\(authenticated\.role,authenticated,/);
 assert.match(app,/SecureSessionStore\(context\)\.clear\(\)/);
 assert.doesNotMatch(activity+app,/demoMode|previewOnly|showDemoSwitch|onRolePreview|loadRefreshToken|saveRefreshToken|\/fields\/demo-|DEMÓ/);
});

test("Android build never uploads a demo APK when public Supabase configuration is missing",()=>{
 const workflow=source(".github/workflows/agrarmentor-android.yml");
 assert.match(workflow,/node \.\.\/scripts\/android-release-guards\.mjs test-config/);
 assert.match(workflow,/AgrarMentor-ANDROID-TESZT-KAPCSOLT-/);
 assert.doesNotMatch(workflow,/mode=DEMO|GITHUB_OUTPUT|mintaadat|steps\.test-config/);
 const main=source("android/app/src/main/java/hu/agrarmentor/android/ui/SignInScreen.kt");
 assert.match(main,/enabled=!waiting&&gateway\.isConfigured/);
});
