"use client";
import {useState} from "react";
import {createClient} from "@/lib/supabase/client";
import {createFarmerReport} from "@/app/fields/[id]/report-actions";
import {BlockHelpButton} from "@/components/GuidedTour";

const categories=[
 ["crop_health","Állomány / növényállapot"],["pest","Kártevő"],["disease","Betegség"],["weed","Gyomosodás"],
 ["water","Víz / belvíz / aszály"],["weather","Időjárási kár"],["soil","Talajprobléma"],["machine","Gép / műszaki probléma"],["work","Munkafolyamat"],["other","Egyéb"]
] as const;
const severities=[["normal","Normál"],["high","Fontos"],["urgent","Sürgős"]] as const;

export function FarmerReportForm({fieldId}:{fieldId:string}){
 const[step,setStep]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
 const[category,setCategory]=useState("crop_health"),[severity,setSeverity]=useState("normal"),[title,setTitle]=useState(""),[message,setMessage]=useState("");
 const[lat,setLat]=useState<number|null>(null),[lng,setLng]=useState<number|null>(null),[locating,setLocating]=useState(false);
 const supabase=createClient();
 function locate(){if(!navigator.geolocation){setError("A böngésző nem támogatja a GPS-helymeghatározást.");return}setLocating(true);setError("");navigator.geolocation.getCurrentPosition(p=>{setLat(p.coords.latitude);setLng(p.coords.longitude);setLocating(false)},()=>{setError("A GPS-helyzet nem olvasható. Engedélyezd a helyhozzáférést.");setLocating(false)},{enableHighAccuracy:true,timeout:12000,maximumAge:5000})}
 async function submit(formData:FormData){setBusy(true);setError("");setSuccess("");try{
  const{data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Nincs bejelentkezve.");
  if(!title.trim())throw new Error("A bejelentés tárgya kötelező.");
  const files=formData.getAll("media").filter((v):v is File=>v instanceof File&&v.size>0);
  const report=await createFarmerReport(fieldId,title,message,{category,severity,lat,lng});
  for(const file of files){if(file.size>50*1024*1024)throw new Error(`${file.name}: maximum 50 MB lehet.`);const kind=file.type.startsWith("image/")?"image":file.type.startsWith("video/")?"video":null;if(!kind)throw new Error(`${file.name}: csak kép vagy videó tölthető fel.`);const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");const path=`${user.id}/${report.id}/${crypto.randomUUID()}-${safe}`;const{error:uploadError}=await supabase.storage.from("farmer-report-media").upload(path,file,{contentType:file.type});if(uploadError)throw new Error(uploadError.message);const{error:mediaError}=await supabase.from("farmer_report_media").insert({report_id:report.id,storage_path:path,file_name:file.name,media_type:kind,mime_type:file.type,size_bytes:file.size});if(mediaError)throw new Error(mediaError.message)}
  setSuccess("A bejelentést elküldtük a szaktanácsadónak.");setTimeout(()=>window.location.reload(),700);
 }catch(e){setError(e instanceof Error?e.message:"A bejelentés elküldése sikertelen.");setBusy(false)}}
 const categoryLabel=categories.find(x=>x[0]===category)?.[1]||category;const severityLabel=severities.find(x=>x[0]===severity)?.[1]||severity;
 const nextOk=step===0?!!category&&!!severity:step===1?!!title.trim():true;
 return <form action={submit} className="farmer-report-form am-wizard" data-help-block="farmer-report" data-tour="farmer-report-wizard">
  <div style={{display:"flex",justifyContent:"flex-end"}}><BlockHelpButton label="A bejelentési varázsló magyarázata" content={{title:"Szakmai bejelentés – lépésről lépésre",body:"A varázsló először besorolja a problémát, majd bekéri a részleteket, a helyet és a bizonyítékokat. Ettől a szaktanácsadó gyorsabban tudja szűrni és rangsorolni a jelzéseket.",important:"A Sürgős jelölés nem automatikus szakmai jóváhagyás vagy vészhelyzeti szolgáltatás. Közvetlen veszély esetén használd a megfelelő azonnali elérhetőséget.",steps:["Válaszd ki a probléma kategóriáját és súlyosságát.","Adj rövid tárgyat és részletes leírást.","Ha helyhez kötött a probléma, rögzíts GPS-helyet és csatolj képet/videót.","Ellenőrizd az összefoglalót.","Küldd el a szaktanácsadónak."]}}/></div>
  <div className="am-wizard-progress"><span className={step>=0?"active":""}>1</span><i/><span className={step>=1?"active":""}>2</span><i/><span className={step>=2?"active":""}>3</span><i/><span className={step>=3?"active":""}>4</span></div>
  {step===0&&<section className="am-wizard-step"><span className="eyebrow">1. LÉPÉS</span><h3>Mi a probléma?</h3><div className="am-wizard-grid"><label>Kategória<select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label><label>Súlyosság<select value={severity} onChange={e=>setSeverity(e.target.value)}>{severities.map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label></div></section>}
  {step===1&&<section className="am-wizard-step"><span className="eyebrow">2. LÉPÉS</span><h3>Mit tapasztalsz?</h3><label>Tárgy<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="pl. Levélfoltosodás a déli sarokban" required maxLength={200}/></label><label>Részletes leírás<textarea value={message} onChange={e=>setMessage(e.target.value)} rows={5} maxLength={5000} placeholder="Mikor jelent meg, mekkora területet érint, hogyan változott?"/></label></section>}
  {step===2&&<section className="am-wizard-step"><span className="eyebrow">3. LÉPÉS</span><h3>Hely és bizonyíték</h3><div className="am-location-card"><div><strong>{lat!=null?"GPS-hely rögzítve":"A probléma pontos helye"}</strong><small>{lat!=null?`${lat.toFixed(6)}, ${lng?.toFixed(6)}`:"Ha a jelenség helyhez kötött, rögzítsd a telefon aktuális GPS-helyét."}</small></div><button type="button" className="ghost-btn" onClick={locate} disabled={locating}>{locating?"GPS keresése…":"⌖ Saját GPS-helyzet"}</button></div><label>Kép vagy videó<input name="media" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" multiple/><small>Egyszerre több fájl is csatolható, maximum 50 MB / fájl.</small></label></section>}
  {step===3&&<section className="am-wizard-step"><span className="eyebrow">4. LÉPÉS</span><h3>Ellenőrzés</h3><div className="am-wizard-summary"><div><small>Kategória</small><strong>{categoryLabel}</strong></div><div><small>Súlyosság</small><strong>{severityLabel}</strong></div><div><small>Tárgy</small><strong>{title||"—"}</strong></div><div><small>GPS</small><strong>{lat!=null?"Rögzítve":"Nincs megadva"}</strong></div></div>{message&&<p className="am-wizard-review">{message}</p>}</section>}
  {error&&<div className="error-box">{error}</div>}{success&&<div className="success-box">{success}</div>}
  <div className="am-wizard-actions">{step>0&&<button type="button" className="ghost-btn" onClick={()=>setStep(s=>s-1)}>← Vissza</button>}<span/>{step<3?<button type="button" className="btn btn-primary" disabled={!nextOk} onClick={()=>nextOk&&setStep(s=>s+1)}>Tovább →</button>:<button className="btn btn-primary" disabled={busy}>{busy?"Küldés…":"Bejelentés elküldése"}</button>}</div>
 </form>
}
