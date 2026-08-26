"use server";

import {createClient} from "@/lib/supabase/server";
import {notifyAdvisors} from "@/lib/workflowNotifications";

export async function createFarmerReport(fieldId:string,title:string,message:string){
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();
 if(!user)throw new Error("A munkamenet lejárt. Jelentkezz be újra.");
 if(!fieldId||!title.trim())throw new Error("A földtábla és a bejelentés tárgya kötelező.");
 const{data:field}=await supabase.from("fields").select("id,farm_id,name").eq("id",fieldId).maybeSingle();
 if(!field)throw new Error("A földtábla nem található.");
 const{data:farm}=await supabase.from("farms").select("id,name").eq("id",field.farm_id).eq("owner_id",user.id).maybeSingle();
 if(!farm)throw new Error("Ehhez a földtáblához nincs jogosultságod.");
 const{data:report,error}=await supabase.from("farmer_reports").insert({field_id:fieldId,farmer_id:user.id,title:title.trim().slice(0,200),message:message.trim().slice(0,5000)||null}).select("id").single();
 if(error||!report)throw new Error(error?.message||"A bejelentés mentése sikertelen.");
 const href=`/admin/reports?view=new`;
 await notifyAdvisors(supabase,{kind:"farmer_report",title:"Új gazdálkodói bejelentés",message:`${farm.name} · ${field.name} · ${title.trim().slice(0,200)}`,href,eventKey:`report:${report.id}:created`,emailSubject:"Új gazdálkodói bejelentés",emailMessage:`${farm.name}\n${field.name}\n${title.trim()}${message.trim()?`\n\n${message.trim()}`:""}`});
 return{id:report.id};
}
