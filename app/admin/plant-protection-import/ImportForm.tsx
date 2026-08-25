"use client";

import {useState} from "react";
import {importPlantProtectionCsv} from "./actions";

export function ImportForm(){
 const[busy,setBusy]=useState(false),[error,setError]=useState(""),[result,setResult]=useState<any>(null);
 async function run(formData:FormData){setBusy(true);setError("");setResult(null);try{const r=await importPlantProtectionCsv(formData);setResult(r)}catch(e){setError(e instanceof Error?e.message:"Az import sikertelen.")}finally{setBusy(false)}}
 return <form action={run} className="admin-form" style={{gridTemplateColumns:"1fr 1fr"}}>
  <label>Ország<select name="country_code" defaultValue="HU"><option value="HU">Magyarország / Nébih</option><option value="SK">Szlovákia / ÚKSÚP ISPOR</option></select></label>
  <label>Forrás neve<input name="source_name" placeholder="Nébih növényvédő szer adatbázis"/></label>
  <label className="operation-wide">Forrás URL<input name="source_url" placeholder="https://novenyvedoszer.nebih.gov.hu/Engedelykereso/Kereso"/></label>
  <label className="operation-wide">Megjegyzés<input name="notes" placeholder="Import dátuma, export szűrése, ellenőrzési megjegyzés"/></label>
  <label className="operation-wide">CSV / Excelből kimásolt táblázat<textarea name="csv" rows={14} required placeholder={'name;authorization_number;regulatory_category;function_type;crop;target;dose_min;dose_max;dose_unit;application_method;phi_days;ingredient\nMinta készítmény;ABC-123;II;gyomirtó;kukorica;egyszikű gyomok;0,8;1,2;l/ha;permetezés;56;hatóanyag'}></textarea><small>Az első sor legyen fejléc. Magyar és szlovák oszlopneveket is felismer a rendszer: készítmény/szer neve, engedélyszám, kategória, kultúra, károsító/cél, dózis min/max, dózisegység, kijuttatási mód, ÉVI/PHI, hatóanyag.</small></label>
  {error&&<div className="operation-wide error-box">{error}</div>}
  {result&&<div className="operation-wide" style={{padding:14,border:"1px solid #b7d7bd",borderRadius:12,background:"#f3fbf4"}}>Import eredmény: <b>{result.rows}</b> sor feldolgozva, <b>{result.inserted_products}</b> új készítmény, <b>{result.inserted_uses}</b> új felhasználás, <b>{result.inserted_ingredients}</b> új hatóanyag.</div>}
  <button className="btn btn-primary" type="submit" disabled={busy}>{busy?"Import folyamatban…":"Katalógus importálása"}</button>
 </form>
}
