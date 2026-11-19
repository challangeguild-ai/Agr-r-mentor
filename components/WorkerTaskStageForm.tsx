"use client";

import {useRef,useState,type FormEvent} from "react";
import {useRouter} from "next/navigation";
import {setWorkerTaskStage} from "@/app/work/actions";

export function WorkerTaskStageForm({taskId,stage}:{taskId:string;stage:"accepted"|"started"}){
 const router=useRouter();
 const submitting=useRef(false);
 const[busy,setBusy]=useState(false);
 const[warning,setWarning]=useState("");
 const[error,setError]=useState("");

 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(submitting.current)return;
  submitting.current=true;setBusy(true);setError("");setWarning("");
  try{
   const data=new FormData();data.set("task_id",taskId);data.set("stage",stage);
   const result=await setWorkerTaskStage(data);
   if(result.warning)setWarning(result.warning);
   else router.refresh();
  }catch(e){setError(e instanceof Error?e.message:"A munkalépés mentése sikertelen. Ellenőrizd a feladat állapotát.")}
  finally{setBusy(false);submitting.current=false}
 }

 return <form onSubmit={submit} style={{display:"grid",gap:6}}>
  <button className="btn btn-primary" type="submit" disabled={busy}>
   {busy?"Mentés…":warning?"Értesítés újrapróbálása":stage==="started"?"Munka megkezdése":"Elfogadom"}
  </button>
  {warning&&<small role="status" style={{color:"#8a5913",maxWidth:320}}>{warning}</small>}
  {error&&<small role="alert" style={{color:"#b3342b",maxWidth:320}}>{error}</small>}
 </form>;
}
