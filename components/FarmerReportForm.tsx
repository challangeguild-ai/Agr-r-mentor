"use client";
import {useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "@/lib/supabase/client";
import {createFarmerReport} from "@/app/fields/[id]/report-actions";
import {BlockHelpButton} from "@/components/GuidedTour";

const categories=[
 ["crop_health","Állomány / növényállapot"],["pest","Kártevő"],["disease","Betegség"],["weed","Gyomosodás"],
 ["water","Víz / belvíz / aszály"],["weather","Időjárási kár"],["soil","Talajprobléma"],["machine","Gép / műszaki probléma"],["work","Munkafolyamat"],["other","Egyéb"]
] as const;
const severities=[["normal","Normál"],["high","Fontos"],["urgent","Sürgős"]] as const;

export function FarmerReportForm({fieldId}:{fieldId:string}){
 const router=useRouter();
 const reportIdRef=useRef<string|null>(null),reportWarningRef=useRef<string|null>(null),selectedFilesRef=useRef<File[]>([]),uploadedPathsRef=useRef(new Map<number,string>()),linkedFilesRef=useRef(new Set<number>()),submittingRef=useRef(false);
 const[step,setStep]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState(""),[attachmentCount,setAttachmentCount]=useState(0),[reportSaved,setReportSaved]=useState(false),[completed,setCompleted]=useState(false);
 const[category,setCategory]=useState("crop_health"),[severity,setSeverity]=useState("normal"),[title,setTitle]=useState(""),[message,setMessage]=useState("");
 const[lat,setLat]=useState<number|null>(null),[lng,setLng]=useState<number|null>(null),[locating,setLocating]=useState(false);
 const supabase=createClient();
 function locate(){if(!navigator.geolocation){setError("A böngésző nem támogatja a GPS-helymeghatározást.");return}setLocating(true);setError("");navigator.geolocation.getCurrentPosition(p=>{setLat(p.coords.latitude);setLng(p.coords.longitude);setLocating(false)},()=>{setError("A GPS-helyzet nem olvasható. Engedélyezd a helyhozzáférést.");setLocating(false)},{enableHighAccuracy:true,timeout:12000,maximumAge:5000})}
 async function submit(formData:FormData){
  if(submittingRef.current||completed)return;
  submittingRef.current=true;setBusy(true);setError("");setSuccess("");
  try{
   const{data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Nincs bejelentkezve.");
   if(!title.trim())throw new Error("A bejelentés tárgya kötelező.");
   if(!reportIdRef.current){
    const files=formData.getAll("media").filter((v):v is File=>v instanceof File&&v.size>0);
    const allowed=new Set(["image/jpeg","image/png","image/webp","video/mp4","video/webm","video/quicktime"]);
    if(files.length>10)throw new Error("Legfeljebb 10 kép vagy videó csatolható egyszerre.");
    for(const file of files){if(file.size>50*1024*1024)throw new Error(`${file.name}: maximum 50 MB lehet.`);if(!allowed.has(file.type))throw new Error(`${file.name}: csak JPG, PNG, WebP, MP4, WebM vagy MOV tölthető fel.`)}
    selectedFilesRef.current=files;
    const report=await createFarmerReport(fieldId,title,message,{category,severity,lat,lng});
    reportIdRef.current=report.id;reportWarningRef.current=report.warning;setReportSaved(true);
   }
   const reportId=reportIdRef.current;
   for(const [index,file] of selectedFilesRef.current.entries()){
    if(linkedFilesRef.current.has(index))continue;
    const kind=file.type.startsWith("image/")?"image":"video";
    let path=uploadedPathsRef.current.get(index);
    if(!path){
     const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_")||"csatolmany";
     path=`${user.id}/${reportId}/${crypto.randomUUID()}-${safe}`;
     const{error:uploadError}=await supabase.storage.from("farmer-report-media").upload(path,file,{contentType:file.type});
     if(uploadError)throw new Error(`${file.name}: ${uploadError.message}`);
     uploadedPathsRef.current.set(index,path);
    }
    const{data:existing,error:lookupError}=await supabase.from("farmer_report_media").select("id").eq("report_id",reportId).eq("storage_path",path).maybeSingle();
    if(lookupError)throw new Error(`${file.name}: a csatolmány ellenőrzése sikertelen.`);
    if(!existing){
     const{error:mediaError}=await supabase.from("farmer_report_media").insert({report_id:reportId,storage_path:path,file_name:file.name,media_type:kind,mime_type:file.type,size_bytes:file.size});
     if(mediaError)throw new Error(`${file.name}: a csatolmány mentése sikertelen.`);
    }
    linkedFilesRef.current.add(index);
   }
   setSuccess(selectedFilesRef.current.length?"A bejelentést és a csatolmányokat rögzítettük.":"A bejelentést rögzítettük.");
   if(reportWarningRef.current)setError(reportWarningRef.current);
   setCompleted(true);
   try{router.refresh()}catch(refreshError){console.error("Bejelentés lista frissítése sikertelen",refreshError)}
  }catch(e){
   const reason=e instanceof Error?e.message:"Ismeretlen hiba.";
   setError(reportIdRef.current?`A bejelentés már elmentődött. A csatolmányok feltöltése nem fejeződött be: ${reason} A hiányzó fájlokat az újrapróbálás gombbal folytathatod; a bejelentést nem hozzuk létre újra.`:reason);
  }finally{submittingRef.current=false;setBusy(false)}
 }
 const categoryLabel=categories.find(x=>x[0]===category)?.[1]||category;const severityLabel=severities.find(x=>x[0]===severity)?.[1]||severity;
 const nextOk=step===0?!!category&&!!severity:step===1?!!title.trim():true;
 return <form action={submit} className="farmer-report-form am-wizard" data-help-block="farmer-report" data-tour="farmer-report-wizard">
  <div style={{display:"flex",justifyContent:"flex-end"}}><BlockHelpButton label="A bejelentési varázsló magyarázata" content={{title:"Szakmai bejelentés – lépésről lépésre",body:"A varázsló először besorolja a problémát, majd bekéri a részleteket, a helyet és a bizonyítékokat. Ettől a szaktanácsadó gyorsabban tudja szűrni és rangsorolni a jelzéseket.",important:"A Sürgős jelölés nem automatikus szakmai jóváhagyás vagy vészhelyzeti szolgáltatás. Közvetlen veszély esetén használd a megfelelő azonnali elérhetőséget.",steps:["Válaszd ki a probléma kategóriáját és súlyosságát.","Adj rövid tárgyat és részletes leírást.","Ha helyhez kötött a probléma, rögzíts GPS-helyet és csatolj képet/videót.","Ellenőrizd az összefoglalót.","Küldd el a szaktanácsadónak."]}}/></div>
  <div className="am-wizard-progress"><span className={step>=0?"active":""}>1</span><i/><span className={step>=1?"active":""}>2</span><i/><span className={step>=2?"active":""}>3</span><i/><span className={step>=3?"active":""}>4</span></div>
  {step===0&&<section className="am-wizard-step"><span className="eyebrow">1. LÉPÉS</span><h3>Mi a probléma?</h3><div className="am-wizard-grid"><label>Kategória<select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label><label>Súlyosság<select value={severity} onChange={e=>setSeverity(e.target.value)}>{severities.map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label></div></section>}
  {step===1&&<section className="am-wizard-step"><span className="eyebrow">2. LÉPÉS</span><h3>Mit tapasztalsz?</h3><label>Tárgy<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="pl. Levélfoltosodás a déli sarokban" required maxLength={200}/></label><label>Részletes leírás<textarea value={message} onChange={e=>setMessage(e.target.value)} rows={5} maxLength={5000} placeholder="Mikor jelent meg, mekkora területet érint, hogyan változott?"/></label></section>}
  {step===2&&<section className="am-wizard-step"><span className="eyebrow">3. LÉPÉS</span><h3>Hely és bizonyíték</h3><div className="am-location-card"><div><strong>{lat!=null?"GPS-hely rögzítve":"A probléma pontos helye"}</strong><small>{lat!=null?`${lat.toFixed(6)}, ${lng?.toFixed(6)}`:"Ha a jelenség helyhez kötött, rögzítsd a telefon aktuális GPS-helyét."}</small></div><button type="button" className="ghost-btn" onClick={locate} disabled={locating}>{locating?"GPS keresése…":"⌖ Saját GPS-helyzet"}</button></div></section>}
  {/* Keep the file input mounted through step 4 so FormData still contains its files. */}
  <div style={{display:step===2?"block":"none"}}><label>Kép vagy videó<input name="media" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" multiple onChange={e=>setAttachmentCount(e.currentTarget.files?.length||0)}/><small>Legfeljebb 10 csatolmány, maximum 50 MB / fájl.</small></label></div>
  {step===3&&<section className="am-wizard-step"><span className="eyebrow">4. LÉPÉS</span><h3>Ellenőrzés</h3><div className="am-wizard-summary"><div><small>Kategória</small><strong>{categoryLabel}</strong></div><div><small>Súlyosság</small><strong>{severityLabel}</strong></div><div><small>Tárgy</small><strong>{title||"—"}</strong></div><div><small>GPS</small><strong>{lat!=null?"Rögzítve":"Nincs megadva"}</strong></div><div><small>Csatolmányok</small><strong>{attachmentCount} fájl</strong></div></div>{message&&<p className="am-wizard-review">{message}</p>}</section>}
  {error&&<div className="error-box">{error}</div>}{success&&<div className="success-box">{success}</div>}
  <div className="am-wizard-actions">{step>0&&<button type="button" className="ghost-btn" disabled={busy||reportSaved} onClick={()=>setStep(s=>s-1)}>← Vissza</button>}<span/>{step<3?<button type="button" className="btn btn-primary" disabled={!nextOk||busy} onClick={()=>nextOk&&setStep(s=>s+1)}>Tovább →</button>:<button className="btn btn-primary" disabled={busy||completed}>{completed?"Bejelentés rögzítve":busy?"Küldés…":reportSaved?"Hiányzó csatolmányok újrapróbálása":"Bejelentés elküldése"}</button>}</div>
 </form>
}
