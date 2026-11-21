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

function isPublicSupabaseKey(value){
 if(typeof value!=="string")return false;
 if(/^sb_publishable_[a-zA-Z0-9_-]{10,}$/.test(value))return true;
 const parts=value.split(".");
 if(parts.length!==3||parts.some(part=>!part))return false;
 try{
  const claims=JSON.parse(Buffer.from(parts[1],"base64url").toString("utf8"));
  return claims.role==="anon"&&typeof claims.iss==="string";
 }catch{return false}
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
 else if(mode==="cert"&&process.argv.length===4){
  const result=checkSignedApkCertificate(readFileSync(process.argv[3],"utf8"),process.env.AGRAR_RELEASE_SIGNING_CERT_SHA256);
  problems=result.ok?[]:[result.reason];
 }else problems=["Használat: node scripts/android-release-guards.mjs config | cert <apksigner-kimenet>" ];
 if(problems.length){for(const problem of problems)process.stderr.write(`KIADÁSI ZÁR: ${problem}\n`);process.exitCode=1}
 else process.stdout.write("Android kiadási ellenőrzés: rendben.\n");
}
