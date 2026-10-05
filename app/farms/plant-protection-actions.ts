"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

function text(v:FormDataEntryValue|null,max:number){return String(v||"").trim().slice(0,max)}
function uuid(v:string){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)}

async function ownerContext(){const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");const{data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();if(profile?.role==="advisor")throw new Error("A szaktanácsadó nem kezelheti a gazdaság növényvédelmi jóváhagyóit.");return{supabase,user}}

export async function savePlantProtectionApprover(formData:FormData){
 const{supabase,user}=await ownerContext();
 const farmId=text(formData.get("farm_id"),100),personId=text(formData.get("user_id"),100);
 if(!uuid(farmId)||!uuid(personId))throw new Error("Érvénytelen gazdaság vagy személy.");
 const{data:farm}=await supabase.from("farms").select("id,owner_id").eq("id",farmId).maybeSingle();
 if(!farm||farm.owner_id!==user.id)throw new Error("Csak a saját gazdaságod jóváhagyóit kezelheted.");
 const{data:person}=await supabase.from("profiles").select("id,role").eq("id",personId).maybeSingle();
 if(!person||person.role==="advisor")throw new Error("Szaktanácsadó nem jelölhető gazdasági jóváhagyónak.");
 if(personId!==farm.owner_id){
  const{data:member}=await supabase.from("farm_members").select("id").eq("farm_id",farmId).eq("user_id",personId).eq("active",true).maybeSingle();
  if(!member)throw new Error("A kijelölt személy nem aktív tagja ennek a gazdaságnak.");
 }
 const today=new Date().toISOString().slice(0,10);
 const{data:license}=await supabase.from("profile_plant_protection_licenses").select("authorization_level,permit_number,valid_until,active").eq("user_id",personId).eq("active",true).maybeSingle();
 if(!license)throw new Error("A kijelölt személy saját profiljában nincs aktív növényvédelmi jogosultság.");
 if(!license.valid_until||license.valid_until<today)throw new Error("A kijelölt személy növényvédelmi jogosultsága lejárt.");
 const{error}=await supabase.from("farm_plant_protection_approvers").upsert({farm_id:farmId,user_id:personId,authorization_level:license.authorization_level,permit_number:license.permit_number,valid_until:license.valid_until,active:true,created_by:user.id,updated_at:new Date().toISOString()},{onConflict:"farm_id,user_id"});
 if(error)throw new Error(error.message);
 revalidatePath("/farms");revalidatePath("/operations");
}

export async function deactivatePlantProtectionApprover(formData:FormData){const{supabase,user}=await ownerContext();const id=text(formData.get("id"),100);if(!uuid(id))throw new Error("Érvénytelen jogosultság.");const{data:row}=await supabase.from("farm_plant_protection_approvers").select("id,farm_id").eq("id",id).maybeSingle();if(!row)throw new Error("A jogosultság nem található.");const{data:farm}=await supabase.from("farms").select("owner_id").eq("id",row.farm_id).maybeSingle();if(!farm||farm.owner_id!==user.id)throw new Error("Nincs jogosultságod ehhez a gazdasághoz.");const{error}=await supabase.from("farm_plant_protection_approvers").update({active:false,updated_at:new Date().toISOString()}).eq("id",id);if(error)throw new Error(error.message);revalidatePath("/farms");revalidatePath("/operations")}
