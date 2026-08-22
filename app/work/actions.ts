"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {TASK_ACCEPTED_EVENT,TASK_STARTED_EVENT} from "@/lib/taskWorkflow";

async function context(taskId:string){
 const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const{data:task}=await supabase.from("tasks").select("id,title,farm_id,field_id,assigned_to,status").eq("id",taskId).eq("assigned_to",user.id).maybeSingle();
 if(!task)throw new Error("A munka nem található vagy nincs hozzád rendelve.");
 const{data:membership}=await supabase.from("farm_members").select("id,active").eq("farm_id",task.farm_id).eq("user_id",user.id).eq("active",true).maybeSingle();
 if(!membership)throw new Error("Ehhez a gazdasághoz nincs aktív munkatársi jogosultságod.");
 return{supabase,user,task};
}

export async function setWorkerTaskStage(formData:FormData){
 const taskId=String(formData.get("task_id")||"");const stage=String(formData.get("stage")||"");if(!taskId||!["accepted","started"].includes(stage))throw new Error("Érvénytelen munkafolyamat-lépés.");
 const{supabase,user,task}=await context(taskId);if(task.status==="done")return;
 const eventType=stage==="started"?TASK_STARTED_EVENT:TASK_ACCEPTED_EVENT;
 const{data:existing}=await supabase.from("timeline_events").select("id").eq("source_id",task.id).eq("event_type",eventType).maybeSingle();
 if(!existing){const now=new Date().toISOString();const{error}=await supabase.from("timeline_events").insert({farm_id:task.farm_id,field_id:task.field_id,event_type:eventType,title:stage==="started"?`Munka megkezdve: ${task.title}`:`Munka elfogadva: ${task.title}`,description:null,event_at:now,created_by:user.id,source_id:task.id});if(error)throw new Error(error.message)}
 revalidatePath("/work");revalidatePath("/tasks");if(task.field_id)revalidatePath(`/fields/${task.field_id}`);
}
