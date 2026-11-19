"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {prepareFieldBatch,type IncomingField} from "@/lib/fieldBatchImport";

/** Creates one farm's validated fields in a single database INSERT statement. */
export async function importFarmFields(farmId:string,fields:IncomingField[]):Promise<{saved:number;firstId:string}>{
  const supabase=await createClient();
  const{data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login");
  const{data:profile,error:profileError}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
  if(profileError||profile?.role!=="advisor")throw new Error("Tömeges táblafelvitelhez szaktanácsadói jogosultság szükséges.");
  if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(farmId))throw new Error("Érvénytelen gazdaságazonosító.");
  const{data:farm,error:farmError}=await supabase.from("farms").select("id,owner_id").eq("id",farmId).maybeSingle();
  if(farmError||!farm)throw new Error("A kiválasztott gazdaság nem érhető el.");
  const{data:existing,error:existingError}=await supabase.from("fields").select("name,boundary_geojson").eq("farm_id",farmId).limit(1000);
  if(existingError||!existing)throw new Error("Nem ellenőrizhetők a gazdaság korábbi táblái. A mentés megszakadt.");
  if(existing.length>=1000)throw new Error("Túl sok meglévő tábla: a duplikációellenőrzés nem teljes. Az importot nem indítjuk el.");
  const prepared=prepareFieldBatch(fields,existing.map(field=>({name:field.name,geometry:field.boundary_geojson})));
  const now=new Date().toISOString();
  const rows=prepared.map(field=>({
    farm_id:farmId,
    name:field.name,
    area_ha:field.area_ha,
    crop_year:new Date().getFullYear(),
    center_lat:field.center_lat,
    center_lng:field.center_lng,
    boundary_geojson:field.geometry,
    boundary_updated_at:now,
    geometry_source:"external",
    geometry_source_updated_at:now,
  }));
  const{data:saved,error}=await supabase.from("fields").insert(rows).select("id");
  if(error)throw new Error(`A tömeges import nem sikerült: ${error.message}`);
  if(!saved||saved.length!==rows.length)throw new Error("A mentés eredménye nem ellenőrizhető. Mielőtt újra próbálkozol, nézd meg a gazdaság táblalistáját, nehogy duplikátum keletkezzen.");
  revalidatePath("/admin/map");revalidatePath("/admin/clients");revalidatePath(`/admin/clients/${farm.owner_id}/farms/${farmId}`);
  revalidatePath("/fields");revalidatePath("/map");revalidatePath("/dashboard");
  return {saved:saved.length,firstId:saved[0].id};
}
