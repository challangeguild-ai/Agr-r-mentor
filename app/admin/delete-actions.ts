"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

async function requireAdvisor(){
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/login");
 const{data:profile}=await supabase.from("profiles").select("role,system_role").eq("id",user.id).maybeSingle();
 if(profile?.role!=="advisor"||profile?.system_role==="admin")redirect(profile?.system_role==="admin"?"/system-admin":"/dashboard");
 return{supabase,user};
}

function refresh(ownerId?:string){
 revalidatePath("/admin");
 revalidatePath("/admin/clients");
 revalidatePath("/admin/map");
 revalidatePath("/admin/workday");
 revalidatePath("/admin/priorities");
 if(ownerId)revalidatePath(`/admin/clients/${ownerId}`);
}

export async function deleteField(formData:FormData):Promise<void>{
 const{supabase}=await requireAdvisor();
 const fieldId=String(formData.get("field_id")||"").trim();
 if(!fieldId)throw new Error("Hiányzó földtábla-azonosító.");
 const{data:field,error:fieldError}=await supabase.from("fields").select("id,name,farm_id").eq("id",fieldId).maybeSingle();
 if(fieldError)throw new Error(fieldError.message);
 if(!field)throw new Error("A földtábla nem található vagy már törölve lett.");
 const{data:farm}=await supabase.from("farms").select("owner_id").eq("id",field.farm_id).maybeSingle();
 const{error}=await supabase.from("fields").delete().eq("id",fieldId);
 if(error)throw new Error(`A földtábla törlése sikertelen: ${error.message}`);
 refresh(farm?.owner_id||undefined);
}

export async function deleteFarm(formData:FormData):Promise<void>{
 const{supabase}=await requireAdvisor();
 const farmId=String(formData.get("farm_id")||"").trim();
 if(!farmId)throw new Error("Hiányzó gazdaság-azonosító.");
 const{data:farm,error:farmError}=await supabase.from("farms").select("id,name,owner_id").eq("id",farmId).maybeSingle();
 if(farmError)throw new Error(farmError.message);
 if(!farm)throw new Error("A gazdaság nem található vagy már törölve lett.");
 const{error}=await supabase.from("farms").delete().eq("id",farmId);
 if(error)throw new Error(`A gazdaság törlése sikertelen: ${error.message}`);
 refresh(farm.owner_id);
}
