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
 const rehearsal=get("scripts/verify_staged_migrations.sql");
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
 return{ok:problems.length===0,targets,documents,problems};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=checkReleaseContract();
 if(process.argv.includes("--json"))process.stdout.write(JSON.stringify(result,null,2)+"\n");
 else{
  process.stdout.write(`${result.ok?"KIADÁSI FORRÁSCSOMAG: RENDBEN":"KIADÁSI FORRÁSCSOMAG: HIBÁS"}\n`);
  process.stdout.write(`Projekt: ${result.targets.repository??"ismeretlen"} | Vercel: ${result.targets.vercelProjectId??"?"} | Supabase: ${result.targets.supabaseProjectId??"?"}\n`);
  process.stdout.write(`Öt SQL-migráció, három Edge Function, két közös modul: ${result.documents.length} fájl ellenőrizve.\n`);
  for(const problem of result.problems)process.stderr.write(`HIBA: ${problem}\n`);
  process.stdout.write("Ez nem élesítési teszt: a távoli beállításokat és az SMTP-kézbesítést külön kell igazolni.\n");
 }
 if(!result.ok)process.exitCode=1;
}
