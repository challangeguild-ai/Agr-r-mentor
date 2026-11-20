// Safe, read-only release artifact verification. It deliberately never invokes
// Supabase/Vercel CLIs, never reads .env secrets and never deploys anything.
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname,resolve} from "node:path";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
export const migrationFiles=[
 "20261119080000_general_task_attestation_review.sql",
 "20261119093000_authorized_advisor_notifications.sql",
 "20261119110000_verified_task_proof_rpc_guard.sql",
 "20261119123000_field_boundary_proposals.sql",
 "20261119211340_notification_email_send_quota.sql",
 "20261120110000_manual_hu_spraying_log_guard.sql",
];
export const edgeNames=["invite-farmer","invite-advisor","send-notification-email"];

export function checkReleaseContract(read=(path)=>readFileSync(resolve(root,path),"utf8")){
 const problems=[];
 const documents=[];
 const get=(path)=>{
  try{const contents=read(path);documents.push({path,sha256:createHash("sha256").update(contents).digest("hex")});return contents}
  catch{problems.push(`Hiányzik vagy nem olvasható: ${path}`);return ""}
 };
 let targets={};
 try{targets=JSON.parse(get("scripts/release-targets.json"))}
 catch{problems.push("Hibás release-targets.json")}
 for(const field of ["repository","draftBranch","vercelTeam","vercelProjectId","supabaseProjectId","productionHost","emailRelease"])
  if(typeof targets[field]!=="string"||!targets[field])problems.push(`Hiányzó kiadási célazonosító: ${field}`);

 const powershell=get("scripts/Test-AgrarMentor-Migrations.ps1");
 const backupScript=get("scripts/Backup-AgrarMentor-Predeploy.ps1");
 const runnerBackup=get(".github/workflows/agrarmentor-encrypted-backup.yml");
 const androidRelease=get(".github/workflows/agrarmentor-android-release.yml");
 const androidBuild=get("android/app/build.gradle.kts");
 const rehearsal=get("scripts/verify_staged_migrations.sql");
 if(!/^on:\s*\n\s+workflow_dispatch:\s*$/m.test(androidRelease)
   ||/^\s+(push|pull_request|schedule):/m.test(androidRelease)
   ||!androidRelease.includes("environment: agrarmentor-release")
   ||!androidRelease.includes("secrets.AGRAR_RELEASE_KEYSTORE_BASE64")
   ||!androidRelease.includes("vars.AGRAR_SUPABASE_PUBLISHABLE_KEY")
   ||!androidRelease.includes('apksigner" verify --verbose')
   ||!androidRelease.includes("assembleRelease")
   ||!androidRelease.includes("testDebugUnitTest")
   ||!androidRelease.includes("app/build/outputs/apk/release/app-release.apk")
   ||!androidBuild.includes('applicationId = "hu.agrarmentor.android"')
   ||!androidBuild.includes('signingConfigs.getByName("production")'))
  problems.push("A natív kiadás nem bizonyítottan kézi, aláírt és az egyetlen Agrár Mentor alkalmazásra céloz.");
 if(!backupScript.includes(`$projectRef = '${targets.supabaseProjectId}'`)
   ||!backupScript.includes('"--remote=$projectRef"')
   ||!backupScript.includes("'--data-only', '--use-copy'")
   ||!backupScript.includes('Létező mentési mappát nem írunk felül')
   ||/\bdb\s+push\b|\bfunctions\s+deploy\b/i.test(backupScript))
  problems.push("A friss backup nem bizonyítottan csak olvasó, projekthez kötött és felülírásmentes.");
 const dispatchOnly=/^on:\s*\n\s+workflow_dispatch:\s*$/m.test(runnerBackup)
   && !/^\s+(push|pull_request|schedule|workflow_run):/m.test(runnerBackup);
 const encryptedOnly=runnerBackup.includes("--symmetric --cipher-algo AES256")
   && runnerBackup.includes("--passphrase-fd 0")
   && runnerBackup.includes("actions/upload-artifact@")
   && /path:\s*\$\{\{ runner\.temp \}\}\/agrarmentor-db-\$\{\{ github\.run_id \}\}\.tar\.gz\.gpg/.test(runnerBackup)
   && !/path:\s*.*\.(?:sql|tar\.gz)\s*$/m.test(runnerBackup);
 const lockedProject=runnerBackup.match(/db dump --remote=([^\s]+)/g)??[];
 if(!dispatchOnly||!encryptedOnly||lockedProject.length!==3
   ||lockedProject.some(command=>command!==`db dump --remote=${targets.supabaseProjectId}`)
   ||!runnerBackup.includes("environment: agrarmentor-backup")
   ||!runnerBackup.includes("test \"${#BACKUP_PASSPHRASE}\" -ge 32" )
   ||!/retention-days:\s*7/.test(runnerBackup)
   ||/\b(?:db\s+push|db\s+reset|migration\s+up|functions\s+deploy)\b/.test(runnerBackup))
  problems.push("A GitHub runner mentése nem bizonyítottan kézi, célprojektre kötött és csak titkosítva feltölthető.");
 if(!powershell.includes("supabase_db_AgrarMentor-mentes-2026-11-19")||!powershell.includes("ON_ERROR_STOP=1"))
  problems.push("A teszt nem a védett, helyi Docker-konténerre korlátozódik.");
 if(!/^BEGIN;$/m.test(rehearsal)||!/^ROLLBACK;$/m.test(rehearsal)||/^COMMIT;$/m.test(rehearsal))
  problems.push("A migrációpróba nem bizonyítottan visszagörgetett tranzakció.");
 const referenced=[...rehearsal.matchAll(/^\\i\s+\S+\/([^/\s]+\.sql)\s*$/gm)].map(m=>m[1]);
 if(JSON.stringify(referenced)!==JSON.stringify(migrationFiles))
  problems.push("A SQL próba migrációs listája vagy sorrendje eltér a release-csomagtól.");
 for(const filename of migrationFiles){
  if(!powershell.includes(`'${filename}'`))problems.push(`A PowerShell-próbából hiányzik: ${filename}`);
  const sql=get(`supabase/migrations/${filename}`);
  if(/^\s*(BEGIN|COMMIT|ROLLBACK)\s*;/im.test(sql))problems.push(`Beágyazott tranzakció a migrációban: ${filename}`);
  if(filename.includes("manual_hu_spraying_log_guard")&&
    (!sql.includes("hu_manual_spraying_policy_version")||!sql.includes("verification_status','not_verified'")
      ||!sql.includes("permit_check_attested boolean not null default false")
      ||!sql.includes("not coalesce(new.permit_check_attested,false)")
      ||!sql.includes("plant_protection_use_id,crop,dose,dose_unit,dose_mode,permit_check_attested")
      ||!sql.includes("as $$ select 2 $$")
      ||sql.includes("new.product_id := p.id")))
   problems.push("A kézi HU növényvédelmi migráció hiányosan vagy veszélyesen jelöli a hivatalos termékazonosságot.");
 }
 const edgeSources={};
 for(const slug of edgeNames){
  const source=get(`supabase/functions/${slug}/index.ts`);
  edgeSources[slug]=source;
  if(!source.includes(`"X-AgrarMentor-Email-Release":"${targets.emailRelease}"`))
   problems.push(`Nincs egységes e-mail-verzióazonosító: ${slug}`);
  if(!source.includes('Deno.env.get("APP_PUBLIC_ORIGIN")'))
   problems.push(`Az HTTPS eredet ellenőrzése hiányzik: ${slug}`);
 }
 for(const filename of ["notificationAuthorization.ts","notificationIdempotency.ts"])
  get(`supabase/functions/_shared/${filename}`);
 for(const slug of ["invite-farmer","invite-advisor"]){
  const source=edgeSources[slug]??"";
  if(!source.includes('rpc("claim_invitation_email_send_quota"')||source.indexOf("claim_invitation_email_send_quota")>source.indexOf("inviteUserByEmail"))
   problems.push(`A meghívás korlátozása nincs a küldés előtt: ${slug}`);
 }
 const notification=edgeSources["send-notification-email"]??"";
 if(!notification.includes('rpc("claim_notification_email_send_quota"')
   ||notification.indexOf("claim_notification_email_send_quota")>notification.indexOf('fetch("https://api.resend.com/emails"'))
  problems.push("Az értesítő e-mail küldési korlátja hiányzik.");
 if(!notification.includes("authorizeNotificationEmail("))
  problems.push("A mentett üzleti esemény címzettjogosultságának ellenőrzése hiányzik.");
 if(!notification.includes('Deno.env.get("NOTIFICATION_EMAIL_FROM")?.trim()')
   ||!/if\(!from\)return json\(/.test(notification))
  problems.push("Az értesítési feladócím nincs kötelező konfigurációhoz kötve.");
 return{ok:problems.length===0,targets,documents,problems};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=checkReleaseContract();
 if(process.argv.includes("--json"))process.stdout.write(JSON.stringify(result,null,2)+"\n");
 else{
  process.stdout.write(`${result.ok?"KIADÁSI FORRÁSCSOMAG: RENDBEN":"KIADÁSI FORRÁSCSOMAG: HIBÁS"}\n`);
  process.stdout.write(`Projekt: ${result.targets.repository??"ismeretlen"} | Vercel: ${result.targets.vercelProjectId??"?"} | Supabase: ${result.targets.supabaseProjectId??"?"}\n`);
  process.stdout.write(`${migrationFiles.length} SQL-migráció, három Edge Function, két közös modul: ${result.documents.length} fájl ellenőrizve.\n`);
  for(const problem of result.problems)process.stderr.write(`HIBA: ${problem}\n`);
  process.stdout.write("Ez nem élesítési teszt: a távoli beállításokat és az SMTP-kézbesítést külön kell igazolni.\n");
 }
 if(!result.ok)process.exitCode=1;
}
