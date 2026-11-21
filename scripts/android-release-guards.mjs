/**
 * Fail-closed, dependency-free Android release checks.
 * Only public configuration and the APK certificate digest are inspected.
 * Private keystore passwords and backend tokens are never printed.
 */
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const targets=JSON.parse(readFileSync(resolve(root,"scripts/release-targets.json"),"utf8"));

export function normalizeSigningFingerprint(value){
 if(typeof value!=="string"||!/^(?:[0-9a-fA-F]{2}:){31}[0-9a-fA-F]{2}$|^[0-9a-fA-F]{64}$/.test(value.trim()))return null;
 return value.trim().replaceAll(":","").toLowerCase();
}

function exactHttpsOrigin(value,expectedHost){
 try{
  const url=new URL(value);
  return url.protocol==="https:"&&url.hostname===expectedHost&&url.port===""&&url.username===""&&url.password===""&&
   (url.pathname==="/"||url.pathname==="")&&url.search===""&&url.hash==="";
 }catch{return false}
}

export function isPublicSupabaseKey(value){
 if(typeof value!=="string")return false;
 if(/^sb_publishable_[a-zA-Z0-9_-]{10,}$/.test(value))return true;
 const parts=value.split(".");
 if(parts.length!==3||parts.some(part=>!part))return false;
 try{
  const claims=JSON.parse(Buffer.from(parts[1],"base64url").toString("utf8"));
  return claims.role==="anon"&&typeof claims.iss==="string";
 }catch{return false}
}

/** Debug test APKs may omit configuration only when clearly labelled as demo. */
export function validateAndroidTestConfig(env,expected=targets){
 const errors=[];
 if(!exactHttpsOrigin(env.AGRAR_SUPABASE_URL,`${expected.supabaseProjectId}.supabase.co`))
  errors.push("A teszt-APK Supabase URL-je nem a jóváhagyott Agrár Mentor projekt.");
 if(!isPublicSupabaseKey(env.AGRAR_SUPABASE_PUBLISHABLE_KEY))
  errors.push("A teszt-APK kizárólag publishable/anon kulccsal kapcsolódhat.");
 if(!exactHttpsOrigin(env.AGRAR_WEB_ORIGIN,expected.productionHost))
  errors.push("A teszt-APK webes eredetcíme nem megfelelő.");
 return errors;
}

export function validateAndroidReleaseConfig(env,expected=targets){
 const errors=[];
 if(!/^\d+\.\d+\.\d+$/.test(env.VERSION_NAME??""))errors.push("A végleges verziónév három számból álljon.");
 if(!/^[1-9][0-9]{0,8}$/.test(env.VERSION_CODE??""))errors.push("A verziókód 1–9 számjegyű pozitív egész legyen.");
 if(!exactHttpsOrigin(env.AGRAR_SUPABASE_URL,`${expected.supabaseProjectId}.supabase.co`))
  errors.push("A Supabase URL nem a jóváhagyott éles Agrár Mentor projektre mutat.");
 if(!isPublicSupabaseKey(env.AGRAR_SUPABASE_PUBLISHABLE_KEY))
  errors.push("Csak valódi publishable vagy legacy anon Supabase-kulcs engedhető az APK-ba.");
 if(!exactHttpsOrigin(env.AGRAR_WEB_ORIGIN,expected.productionHost))
  errors.push("A webes cím nem a jóváhagyott HTTPS éles oldal.");
 if(!normalizeSigningFingerprint(env.AGRAR_RELEASE_SIGNING_CERT_SHA256))
  errors.push("Hiányzik a tartós Android-aláíró tanúsítvány SHA-256 ujjlenyomata.");
 return errors;
}

/** Check the actual protected GitHub environment, not just the presence of any reviewer rule. */
export function validateReleaseEnvironment(environment,branches){
 const errors=[];
 const reviewRules=environment?.protection_rules?.filter(rule=>rule?.type==="required_reviewers");
 if(environment?.name!=="agrarmentor-release"||environment?.can_admins_bypass!==false)
  errors.push("A kiadási környezet hiányzik, vagy az adminisztrátori megkerülés engedélyezett.");
 if(!Array.isArray(reviewRules)||reviewRules.length!==1||reviewRules[0].prevent_self_review!==true||
  reviewRules[0].reviewers?.length!==1||reviewRules[0].reviewers[0]?.type!=="User"||
  reviewRules[0].reviewers[0]?.reviewer?.login!=="gpshuntruck-blip")
  errors.push("A kötelező, önjóváhagyást tiltó kiadási ellenőr nincs megfelelően beállítva.");
 if(environment?.deployment_branch_policy?.custom_branch_policies!==true||
  environment?.deployment_branch_policy?.protected_branches!==false||
  !environment?.protection_rules?.some(rule=>rule?.type==="branch_policy")||
  branches?.total_count!==1||branches?.branch_policies?.length!==1||
  branches.branch_policies[0]?.name!=="main"||branches.branch_policies[0]?.type!=="branch")
  errors.push("A kiadási környezet nem kizárólag a main ágról enged telepítést.");
 return errors;
}

/** apksigner's output is inspected after a successful `verify --verbose --print-certs`. */
export function checkSignedApkCertificate(apksignerOutput,expected){
 const pinned=normalizeSigningFingerprint(expected);
 if(!pinned)return {ok:false,reason:"A jóváhagyott aláíró tanúsítvány lenyomata nincs beállítva."};
 const lines=String(apksignerOutput).split(/\r?\n/);
 const digests=lines.flatMap(line=>{
  const match=line.match(/^Signer #(\d+) certificate SHA-256 digest:\s*([0-9a-fA-F:]+)\s*$/);
  return match?[{index:Number(match[1]),value:normalizeSigningFingerprint(match[2])}]:[];
 });
 if(digests.length!==1||digests[0].index!==1||digests[0].value===null)
  return {ok:false,reason:"A kimenetben nem pontosan egy ellenőrizhető aláíró tanúsítvány van."};
 if(digests[0].value!==pinned)
  return {ok:false,reason:"Az APK aláíró tanúsítványa eltér a jóváhagyott tartós kulcstól."};
 return {ok:true};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const mode=process.argv[2];
 let problems;
 if(mode==="config")problems=validateAndroidReleaseConfig(process.env);
 else if(mode==="test-config")problems=validateAndroidTestConfig(process.env);
 else if(mode==="environment"&&process.argv.length===5){
  try{problems=validateReleaseEnvironment(
   JSON.parse(readFileSync(process.argv[3],"utf8")),
   JSON.parse(readFileSync(process.argv[4],"utf8"))
  )}catch{problems=["A GitHub kiadási környezetének ellenőrzése nem sikerült."]}
 }
 else if(mode==="cert"&&process.argv.length===4){
  const result=checkSignedApkCertificate(readFileSync(process.argv[3],"utf8"),process.env.AGRAR_RELEASE_SIGNING_CERT_SHA256);
  problems=result.ok?[]:[result.reason];
 }else problems=["Használat: node scripts/android-release-guards.mjs config | test-config | environment <env-json> <branch-json> | cert <apksigner-kimenet>" ];
 if(problems.length){for(const problem of problems)process.stderr.write(`KIADÁSI ZÁR: ${problem}\n`);process.exitCode=1}
 else process.stdout.write("Android kiadási ellenőrzés: rendben.\n");
}
