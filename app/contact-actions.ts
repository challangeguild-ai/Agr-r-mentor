"use server";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {syncContactRows} from "@/lib/contactPersistence";
import {parseContacts,validateContacts} from "@/lib/contactInput";

export async function saveFarmContacts(formData:FormData){
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();
 if(!user)throw new Error("Jelentkezz be újra.");
 const farmId=String(formData.get("farm_id")||"");
 const items=parseContacts(formData.get("contacts_json"));
 validateContacts(items,true);
 const{data:me}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
 const{data:farm}=await supabase.from("farms").select("owner_id").eq("id",farmId).maybeSingle();
 if(!farm||(me?.role!=="advisor"&&farm.owner_id!==user.id))
  throw new Error("Nincs jogosultságod a kapcsolattartási adatok módosításához.");
 await syncContactRows(supabase,"farm_contacts","farm_id",farmId,items);
 try{
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${farm.owner_id}`);
  revalidatePath(`/admin/clients/${farm.owner_id}/farms/${farmId}`);
  revalidatePath("/farms");
 }catch(error){console.error("Mentett gazdasági kapcsolatok frissítési hiba",error)}
}

export async function saveProfileContacts(formData:FormData){
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();
 if(!user)throw new Error("Jelentkezz be újra.");
 const items=parseContacts(formData.get("contacts_json"));
 validateContacts(items,true);
 await syncContactRows(supabase,"profile_contacts","profile_id",user.id,items,{visible_to_counterparty:true});
 try{revalidatePath("/dashboard");revalidatePath("/admin")}
 catch(error){console.error("Mentett saját kapcsolatok frissítési hiba",error)}
}

export async function markCommunicationSeen(entityType:string,entityId:string){const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Jelentkezz be újra.");if(!["farmer_report","inspection","task","advisor_message"].includes(entityType)||!entityId)throw new Error("Érvénytelen kommunikációs elem.");const{error}=await supabase.rpc("mark_communication_seen",{p_entity_type:entityType,p_entity_id:entityId});if(error)throw new Error(error.message)}

export async function createPersonalFollowup(formData:FormData):Promise<{id:string}>{const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Jelentkezz be újra.");const entityType=String(formData.get("entity_type")||""),entityId=String(formData.get("entity_id")||""),title=String(formData.get("title")||"").trim(),href=String(formData.get("href")||"").trim(),when=String(formData.get("remind_at")||"");if(!["farmer_report","inspection","task","advisor_message"].includes(entityType)||!entityId||!title||!href)throw new Error("Hiányzó emlékeztető adat.");if(!href.startsWith("/"))throw new Error("Az emlékeztető hivatkozása érvénytelen.");const remindAt=new Date(when);if(Number.isNaN(remindAt.getTime())||remindAt.getTime()<=Date.now())throw new Error("Az emlékeztető időpontja legyen a jövőben.");const{data,error}=await supabase.from("personal_followups").insert({user_id:user.id,entity_type:entityType,entity_id:entityId,title:title.slice(0,180),href,remind_at:remindAt.toISOString()}).select("id").single();if(error){if(error.code==="23505"){const{data:existing}=await supabase.from("personal_followups").select("id").eq("user_id",user.id).eq("entity_type",entityType).eq("entity_id",entityId).eq("remind_at",remindAt.toISOString()).maybeSingle();if(existing)return{id:existing.id}}throw new Error(error.message)}revalidatePath("/notifications");return{id:data.id}}

export async function cancelPersonalFollowup(formData:FormData){const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Jelentkezz be újra.");const id=String(formData.get("followup_id")||"");if(!id)throw new Error("Hiányzó emlékeztető.");const{error}=await supabase.from("personal_followups").update({status:"cancelled",completed_at:new Date().toISOString()}).eq("id",id).eq("user_id",user.id).in("status",["pending","notified"]);if(error)throw new Error(error.message);revalidatePath("/notifications")}

export async function reschedulePersonalFollowup(formData:FormData){const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Jelentkezz be újra.");const id=String(formData.get("followup_id")||""),when=String(formData.get("remind_at")||"");const remindAt=new Date(when);if(!id||Number.isNaN(remindAt.getTime())||remindAt.getTime()<=Date.now())throw new Error("Érvényes jövőbeli időpont szükséges.");const{error}=await supabase.from("personal_followups").update({status:"pending",remind_at:remindAt.toISOString(),notified_at:null,completed_at:null}).eq("id",id).eq("user_id",user.id);if(error)throw new Error(error.message);revalidatePath("/notifications")}

export async function completePersonalFollowup(formData:FormData){const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Jelentkezz be újra.");const id=String(formData.get("followup_id")||"");const{error}=await supabase.from("personal_followups").update({status:"done",completed_at:new Date().toISOString()}).eq("id",id).eq("user_id",user.id);if(error)throw new Error(error.message);revalidatePath("/notifications")}
