"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {TASK_ACCEPTED_EVENT,TASK_STARTED_EVENT} from "@/lib/taskWorkflow";
import {notifyAdvisors} from "@/lib/workflowNotifications";

async function context(taskId:string){
 const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const{data:task}=await supabase.from("tasks").select("id,title,farm_id,field_id,assigned_to,status").eq("id",taskId).eq("assigned_to",user.id).maybeSingle();
 if(!task)throw new Error("A munka nem található vagy nincs hozzád rendelve.");
 if(task.status==="done")throw new Error("A munka már véglegesen lezárt.");
 if(task.status==="submitted")throw new Error("A munka már szaktanácsadói ellenőrzésre vár.");
 const{data:membership}=await supabase.from("farm_members").select("id,active").eq("farm_id",task.farm_id).eq("user_id",user.id).eq("active",true).maybeSingle();
 if(!membership)throw new Error("Ehhez a gazdasághoz nincs aktív munkatársi jogosultságod.");
 return{supabase,user,task};
}

export async function setWorkerTaskStage(formData:FormData){
 const taskId=String(formData.get("task_id")||""),stage=String(formData.get("stage")||"");if(!taskId||!["accepted","started"].includes(stage))throw new Error("Érvénytelen munkafolyamat-lépés.");
 const{supabase,user,task}=await context(taskId);const eventType=stage==="started"?TASK_STARTED_EVENT:TASK_ACCEPTED_EVENT;
 const{data:existing,error:lookupError}=await supabase.from("timeline_events").select("id").eq("source_id",task.id).eq("event_type",eventType).eq("created_by",user.id).limit(1).maybeSingle();
 if(lookupError)throw new Error("A korábbi munkalépés ellenőrzése nem sikerült. Új eseményt nem rögzítettünk.");
 if(stage==="started"){
  const{data:accepted,error:acceptedError}=await supabase.from("timeline_events").select("id").eq("source_id",task.id).eq("event_type",TASK_ACCEPTED_EVENT).eq("created_by",user.id).limit(1).maybeSingle();
  if(acceptedError)throw new Error("A munka elfogadásának ellenőrzése nem sikerült.");
  if(!accepted)throw new Error("A munka megkezdése előtt előbb el kell fogadnod a feladatot.");
 }
 if(!existing){
  const now=new Date().toISOString(),title=stage==="started"?`Munka megkezdve: ${task.title}`:`Munka elfogadva: ${task.title}`;
  const{error}=await supabase.from("timeline_events").insert({farm_id:task.farm_id,field_id:task.field_id,event_type:eventType,title,description:null,event_at:now,created_by:user.id,source_id:task.id});if(error)throw new Error(error.message);
 }
 let warning:string|null=null;
 // A mentett esemény utáni RPC-hiba esetén ugyanaz a kérés újrapróbálható.
 // A notify_advisors egyedi event_key-je meggátolja a dupla értesítést.
 try{await notifyAdvisors(supabase,{kind:eventType,title:stage==="started"?"A végrehajtó megkezdte a munkát":"A végrehajtó elfogadta a munkát",message:task.title,href:"/admin/tasks?view=open",eventKey:`task:${task.id}:${stage}`});}
 catch(e){console.error("A munkafolyamat-lépés elmentve, de az értesítés nem igazolt",e);warning="A munkalépés elmentődött, de a szaktanácsadói értesítés nem igazolt. Az értesítést ugyanitt újrapróbálhatod; új munkalépés nem keletkezik."}
 for(const path of ["/work","/tasks","/admin/tasks",...(task.field_id?[`/fields/${task.field_id}`]:[])]){
  try{revalidatePath(path)}catch(e){console.error("A mentett munkalépés utáni nézetfrissítés sikertelen",e)}
 }
 return{ok:true as const,warning};
}
