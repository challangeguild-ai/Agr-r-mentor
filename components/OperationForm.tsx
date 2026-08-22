"use client";
import {useState} from "react";
import {createFieldOperation} from "@/app/operations/actions";
import {operationTypes} from "@/lib/operations";

type FieldOption={id:string;name:string;farmName:string;areaHa:number|null};
export function OperationForm({fields,defaultFieldId=""}:{fields:FieldOption[];defaultFieldId?:string}){
 const[busy,setBusy]=useState(false),[error,setError]=useState(""),[type,setType]=useState("spraying");
 async function submit(formData:FormData){setBusy(true);setError("");try{await createFieldOperation(formData);window.location.reload()}catch(e){setError(e instanceof Error?e.message:"A művelet mentése sikertelen.");setBusy(false)}}
 const spraying=type==="spraying"||type==="plant_protection";const inputLike=type==="fertilizing"||spraying;
 return <form action={submit} className="admin-form operation-form">
  <label>Földtábla<select name="field_id" defaultValue={defaultFieldId} required><option value="">Válassz földtáblát</option>{fields.map(f=><option key={f.id} value={f.id}>{f.name} – {f.farmName}{f.areaHa?` (${f.areaHa} ha)`:""}</option>)}</select></label>
  <label>Dátum<input type="date" name="operation_date" defaultValue={new Date().toISOString().slice(0,10)} required/></label>
  <label>Művelet<select name="operation_type" value={type} onChange={e=>setType(e.target.value)}>{operationTypes.map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label>
  <label>{spraying?"Készítmény / szer":type==="fertilizing"?"Műtrágya / anyag":type==="sowing"?"Vetőmag / fajta":"Anyag / megnevezés"}<input name="product" placeholder={spraying?"pl. gyomirtó készítmény":"opcionális"}/></label>
  {inputLike&&<><label>Dózis<input name="dose" inputMode="decimal" placeholder="pl. 2,5"/></label><label>Dózis egysége<select name="dose_unit" defaultValue={spraying?"l/ha":"kg/ha"}><option>l/ha</option><option>kg/ha</option><option>g/ha</option><option>ml/ha</option><option>kg</option><option>l</option></select></label></>}
  <label>Kezelt terület (ha)<input name="treated_area" inputMode="decimal" placeholder="pl. 4,2"/></label>
  <label>Összes mennyiség<input name="quantity" inputMode="decimal" placeholder="opcionális"/></label>
  <label>Mennyiség egysége<select name="quantity_unit" defaultValue="l"><option>l</option><option>kg</option><option>g</option><option>db</option><option>m³</option><option>t</option></select></label>
  <label>Gép / eszköz<input name="machine" placeholder="pl. permetezőgép"/></label>
  <label>Végrehajtó<input name="operator" placeholder="név vagy vállalkozó"/></label>
  <label className="operation-wide">Időjárás / körülmények<input name="weather" placeholder="pl. 19 °C, gyenge szél, száraz levélzet"/></label>
  <label className="operation-wide">Megjegyzés<textarea name="notes" rows={3} placeholder="Minden további szakmai megjegyzés..."/></label>
  {error&&<div className="error-box operation-wide">{error}</div>}
  <button className="btn btn-primary" type="submit" disabled={busy}>{busy?"Mentés…":"Művelet rögzítése"}</button>
 </form>
}
