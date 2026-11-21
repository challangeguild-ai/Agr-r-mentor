import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {checkReleaseContract,migrationFiles,edgeNames} from "../scripts/release-contract.mjs";

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");

test("the release contract binds the right GitHub, Vercel and Supabase projects",()=>{
 const result=checkReleaseContract(read);
 assert.deepEqual(result.problems,[]);
 assert.equal(result.ok,true);
 assert.equal(result.targets.repository,"challangeguild-ai/Agr-r-mentor");
 assert.equal(result.targets.vercelProjectId,"prj_DMNfMt71StWzgb7rO839NUnrYEjS");
 assert.equal(result.targets.supabaseProjectId,"qkezhvtwirdsvhzjyvfi");
 assert.equal(result.targets.emailRelease,"2026-11-20-email-v1");
 assert.equal(result.documents.length,20);
 for(const item of result.documents)assert.match(item.sha256,/^[a-f0-9]{64}$/);
 assert.equal(migrationFiles.length,6);
 assert.deepEqual(edgeNames,["invite-farmer","invite-advisor","send-notification-email"]);
});

test("a stale SQL trial or a missing migration cannot pass the release gate",()=>{
 const result=checkReleaseContract(path=>{
  if(path==="scripts/verify_staged_migrations.sql")return read(path).replace("20261119093000_authorized_advisor_notifications.sql","other_old_migration.sql");
  return read(path);
 });
 assert.equal(result.ok,false);
 assert.ok(result.problems.some(p=>p.includes("sorrendje")));
});

test("mismatched Edge releases and missing invitation quotas block the package",()=>{
 const result=checkReleaseContract(path=>{
  if(path==="supabase/functions/invite-advisor/index.ts")
   return read(path).replace('"X-AgrarMentor-Email-Release":"2026-11-20-email-v1"','"X-AgrarMentor-Email-Release":"old-build"')
    .replace('rpc("claim_invitation_email_send_quota"','rpc("missing_quota"');
  return read(path);
 });
 assert.equal(result.ok,false);
 assert.ok(result.problems.some(p=>p.includes("verzióazonosító")));
 assert.ok(result.problems.some(p=>p.includes("meghívás korlátozása")));
});

test("notification emails require an explicitly configured sender address",()=>{
 const result=checkReleaseContract(path=>{
  if(path==="supabase/functions/send-notification-email/index.ts")
   return read(path).replace('Deno.env.get("NOTIFICATION_EMAIL_FROM")?.trim()',
    'Deno.env.get("NOTIFICATION_EMAIL_FROM")||"Agrár Mentor <noreply@old.invalid>"');
  return read(path);
 });
 assert.equal(result.ok,false);
 assert.ok(result.problems.some(p=>p.includes("feladócím")));
});

test("fresh backup must target the exact AgrarMentor project without overwriting older dumps",()=>{
 const result=checkReleaseContract(path=>{
  if(path==="scripts/Backup-AgrarMentor-Predeploy.ps1")
   return read(path).replace("$projectRef = 'qkezhvtwirdsvhzjyvfi'","$projectRef = 'wrong-project'");
  return read(path);
 });
 assert.equal(result.ok,false);
 assert.ok(result.problems.some(p=>p.includes("friss backup")));
});

test("a public-repository backup cannot upload database dumps unencrypted",()=>{
 const workflow=read(".github/workflows/agrarmentor-encrypted-backup.yml");
 assert.match(workflow,/^on:\s*\n\s+workflow_dispatch:\s*$/m);
 assert.doesNotMatch(workflow,/^\s+(push|pull_request|schedule):/m);
 assert.match(workflow,/permissions:\s*\n\s+contents: read/);
 assert.match(workflow,/environment: agrarmentor-backup/);
 assert.equal((workflow.match(/db dump --remote=qkezhvtwirdsvhzjyvfi/g)||[]).length,3);
 assert.match(workflow,/--symmetric --cipher-algo AES256/);
 assert.match(workflow,/--passphrase-fd 0/);
 assert.match(workflow,/path: \$\{\{ runner\.temp \}\}\/agrarmentor-db-\$\{\{ github\.run_id \}\}\.tar\.gz\.gpg/);
 assert.doesNotMatch(workflow,/path:.*\.(?:sql|tar\.gz)\s*$/m);
 assert.match(workflow,/retention-days: 7/);
 assert.doesNotMatch(workflow,/db push|db reset|functions deploy|migration up/);
 const compromised=checkReleaseContract(path=>{
  if(path===".github/workflows/agrarmentor-encrypted-backup.yml")
   return workflow.replace("--remote=qkezhvtwirdsvhzjyvfi", "--remote=another-project");
  return read(path);
 });
 assert.equal(compromised.ok,false);
 assert.ok(compromised.problems.some(p=>p.includes("GitHub runner")));
});

test("the release verifier is read-only and CI runs a compatible Node version",()=>{
 const source=read("scripts/release-contract.mjs");
 assert.doesNotMatch(source,/execSync|spawnSync|child_process|\bawait\s+fetch\(|db push|supabase functions deploy/);
 const ci=read(".github/workflows/ci-build.yml");
 assert.match(ci,/node-version: '22'/);
 assert.match(ci,/npm ci/);
 assert.match(ci,/npm run build/);
 const pkg=JSON.parse(read("package.json"));
 assert.match(pkg.scripts.build,/release:check/);
});

test("the Android release cannot become automatic or unsigned",()=>{
 const safe=read(".github/workflows/agrarmentor-android-release.yml");
 assert.match(safe,/^on:\s*\n\s+workflow_dispatch:\s*$/m);
 assert.match(safe,/environment: agrarmentor-release/);
 assert.match(safe,/apksigner" verify --verbose/);
 assert.match(safe,/--print-certs/);
 assert.match(safe,/AGRAR_RELEASE_SIGNING_CERT_SHA256/);
 assert.match(safe,/android-release-guards\.mjs cert/);
 assert.doesNotMatch(safe,/^\s+(push|pull_request|schedule):/m);
 const bad=checkReleaseContract(path=>path===".github/workflows/agrarmentor-android-release.yml"
  ?safe.replace('apksigner" verify --verbose','apksigner" version')
  :read(path));
 assert.equal(bad.ok,false);
 assert.ok(bad.problems.some(p=>p.includes("natív kiadás")));
});

test("Android release cannot bypass the pinned certificate or production database gate",()=>{
 const safe=read(".github/workflows/agrarmentor-android-release.yml");
 const compromised=checkReleaseContract(path=>path===".github/workflows/agrarmentor-android-release.yml"
  ?safe.replace('node ../scripts/android-release-guards.mjs cert', 'echo unverified-certificate')
  :read(path));
 assert.equal(compromised.ok,false);
 assert.ok(compromised.problems.some(p=>p.includes("natív kiadás")));
 const sql=read("scripts/check-android-production-gates.sql");
 assert.match(sql,/^BEGIN READ ONLY;$/m);
 assert.match(sql,/^ROLLBACK;$/m);
 assert.doesNotMatch(sql,/\b(update|insert|delete|create|alter|drop)\s+(table|function|trigger|into)\b/i);
 const broken=checkReleaseContract(path=>path==="scripts/check-android-production-gates.sql"
  ?sql.replace("hu_manual_spraying_policy_version()", "no_hu_policy_gate()")
  :read(path));
 assert.equal(broken.ok,false);
});
