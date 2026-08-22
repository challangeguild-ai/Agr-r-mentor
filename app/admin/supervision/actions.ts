"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {encodeSupervisionConfig,SUPERVISION_EVENT} from "@/lib/supervision";

function text(v:FormDataEntryValue|null,max:number){return String(v||"").trim().slice(0,max)}
export async function saveSupervisionConfig(formData:FormData){
 const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const{data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();if(profile?.role!=="advisor")throw new Error("Nincs jogosultság a beállítás módosításához.");
 const farmId=text(formData.get("farm_id"),100),activeFrom=text(formData.get("active_from"),5),activeTo=text(formData.get("active_to"),5),note=text(formData.get("note"),500),enabled=formData.get("enabled")==="on",interval=Math.max(1,Math.min(365,Number(formData.get("inspection_interval_days"))||30));
 if(!farmId)throw new Error("Válassz gazdaságot.");if(!/^\d{2}-\d{2}$/.test(activeFrom)||!/^\d{2}-\d{2}$/.test(activeTo))throw new Error("A szezon dátuma hibás.");
 const{data:farm}=await supabase.from("farms").select("id,name").eq("id",farmId).maybeSingle();if(!farm)throw new Error("A gazdaság nem található.");
 const description=encodeSupervisionConfig({activeFrom,activeTo,inspectionIntervalDays:interval,enabled,note:note||undefined});
 const{error}=await supabase.from("timeline_events").insert({farm_id:farmId,field_id:null,event_type:SUPERVISION_EVENT,title:`Szemlézési szezon: ${farm.name}`,description,event_at:new Date().toISOString(),created_by:user.id});if(error)throw new Error(error.message);
 revalidatePath("/admin/supervision");revalidatePath("/admin/priorities");revalidatePath("/admin/map");revalidatePath("/map");
}
