"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {parseMachineMeasurements} from "@/lib/machinery";

async function canManageFarm(supabase:any,userId:string,farmId:string){
 const{data:farm,error:farmError}=await supabase.from("farms").select("owner_id").eq("id",farmId).maybeSingle();
 if(farmError||!farm)return false;
 if(farm.owner_id===userId)return true;
 const{data:profile}=await supabase.from("profiles").select("role").eq("id",userId).maybeSingle();
 if(profile?.role==="advisor")return true;
 const{data:member}=await supabase.from("farm_members").select("id").eq("farm_id",farmId).eq("user_id",userId).eq("active",true).in("member_role",["manager","agronomist"]).maybeSingle();
 return!!member;
}

export async function saveMachine(formData:FormData){
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/login");
 const id=String(formData.get("id")||"");
 const farmId=String(formData.get("farm_id")||"");
 const name=String(formData.get("name")||"").trim();
 const machineType=String(formData.get("machine_type")||"other");
 if(!farmId||!name)throw new Error("Gazdaság és gépnév kötelező.");
 if(!(await canManageFarm(supabase,user.id,farmId)))throw new Error("Nincs jogosultságod ehhez a gépparkhoz.");
 const{currentHours,currentHectares,serviceIntervalHours,nextServiceHours}=parseMachineMeasurements(formData);
 const payload={
  farm_id:farmId,
  name:name.slice(0,120),
  machine_type:["tractor","combine","sprayer","implement","loader","other"].includes(machineType)?machineType:"other",
  manufacturer:String(formData.get("manufacturer")||"").trim()||null,
  model:String(formData.get("model")||"").trim()||null,
  registration_no:String(formData.get("registration_no")||"").trim()||null,
  serial_no:String(formData.get("serial_no")||"").trim()||null,
  notes:String(formData.get("notes")||"").trim()||null,
  current_hours:currentHours,
  current_hectares:currentHectares,
  service_interval_hours:serviceIntervalHours,
  next_service_hours:nextServiceHours,
  updated_at:new Date().toISOString(),
 };
 if(id){
  const{data:existing,error:existingError}=await supabase.from("machines").select("farm_id").eq("id",id).maybeSingle();
  if(existingError||!existing||existing.farm_id!==farmId)throw new Error("A gép nem található.");
  const{data:updated,error}=await supabase.from("machines").update(payload).eq("id",id).eq("farm_id",farmId).select("id").maybeSingle();
  if(error)throw new Error(error.message);
  if(!updated)throw new Error("A gép közben módosult vagy már nem érhető el. Ellenőrizd a listát.");
 }else{
  const{error}=await supabase.from("machines").insert(payload);
  if(error)throw new Error(error.message);
 }
 revalidatePath("/machines");revalidatePath("/dispatch");revalidatePath("/admin/machines");
}

export async function toggleMachine(formData:FormData){
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/login");
 const id=String(formData.get("id")||"");
 const{data:machine}=await supabase.from("machines").select("id,farm_id,active").eq("id",id).maybeSingle();
 if(!machine||!(await canManageFarm(supabase,user.id,machine.farm_id)))throw new Error("Nincs jogosultságod ehhez a géphez.");
 const{data:updated,error}=await supabase.from("machines").update({active:!machine.active,updated_at:new Date().toISOString()}).eq("id",id).eq("farm_id",machine.farm_id).eq("active",machine.active).select("id").maybeSingle();
 if(error)throw new Error(error.message);
 if(!updated)throw new Error("A gép állapota közben megváltozott. Frissítsd a listát.");
 revalidatePath("/machines");revalidatePath("/dispatch");revalidatePath("/admin/machines");
}
