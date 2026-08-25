"use client";

import {useState} from "react";
import {importPlantProtectionCsv,syncUksupOfficialCatalog} from "./actions";

export function ImportForm(){
 const[busy,setBusy]=useState(false),[syncBusy,setSyncBusy]=useState(false),[error,setError]=useState(""),[result,setResult]=useState<any>(null),[fileText,setFileText]=useState("");
 async function run(formData:FormData){setBusy(true);setError("");setResult(null);try{const r=await importPlantProtectionCsv(formData);setResult(r)}catch(e){setError(e instanceof Error?e.message:"Az import sikertelen.")}finally{setBusy(false)}}
 async function runSk(){setSyncBusy(true);setError("");setResult(null);try{const r=await syncUksupOfficialCatalog();setResult(r)}catch(e){setError(e instanceof Error?e.message:"Az ÚKSÚP szinkron sikertelen.")}finally{setSyncBusy(false)}}
 async function readFile(file:File|null){setError("");setFileText("");if(!file)return;try{const lower=file.name.toLowerCase();if(lower.endsWith(".csv")||lower.endsWith(".txt")){setFileText(await file.text());return}if(lower.endsWith(".xls")||lower.endsWith(".xlsx")){const XLSX=await import("xlsx");const wb=XLSX.read(await file.arrayBuffer(),{type:"array"});const parts=wb.SheetNames.map(name=>XLSX.utils.sheet_to_csv(wb.Sheets[name],{FS:";"})).filter(Boolean);setFileText(parts.join("\n"));return}throw new Error("Csak CSV, TXT, XLS vagy XLSX fájl támogatott.")}catch(e){setError(e instanceof Error?e.message:"A fájl beolvasása sikertelen.")}}
 const resultBox=result&&<div className="operation-wide" style={{padding:14,border:"1px solid #b7d7bd",borderRadius:12,background:"#f3fbf4"}}>Import eredmény: <b>{result.rows}</b> sor feldolgozva, <b>{result.inserted_products}</b> új készítmény, <b>{result.inserted_uses}</b> új felhasználás, <b>{result.inserted_ingredients}</b> új hatóanyag.</div>;
 return <div style={{display:"grid",gap:18}}>
  <section style={{padding:16,border:"1px solid #dce5dc",borderRadius:14,background:"#fff"}}><h3 style={{marginTop:0}}>Szlovák hivatalos katalógus – automatikus szinkron</h3><p>Az ÚKSÚP nyilvános <b>Prípravky na ochranu rastlín.csv</b> datasetjét tölti le és importálja.</p><button className="btn btn-primary" type="button" onClick={runSk} disabled={syncBusy||busy}>{syncBusy?"ÚKSÚP szinkron folyamatban…":"ÚKSÚP hivatalos katalógus szinkronizálása"}</button></section>
  <form action={run} className="admin-form" style={{gridTemplateColumns:"1fr 1fr",padding:16,border:"1px solid #dce5dc",borderRadius:14,background:"#fff"}}>
   <div className="operation-wide"><h3 style={{margin:"0 0 6px"}}>Hivatalos exportfájl feltöltése</h3><p style={{margin:0}}>CSV/TXT/XLS/XLSX. A fájl a böngészőben kerül beolvasásra, majd a szerver ugyanazzal a validált importfolyamattal dolgozza fel.</p></div>
   <label>Ország<select name="country_code" defaultValue="HU"><option value="HU">Magyarország / Nébih</option><option value="SK">Szlovákia / ÚKSÚP ISPOR</option></select></label>
   <label>Forrás neve<input name="source_name" placeholder="Nébih növényvédő szerek adatbázisa"/></label>
   <label className="operation-wide">Forrás URL<input name="source_url" placeholder="https://novenyvedoszer.nebih.gov.hu/Engedelykereso/Kereso"/></label>
   <label className="operation-wide">Fájl<input type="file" accept=".csv,.txt,.xls,.xlsx" onChange={e=>readFile(e.target.files?.[0]||null)} required/></label>
   <input type="hidden" name="csv" value={fileText}/>
   <label className="operation-wide">Megjegyzés<input name="notes" placeholder="Export dátuma, szűrés, ellenőrzési megjegyzés"/></label>
   <button className="btn btn-primary" type="submit" disabled={busy||syncBusy||!fileText}>{busy?"Import folyamatban…":"Hivatalos fájl importálása"}</button>
  </form>
  <details style={{padding:16,border:"1px solid #dce5dc",borderRadius:14,background:"#fff"}}><summary style={{fontWeight:800,cursor:"pointer"}}>Haladó: táblázat beillesztése</summary><form action={run} className="admin-form" style={{gridTemplateColumns:"1fr 1fr",marginTop:14}}>
   <label>Ország<select name="country_code" defaultValue="HU"><option value="HU">Magyarország / Nébih</option><option value="SK">Szlovákia / ÚKSÚP ISPOR</option></select></label>
   <label>Forrás neve<input name="source_name" placeholder="Nébih növényvédő szer adatbázis"/></label>
   <label className="operation-wide">Forrás URL<input name="source_url" placeholder="https://novenyvedoszer.nebih.gov.hu/Engedelykereso/Kereso"/></label>
   <label className="operation-wide">Megjegyzés<input name="notes"/></label>
   <label className="operation-wide">CSV / Excelből kimásolt táblázat<textarea name="csv" rows={12} required placeholder={'name;authorization_number;regulatory_category;function_type;crop;target;dose_min;dose_max;dose_unit;application_method;phi_days;ingredient\nMinta;ABC-123;II;gyomirtó;kukorica;gyomok;0,8;1,2;l/ha;permetezés;56;hatóanyag'}></textarea></label>
   <button className="btn btn-primary" type="submit" disabled={busy||syncBusy}>{busy?"Import folyamatban…":"Táblázat importálása"}</button>
  </form></details>
  {error&&<div className="error-box">{error}</div>}{resultBox}
 </div>
}
