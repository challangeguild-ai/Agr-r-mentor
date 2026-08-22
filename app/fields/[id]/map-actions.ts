"use server";

import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";

export async function saveFieldBoundary(fieldId:string,centerLat:number|null,centerLng:number|null,boundary:any){
  const supabase=await createClient();
  const{data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error("Nincs bejelentkezve.");
  const{data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
  if(profile?.role!=="advisor")throw new Error("Nincs jogosultsága a táblahatár módosításához.");
  const payload={center_lat:centerLat,center_lng:centerLng,boundary_geojson:boundary,boundary_updated_at:boundary?new Date().toISOString():null};
  const{error}=await supabase.from("fields").update(payload).eq("id",fieldId);
  if(error)throw new Error(error.message);
  revalidatePath(`/fields/${fieldId}`);revalidatePath("/dashboard");revalidatePath("/admin");
}
