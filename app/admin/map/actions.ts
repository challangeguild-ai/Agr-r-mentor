"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

export async function saveParcelIdentity(formData:FormData){
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const{data:me}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();if(me?.role!=="advisor")throw new Error("Csak szaktanácsadó módosíthatja a földrészlet-azonosítókat.");
 const fieldId=String(formData.get("field_id")||"").trim();
 const settlement=String(formData.get("settlement")||"").trim();
 const parcelNumber=String(formData.get("parcel_number")||"").trim();
 const meparBlock=String(formData.get("mepar_block_id")||"").trim();
 const externalId=String(formData.get("external_parcel_id")||"").trim();
 if(!fieldId)throw new Error("Hiányzó földtábla.");
 if(parcelNumber&&!settlement)throw new Error("Helyrajzi szám mellé települést is meg kell adni.");
 if(settlement.length>120||parcelNumber.length>80||meparBlock.length>80||externalId.length>160)throw new Error("Az egyik földrészlet-azonosító túl hosszú.");
 const{error}=await supabase.from("fields").update({settlement:settlement||null,parcel_number:parcelNumber||null,mepar_block_id:meparBlock||null,external_parcel_id:externalId||null}).eq("id",fieldId);
 if(error)throw new Error(error.message);
 revalidatePath("/admin/map");revalidatePath(`/fields/${fieldId}`);revalidatePath("/map");
}
