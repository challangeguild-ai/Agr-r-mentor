"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {validDateOnly} from "@/lib/operationInput";
import {createTaskOnce} from "@/lib/taskCreateIdempotency";
export async function createAssignedTask(formData:FormData){
 const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");const{data:me}=await supabase.from("profiles").select("role,system_role").eq("id",user.id).maybeSingle();if(me?.role!=="advisor"||me?.system_role==="admin")throw new Error("Szaktanácsadói jogosultság szükséges.");
 const farmId=String(formData.get("farm_id")||""),fieldId=String(formData.get("field_id")||""),assignedTo=String(formData.get("assigned_to")||""),title=String(formData.get("title")||"").trim(),description=String(formData.get("description")||"").trim(),dueDate=String(formData.get("due_date")||""),priority=String(formData.get("priority")||"normal");if(!farmId||!title)throw new Error("Gazdaság és teendő megadása kötelező.");if(title.length>180||description.length>3000)throw new Error("A teendő szövege túl hosszú.");if(dueDate&&!validDateOnly(dueDate))throw new Error("Érvénytelen határidő: létező naptári napot adj meg.");
 const{data:farm}=await supabase.from("farms").select("id,name,owner_id").eq("id",farmId).maybeSingle();if(!farm)throw new Error("A gazdaság nem található.");if(fieldId){const{data:field}=await supabase.from("fields").select("id,farm_id").eq("id",fieldId).maybeSingle();if(!field||field.farm_id!==farmId)throw new Error("A tábla nem ehhez a gazdasághoz tartozik.")}
 const target=assignedTo||farm.owner_id;if(target!==farm.owner_id){const{data:member}=await supabase.from("farm_members").select("id").eq("farm_id",farmId).eq("user_id",target).eq("active",true).maybeSingle();if(!member)throw new Error("A kiválasztott végrehajtó nem aktív tagja a gazdaságnak.")}
 const safePriority=["normal","high","urgent"].includes(priority)?priority:"normal";
 const{ id:taskId,alreadyExists}=await createTaskOnce(supabase,{
  farm_id:farmId,field_id:fieldId||null,title,description:description||null,
  due_date:dueDate||null,priority:safePriority,status:"open",
  assigned_to:target,created_by:user.id
 },String(formData.get("request_id")||""));
 if(alreadyExists)return{ok:true as const,id:taskId,warnings:["Ez a teendő már létrejött egy korábbi próbálkozáskor. Újabb értesítést nem küldtünk."]};
 // From here the primary task exists. Notification failures must never prompt
 // another task creation as if the first insert had failed.
 const warnings:string[]=[];
 const href=target===farm.owner_id?(fieldId?`/fields/${fieldId}`:"/tasks"):"/work";
 try{
  const{error:ne}=await supabase.from("notifications").insert({user_id:target,kind:"task",title:"Új munka a szaktanácsadótól",message:title,href,event_key:`task:${taskId}:advisor`});
  if(ne){console.error("Feladatértesítési hiba",ne);warnings.push("Az alkalmazáson belüli értesítés nem sikerült.")}
 }catch(e){console.error("Feladatértesítési hálózati hiba",e);warnings.push("Az alkalmazáson belüli értesítés nem ellenőrizhető.")}
 try{
  const{error:emailError}=await supabase.functions.invoke("send-notification-email",{body:{target_user_id:target,event_key:`task:${taskId}:advisor`,subject:safePriority==="urgent"?"Sürgős munka a szaktanácsadótól":"Új munka a szaktanácsadótól",message:`${title}${dueDate?`\nHatáridő: ${dueDate}`:""}${description?`\n${description}`:""}`,href}});
  if(emailError){console.error("Feladat e-mail-hiba",emailError);warnings.push("Az e-mail-értesítés nem sikerült.")}
 }catch(e){console.error("Feladat e-mail-hálózati hiba",e);warnings.push("Az e-mail-értesítés küldése nem ellenőrizhető.")}
 try{
  revalidatePath("/admin");revalidatePath("/admin/tasks");revalidatePath("/admin/workday");revalidatePath("/admin/priorities");revalidatePath(`/admin/clients/${farm.owner_id}`);revalidatePath(`/admin/clients/${farm.owner_id}/farms/${farmId}`);revalidatePath("/work");revalidatePath("/tasks");if(fieldId)revalidatePath(`/fields/${fieldId}`);
 }catch(e){console.error("Feladat mentés utáni cache-frissítési hiba",e);warnings.push("A listák frissülése késhet; az új teendő létrejött.")}
 return{ok:true as const,id:taskId,warnings};
}
