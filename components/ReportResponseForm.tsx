"use client";
import {useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {handleReport} from "@/app/admin/actions";
import type {ReportHandlingResult} from "@/app/admin/actions";

export function ReportResponseForm({reportId}:{reportId:string}){
 const router=useRouter();
 const pendingRef=useRef(false);
 const[busy,setBusy]=useState(false);
 const[result,setResult]=useState<ReportHandlingResult|null>(null);
 const[error,setError]=useState("");

 async function submit(formData:FormData){
  if(pendingRef.current||result)return;
  pendingRef.current=true;
  setBusy(true);
  setError("");
  try{
   const saved=await handleReport(formData);
   setResult(saved);
   router.refresh();
  }catch(error){
   setError(error instanceof Error?error.message:"A bejelentés kezelése sikertelen.");
  }finally{
   pendingRef.current=false;
   setBusy(false);
  }
 }
 const actionLabel=result?.action==="close"?"A bejelentés lezárva."
  :result?.status==="already_saved"?"A válasz már korábban mentve volt."
  :"A szaktanácsadói válasz mentve.";

 return <form action={submit} className="report-reply-form">
  <input type="hidden" name="report_id" value={reportId}/>
  <label>Válasz a gazdálkodónak
   <textarea name="reply" rows={3} placeholder="Szakmai válasz vagy javaslat..." disabled={!!result}/>
  </label>
  <div className="report-task-options">
   <input name="task_title" placeholder="Teendő neve (opcionális)" disabled={!!result}/>
   <input name="due_date" type="date" disabled={!!result}/>
   <select name="priority" defaultValue="normal" disabled={!!result}>
    <option value="normal">Normál</option>
    <option value="high">Fontos</option>
    <option value="urgent">Sürgős</option>
   </select>
  </div>
  {error&&<div className="error-box" role="alert">{error}</div>}
  {result&&<div role="status" style={{border:"1px solid #d7e8d5",background:"#f5fbf2",padding:12,borderRadius:10}}>
   <strong>{actionLabel}</strong>
   {result.taskId&&<p>A teendő is létrejött.</p>}
   {result.warnings.map((warning,index)=><p key={index} style={{color:"#8b5e13"}}>{warning}</p>)}
   <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
    <a className="ghost-btn" href="/admin/reports">Bejelentések frissítése</a>
    {result.action==="reply_task"&&<a className="ghost-btn" href="/admin/tasks">Teendőlista ellenőrzése</a>}
   </div>
  </div>}
  <div className="report-buttons">
   <button className="btn btn-primary" name="action" value="reply" disabled={busy||!!result}>
    {busy?"Mentés…":"Válasz küldése"}
   </button>
   <button className="btn btn-secondary" name="action" value="reply_task" disabled={busy||!!result}>Válasz + teendő</button>
   <button className="ghost-btn" name="action" value="close" formNoValidate disabled={busy||!!result}>Lezárás</button>
  </div>
 </form>;
}
