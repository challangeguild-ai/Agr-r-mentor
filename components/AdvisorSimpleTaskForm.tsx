"use client";

import {useMemo,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {createAssignedTask} from "@/app/admin/tasks/actions";
import {selectDispatchOptions} from "@/lib/dispatchOptions";

type Farm={id:string;name:string;owner_id:string};
type Field={id:string;farm_id:string;name:string};
type Member={id:string;farm_id:string;user_id:string};
type Person={id:string;full_name:string|null};

/** Simple advisor tasks must only offer fields and people from the selected farm. */
export function AdvisorSimpleTaskForm({farms,fields,members,people}:{farms:Farm[];fields:Field[];members:Member[];people:Person[]}){
  const router=useRouter();
  const form=useRef<HTMLFormElement|null>(null);
  const submitting=useRef(false);
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState("");
  const[success,setSuccess]=useState("");
  const[warning,setWarning]=useState("");
  const[farmId,setFarmId]=useState("");
  const[fieldId,setFieldId]=useState("");
  const[assignee,setAssignee]=useState("");
  const[title,setTitle]=useState("");
  const peopleMap=useMemo(()=>new Map(people.map(p=>[p.id,p.full_name||"Munkatárs"])),[people]);
  const{farm,fields:availableFields,assigneeIds}=selectDispatchOptions(farmId,farms,fields,members,[]);
  const canSubmit=Boolean(farmId&&title.trim()&&assignee);

  function selectFarm(next:string){
    setFarmId(next);setFieldId("");setAssignee(farms.find(f=>f.id===next)?.owner_id||"");setError("");setSuccess("");setWarning("");
  }

  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(submitting.current||!canSubmit)return;
    const formData=new FormData(event.currentTarget);
    const taskName=title.trim();
    submitting.current=true;setBusy(true);setError("");setSuccess("");setWarning("");
    try{
      const result=await createAssignedTask(formData);
      setSuccess(`„${taskName}” teendő létrejött, a munkalistában megtalálható.`);
      if(result.warnings.length)setWarning(`A teendő mentése sikeres, de: ${result.warnings.join(" ")}`);
      form.current?.reset();setFarmId("");setFieldId("");setAssignee("");setTitle("");
      router.refresh();
    }catch(err){
      setError(`${err instanceof Error?err.message:"A teendő mentését nem sikerült megerősíteni."} Ha megszakadt a kapcsolat, újraküldés előtt nézd meg a munkalistát, nehogy kétszer add ki ugyanazt.`);
    }finally{submitting.current=false;setBusy(false)}
  }

  return <form ref={form} onSubmit={submit} className="admin-form task-create-grid" aria-label="Egyszerű szaktanácsadói teendő kiadása" aria-busy={busy}>
    <label>Gazdaság
      <select name="farm_id" value={farmId} onChange={e=>selectFarm(e.target.value)} disabled={busy} required>
        <option value="">Válassz gazdaságot</option>
        {farms.map(f=><option key={f.id} value={f.id}>{f.name} · {peopleMap.get(f.owner_id)||"Gazdálkodó"}</option>)}
      </select>
    </label>
    <label>Földtábla
      <select name="field_id" value={fieldId} onChange={e=>setFieldId(e.target.value)} disabled={!farmId||busy}>
        <option value="">Teljes gazdaság (nem kötelező)</option>
        {availableFields.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
      </select>
    </label>
    <label>Végrehajtó
      <select name="assigned_to" value={assignee} onChange={e=>setAssignee(e.target.value)} disabled={!farmId||busy} required>
        <option value="">Válassz végrehajtót</option>
        {assigneeIds.map(id=><option key={id} value={id}>{peopleMap.get(id)||"Munkatárs"}{id===farm?.owner_id?" (tulajdonos)":""}</option>)}
      </select>
    </label>
    <label>Feladat
      <input name="title" value={title} onChange={e=>setTitle(e.target.value)} maxLength={180} disabled={busy} required/>
    </label>
    <label>Határidő<input name="due_date" type="date" disabled={busy}/></label>
    <label>Prioritás
      <select name="priority" defaultValue="normal" disabled={busy}><option value="normal">Normál</option><option value="high">Fontos</option><option value="urgent">Sürgős</option></select>
    </label>
    <label className="task-description">Megjegyzés<input name="description" maxLength={3000} disabled={busy}/></label>
    <div className="task-description" role="status" style={{color:"#5f6f65",fontSize:12}}>
      {farm?`${farm.name}: ${availableFields.length} választható földtábla, ${assigneeIds.length} jogosult végrehajtó.`:"A gazdaság kiválasztása után csak a hozzá tartozó táblák és végrehajtók jelennek meg."}
    </div>
    {error&&<div className="task-description error-box" role="alert">{error}</div>}
    {success&&<div className="task-description success-box" role="status">{success}</div>}
    {warning&&<div className="task-description notice" role="alert">{warning}</div>}
    <button className="btn btn-primary" type="submit" disabled={!canSubmit||busy}>{busy?"Teendő mentése…":"Teendő kiadása"}</button>
  </form>;
}
