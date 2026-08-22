"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {ADVISOR_VISIT_EVENT,decodeAdvisorVisit,encodeAdvisorVisit,type AdvisorVisitStatus} from "@/lib/advisorVisits";

async function advisorContext(){
  const supabase=await createClient();
  const{data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login");
  const{data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
  if(profile?.role!=="advisor")redirect("/dashboard");
  return{supabase,user};
}

export async function createAdvisorVisit(formData:FormData){
  const{supabase,user}=await advisorContext();
  const farmId=String(formData.get("farm_id")||"");
  const fieldId=String(formData.get("field_id")||"");
  const scheduledAt=String(formData.get("scheduled_at")||"");
  const purpose=String(formData.get("purpose")||"").trim();
  const note=String(formData.get("note")||"").trim();
  const notifyFarmer=String(formData.get("notify_farmer")||"")==="yes";
  if(!farmId||!scheduledAt||!purpose)throw new Error("Ügyfél, időpont és látogatási cél megadása kötelező.");
  const when=new Date(scheduledAt);if(Number.isNaN(when.getTime()))throw new Error("Érvénytelen időpont.");
  if(purpose.length>180||note.length>3000)throw new Error("A megadott szöveg túl hosszú.");
  const{data:farm}=await supabase.from("farms").select("id,name,owner_id").eq("id",farmId).maybeSingle();
  if(!farm)throw new Error("A gazdaság nem található.");
  let fieldName="";
  if(fieldId){const{data:field}=await supabase.from("fields").select("id,name,farm_id").eq("id",fieldId).eq("farm_id",farmId).maybeSingle();if(!field)throw new Error("A kiválasztott tábla nem ehhez a gazdasághoz tartozik.");fieldName=field.name;}
  const payload=encodeAdvisorVisit({scheduledAt:when.toISOString(),purpose,note:note||undefined,status:"planned",completedAt:null});
  const{error}=await supabase.from("timeline_events").insert({farm_id:farmId,field_id:fieldId||null,event_type:ADVISOR_VISIT_EVENT,title:`Tervezett látogatás: ${purpose}`,description:payload,event_at:when.toISOString(),created_by:user.id});
  if(error)throw new Error(error.message);
  if(notifyFarmer){
    const href=fieldId?`/fields/${fieldId}`:"/dashboard";
    await supabase.from("notifications").insert({user_id:farm.owner_id,kind:"advisor_visit",title:"Szaktanácsadói látogatás tervezve",message:`${purpose}${fieldName?` · ${fieldName}`:""} · ${when.toLocaleString("hu-HU")}`,href});
  }
  revalidatePath("/admin/visits");revalidatePath("/admin/portfolio");revalidatePath("/admin");
}

export async function updateAdvisorVisitStatus(formData:FormData){
  const{supabase,user}=await advisorContext();
  const eventId=String(formData.get("event_id")||"");
  const status=String(formData.get("status")||"") as AdvisorVisitStatus;
  if(!eventId||!["planned","completed","cancelled"].includes(status))throw new Error("Érvénytelen látogatási állapot.");
  const{data:event}=await supabase.from("timeline_events").select("id,farm_id,field_id,description,event_type,created_by").eq("id",eventId).eq("event_type",ADVISOR_VISIT_EVENT).maybeSingle();
  if(!event||event.created_by!==user.id)throw new Error("A látogatás nem található vagy nincs hozzá jogosultságod.");
  const visit=decodeAdvisorVisit(event.description);if(!visit)throw new Error("A látogatás adatai sérültek.");
  const next={...visit,status,completedAt:status==="completed"?new Date().toISOString():null};
  const{error}=await supabase.from("timeline_events").update({description:encodeAdvisorVisit(next),title:`${status==="completed"?"Elvégzett":status==="cancelled"?"Lemondott":"Tervezett"} látogatás: ${visit.purpose}`}).eq("id",eventId).eq("created_by",user.id);
  if(error)throw new Error(error.message);
  revalidatePath("/admin/visits");revalidatePath("/admin/portfolio");revalidatePath("/admin");
}
