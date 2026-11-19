"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {parseContacts,validateContacts} from "@/lib/contactInput";
import {createFarmRecord} from "@/lib/farmCreation";

export async function createFarmWithContacts(formData:FormData){
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/login");
 const{data:me}=await supabase.from("profiles").select("role,system_role").eq("id",user.id).maybeSingle();
 if(me?.role!=="advisor"||me?.system_role==="admin")
  redirect(me?.system_role==="admin"?"/system-admin":"/dashboard");

 const owner_id=String(formData.get("owner_id")||"");
 const name=String(formData.get("name")||"").trim();
 const settlement=String(formData.get("settlement")||"").trim();
 const address=String(formData.get("address")||"").trim();
 const items=parseContacts(formData.get("contacts_json"));
 if(!owner_id||!name)throw new Error("Gazdálkodó és gazdaságnév kötelező.");
 if(name.length>120||settlement.length>120||address.length>250)
  throw new Error("Az egyik gazdasági adat túl hosszú.");
 validateContacts(items,true);
 const{data:owner}=await supabase.from("profiles").select("id,role").eq("id",owner_id).maybeSingle();
 if(!owner||owner.role!=="farmer")throw new Error("A kiválasztott ügyfél nem gazdálkodó.");

 const result=await createFarmRecord(supabase,{
  owner_id,name,settlement:settlement||null,address:address||null
 },items);
 try{
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${owner_id}`);
  revalidatePath(`/admin/clients/${owner_id}/farms/${result.id}`);
  revalidatePath("/admin/contacts");
 }catch(error){console.error("Gazdaság mentve, gyorsítótár frissítése sikertelen",error)}
 return{...result,ownerId:owner_id};
}
