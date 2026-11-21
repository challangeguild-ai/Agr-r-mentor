import test from "node:test";
import assert from "node:assert/strict";
import {checkSignedApkCertificate,normalizeSigningFingerprint,validateAndroidReleaseConfig} from "../scripts/android-release-guards.mjs";

const digest="ab".repeat(32);
const valid={
 VERSION_NAME:"1.0.0",VERSION_CODE:"12",
 AGRAR_SUPABASE_URL:"https://qkezhvtwirdsvhzjyvfi.supabase.co",
 AGRAR_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_AAAAAAAAAAAAAAAAAAA",
 AGRAR_WEB_ORIGIN:"https://agr-r-mentor.vercel.app",
 AGRAR_RELEASE_SIGNING_CERT_SHA256:digest,
};

test("release configuration accepts only the existing production project and web origin",()=>{
 assert.deepEqual(validateAndroidReleaseConfig(valid),[]);
 assert.deepEqual(validateAndroidReleaseConfig({...valid,VERSION_NAME:"0.1.0-dev"}).length,1);
 assert.deepEqual(validateAndroidReleaseConfig({...valid,VERSION_CODE:"00"}).length,1);
 assert.deepEqual(validateAndroidReleaseConfig({...valid,AGRAR_SUPABASE_URL:"https://other.supabase.co"}).length,1);
 assert.deepEqual(validateAndroidReleaseConfig({...valid,AGRAR_WEB_ORIGIN:"https://fake.example"}).length,1);
 assert.deepEqual(validateAndroidReleaseConfig({...valid,AGRAR_WEB_ORIGIN:"https://agr-r-mentor.vercel.app@evil.example"}).length,1);
 assert.deepEqual(validateAndroidReleaseConfig({...valid,AGRAR_SUPABASE_URL:"https://qkezhvtwirdsvhzjyvfi.supabase.co/token"}).length,1);
 assert.deepEqual(validateAndroidReleaseConfig({...valid,AGRAR_WEB_ORIGIN:"http://agr-r-mentor.vercel.app"}).length,1);
});

test("an APK may contain a public key but never a service-role or secret key",()=>{
 const anon=Buffer.from(JSON.stringify({role:"anon",iss:"supabase"})).toString("base64url");
 const service=Buffer.from(JSON.stringify({role:"service_role",iss:"supabase"})).toString("base64url");
 assert.deepEqual(validateAndroidReleaseConfig({...valid,AGRAR_SUPABASE_PUBLISHABLE_KEY:`abc.${anon}.signature`}),[]);
 assert.equal(validateAndroidReleaseConfig({...valid,AGRAR_SUPABASE_PUBLISHABLE_KEY:`abc.${service}.signature`}).length,1);
 assert.equal(validateAndroidReleaseConfig({...valid,AGRAR_SUPABASE_PUBLISHABLE_KEY:"sb_secret_REDACTEDREDACTED"}).length,1);
 assert.equal(validateAndroidReleaseConfig({...valid,AGRAR_SUPABASE_PUBLISHABLE_KEY:""}).length,1);
});

test("only the pinned single-signing-certificate fingerprint is accepted",()=>{
 assert.equal(normalizeSigningFingerprint(digest.toUpperCase()),digest);
 assert.equal(normalizeSigningFingerprint("AB:".repeat(31)+"AB"),digest);
 assert.equal(normalizeSigningFingerprint("not-a-digest"),null);
 const output=`Verifies\nVerified using v2 scheme (APK Signature Scheme v2): true\nSigner #1 certificate SHA-256 digest: ${digest}\n`;
 assert.deepEqual(checkSignedApkCertificate(output,digest),{ok:true});
 assert.equal(checkSignedApkCertificate(output,"cd".repeat(32)).ok,false);
 assert.equal(checkSignedApkCertificate(output.replace("Signer #1","Signer #2"),digest).ok,false);
 assert.equal(checkSignedApkCertificate(output+`Signer #2 certificate SHA-256 digest: ${digest}\n`,digest).ok,false);
 assert.equal(checkSignedApkCertificate("no certificate output",digest).ok,false);
 assert.equal(checkSignedApkCertificate(output," ").ok,false);
});
