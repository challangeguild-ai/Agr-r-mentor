"use client";

import {useMemo,useState} from "react";
import {dispatchTask} from "@/app/dispatch/actions";
import {farmMemberRoleLabel} from "@/lib/farmMembers";
import {machineTypeLabel} from "@/lib/machinery";

type Farm={id:string;name:string;owner_id:string};
type Field={id:string;name:string;farm_id:string};
type Member={id:string;farm_id:string;user_id:string;member_role:string};
type Machine={id:string;farm_id:string;name:string;machine_type:string};
type Person={id:string;full_name:string|null};

export function DispatchTaskForm({farms,fields,members,machines,people}:{
 farms:Farm[];fields:Field[];members:Member[];machines:Machine[];people:Person[]
}){
 const[farmId,setFarmId]=useState("");
 const[fieldId,setFieldId]=useState("");
 const[assigneeId,setAssigneeId]=useState("");
 const[machineId,setMachineId]=useState("");
 const[title,setTitle]=useState("");
 const[farmName,setFarmName]=useState("");
 const peopleMap=useMemo(()=>new Map(people.map(p=>[p.id,p.full_name||"Munkatárs"])),[people]);
 const selectedFarm=farms.find(f=>f.id===farmId);
 const filteredFields=fields.filter(f=>f.farm_id===farmId);
 const filteredMembers=members.filter(m=>m.farm_id===farmId);
 const filteredMachines=machines.filter(m=>m.farm_id===farmId);
 const eligibleAssignees=selectedFarm
  ?[{id:selectedFarm.owner_id,label:`${peopleMap.get(selectedFarm.owner_id)||"Tulajdonos"} (tulajdonos)`},
    ...filteredMembers.filter(m=>m.user_id!==selectedFarm.owner_id).map(m=>({
      id:m.user_id,label:`${peopleMap.get(m.user_id)||"Munkatárs"} (${farmMemberRoleLabel(m.member_role)})`
    }))]
  :[];
 const canSubmit=Boolean(farmId&&fieldId&&assigneeId&&title.trim());
 function selectFarm(id:string){
  setFarmId(id);setFieldId("");setAssigneeId("");setMachineId("");
  setFarmName(farms.find(f=>f.id===id)?.name||"");
 }
 return <form action={dispatchTask} className="admin-form task-create-grid" aria-label="Gazdasági munka kiosztása">
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
  <button className="btn btn-primary" disabled={!canSubmit} type="submit">Munka kiosztása</button>
 </form>;
}
