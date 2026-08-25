"use client";

import {useState} from "react";
import {importPlantProtectionCsv,syncUksupOfficialCatalog} from "./actions";

export function ImportForm(){
 const[busy,setBusy]=useState(false),[syncBusy,setSyncBusy]=useState(false),[error,setError]=useState(""),[result,setResult]=useState<any>(null);
 async function run(formData:FormData){setBusy(true);setError("");setResult(null);try{const r=await importPlantProtectionCsv(formData);setResult(r)}catch(e){setError(e instanceof Error?e.message:"Az import sikertelen.")}finally{setBusy(false)}}
 async function runSk(){setSyncBusy(true);setError("");setResult(null);try{const r=await syncUksupOfficialCatalog();if(!r.ok){setError(r.error||"Az ÚKSÚP szinkron sikertelen.");return}setResult(r)}catch{setError("Az ÚKSÚP szinkron nem fejeződött be. Próbáld újra később; a rendszer nem módosította a meglévő katalógust.")}finally{setSyncBusy(false)}}
 return <div style={{display:"grid",gap:18}}>
  <section style={{padding:16,border:"1px solid #dce5dc",borderRadius:14,background:"#fff"}}><h3 style={{marginTop:0}}>Szlovák hivatalos katalógus – automatikus szinkron</h3><p>Az ÚKSÚP nyilvános <b>Prípravky na ochranu rastlín.csv</b> datasetjét tölti le és importálja közvetlenül a hivatalos forrásból. A rendszer elsődleges és tartalék ÚKSÚP végponttal, időkorláttal és újrapróbálással dolgozik.</p><button className="btn btn-primary" type="button" onClick={runSk} disabled={syncBusy||busy}>{syncBusy?"ÚKSÚP szinkron folyamatban…":"ÚKSÚP hivatalos katalógus szinkronizálása"}</button></section>
  <form action={run} className="admin-form" style={{gridTemplateColumns:"1fr 1fr"}}>
   <label>Ország<select name="country_code" defaultValue="HU"><option value="HU">Magyarország / Nébih</option><option value="SK">Szlovákia / ÚKSÚP ISPOR</option></select></label>
   <label>Forrás neve<input name="source_name" placeholder="Nébih növényvédő szer adatbázis"/></label>
   <label className="operation-wide">Forrás URL<input name="source_url" placeholder="https://novenyvedoszer.nebih.gov.hu/Engedelykereso/Kereso"/></label>
   <label className="operation-wide">Megjegyzés<input name="notes" placeholder="Import dátuma, export szűrése, ellenőrzési megjegyzés"/></label>
   <label className="operation-wide">Hivatalos CSV / Excelből kimásolt táblázat<textarea name="csv" rows={14} required placeholder={'name;authorization_number;regulatory_category;function_type;crop;target;dose_min;dose_max;dose_unit;application_method;phi_days;ingredient\nMinta készítmény;ABC-123;II;gyomirtó;kukorica;egyszikű gyomok;0,8;1,2;l/ha;permetezés;56;hatóanyag'}></textarea><small>Az első sor legyen fejléc. Magyar és szlovák oszlopneveket is felismer a rendszer. A Nébih esetében csak hivatalos keresőből/engedélyokiratból származó adat tölthető be.</small></label>
   <button className="btn btn-primary" type="submit" disabled={busy||syncBusy}>{busy?"Import folyamatban…":"Katalógus importálása"}</button>
  </form>
  {error&&<div className="error-box"><b>A szinkron nem futott le.</b><br/>{error}</div>}
  {result&&<div style={{padding:14,border:"1px solid #b7d7bd",borderRadius:12,background:"#f3fbf4"}}>Import eredmény: <b>{result.rows}</b> sor feldolgozva, <b>{result.inserted_products}</b> új készítmény, <b>{result.inserted_uses}</b> új felhasználás, <b>{result.inserted_ingredients}</b> új hatóanyag.</div>}
 </div>
}
