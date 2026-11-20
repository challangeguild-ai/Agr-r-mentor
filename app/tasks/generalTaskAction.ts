"use server";

import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {budapestCalendarDate} from "@/lib/weather/rollingPrecipitation";
import {canSubmitGeneralTask,generalTaskCompletionNote} from "@/lib/taskWorkflow";
import {notifyAdvisors} from "@/lib/workflowNotifications";

export async function submitGeneralTaskCompletion(formData:FormData){
 let persistAttempted=false;
 try{
  const taskId=String(formData.get("task_id")||"").trim();
  const notes=generalTaskCompletionNote(String(formData.get("completion_notes")||""));
  if(!taskId)throw new Error("Hiányzó teendő.");
  if(!notes)throw new Error("Írj legalább 3, legfeljebb 1500 karaktert a teljesítésről.");

  const supabase=await createClient();
  const{data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error("A munkamenet lejárt. Jelentkezz be újra.");
  const{data:task,error:taskError}=await supabase.from("tasks")
   .select("id,title,farm_id,field_id,task_kind,status,assigned_to")
   .eq("id",taskId).eq("assigned_to",user.id).maybeSingle();
  if(taskError||!task)throw new Error("A teendő nem található vagy nincs hozzá jogosultságod.");
  if(!task.field_id&&task.task_kind==="general"&&(task.status==="done"||task.status==="submitted"))
   return{ok:true,submitted:false};
  if(!canSubmitGeneralTask(task.status,task.field_id,task.task_kind))
   throw new Error("Ez a beküldési mód csak nyitott, földtábla nélküli általános teendőhöz használható.");

  persistAttempted=true;
  const{data:submitted,error}=await supabase.rpc("submit_general_task_execution",{
   p_task_id:task.id,p_notes:notes,p_operation_date:budapestCalendarDate()
  });
  if(error)throw new Error(error.message);
  if(typeof submitted!=="boolean")throw new Error("A mentés eredménye nem igazolható.");

  if(submitted){
   try{await notifyAdvisors(supabase,{
    kind:"task_submitted_review",title:"Általános teendő ellenőrzésre vár",
    message:`${task.title} · teljes gazdaság`,href:"/admin/tasks?view=submitted",
    eventKey:`task:${task.id}:submitted`,emailSubject:"Általános teendő ellenőrzésre vár",
    emailMessage:`${task.title}\n${notes}\nA végrehajtás szaktanácsadói visszaigazolásra vár.`
   })}catch(e){console.error("A teendő beküldve, de az értesítés sikertelen",e)}
  }
  for(const path of ["/tasks","/work","/dashboard","/admin/tasks","/admin/workday"]){
   try{revalidatePath(path)}catch(e){console.error("A teendő utáni frissítés sikertelen",e)}
  }
  return{ok:true,submitted};
 }catch(e){
  console.error("submitGeneralTaskCompletion",e);
  return{ok:false,submitted:false,uncertain:persistAttempted,
   error:e instanceof Error?e.message:"A teendő beküldése sikertelen."};
 }
}
