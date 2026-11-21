/**
 * Read-only comparison of the six Android release migrations with production's
 * migration-history hashes. Never connects to a database or applies SQL.
 * Input comes from scripts/read-android-migration-history.sql.
 * A known historic checksum mismatch must be reconciled with a NEW forward
 * migration, not by rewriting history or replaying all previous migrations.
 */
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {migrationFiles} from "./release-contract.mjs";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const oldProofSourceMd5="da4aebf859b3e1c16a963d656d5cfbe2";
const proofFile="20261119110000_verified_task_proof_rpc_guard.sql";

export function auditAndroidMigrationHistory(observed,readFile=filename=>readFileSync(resolve(root,"supabase/migrations",filename),"utf8")){
 if(!Array.isArray(observed))throw Error("A migrációs napló JSON-tömböt vár.");
 const result=migrationFiles.map(filename=>{
  const name=filename.replace(/\.sql$/,""),hash=createHash("md5").update(readFile(filename)).digest("hex");
  const rows=observed.filter(row=>row?.name===name);
  const stored=rows[0]?.stored_md5;
  const status=rows.length===0?"missing"
   :rows.length!==1?"duplicate"
   :!(/^[a-f0-9]{32}$/.test(stored??""))?"invalid_checksum"
   :stored===hash?"identical"
   :filename===proofFile&&stored===oldProofSourceMd5?"known_older_proof_without_marker"
   :"unexpected_drift";
  return {name,status,expected_md5:hash,stored_md5:stored??null};
 });
 return {ready:result.every(entry=>entry.status==="identical"),migrations:result};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.length!==3)throw Error("Használat: node scripts/audit-android-migration-history.mjs <history.json>");
  const rows=JSON.parse(readFileSync(process.argv[2],"utf8"));
  const result=auditAndroidMigrationHistory(rows);
  for(const migration of result.migrations)process.stdout.write(`${migration.status.padEnd(32)} ${migration.name}\n`);
  process.stdout.write(result.ready?"Mind a hat migráció egyezik.\n":"Eltérés vagy hiány van: automatikus élesítés TILOS.\n");
  if(!result.ready)process.exitCode=1;
 }catch(error){process.stderr.write(`Migrációellenőrzés sikertelen: ${error.message}\n`);process.exitCode=1}
}
