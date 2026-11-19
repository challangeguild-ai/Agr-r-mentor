"use client";

import {useMemo,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {dispatchTask} from "@/app/dispatch/actions";
import {farmMemberRoleLabel} from "@/lib/farmMembers";
import {machineTypeLabel} from "@/lib/machinery";
import {selectDispatchOptions} from "@/lib/dispatchOptions";

type Farm={id:string;name:string;owner_id:string};
type Field={id:string;name:string;farm_id:string};
type Member={id:string;farm_id:string;user_id:string;member_role:string};
type Machine={id:string;farm_id:string;name:string;machine_type:string|null};
type Person={id:string;full_name:string|null};

export function DispatchTaskForm({farms,fields,members,machines,people}:{
 farms:Farm[];fields:Field[];members:Member[];machines:Machine[];people:Person[]
}){
 const router=useRouter();
 const formRef=useRef<HTMLFormElement>(null);
 const submitting=useRef(false);
 const[busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState(""),[warning,setWarning]=useState("");
 const[farmId,setFarmId]=useState("");
 const[fieldId,setFieldId]=useState("");
 const[assigneeId,setAssigneeId]=useState("");
 const[machineId,setMachineId]=useState("");
 const[title,setTitle]=useState("");
 const[farmName,setFarmName]=useState("");
 const peopleMap=useMemo(()=>new Map(people.map(p=>[p.id,p.full_name||"Munkatárs"])),[people]);
 const {farm:selectedFarm,fields:filteredFields,machines:filteredMachines,assigneeIds}=selectDispatchOptions(farmId,farms,fields,members,machines);
 const eligibleAssignees=selectedFarm?assigneeIds.map(userId=>({
  id:userId,label:userId===selectedFarm.owner_id
   ?`${peopleMap.get(userId)||"Tulajdonos"} (tulajdonos)`
   :`${peopleMap.get(userId)||"Munkatárs"} (${farmMemberRoleLabel(members.find(m=>m.farm_id===farmId&&m.user_id===userId)?.member_role)})`
 })):[];
 const canSubmit=Boolean(farmId&&fieldId&&assigneeId&&title.trim());
 function selectFarm(id:string){
  setFarmId(id);setFieldId("");setAssigneeId("");setMachineId("");
  setFarmName(farms.find(f=>f.id===id)?.name||"");
  setError("");setSuccess("");setWarning("");
 }
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(submitting.current||!canSubmit)return;
  const data=new FormData(event.currentTarget);
  const taskTitle=title.trim();
  submitting.current=true;setBusy(true);setError("");setSuccess("");setWarning("");
  try{
   const result=await dispatchTask(data);
   setSuccess(`„${taskTitle}” feladat rögzítve. A lista frissült.`);
   if(result.warnings.length)setWarning(`A feladat elkészült, de további ellenőrzés szükséges: ${result.warnings.join(" ")}`);
   formRef.current?.reset();
   setFarmId("");setFieldId("");setAssigneeId("");setMachineId("");setTitle("");setFarmName("");
   try{router.refresh()}catch(refreshError){console.error("Munkakiosztás utáni lista frissítése sikertelen",refreshError);setWarning(previous=>[previous,"A lista frissítése nem sikerült; a munka ettől létrejött. Frissítsd az oldalt."].filter(Boolean).join(" "))}
  }catch(e){
   setError(e instanceof Error?e.message:"A feladat kiosztása sikertelen. Ellenőrizd az adatokat.");
  }finally{
   submitting.current=false;setBusy(false);
  }
 }
 return <form ref={formRef} onSubmit={submit} aria-busy={busy} className="admin-form task-create-grid" aria-label="Gazdasági munka kiosztása">
  <label>Gazdaság
   <select name="farm_id" value={farmId} onChange={e=>selectFarm(e.target.value)} required>
    <option value="">Válassz gazdaságot</option>
    {farms.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
   </select>
  </label>
  <label>Földtábla
   <select name="field_id" value={fieldId} onChange={e=>setFieldId(e.target.value)} disabled={!farmId} required>
    <option value="">{farmId?"Válassz táblát":"Előbb válassz gazdaságot"}</option>
    {filteredFields.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
   </select>
  </label>
  <label>Munkatárs
   <select name="assigned_to" value={assigneeId} onChange={e=>setAssigneeId(e.target.value)} disabled={!farmId} required>
    <option value="">{farmId?"Válassz végrehajtót":"Előbb válassz gazdaságot"}</option>
    {eligibleAssignees.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
   </select>
  </label>
  <label>Gép / eszköz
   <select name="machine_id" value={machineId} onChange={e=>setMachineId(e.target.value)} disabled={!farmId}>
    <option value="">Nincs hozzárendelve</option>
    {filteredMachines.map(m=><option key={m.id} value={m.id}>{m.name} ({machineTypeLabel(m.machine_type)})</option>)}
   </select>
  </label>
  <label>Feladat
   <input name="title" value={title} onChange={e=>setTitle(e.target.value)} maxLength={180}
    placeholder="pl. Tarlóhántás" required/>
  </label>
  <label>Határidő<input name="due_date" type="date"/></label>
  <label>Prioritás
   <select name="priority" defaultValue="normal">
    <option value="normal">Normál</option>
    <option value="high">Fontos</option>
    <option value="urgent">Sürgős</option>
   </select>
  </label>
  <label className="task-description">Utasítás / megjegyzés
   <input name="description" placeholder="pl. 12 cm mélység, teljes területen" maxLength={3000}/>
  </label>
  <div className="task-description am-dispatch-summary" role="status">
   {farmId
    ? <><strong>{farmName}</strong> · {filteredFields.length} választható földtábla · {eligibleAssignees.length} végrehajtó · {filteredMachines.length} gép</>
    : "Először válaszd ki a gazdaságot; utána csak az oda tartozó földtáblák, munkatársak és gépek jelennek meg."}
  </div>
  {error&&<div className="task-description error-box" role="alert">{error}</div>}
  {success&&<div className="task-description success-box" role="status">{success}</div>}
  {warning&&<div className="task-description notice" role="alert">{warning}</div>}
  <button className="btn btn-primary" disabled={!canSubmit||busy} type="submit">
   {busy?"Kiosztás folyamatban…":"Munka kiosztása"}
  </button>
 </form>;
}
