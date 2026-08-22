"use server";

import {createClient} from "@/lib/supabase/server";

export async function createFarmerReport(fieldId:string,title:string,message:string){
  const supabase=await createClient();
  const{data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error("A munkamenet lejárt. Jelentkezz be újra.");
  if(!fieldId||!title.trim())throw new Error("A földtábla és a bejelentés tárgya kötelező.");

  const{data:field}=await supabase.from("fields").select("id,farm_id").eq("id",fieldId).maybeSingle();
  if(!field)throw new Error("A földtábla nem található.");
  const{data:farm}=await supabase.from("farms").select("id").eq("id",field.farm_id).eq("owner_id",user.id).maybeSingle();
  if(!farm)throw new Error("Ehhez a földtáblához nincs jogosultságod.");

  const{data:report,error}=await supabase.from("farmer_reports").insert({field_id:fieldId,farmer_id:user.id,title:title.trim().slice(0,200),message:message.trim().slice(0,5000)||null}).select("id").single();
  if(error||!report)throw new Error(error?.message||"A bejelentés mentése sikertelen.");

  const{data:advisors}=await supabase.from("profiles").select("id").eq("role","advisor");
  if(advisors?.length){
    const href=`/fields/${fieldId}`;
    const rows=advisors.map(a=>({user_id:a.id,kind:"farmer_report",title:"Új gazdálkodói bejelentés",message:title.trim().slice(0,200),href}));
    const{error:notificationError}=await supabase.from("notifications").insert(rows);
    if(notificationError)console.error("Értesítés létrehozása sikertelen",notificationError);
    for(const advisor of advisors){try{await supabase.functions.invoke("send-notification-email",{body:{target_user_id:advisor.id,subject:"Új gazdálkodói bejelentés",message:`${title.trim()}${message.trim()?`\n\n${message.trim()}`:""}`,href}})}catch(error){console.error("E-mail értesítés sikertelen",error)}}
  }
  return {id:report.id};
}
