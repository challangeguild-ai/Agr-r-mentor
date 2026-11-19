"use client";

import {useRef,useState,type FormEvent} from "react";
import {submitGeneralTaskCompletion} from "@/app/tasks/generalTaskAction";
import {generalTaskCompletionNote} from "@/lib/taskWorkflow";

export function GeneralTaskCompleteForm({taskId}:{taskId:string}){
 const[notes,setNotes]=useState("");
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState("");
 const submitting=useRef(false);

 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(submitting.current)return;
  const validatedNotes=generalTaskCompletionNote(notes);
  if(!validatedNotes){setError("Írj röviden a teljesítésről (legalább 3 karakter). ");return;}
  submitting.current=true;setBusy(true);setError("");
  try{
   const formData=new FormData();
   formData.set("task_id",taskId);
   formData.set("completion_notes",validatedNotes);
   const result=await submitGeneralTaskCompletion(formData);
   if(!result.ok)throw new Error(result.uncertain
    ?`${result.error} Ellenőrizd a feladat állapotát, mielőtt újra próbálod.`
    :result.error||"A beküldés sikertelen.");
   window.location.reload();
  }catch(e){
   setError(e instanceof Error?e.message:"A teendő beküldése sikertelen.");
   setBusy(false);submitting.current=false;
  }
 }

 return <form onSubmit={submit} style={{display:"grid",gap:8,maxWidth:500}}>
  <p style={{margin:0,fontSize:13}}>Általános, nem földtáblához kötött teendő: itt rövid teljesítési beszámoló elegendő, GPS és fotó nem szükséges. A szaktanácsadó ellenőrzése után lesz kész.</p>
  <label htmlFor={`general-task-notes-${taskId}`} style={{fontSize:12,fontWeight:700}}>Mit végeztél el?</label>
  <textarea id={`general-task-notes-${taskId}`} value={notes} onChange={e=>setNotes(e.target.value)} rows={2}
   minLength={3} maxLength={1500} required disabled={busy}
   placeholder="Pl. Átadtam a dokumentumokat és egyeztettem a gazdaságvezetővel."
   style={{width:"100%",padding:10,border:"1px solid #dfe5df",borderRadius:8}}/>
  <button type="submit" className="btn btn-primary" disabled={busy||!generalTaskCompletionNote(notes)}>
   {busy?"Beküldés…":"Beküldés ellenőrzésre"}
  </button>
  {error&&<small role="alert" style={{color:"#b3342b"}}>{error}</small>}
 </form>;
}
