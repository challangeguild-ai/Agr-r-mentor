"use client";

import {useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "@/lib/supabase/client";
import {createInspection} from "./inspectionActions";

type FieldOption={id:string;name:string;farmName:string};
const allowedMedia=new Set(["image/jpeg","image/png","image/webp","video/mp4","video/webm","video/quicktime"]);

export function InspectionForm({fields,defaultFieldId=""}:{fields:FieldOption[];defaultFieldId?:string}){
 const router=useRouter();
 const supabase=createClient();
 const inspectionIdRef=useRef<string|null>(null);
 const selectedFilesRef=useRef<File[]>([]);
 const savedPathsRef=useRef(new Map<number,string>());
 const linkedFilesRef=useRef(new Set<number>());
 const warningsRef=useRef<string[]>([]);
 const submittingRef=useRef(false);
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState("");
 const[success,setSuccess]=useState("");
 const[warning,setWarning]=useState("");
 const[createTask,setCreateTask]=useState(false);
 const[inspectionSaved,setInspectionSaved]=useState(false);
 const[completed,setCompleted]=useState(false);

 async function submit(formData:FormData){
  if(submittingRef.current||completed)return;
  submittingRef.current=true;setBusy(true);setError("");setSuccess("");setWarning("");
  try{
   const{data:{user}}=await supabase.auth.getUser();
   if(!user)throw new Error("Jelentkezz be újra.");
   if(!inspectionIdRef.current){
    const files=formData.getAll("media").filter((value):value is File=>value instanceof File&&value.size>0);
    if(files.length>10)throw new Error("Legfeljebb 10 kép vagy videó csatolható egyszerre.");
    for(const file of files){
     if(file.size>50*1024*1024)throw new Error(`${file.name}: maximum 50 MB lehet.`);
     if(!allowedMedia.has(file.type))throw new Error(`${file.name}: csak JPG, PNG, WebP, MP4, WebM vagy MOV tölthető fel.`);
    }
    selectedFilesRef.current=files;
    formData.delete("media");
    const result=await createInspection(formData);
    inspectionIdRef.current=result.id;
    warningsRef.current=result.warnings;
    setInspectionSaved(true);
   }
   const inspectionId=inspectionIdRef.current;
   for(const[index,file]of selectedFilesRef.current.entries()){
    if(linkedFilesRef.current.has(index))continue;
    const kind=file.type.startsWith("image/")?"image":"video";
    let path=savedPathsRef.current.get(index);
    if(!path){
     const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"_")||"csatolmany";
     path=`${inspectionId}/${crypto.randomUUID()}-${safeName}`;
     const{error:uploadError}=await supabase.storage.from("inspection-media")
      .upload(path,file,{contentType:file.type,upsert:false});
     if(uploadError)throw new Error(`${file.name}: ${uploadError.message}`);
     savedPathsRef.current.set(index,path);
    }
    const{data:existing,error:lookupError}=await supabase.from("inspection_media")
     .select("id").eq("inspection_id",inspectionId).eq("storage_path",path).maybeSingle();
    if(lookupError)throw new Error(`${file.name}: a csatolmány ellenőrzése nem sikerült.`);
    if(!existing){
     const{error:rowError}=await supabase.from("inspection_media").insert({
      inspection_id:inspectionId,storage_path:path,file_name:file.name,
      media_type:kind,mime_type:file.type,size_bytes:file.size,uploaded_by:user.id
     });
     if(rowError)throw new Error(`${file.name}: a csatolmány mentése nem sikerült.`);
    }
    linkedFilesRef.current.add(index);
   }
   setSuccess(selectedFilesRef.current.length
    ?"A szemle és a csatolmányok rögzítve."
    :"A szemle rögzítve.");
   if(warningsRef.current.length)setWarning(`A szemle mentése sikerült, de ellenőrzést igényel: ${warningsRef.current.join(" ")}`);
   setCompleted(true);
   try{router.refresh()}catch(refreshError){console.error("Szemle lista frissítése sikertelen",refreshError)}
  }catch(caught){
   const reason=caught instanceof Error?caught.message:"A szemle mentése sikertelen.";
   setError(inspectionIdRef.current
    ?`A szemle már elmentődött. Egy vagy több csatolmány hiányzik: ${reason} Az újrapróbálás ugyanahhoz a szemléhez folytatja a feltöltést; a szemlét ne hozd létre újra.`
    :reason);
   if(inspectionIdRef.current&&warningsRef.current.length)
    setWarning(warningsRef.current.join(" "));
  }finally{submittingRef.current=false;setBusy(false)}
 }

 return <form action={submit} className="admin-form inspection-create-grid" data-help="inspection-form">
  <label data-help="inspection-field">Földtábla
   <select name="field_id" required defaultValue={defaultFieldId} disabled={inspectionSaved}>
    <option value="">Válassz táblát</option>
    {fields.map(field=><option key={field.id} value={field.id}>{field.name} – {field.farmName}</option>)}
   </select>
  </label>
  <label>Szemle dátuma<input name="inspected_at" type="date" defaultValue={new Date().toISOString().slice(0,10)} disabled={inspectionSaved}/></label>
  <label>Állapot / minősítés
   <select name="condition" defaultValue="good" required disabled={inspectionSaved}>
    <option value="good">Jó állapot</option>
    <option value="attention">Figyelmet igényel</option>
    <option value="critical">Kritikus</option>
   </select>
  </label>
  <label>Előző szemléhez képest
   <select name="follow_up_status" defaultValue="" disabled={inspectionSaved}>
    <option value="">Első szemle / nincs összevetés</option>
    <option value="improved">Javult</option>
    <option value="unchanged">Változatlan</option>
    <option value="worsened">Romlott</option>
   </select>
  </label>
  <label>Következő javasolt ellenőrzés
   <input name="next_check_at" type="date" disabled={inspectionSaved}/>
   <small>Ha szükséges visszaellenőrzés, itt ütemezhető.</small>
  </label>
  <label>Probléma állapota
   <select name="issue_status" defaultValue="open" disabled={inspectionSaved}>
    <option value="open">Nyitott</option>
    <option value="monitoring">Megfigyelés alatt</option>
    <option value="resolved">Lezárt / megoldódott</option>
   </select>
  </label>
  <label className="inspection-wide" data-help="inspection-observation">Belső szakmai megfigyelés
   <textarea name="notes" rows={3} placeholder="Szakmai jegyzet a szemléről. Ez nem kerül automatikusan e-mailben a gazdálkodóhoz." disabled={inspectionSaved}/>
   <small>Belső munkajegyzet; a gazdálkodói e-mailhez használd az alábbi külön mezőt.</small>
  </label>
  <label className="inspection-wide" data-help="inspection-recommendation">Szaktanácsadói javaslat
   <textarea name="recommendation" rows={3} placeholder="Javasolt kezelés, következő lépés..." disabled={inspectionSaved}/>
  </label>
  <div className="inspection-wide task-from-inspection" data-tour="inspection-farmer-message">
   <label>Gazdálkodónak szóló észrevétel
    <textarea name="farmer_message" rows={4} placeholder="Pl. Az állomány megfelelően fejlődik, jelenleg beavatkozás nem szükséges." disabled={inspectionSaved}/>
   </label>
   <label className="checkbox-row">
    <input type="checkbox" name="notify_farmer" value="yes" defaultChecked disabled={inspectionSaved}/>
    Értesítés és e-mail küldése a gazdálkodónak
   </label>
   <small>Ide pozitív és negatív visszajelzés is írható. Ha a mező üres, külön szemle-e-mail nem kerül kiküldésre.</small>
  </div>
  <div className="inspection-wide task-from-inspection" data-help="inspection-task">
   <label className="checkbox-row">
    <input type="checkbox" name="create_task" value="yes" checked={createTask} disabled={inspectionSaved}
     onChange={event=>setCreateTask(event.target.checked)}/>
    Teendő létrehozása ebből a szemléből
   </label>
   {createTask&&<div className="inspection-task-grid">
    <label>Teendő neve<input name="task_title" placeholder="pl. Gyomirtás" required disabled={inspectionSaved}/></label>
    <label>Határidő<input name="task_due_date" type="date" disabled={inspectionSaved}/></label>
    <label>Prioritás<select name="task_priority" defaultValue="normal" disabled={inspectionSaved}>
     <option value="normal">Normál</option>
     <option value="high">Fontos</option>
     <option value="urgent">Sürgős</option>
    </select></label>
   </div>}
  </div>
  <label className="inspection-wide" data-help="inspection-media">Képek és videók
   <input name="media" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" multiple disabled={inspectionSaved}/>
   <small>Legfeljebb 10 csatolmány, maximum 50 MB / fájl.</small>
  </label>
  {error&&<div className="error-box inspection-wide" role="alert">{error}</div>}
  {success&&<div className="success-box inspection-wide" role="status">{success}</div>}
  {warning&&<div className="inspection-wide notice" role="alert">{warning}</div>}
  <button className="btn btn-primary" type="submit" disabled={busy||completed} data-help="inspection-save">
   {completed?"Szemle rögzítve":busy?"Mentés és feltöltés…":inspectionSaved?"Hiányzó csatolmányok újrapróbálása":"Szemle mentése"}
  </button>
 </form>;
}
