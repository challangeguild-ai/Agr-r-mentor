"use server";

import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {encodeHotspot,hotspotTypes,HOTSPOT_EVENT,type HotspotSeverity,type HotspotType} from "@/lib/hotspots";
import {notifyAdvisors,notifyUser} from "@/lib/workflowNotifications";

async function context(fieldId:string){
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();
 if(!user)throw new Error("A munkamenet lejárt. Jelentkezz be újra.");
 const{data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
 const{data:field}=await supabase.from("fields").select("id,farm_id,name").eq("id",fieldId).maybeSingle();
 if(!field)throw new Error("A földtábla nem található.");
 const{data:farm}=await supabase.from("farms").select("id,owner_id,name").eq("id",field.farm_id).maybeSingle();
 if(!farm)throw new Error("A gazdaság nem található.");
 if(profile?.role!=="advisor"&&farm.owner_id!==user.id)throw new Error("Ehhez a földtáblához nincs jogosultságod.");
 return{supabase,user,profile,field,farm};
}

export async function createHotspot(formData:FormData){
 const fieldId=String(formData.get("field_id")||"");
 const{user,profile,field,farm,supabase}=await context(fieldId);
 const type=String(formData.get("type")||"") as HotspotType;
 const severity=String(formData.get("severity")||"warning") as HotspotSeverity;
 const lat=Number(String(formData.get("lat")||"").replace(",","."));
 const lng=Number(String(formData.get("lng")||"").replace(",","."));
 const notes=String(formData.get("notes")||"").trim();
 const createTask=String(formData.get("create_task")||"")==="yes";
 const dueDate=String(formData.get("due_date")||"");
 if(!hotspotTypes.some(([k])=>k===type))throw new Error("Érvénytelen problématípus.");
 if(!["warning","critical"].includes(severity))throw new Error("Érvénytelen súlyosság.");
 if(!Number.isFinite(lat)||lat<-90||lat>90||!Number.isFinite(lng)||lng<-180||lng>180)throw new Error("Jelöld ki a probléma pontos helyét a térképen.");
 if(notes.length>4000)throw new Error("A megjegyzés túl hosszú.");
 const now=new Date().toISOString();
 const data={type,severity,lat,lng,notes:notes||undefined,resolved:false,resolvedAt:null};
 const title=`Problémagóc: ${hotspotTypes.find(([k])=>k===type)?.[1]||"Probléma"}`;
 const{data:event,error}=await supabase.from("timeline_events").insert({farm_id:field.farm_id,field_id:field.id,event_type:HOTSPOT_EVENT,title,description:encodeHotspot(data),event_at:now,created_by:user.id}).select("id").single();
 if(error||!event)throw new Error(error?.message||"A problémagóc mentése sikertelen.");
 if(createTask&&profile?.role==="advisor"){
  const priority=severity==="critical"?"urgent":"high";
  const{data:task,error:taskError}=await supabase.from("tasks").insert({farm_id:field.farm_id,field_id:field.id,title,description:notes||"Térképen jelölt probléma kivizsgálása / kezelése.",due_date:dueDate||null,priority,status:"open",assigned_to:farm.owner_id,created_by:user.id}).select("id").single();
  if(taskError||!task)throw new Error(taskError?.message||"A teendő létrehozása sikertelen.");
  await notifyUser(supabase,{userId:farm.owner_id,kind:"hotspot",title:severity==="critical"?"Kritikus probléma a táblán":"Új probléma a táblán",message:`${field.name}: ${title}`,href:`/fields/${field.id}/hotspots`,eventKey:`hotspot:${event.id}:advisor-task`});
 }else if(profile?.role!=="advisor"){
  await notifyAdvisors(supabase,{kind:"hotspot",title:"Gazdálkodói problémagóc",message:`${farm.name} · ${field.name}: ${title}`,href:`/fields/${field.id}/hotspots`,eventKey:`hotspot:${event.id}:created`});
 }
 revalidatePath(`/fields/${field.id}`);revalidatePath(`/fields/${field.id}/hotspots`);revalidatePath("/admin/map");revalidatePath("/map");revalidatePath("/admin/priorities");
}

export async function resolveHotspot(formData:FormData){
 const fieldId=String(formData.get("field_id")||""),eventId=String(formData.get("event_id")||"");
 const{supabase,user,profile,field,farm}=await context(fieldId);
 const{data:event}=await supabase.from("timeline_events").select("id,description,event_type,title").eq("id",eventId).eq("field_id",fieldId).maybeSingle();
 if(!event||event.event_type!==HOTSPOT_EVENT)throw new Error("A problémagóc nem található.");
 const raw=String(event.description||"");if(!raw.startsWith("HOTSPOTJSON:"))throw new Error("A problémagóc adata sérült.");
 let data:any;try{data=JSON.parse(raw.slice(12))}catch{throw new Error("A problémagóc adata sérült.")}
 data.resolved=true;data.resolvedAt=new Date().toISOString();
 const label=hotspotTypes.find(([k])=>k===data.type)?.[1]||"Probléma";
 const{error}=await supabase.from("timeline_events").update({description:encodeHotspot(data),title:`Lezárt problémagóc: ${label}`,created_by:user.id}).eq("id",eventId).eq("field_id",fieldId);if(error)throw new Error(error.message);
 if(profile?.role==="advisor")await notifyUser(supabase,{userId:farm.owner_id,kind:"hotspot_resolved",title:"Problémagóc lezárva",message:`${field.name} · ${label}`,href:`/fields/${field.id}/hotspots`,eventKey:`hotspot:${eventId}:resolved`});
 else await notifyAdvisors(supabase,{kind:"hotspot_resolved",title:"Gazdálkodó lezárt egy problémagócot",message:`${farm.name} · ${field.name} · ${label}`,href:`/fields/${field.id}/hotspots`,eventKey:`hotspot:${eventId}:resolved`});
 revalidatePath(`/fields/${fieldId}`);revalidatePath(`/fields/${fieldId}/hotspots`);revalidatePath("/admin/map");revalidatePath("/map");revalidatePath("/admin/priorities");
}
