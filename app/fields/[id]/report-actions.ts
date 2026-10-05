"use server";
import {createClient} from "@/lib/supabase/server";
import {notifyAdvisors} from "@/lib/workflowNotifications";

type ReportMeta={category?:string;severity?:string;lat?:number|null;lng?:number|null};
const categories=new Set(["crop_health","pest","disease","weed","water","weather","soil","machine","work","other"]);
const severities=new Set(["normal","high","urgent"]);

export async function createFarmerReport(fieldId:string,title:string,message:string,meta:ReportMeta={}){
 const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("A munkamenet lejárt. Jelentkezz be újra.");
 if(!fieldId||!title.trim())throw new Error("A földtábla és a bejelentés tárgya kötelező.");
 const{data:field}=await supabase.from("fields").select("id,farm_id,name").eq("id",fieldId).maybeSingle();if(!field)throw new Error("A földtábla nem található.");
 const{data:farm}=await supabase.from("farms").select("id,name").eq("id",field.farm_id).eq("owner_id",user.id).maybeSingle();if(!farm)throw new Error("Ehhez a földtáblához nincs jogosultságod.");
 const category=categories.has(meta.category||"")?meta.category:"other",severity=severities.has(meta.severity||"")?meta.severity:"normal";
 const lat=Number.isFinite(meta.lat as number)?Number(meta.lat):null,lng=Number.isFinite(meta.lng as number)?Number(meta.lng):null;
 const{data:report,error}=await supabase.from("farmer_reports").insert({field_id:fieldId,farmer_id:user.id,title:title.trim().slice(0,200),message:message.trim().slice(0,5000)||null,category,severity,location_lat:lat,location_lng:lng}).select("id").single();
 if(error||!report)throw new Error(error?.message||"A bejelentés mentése sikertelen.");
 const severityLabel=severity==="urgent"?"SÜRGŐS":severity==="high"?"FONTOS":"NORMÁL";
 await notifyAdvisors(supabase,{kind:"farmer_report",title:`Új gazdálkodói bejelentés · ${severityLabel}`,message:`${farm.name} · ${field.name} · ${title.trim().slice(0,200)}`,href:"/admin/reports?view=new",eventKey:`report:${report.id}:created`,emailSubject:"Új gazdálkodói bejelentés",emailMessage:`${farm.name}\n${field.name}\n${severityLabel}\n${title.trim()}${message.trim()?`\n\n${message.trim()}`:""}`});
 return{id:report.id};
}
