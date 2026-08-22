"use server";

import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";

export async function registerDocument(input:{farm_id:string|null;field_id:string|null;title:string;category:string;notes:string|null;storage_path:string;file_name:string;media_type:string|null;file_size:number}){
  const supabase=await createClient();
  const{data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error("A munkamenet lejárt. Jelentkezz be újra.");
  if(!input.storage_path.startsWith(`${user.id}/`))throw new Error("Érvénytelen fájlútvonal.");
  if(!input.title.trim())throw new Error("A dokumentum megnevezése kötelező.");
  if(!input.farm_id&&!input.field_id)throw new Error("Gazdaság vagy földtábla kiválasztása kötelező.");

  const{data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
  const advisor=profile?.role==="advisor";
  let farmId=input.farm_id;

  if(input.field_id){
    const{data:field}=await supabase.from("fields").select("id,farm_id").eq("id",input.field_id).maybeSingle();
    if(!field)throw new Error("A földtábla nem található.");
    if(farmId&&field.farm_id!==farmId)throw new Error("A földtábla nem ehhez a gazdasághoz tartozik.");
    farmId=field.farm_id;
  }

  if(!farmId)throw new Error("A gazdaság nem azonosítható.");
  if(!advisor){
    const{data:farm}=await supabase.from("farms").select("id").eq("id",farmId).eq("owner_id",user.id).maybeSingle();
    if(!farm)throw new Error("Ehhez a gazdasághoz nincs jogosultságod.");
  }

  const allowed=["talajvizsgalat","permetezes","szerzodes","szamla","foto","egyeb"];
  const category=allowed.includes(input.category)?input.category:"egyeb";
  const{error}=await supabase.from("documents").insert({uploaded_by:user.id,farm_id:farmId,field_id:input.field_id||null,title:input.title.trim().slice(0,200),category,notes:input.notes?.trim().slice(0,500)||null,storage_path:input.storage_path,file_name:input.file_name.slice(0,255),media_type:input.media_type||null,file_size:input.file_size});
  if(error)throw new Error(error.message);
  return {ok:true};
}

export async function deleteDocument(documentId:string){
  const supabase=await createClient();
  const{data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error("A munkamenet lejárt. Jelentkezz be újra.");
  const{data:doc}=await supabase.from("documents").select("id,farm_id,storage_path,uploaded_by").eq("id",documentId).maybeSingle();
  if(!doc)throw new Error("A dokumentum nem található.");
  const{data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
  if(profile?.role!=="advisor"){
    const{data:farm}=await supabase.from("farms").select("id").eq("id",doc.farm_id).eq("owner_id",user.id).maybeSingle();
    if(!farm)throw new Error("Ehhez a dokumentumhoz nincs jogosultságod.");
  }
  const{error}=await supabase.from("documents").delete().eq("id",documentId);
  if(error)throw new Error(error.message);
  const storage=await supabase.storage.from("documents").remove([doc.storage_path]);
  if(storage.error)console.warn("A dokumentum rekordja törölve, a fájl takarítása sikertelen:",storage.error.message);
  revalidatePath("/documents");revalidatePath("/invoices");revalidatePath("/admin/documents");
  return {ok:true};
}
